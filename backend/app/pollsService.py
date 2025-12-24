# app/pollsService.py
from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from .models import PollCategory, PollInstance


async def buildPollsForDate(db: AsyncSession, pollDate: date) -> dict[str, Any]:
    # Load categories (for sort + name) and instances for the date
    categories = (await db.execute(
        select(PollCategory).order_by(PollCategory.sortOrder, PollCategory.name)
    )).scalars().all()

    instances = (await db.execute(
        select(PollInstance)
        .where(PollInstance.pollDate == pollDate)
        # MVP: only show public polls
        .where(PollInstance.audience == "PUBLIC")
        .options(selectinload(PollInstance.options))
        .order_by(PollInstance.categoryId, PollInstance.templateId)
    )).scalars().all()

    instancesByCategoryId: dict[str, list[PollInstance]] = {}
    for inst in instances:
        instancesByCategoryId.setdefault(inst.categoryId, []).append(inst)

    categoryBlocks: list[dict[str, Any]] = []
    for cat in categories:
        catInstances = instancesByCategoryId.get(cat.id, [])
        if not catInstances:
            continue

        polls = []
        for inst in catInstances:
            options = sorted(inst.options or [], key=lambda o: o.sortOrder)
            polls.append({
                "pollId": inst.id,
                "templateId": inst.templateId,
                "pollDate": str(inst.pollDate),
                "title": inst.title,
                "question": inst.question,
                "pollType": inst.pollType,
                "maxRank": inst.maxRank,
                "audience": inst.audience,
                "status": inst.status,
                "options": [
                    {"optionId": o.id, "label": o.label, "sortOrder": o.sortOrder}
                    for o in options
                ],
            })

        categoryBlocks.append({
            "categoryId": cat.id,
            "categoryKey": cat.key,
            "categoryName": cat.name,
            "sortOrder": cat.sortOrder,
            "polls": polls,
        })

    return {
        "pollDate": str(pollDate),
        "categories": categoryBlocks,
    }
