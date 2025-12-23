# app/adminRoutes.py
from __future__ import annotations

import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, delete, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from .db import getDb
from .adminAuth import requireAdmin

from .models import (
    PollCategory,
    PollTemplate,
    PollTemplateOption,
    PollInstance,
    PollPlan,
    PollPlanOption,
)
from .rollover import ensureInstancesForDate

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(requireAdmin)],
)

# -----------------------------
# Pydantic Schemas (camelCase)
# -----------------------------

class CategoryCreateInput(BaseModel):
    key: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9\-]+$")
    name: str = Field(min_length=2, max_length=128)
    sortOrder: int = 0

class CategoryUpdateInput(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=128)
    sortOrder: int | None = None

class OptionInput(BaseModel):
    label: str = Field(min_length=1, max_length=256)
    sortOrder: int = 0

PollType = Literal["SINGLE", "RANKED"]
Audience = Literal["PUBLIC", "USER_ONLY"]

class TemplateCreateInput(BaseModel):
    categoryId: str
    key: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9\-]+$")
    title: str = Field(min_length=2, max_length=256)
    question: str | None = Field(default=None, max_length=1000)

    pollType: PollType
    maxRank: int | None = Field(default=None, ge=1)
    audience: Audience = "PUBLIC"

    options: list[OptionInput] = Field(min_length=2)

class TemplateUpdateInput(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=256)
    question: str | None = Field(default=None, max_length=1000)
    pollType: PollType | None = None
    maxRank: int | None = Field(default=None, ge=1)
    audience: Audience | None = None

class TemplateActiveInput(BaseModel):
    isActive: bool

class TemplateReplaceOptionsInput(BaseModel):
    options: list[OptionInput] = Field(min_length=2)

class PlanUpsertInput(BaseModel):
    pollDate: date
    isEnabled: bool = True
    questionOverride: str | None = Field(default=None, max_length=1000)

class PlanReplaceOptionsInput(BaseModel):
    pollDate: date
    options: list[OptionInput] = Field(min_length=2)

# -----------------------------
# Helpers
# -----------------------------

def newId() -> str:
    return str(uuid.uuid4())

def serializeCategory(category: PollCategory) -> dict:
    return {
        "id": category.id,
        "key": category.key,
        "name": category.name,
        "sortOrder": category.sortOrder,
    }

def serializeTemplate(template: PollTemplate, includeOptions: bool = False) -> dict:
    data = {
        "id": template.id,
        "categoryId": template.categoryId,
        "key": template.key,
        "title": template.title,
        "question": template.question,
        "pollType": template.pollType,
        "maxRank": template.maxRank,
        "audience": template.audience,
        "isActive": template.isActive,
    }
    if includeOptions:
        options = sorted(template.defaultOptions or [], key=lambda o: o.sortOrder)
        data["options"] = [{"id": o.id, "label": o.label, "sortOrder": o.sortOrder} for o in options]
    return data

def serializePlan(plan: PollPlan, options: list[PollPlanOption]) -> dict:
    return {
        "id": plan.id,
        "templateId": plan.templateId,
        "pollDate": str(plan.pollDate),
        "isEnabled": plan.isEnabled,
        "questionOverride": plan.questionOverride,
        "options": [{"id": o.id, "label": o.label, "sortOrder": o.sortOrder} for o in sorted(options, key=lambda x: x.sortOrder)],
    }

# -----------------------------
# Category Routes
# -----------------------------

