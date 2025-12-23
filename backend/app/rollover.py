# app/rollover.py
from __future__ import annotations

import uuid
from datetime import date
from typing import Dict, List, Tuple

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    PollTemplate,
    PollTemplateOption,
    PollInstance,
    PollInstanceOption,
    PollPlan,
    PollPlanOption,
)

def newId() -> str:
    return str(uuid.uuid4())


async def ensureInstancesForDate(db: AsyncSession, pollDate: date) -> int:
    """
    Create PollInstance rows for all active templates for the given pollDate,
    applying any PollPlan overrides for that date.

    Returns:
        createdCount: number of PollInstance rows created
    """

    # 1) Load active templates + default options
    templates: List[PollTemplate] = (await db.execute(
        select(PollTemplate)
        .where(PollTemplate.isActive == True)  # noqa: E712
        .options(selectinload(PollTemplate.defaultOptions))
    )).scalars().all()

    if not templates:
        return 0

    templateIds = [t.id for t in templates]

    # 2) Load plans for this pollDate for those templates + plan options
    plans: List[PollPlan] = (await db.execute(
        select(PollPlan)
        .where(PollPlan.templateId.in_(templateIds))
        .where(PollPlan.pollDate == pollDate)
        .options(selectinload(PollPlan.options))
    )).scalars().all()

    planByTemplateId: Dict[str, PollPlan] = {p.templateId: p for p in plans}

    # 3) Load existing instances for this date (idempotency)
    existingInstances: List[PollInstance] = (await db.execute(
        select(PollInstance)
        .where(PollInstance.templateId.in_(templateIds))
        .where(PollInstance.pollDate == pollDate)
    )).scalars().all()

    existingTemplateIds = {i.templateId for i in existingInstances}

    createdCount = 0

    # 4) Create missing instances
    for template in templates:
        # If already exists, do nothing (preserve snapshot integrity)
        if template.id in existingTemplateIds:
            continue

        plan = planByTemplateId.get(template.id)
        if plan is not None and plan.isEnabled is False:
            # Explicitly skipped for this date
            continue

        question = template.question
        if plan is not None and plan.questionOverride:
            question = plan.questionOverride

        optionInputs = chooseInstanceOptions(template, plan)

        instanceId = newId()
        instance = PollInstance(
            id=instanceId,
            templateId=template.id,
            categoryId=template.categoryId,
            pollDate=pollDate,
            title=template.title,
            question=question,
            pollType=template.pollType,
            maxRank=template.maxRank,
            audience=template.audience,
            status="OPEN",
        )
        db.add(instance)

        for opt in optionInputs:
            db.add(PollInstanceOption(
                id=newId(),
                instanceId=instanceId,
                label=opt["label"],
                sortOrder=opt["sortOrder"],
            ))

        createdCount += 1

    await db.commit()
    return createdCount


def chooseInstanceOptions(template: PollTemplate, plan: PollPlan | None) -> List[dict]:
    """
    Returns the options list to use for an instance:
    - if plan has options: use plan.options
    - else use template.defaultOptions

    Output format:
      [{"label": "...", "sortOrder": 1}, ...]
    """
    if plan is not None and plan.options and len(plan.options) > 0:
        planOptions = sorted(plan.options, key=lambda o: o.sortOrder)
        return [{"label": o.label, "sortOrder": o.sortOrder} for o in planOptions]

    defaultOptions = sorted(template.defaultOptions or [], key=lambda o: o.sortOrder)
    return [{"label": o.label, "sortOrder": o.sortOrder} for o in defaultOptions]