@router.post("/categories")
async def createCategory(payload: CategoryCreateInput, db: AsyncSession = Depends(getDb)):
    existing = (await db.execute(select(PollCategory).where(PollCategory.key == payload.key))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Category key already exists")

    category = PollCategory(
        id=newId(),
        key=payload.key,
        name=payload.name,
        sortOrder=payload.sortOrder,
    )
    db.add(category)
    await db.commit()
    return {"ok": True, "category": serializeCategory(category)}

@router.get("/categories")
async def listCategories(db: AsyncSession = Depends(getDb)):
    rows = (await db.execute(select(PollCategory).order_by(PollCategory.sortOrder, PollCategory.name))).scalars().all()
    return {"categories": [serializeCategory(c) for c in rows]}

@router.patch("/categories/{categoryId}")
async def updateCategory(categoryId: str, payload: CategoryUpdateInput, db: AsyncSession = Depends(getDb)):
    category = (await db.execute(select(PollCategory).where(PollCategory.id == categoryId))).scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    if payload.name is not None:
        category.name = payload.name
    if payload.sortOrder is not None:
        category.sortOrder = payload.sortOrder

    await db.commit()
    return {"ok": True, "category": serializeCategory(category)}

# -----------------------------
# Template Routes
# -----------------------------

@router.post("/templates")
async def createTemplate(payload: TemplateCreateInput, db: AsyncSession = Depends(getDb)):
    # validate category exists
    category = (await db.execute(select(PollCategory).where(PollCategory.id == payload.categoryId))).scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # enforce unique (categoryId, key)
    existing = (await db.execute(
        select(PollTemplate).where(PollTemplate.categoryId == payload.categoryId, PollTemplate.key == payload.key)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Template key already exists in this category")

    if payload.pollType == "RANKED" and payload.maxRank is not None and payload.maxRank < 2:
        raise HTTPException(status_code=422, detail="maxRank must be >= 2 for ranked polls")

    template = PollTemplate(
        id=newId(),
        categoryId=payload.categoryId,
        key=payload.key,
        title=payload.title,
        question=payload.question,
        pollType=payload.pollType,
        maxRank=payload.maxRank,
        audience=payload.audience,
        isActive=True,
    )
    db.add(template)
    await db.flush()

    # replace default options (create)
    for opt in payload.options:
        db.add(PollTemplateOption(
            id=newId(),
            templateId=template.id,
            label=opt.label,
            sortOrder=opt.sortOrder,
        ))

    await db.commit()

    template = (await db.execute(
        select(PollTemplate).where(PollTemplate.id == template.id).options(selectinload(PollTemplate.defaultOptions))
    )).scalar_one()

    return {"ok": True, "template": serializeTemplate(template, includeOptions=True)}

@router.get("/templates")
async def listTemplates(
    db: AsyncSession = Depends(getDb),
    categoryId: str | None = Query(default=None),
    isActive: bool | None = Query(default=None),
):
    stmt = select(PollTemplate).order_by(PollTemplate.categoryId, PollTemplate.key)
    if categoryId:
        stmt = stmt.where(PollTemplate.categoryId == categoryId)
    if isActive is not None:
        stmt = stmt.where(PollTemplate.isActive == isActive)

    templates = (await db.execute(stmt)).scalars().all()
    return {"templates": [serializeTemplate(t, includeOptions=False) for t in templates]}

@router.get("/templates/{templateId}")
async def getTemplate(templateId: str, db: AsyncSession = Depends(getDb)):
    template = (await db.execute(
        select(PollTemplate)
        .where(PollTemplate.id == templateId)
        .options(selectinload(PollTemplate.defaultOptions))
    )).scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"template": serializeTemplate(template, includeOptions=True)}

@router.patch("/templates/{templateId}")
async def updateTemplate(templateId: str, payload: TemplateUpdateInput, db: AsyncSession = Depends(getDb)):
    template = (await db.execute(select(PollTemplate).where(PollTemplate.id == templateId))).scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if payload.title is not None:
        template.title = payload.title
    if payload.question is not None:
        template.question = payload.question
    if payload.pollType is not None:
        template.pollType = payload.pollType
    if payload.maxRank is not None:
        template.maxRank = payload.maxRank
    if payload.audience is not None:
        template.audience = payload.audience

    if template.pollType == "RANKED" and template.maxRank is not None and template.maxRank < 2:
        raise HTTPException(status_code=422, detail="maxRank must be >= 2 for ranked polls")

    await db.commit()
    return {"ok": True, "template": serializeTemplate(template, includeOptions=False)}

@router.patch("/templates/{templateId}/active")
async def setTemplateActive(templateId: str, payload: TemplateActiveInput, db: AsyncSession = Depends(getDb)):
    template = (await db.execute(select(PollTemplate).where(PollTemplate.id == templateId))).scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    template.isActive = payload.isActive
    await db.commit()
    return {"ok": True, "template": serializeTemplate(template, includeOptions=False)}

@router.put("/templates/{templateId}/options")
async def replaceTemplateOptions(templateId: str, payload: TemplateReplaceOptionsInput, db: AsyncSession = Depends(getDb)):
    template = (await db.execute(select(PollTemplate).where(PollTemplate.id == templateId))).scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # delete existing
    await db.execute(delete(PollTemplateOption).where(PollTemplateOption.templateId == templateId))

    # insert new
    for opt in payload.options:
        db.add(PollTemplateOption(
            id=newId(),
            templateId=templateId,
            label=opt.label,
            sortOrder=opt.sortOrder,
        ))

    await db.commit()
    return {"ok": True, "templateId": templateId, "optionCount": len(payload.options)}

# -----------------------------
# Plan Routes (per-date overrides)
# -----------------------------

@router.put("/templates/{templateId}/plan")
async def upsertPlan(templateId: str, payload: PlanUpsertInput, db: AsyncSession = Depends(getDb)):
    # validate template exists
    template = (await db.execute(select(PollTemplate).where(PollTemplate.id == templateId))).scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    plan = (await db.execute(
        select(PollPlan).where(PollPlan.templateId == templateId, PollPlan.pollDate == payload.pollDate)
    )).scalar_one_or_none()

    if not plan:
        plan = PollPlan(
            id=newId(),
            templateId=templateId,
            pollDate=payload.pollDate,
            isEnabled=payload.isEnabled,
            questionOverride=payload.questionOverride,
        )
        db.add(plan)
    else:
        plan.isEnabled = payload.isEnabled
        plan.questionOverride = payload.questionOverride

    await db.commit()
    return {"ok": True, "planId": plan.id}

@router.put("/templates/{templateId}/plan/options")
async def replacePlanOptions(templateId: str, payload: PlanReplaceOptionsInput, db: AsyncSession = Depends(getDb)):
    # ensure template exists
    template = (await db.execute(select(PollTemplate).where(PollTemplate.id == templateId))).scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # ensure plan exists
    plan = (await db.execute(
        select(PollPlan).where(PollPlan.templateId == templateId, PollPlan.pollDate == payload.pollDate)
    )).scalar_one_or_none()

    if not plan:
        plan = PollPlan(
            id=newId(),
            templateId=templateId,
            pollDate=payload.pollDate,
            isEnabled=True,
            questionOverride=None,
        )
        db.add(plan)
        await db.flush()

    # delete existing plan options
    await db.execute(delete(PollPlanOption).where(PollPlanOption.planId == plan.id))

    # insert new plan options
    for opt in payload.options:
        db.add(PollPlanOption(
            id=newId(),
            planId=plan.id,
            label=opt.label,
            sortOrder=opt.sortOrder,
        ))

    await db.commit()
    return {"ok": True, "planId": plan.id, "optionCount": len(payload.options)}

@router.get("/templates/{templateId}/plan")
async def getPlan(templateId: str, pollDate: date = Query(...), db: AsyncSession = Depends(getDb)):
    plan = (await db.execute(
        select(PollPlan).where(PollPlan.templateId == templateId, PollPlan.pollDate == pollDate)
    )).scalar_one_or_none()

    if not plan:
        return {"plan": None}

    options = (await db.execute(
        select(PollPlanOption).where(PollPlanOption.planId == plan.id)
    )).scalars().all()

    return {"plan": serializePlan(plan, options)}

# -----------------------------
# Instance visibility + manual rollover
# -----------------------------

@router.get("/instances")
async def listInstances(pollDate: date = Query(...), db: AsyncSession = Depends(getDb)):
    instances = (await db.execute(
        select(PollInstance)
        .where(PollInstance.pollDate == pollDate)
        .options(selectinload(PollInstance.options))
        .order_by(PollInstance.templateId)
    )).scalars().all()

    return {
        "pollDate": str(pollDate),
        "instances": [
            {
                "id": i.id,
                "templateId": i.templateId,
                "pollDate": str(i.pollDate),
                "question": i.question,
                "pollType": i.pollType,
                "maxRank": i.maxRank,
                "audience": i.audience,
                "status": i.status,
                "options": [{"id": o.id, "label": o.label, "sortOrder": o.sortOrder} for o in sorted(i.options, key=lambda x: x.sortOrder)],
            }
            for i in instances
        ],
    }

@router.post("/rollover")
async def runRollover(pollDate: date = Query(...), db: AsyncSession = Depends(getDb)):
    createdCount = await ensureInstancesForDate(db, pollDate)
    return {"ok": True, "pollDate": str(pollDate), "createdCount": createdCount}
