# app/adminRoutes.py
from __future__ import annotations

import uuid
import re
from datetime import date
from typing import Literal, TYPE_CHECKING

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, delete, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from .db import getDb
from .adminAuth import requireAdmin, AdminContext
from .closeService import closeAndSnapshotForDate
from . import sanitize
from .auditLog import logAdminAction
from .aiContext import generatePollContext

from .models import (
    PollCategory,
    PollTemplate,
    PollTemplateOption,
    PollInstance,
    PollPlan,
    PollPlanOption,
    PresetOptionSet,
)
from .rollover import ensureInstancesForDate


async def generateUniqueTemplateKey(db: AsyncSession, categoryId: str, title: str) -> str:
    """
    Generate a unique template key from the category key and title.
    Format: {category-key}-{short-title-slug}
    Keeps keys short for URLs by taking only first few words of title.
    If key exists, appends a number (e.g., 'politics-approval-2').
    """
    # Get category to use its key as prefix
    category = (await db.execute(
        select(PollCategory).where(PollCategory.id == categoryId)
    )).scalar_one_or_none()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Use category key as prefix
    category_prefix = category.key
    
    # Convert title to slug
    title_slug = re.sub(r'[^a-z0-9\s-]', '', title.lower())
    title_slug = re.sub(r'\s+', '-', title_slug.strip())
    title_slug = re.sub(r'-+', '-', title_slug)  # Collapse multiple hyphens
    
    if not title_slug:
        title_slug = "poll"
    
    # Take only first 2-3 words or limit to 25 chars to keep URLs short
    words = title_slug.split('-')
    if len(words) > 3:
        title_slug = '-'.join(words[:3])
    
    # Limit title portion to 25 characters max
    if len(title_slug) > 25:
        title_slug = title_slug[:25].rstrip('-')
    
    # Combine category and title (total should be under 45 chars typically)
    base_key = f"{category_prefix}-{title_slug}"
    
    # Check if key exists
    key = base_key
    counter = 2
    
    while True:
        existing = (await db.execute(
            select(PollTemplate).where(
                PollTemplate.categoryId == categoryId,
                PollTemplate.key == key
            )
        )).scalar_one_or_none()
        
        if not existing:
            return key
        
        # Key exists, try with number suffix
        key = f"{base_key}-{counter}"
        counter += 1
        
        # Safety limit to prevent infinite loop
        if counter > 1000:
            # Fallback to UUID-based key
            return f"{base_key}-{uuid.uuid4().hex[:8]}"

from .schemas import (
    ImportDataInput,
    CreatePresetInput,
    UpdatePresetInput,
    PresetOptionSetResponse,
    PresetListResponse,
)

if TYPE_CHECKING:
    pass

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    # Note: requireAdmin now returns AdminContext, so endpoints should accept it as dependency
)

# -----------------------------
# Pydantic Schemas (camelCase)
# -----------------------------

class CategoryCreateInput(BaseModel):
    key: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9\-]+$")
    name: str = Field(min_length=2, max_length=128)
    sortOrder: int = 0
    parentCategoryId: str | None = None

class CategoryUpdateInput(BaseModel):
    key: str | None = Field(default=None, min_length=2, max_length=64, pattern=r"^[a-z0-9\-]+$")
    name: str | None = Field(default=None, min_length=2, max_length=128)
    sortOrder: int | None = None
    parentCategoryId: str | None = None

class OptionInput(BaseModel):
    label: str = Field(min_length=1, max_length=256)
    sortOrder: int = 0

PollType = Literal["SINGLE", "RANKED"]
Audience = Literal["PUBLIC", "USER_ONLY"]

class TemplateCreateInput(BaseModel):
    categoryId: str
    title: str = Field(min_length=2, max_length=256)
    question: str | None = Field(default=None, max_length=1000)

    pollType: PollType
    maxRank: int | None = Field(default=None, ge=1)
    audience: Audience = "PUBLIC"
    durationDays: int = Field(default=1, ge=1, le=365)  # How many days poll stays open

    options: list[OptionInput] = Field(min_length=2)

class TemplateUpdateInput(BaseModel):
    categoryId: str | None = None
    key: str | None = Field(default=None, min_length=2, max_length=64)
    title: str | None = Field(default=None, min_length=2, max_length=256)
    question: str | None = Field(default=None, max_length=1000)
    contextText: str | None = Field(default=None)
    pollType: PollType | None = None
    maxRank: int | None = Field(default=None, ge=1)
    audience: Audience | None = None
    durationDays: int | None = Field(default=None, ge=1, le=365)
    featured: bool | None = None

class TemplateActiveInput(BaseModel):
    isActive: bool

class TemplateFeaturedInput(BaseModel):
    featured: bool

class InstanceUpdateInput(BaseModel):
    categoryId: str | None = None

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
    # Safely access subCategories with try/except to prevent lazy loading errors
    subCategories = []
    try:
        if hasattr(category, 'subCategories') and category.subCategories is not None:
            subCategories = [serializeCategory(sub) for sub in category.subCategories]
    except:
        # If lazy loading fails, just skip subcategories
        pass
    
    return {
        "id": category.id,
        "key": category.key,
        "name": category.name,
        "sortOrder": category.sortOrder,
        "parentCategoryId": category.parentCategoryId,
        "subCategories": subCategories,
    }

def serializeTemplate(template: PollTemplate, includeOptions: bool = False) -> dict:
    data = {
        "id": template.id,
        "categoryId": template.categoryId,
        "key": template.key,
        "title": template.title,
        "question": template.question,
        "contextText": template.contextText,
        "pollType": template.pollType,
        "maxRank": template.maxRank,
        "audience": template.audience,
        "durationDays": template.durationDays,
        "isActive": template.isActive,
        "featured": template.featured,
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
async def createCategory(
    payload: CategoryCreateInput,
    db: AsyncSession = Depends(getDb),
    admin: AdminContext = Depends(requireAdmin)
):
    # Sanitize inputs
    sanitizedKey = sanitize.sanitizeKey(payload.key, maxLength=64)
    sanitizedName = sanitize.sanitizeName(payload.name, maxLength=128)
    
    existing = (await db.execute(select(PollCategory).where(PollCategory.key == sanitizedKey))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Category key already exists")

    category = PollCategory(
        id=newId(),
        key=sanitizedKey,
        name=sanitizedName,
        sortOrder=payload.sortOrder,
        parentCategoryId=payload.parentCategoryId,
    )
    db.add(category)
    
    # Audit log
    await logAdminAction(
        db=db,
        action="category_created",
        entityType="category",
        entityId=category.id,
        adminKeyHash=admin.adminKeyHash,
        ipAddress=admin.ipAddress,
        userAgent=admin.userAgent,
        changes={"key": sanitizedKey, "name": sanitizedName, "sortOrder": payload.sortOrder}
    )
    
    await db.commit()
    return {"ok": True, "category": serializeCategory(category)}

@router.get("/categories")
async def listCategories(db: AsyncSession = Depends(getDb)):
    stmt = (
        select(PollCategory)
        .options(selectinload(PollCategory.subCategories))
        .where(PollCategory.parentCategoryId.is_(None))  # Only top-level categories
        .order_by(PollCategory.sortOrder, PollCategory.name)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return {"categories": [serializeCategory(c) for c in rows]}

@router.get("/categories/{categoryId}")
async def getCategory(categoryId: str, db: AsyncSession = Depends(getDb)):
    category = (await db.execute(select(PollCategory).where(PollCategory.id == categoryId))).scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"category": serializeCategory(category)}

@router.put("/categories/{categoryId}")
async def updateCategory(categoryId: str, payload: CategoryUpdateInput, db: AsyncSession = Depends(getDb), admin: AdminContext = Depends(requireAdmin)):
    category = (await db.execute(select(PollCategory).where(PollCategory.id == categoryId))).scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    changes = {}
    
    if payload.key is not None:
        sanitizedKey = sanitize.sanitizeKey(payload.key, maxLength=64)
        # Check for duplicate key
        existing = (await db.execute(
            select(PollCategory)
            .where(PollCategory.key == sanitizedKey)
            .where(PollCategory.id != categoryId)
        )).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Category key already exists")
        category.key = sanitizedKey
        changes["key"] = sanitizedKey
    
    if payload.name is not None:
        sanitizedName = sanitize.sanitizeName(payload.name, maxLength=128)
        category.name = sanitizedName
        changes["name"] = sanitizedName
    
    if payload.sortOrder is not None:
        category.sortOrder = payload.sortOrder
        changes["sortOrder"] = payload.sortOrder
    
    if "parentCategoryId" in payload.model_fields_set:
        # Validate parent exists if provided
        if payload.parentCategoryId is not None:
            parent = (await db.execute(
                select(PollCategory).where(PollCategory.id == payload.parentCategoryId)
            )).scalar_one_or_none()
            if not parent:
                raise HTTPException(status_code=404, detail="Parent category not found")
            # Prevent circular reference (setting parent to self or descendant)
            if payload.parentCategoryId == categoryId:
                raise HTTPException(status_code=422, detail="Cannot set category as its own parent")
        category.parentCategoryId = payload.parentCategoryId
        changes["parentCategoryId"] = payload.parentCategoryId

    # Audit log
    await logAdminAction(
        db=db,
        action="category_updated",
        entityType="category",
        entityId=category.id,
        adminKeyHash=admin.adminKeyHash,
        ipAddress=admin.ipAddress,
        userAgent=admin.userAgent,
        changes=changes
    )

    await db.commit()
    return {"ok": True, "category": serializeCategory(category)}

@router.patch("/categories/{categoryId}")
async def patchCategory(categoryId: str, payload: CategoryUpdateInput, db: AsyncSession = Depends(getDb)):
    category = (await db.execute(select(PollCategory).where(PollCategory.id == categoryId))).scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    if payload.name is not None:
        category.name = sanitize.sanitizeName(payload.name, maxLength=128)
    if payload.sortOrder is not None:
        category.sortOrder = payload.sortOrder

    await db.commit()
    return {"ok": True, "category": serializeCategory(category)}

# -----------------------------
# Template Routes
# -----------------------------

@router.post("/templates")
async def createTemplate(payload: TemplateCreateInput, db: AsyncSession = Depends(getDb)):
    # Auto-generate unique key from title
    sanitizedKey = await generateUniqueTemplateKey(db, payload.categoryId, payload.title)
    sanitizedTitle = sanitize.sanitizeTitle(payload.title, maxLength=256)
    sanitizedQuestion = sanitize.sanitizeQuestion(payload.question, maxLength=1000)
    
    # validate category exists
    category = (await db.execute(select(PollCategory).where(PollCategory.id == payload.categoryId))).scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Key uniqueness is already guaranteed by generateUniqueTemplateKey

    if payload.pollType == "RANKED" and payload.maxRank is not None and payload.maxRank < 2:
        raise HTTPException(status_code=422, detail="maxRank must be >= 2 for ranked polls")

    template = PollTemplate(
        id=newId(),
        categoryId=payload.categoryId,
        key=sanitizedKey,
        title=sanitizedTitle,
        question=sanitizedQuestion,
        pollType=payload.pollType,
        maxRank=payload.maxRank,
        audience=payload.audience,
        durationDays=payload.durationDays,
        isActive=True,
    )
    db.add(template)
    await db.flush()

    # replace default options (create)
    for opt in payload.options:
        db.add(PollTemplateOption(
            id=newId(),
            templateId=template.id,
            label=sanitize.sanitizeLabel(opt.label, maxLength=256),
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

    if payload.categoryId is not None:
        # Validate category exists
        category = (await db.execute(select(PollCategory).where(PollCategory.id == payload.categoryId))).scalar_one_or_none()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        template.categoryId = payload.categoryId
    if payload.key is not None:
        template.key = sanitize.sanitizeKey(payload.key, maxLength=64)
    if payload.title is not None:
        template.title = sanitize.sanitizeTitle(payload.title, maxLength=256)
    if payload.question is not None:
        template.question = sanitize.sanitizeQuestion(payload.question, maxLength=1000)
    if payload.contextText is not None:
        template.contextText = payload.contextText
    if payload.pollType is not None:
        template.pollType = payload.pollType
    if payload.maxRank is not None:
        template.maxRank = payload.maxRank
    if payload.audience is not None:
        template.audience = payload.audience
    if payload.durationDays is not None:
        template.durationDays = payload.durationDays
    if payload.featured is not None:
        template.featured = payload.featured

    if template.pollType == "RANKED" and template.maxRank is not None and template.maxRank < 2:
        raise HTTPException(status_code=422, detail="maxRank must be >= 2 for ranked polls")

    await db.commit()
    return {"ok": True, "template": serializeTemplate(template, includeOptions=False)}

@router.post("/templates/{templateId}/generate-context")
async def generateTemplateContext(
    templateId: str,
    db: AsyncSession = Depends(getDb),
    admin: AdminContext = Depends(requireAdmin)
):
    """Generate AI-powered context for a poll template"""
    # Fetch template with options
    template = (await db.execute(
        select(PollTemplate)
        .where(PollTemplate.id == templateId)
        .options(selectinload(PollTemplate.defaultOptions))
    )).scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Extract option labels
    optionLabels = [opt.label for opt in sorted(template.defaultOptions, key=lambda x: x.sortOrder)]
    
    if len(optionLabels) < 2:
        raise HTTPException(status_code=422, detail="Template must have at least 2 options to generate context")
    
    try:
        # Generate context using AI
        contextText = await generatePollContext(
            title=template.title,
            question=template.question,
            optionLabels=optionLabels
        )
        
        # Log admin action
        await logAdminAction(
            db=db,
            action="generate_poll_context",
            entityType="template",
            entityId=templateId,
            adminKeyHash=admin.adminKeyHash,
            ipAddress=admin.ipAddress,
            userAgent=admin.userAgent,
            extraData={"title": template.title}
        )
        await db.commit()
        
        return {"ok": True, "contextText": contextText}
        
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate context: {str(e)}")

@router.patch("/templates/{templateId}/active")
async def setTemplateActive(templateId: str, payload: TemplateActiveInput, db: AsyncSession = Depends(getDb)):
    template = (await db.execute(select(PollTemplate).where(PollTemplate.id == templateId))).scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    template.isActive = payload.isActive
    await db.commit()
    return {"ok": True, "template": serializeTemplate(template, includeOptions=False)}

@router.patch("/templates/{templateId}/featured")
async def setTemplateFeatured(templateId: str, payload: TemplateFeaturedInput, db: AsyncSession = Depends(getDb)):
    template = (await db.execute(select(PollTemplate).where(PollTemplate.id == templateId))).scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    template.featured = payload.featured
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
            label=sanitize.sanitizeLabel(opt.label, maxLength=256),
            sortOrder=opt.sortOrder,
        ))

    await db.commit()
    return {"ok": True, "templateId": templateId, "optionCount": len(payload.options)}

@router.delete("/templates/{templateId}")
async def deleteTemplate(
    templateId: str,
    force: bool = Query(default=False),
    db: AsyncSession = Depends(getDb),
    admin: AdminContext = Depends(requireAdmin)
):
    """Delete a poll template with safety checks"""
    from sqlalchemy import func
    from .models import VoteBallot, VoteRanking
    
    template = (await db.execute(
        select(PollTemplate).where(PollTemplate.id == templateId)
    )).scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get all instances for this template
    instances = (await db.execute(
        select(PollInstance).where(PollInstance.templateId == templateId)
    )).scalars().all()
    
    instanceCount = len(instances)
    
    # Check for existing plans
    planCount = await db.scalar(
        select(func.count())
        .select_from(PollPlan)
        .where(PollPlan.templateId == templateId)
    )
    
    if not force and instanceCount > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete template with {instanceCount} existing instance(s). Use force=true to override."
        )
    
    # Count votes before deletion
    voteCount = 0
    if instanceCount > 0:
        instanceIds = [inst.id for inst in instances]
        voteCount = await db.scalar(
            select(func.count())
            .select_from(VoteBallot)
            .where(VoteBallot.instanceId.in_(instanceIds))
        ) or 0
    
    # If force=true, manually delete votes first (due to RESTRICT foreign keys)
    if force and voteCount > 0:
        # Get all instance IDs
        instanceIds = [inst.id for inst in instances]
        
        # Delete vote rankings first (they reference ballots)
        await db.execute(
            delete(VoteRanking)
            .where(VoteRanking.ballotId.in_(
                select(VoteBallot.id).where(VoteBallot.instanceId.in_(instanceIds))
            ))
        )
        
        # Delete vote ballots
        await db.execute(
            delete(VoteBallot).where(VoteBallot.instanceId.in_(instanceIds))
        )
        
        await db.flush()
    
    # Audit log
    await logAdminAction(
        db=db,
        action="template_deleted",
        entityType="template",
        entityId=templateId,
        adminKeyHash=admin.adminKeyHash,
        ipAddress=admin.ipAddress,
        userAgent=admin.userAgent,
        changes={
            "title": template.title,
            "key": template.key,
            "force": force,
            "instanceCount": instanceCount,
            "planCount": planCount,
            "voteCount": voteCount
        }
    )
    
    # Delete the template (cascade will handle plans and instances)
    await db.delete(template)
    await db.commit()
    
    return {
        "ok": True,
        "deletedTemplate": {
            "id": templateId,
            "title": template.title,
            "key": template.key
        },
        "cascadeDeleted": {
            "instances": instanceCount,
            "plans": planCount,
            "votes": voteCount
        }
    }

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

    sanitizedQuestionOverride = sanitize.sanitizeQuestion(payload.questionOverride, maxLength=1000)

    if not plan:
        plan = PollPlan(
            id=newId(),
            templateId=templateId,
            pollDate=payload.pollDate,
            isEnabled=payload.isEnabled,
            questionOverride=sanitizedQuestionOverride,
        )
        db.add(plan)
    else:
        plan.isEnabled = payload.isEnabled
        plan.questionOverride = sanitizedQuestionOverride

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
            label=sanitize.sanitizeLabel(opt.label, maxLength=256),
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
                "categoryId": i.categoryId,
                "pollDate": str(i.pollDate),
                "closeDate": str(i.closeDate),
                "title": i.title,
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

@router.get("/instances/{instanceId}")
async def getInstance(instanceId: str, db: AsyncSession = Depends(getDb)):
    instance = (await db.execute(
        select(PollInstance)
        .where(PollInstance.id == instanceId)
        .options(selectinload(PollInstance.options))
    )).scalar_one_or_none()
    
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    return {
        "instance": {
            "id": instance.id,
            "templateId": instance.templateId,
            "categoryId": instance.categoryId,
            "pollDate": str(instance.pollDate),
            "closeDate": str(instance.closeDate),
            "title": instance.title,
            "question": instance.question,
            "pollType": instance.pollType,
            "maxRank": instance.maxRank,
            "audience": instance.audience,
            "status": instance.status,
            "options": [
                {"id": o.id, "label": o.label, "sortOrder": o.sortOrder}
                for o in sorted(instance.options, key=lambda x: x.sortOrder)
            ],
        }
    }

@router.post("/rollover")
async def runRollover(pollDate: date = Query(...), db: AsyncSession = Depends(getDb)):
    createdCount = await ensureInstancesForDate(db, pollDate)
    return {"ok": True, "pollDate": str(pollDate), "createdCount": createdCount}


@router.post("/close")
async def closePolls(
    pollDate: date = Query(...),
    db: AsyncSession = Depends(getDb),
):
    """Close all polls for a specific date and create snapshots"""
    result = await closeAndSnapshotForDate(db, pollDate)
    return {
        "ok": True,
        "pollDate": str(pollDate),
        "closedCount": result.get("closedCount", 0),
        "snapshotCount": result.get("snapCount", 0),
    }

@router.post("/instances/{instanceId}/close")
async def closeInstance(
    instanceId: str,
    db: AsyncSession = Depends(getDb),
    admin: AdminContext = Depends(requireAdmin),
):
    """Close and snapshot a specific poll instance"""
    from .snapshotService import upsertResultSnapshot
    
    # Get the instance
    instance = (await db.execute(
        select(PollInstance).where(PollInstance.id == instanceId)
    )).scalar_one_or_none()
    
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    if instance.status == "CLOSED":
        raise HTTPException(status_code=409, detail="Instance already closed")
    
    # Create snapshot
    snapshotOk = await upsertResultSnapshot(db, instanceId)
    
    # Close the instance
    instance.status = "CLOSED"
    
    # Audit log
    await logAdminAction(
        db=db,
        action="instance_closed",
        entityType="instance",
        entityId=instanceId,
        adminKeyHash=admin.adminKeyHash,
        ipAddress=admin.ipAddress,
        userAgent=admin.userAgent,
        changes={"status": "CLOSED", "snapshotCreated": snapshotOk}
    )
    
    await db.commit()
    
    return {
        "ok": True,
        "instanceId": instanceId,
        "snapshotCreated": snapshotOk,
        "pollDate": str(instance.pollDate),
        "templateId": instance.templateId,
    }

@router.patch("/instances/{instanceId}")
async def updateInstance(
    instanceId: str,
    payload: InstanceUpdateInput,
    db: AsyncSession = Depends(getDb),
    admin: AdminContext = Depends(requireAdmin),
):
    """Update an instance's category"""
    instance = (await db.execute(
        select(PollInstance).where(PollInstance.id == instanceId)
    )).scalar_one_or_none()
    
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    if payload.categoryId is not None:
        # Validate category exists
        category = (await db.execute(
            select(PollCategory).where(PollCategory.id == payload.categoryId)
        )).scalar_one_or_none()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        oldCategoryId = instance.categoryId
        instance.categoryId = payload.categoryId
        
        await logAdminAction(
            db=db,
            action="instance_category_updated",
            entityType="instance",
            entityId=instanceId,
            adminKeyHash=admin.adminKeyHash,
            ipAddress=admin.ipAddress,
            userAgent=admin.userAgent,
            changes={"categoryId": {"old": oldCategoryId, "new": payload.categoryId}}
        )
    
    await db.commit()
    return {"ok": True, "instanceId": instanceId, "categoryId": instance.categoryId}

@router.post("/instances/{instanceId}/replace")
async def replaceInstance(
    instanceId: str,
    db: AsyncSession = Depends(getDb),
    admin: AdminContext = Depends(requireAdmin),
):
    """
    Replace a poll instance by closing the current one and creating a new one.
    The new instance will use the template + any plan overrides for that date.
    
    Workflow for mid-day corrections:
    1. Update the PollPlan for this date (question/options) via PUT /admin/templates/{templateId}/plan
    2. Call this endpoint to replace the instance
    3. New instance will use the updated plan settings
    
    The new instance will still be closed/rolled over normally at end of day.
    """
    from .snapshotService import upsertResultSnapshot
    from .models import PollInstanceOption, PollTemplate, PollPlan, PollPlanOption
    from .rollover import chooseInstanceOptions
    
    # Get the current instance
    currentInstance = (await db.execute(
        select(PollInstance)
        .where(PollInstance.id == instanceId)
    )).scalar_one_or_none()
    
    if not currentInstance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    if currentInstance.status == "CLOSED":
        raise HTTPException(status_code=409, detail="Cannot replace a closed instance")
    
    # Get the template to rebuild from
    template = (await db.execute(
        select(PollTemplate)
        .where(PollTemplate.id == currentInstance.templateId)
        .options(selectinload(PollTemplate.defaultOptions))
    )).scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get plan for this date (if exists)
    plan = (await db.execute(
        select(PollPlan)
        .where(PollPlan.templateId == currentInstance.templateId)
        .where(PollPlan.pollDate == currentInstance.pollDate)
        .options(selectinload(PollPlan.options))
    )).scalar_one_or_none()
    
    # Close and snapshot the current instance
    snapshotOk = await upsertResultSnapshot(db, instanceId)
    currentInstance.status = "CLOSED"
    await db.flush()
    
    # Store instance properties before deletion
    templateId = currentInstance.templateId
    categoryId = currentInstance.categoryId
    pollDate = currentInstance.pollDate
    title = currentInstance.title
    pollType = currentInstance.pollType
    maxRank = currentInstance.maxRank
    audience = currentInstance.audience
    
    # Determine question from plan override or template
    question = plan.questionOverride if (plan and plan.questionOverride) else template.question
    
    # Determine options from plan or template
    optionData = chooseInstanceOptions(template, plan)
    
    # Delete the current instance (removes unique constraint block)
    await db.delete(currentInstance)
    await db.flush()
    
    # Create new instance with template/plan settings
    newInstanceId = newId()
    newInstance = PollInstance(
        id=newInstanceId,
        templateId=templateId,
        categoryId=categoryId,
        pollDate=pollDate,
        title=title,
        question=question,
        pollType=pollType,
        maxRank=maxRank,
        audience=audience,
        status="OPEN",
    )
    db.add(newInstance)
    await db.flush()
    
    # Create options
    for opt in optionData:
        db.add(PollInstanceOption(
            id=newId(),
            instanceId=newInstanceId,
            label=opt["label"],
            sortOrder=opt["sortOrder"],
        ))
    
    # Audit log
    await logAdminAction(
        db=db,
        action="instance_replaced",
        entityType="instance",
        entityId=instanceId,
        adminKeyHash=admin.adminKeyHash,
        ipAddress=admin.ipAddress,
        userAgent=admin.userAgent,
        changes={
            "oldInstanceId": instanceId,
            "newInstanceId": newInstanceId,
            "snapshotCreated": snapshotOk,
            "pollDate": str(pollDate),
            "usedPlan": plan is not None,
            "planOverrides": {
                "question": plan.questionOverride is not None,
                "options": bool(plan and plan.options)
            } if plan else None
        }
    )
    
    await db.commit()
    
    return {
        "ok": True,
        "oldInstanceId": instanceId,
        "newInstanceId": newInstanceId,
        "snapshotCreated": snapshotOk,
        "pollDate": str(pollDate),
        "templateId": templateId,
        "usedPlan": plan is not None,
    }


@router.post("/snapshots/create-missing")
async def createMissingSnapshots(
    db: AsyncSession = Depends(getDb),
    admin: AdminContext = Depends(requireAdmin),
):
    """Create snapshots for all closed polls that are missing them"""
    from .snapshotService import upsertResultSnapshot
    from .models import PollResultSnapshot
    
    # Get all closed instances
    closedInstances = (await db.execute(
        select(PollInstance)
        .where(PollInstance.status == "CLOSED")
        .order_by(PollInstance.pollDate.desc())
    )).scalars().all()
    
    # Find missing snapshots
    missing = []
    for inst in closedInstances:
        snap = (await db.execute(
            select(PollResultSnapshot)
            .where(PollResultSnapshot.instanceId == inst.id)
        )).scalar_one_or_none()
        
        if not snap:
            missing.append(inst)
    
    if not missing:
        return {
            "ok": True,
            "message": "All closed polls already have snapshots",
            "createdCount": 0,
        }
    
    # Create missing snapshots
    createdCount = 0
    for inst in missing:
        success = await upsertResultSnapshot(db, inst.id)
        if success:
            createdCount += 1
    
    # Audit log
    await logAdminAction(
        db=db,
        action="snapshots_created",
        entityType="snapshot",
        entityId=None,
        adminKeyHash=admin.adminKeyHash,
        ipAddress=admin.ipAddress,
        userAgent=admin.userAgent,
        changes={"createdCount": createdCount, "totalMissing": len(missing)}
    )
    
    await db.commit()
    
    return {
        "ok": True,
        "createdCount": createdCount,
        "totalMissing": len(missing),
    }


@router.post("/snapshots/regenerate")
async def regenerateSnapshots(
    db: AsyncSession = Depends(getDb),
    admin: AdminContext = Depends(requireAdmin),
):
    """Regenerate snapshots for all closed polls (updates data structure)"""
    from .snapshotService import upsertResultSnapshot
    
    # Get all closed instances
    closedInstances = (await db.execute(
        select(PollInstance)
        .where(PollInstance.status == "CLOSED")
        .order_by(PollInstance.pollDate.desc())
    )).scalars().all()
    
    if not closedInstances:
        return {
            "ok": True,
            "message": "No closed polls found",
            "regeneratedCount": 0,
        }
    
    # Regenerate all snapshots
    regeneratedCount = 0
    for inst in closedInstances:
        success = await upsertResultSnapshot(db, inst.id)
        if success:
            regeneratedCount += 1
    
    # Audit log
    await logAdminAction(
        db=db,
        action="snapshots_regenerated",
        entityType="snapshot",
        entityId=None,
        adminKeyHash=admin.adminKeyHash,
        ipAddress=admin.ipAddress,
        userAgent=admin.userAgent,
        changes={"regeneratedCount": regeneratedCount, "totalClosed": len(closedInstances)}
    )
    
    await db.commit()
    
    return {
        "ok": True,
        "regeneratedCount": regeneratedCount,
        "totalClosed": len(closedInstances),
    }


@router.post("/snapshots/create-for-active")
async def createSnapshotsForActive(
    db: AsyncSession = Depends(getDb),
    admin: AdminContext = Depends(requireAdmin),
):
    """Create/update snapshots for all active (OPEN) polls to capture current results"""
    from .snapshotService import upsertResultSnapshot
    
    # Get all open instances
    openInstances = (await db.execute(
        select(PollInstance)
        .where(PollInstance.status == "OPEN")
        .order_by(PollInstance.pollDate.desc())
    )).scalars().all()
    
    if not openInstances:
        return {
            "ok": True,
            "message": "No active polls found",
            "createdCount": 0,
        }
    
    # Create/update snapshots for all active polls
    createdCount = 0
    for inst in openInstances:
        success = await upsertResultSnapshot(db, inst.id)
        if success:
            createdCount += 1
    
    # Audit log
    await logAdminAction(
        db=db,
        action="snapshots_created_for_active",
        entityType="snapshot",
        entityId=None,
        adminKeyHash=admin.adminKeyHash,
        ipAddress=admin.ipAddress,
        userAgent=admin.userAgent,
        changes={"createdCount": createdCount, "totalActive": len(openInstances)}
    )
    
    await db.commit()
    
    return {
        "ok": True,
        "createdCount": createdCount,
        "totalActive": len(openInstances),
    }


@router.post("/instances/{instanceId}/snapshot")
async def createInstanceSnapshot(
    instanceId: str,
    db: AsyncSession = Depends(getDb),
    admin: AdminContext = Depends(requireAdmin),
):
    """Create/update snapshot for a specific poll instance (works for both OPEN and CLOSED)"""
    from .snapshotService import upsertResultSnapshot
    from .models import PollResultSnapshot
    
    # Get the instance
    instance = (await db.execute(
        select(PollInstance).where(PollInstance.id == instanceId)
    )).scalar_one_or_none()
    
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    # Create/update snapshot
    success = await upsertResultSnapshot(db, instanceId)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create snapshot")
    
    # Get the snapshot
    snapshot = (await db.execute(
        select(PollResultSnapshot).where(PollResultSnapshot.instanceId == instanceId)
    )).scalar_one_or_none()
    
    # Audit log
    await logAdminAction(
        db=db,
        action="instance_snapshot_created",
        entityType="snapshot",
        entityId=snapshot.id if snapshot else None,
        adminKeyHash=admin.adminKeyHash,
        ipAddress=admin.ipAddress,
        userAgent=admin.userAgent,
        changes={
            "instanceId": instanceId,
            "instanceStatus": instance.status,
            "pollDate": str(instance.pollDate),
        }
    )
    
    await db.commit()
    
    return {
        "ok": True,
        "instanceId": instanceId,
        "snapshotId": snapshot.id if snapshot else None,
        "snapshot": {
            "id": snapshot.id,
            "instanceId": snapshot.instanceId,
            "totalVotes": snapshot.totalVotes,
            "totalBallots": snapshot.totalBallots,
            "winnerOptionId": snapshot.winnerOptionId,
            "resultsJson": snapshot.resultsJson,
            "createdAt": snapshot.createdAt.isoformat(),
        } if snapshot else None,
    }


@router.get("/instances/{instanceId}/snapshot")
async def getInstanceSnapshot(
    instanceId: str,
    db: AsyncSession = Depends(getDb),
):
    """Get snapshot for a specific poll instance"""
    from .models import PollResultSnapshot
    
    snapshot = (await db.execute(
        select(PollResultSnapshot).where(PollResultSnapshot.instanceId == instanceId)
    )).scalar_one_or_none()
    
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found for this instance")
    
    return {
        "ok": True,
        "snapshot": {
            "id": snapshot.id,
            "instanceId": snapshot.instanceId,
            "totalVotes": snapshot.totalVotes,
            "totalBallots": snapshot.totalBallots,
            "winnerOptionId": snapshot.winnerOptionId,
            "resultsJson": snapshot.resultsJson,
            "createdAt": snapshot.createdAt.isoformat(),
        },
    }

# ----------------------
# Import/Export
# ----------------------

@router.post("/import")
async def importData(
    data: ImportDataInput = Body(...),
    admin: AdminContext = Depends(requireAdmin),
    db: AsyncSession = Depends(getDb),
):
    """Import categories and templates from JSON"""
    from .schemas import ImportResult, ImportResultItem
    
    categoriesCreated = 0
    templatesCreated = 0
    errors = []
    details = []
    
    # Map of category keys to IDs
    categoryMap = {}
    
    # First pass: create/update categories
    for catInput in data.categories:
        try:
            # Sanitize inputs
            clean_key = sanitize.sanitizeKey(catInput.key)
            clean_name = sanitize.sanitizeName(catInput.name)
            clean_emoji = catInput.emoji.strip() if catInput.emoji else None
            
            # Check if category exists
            existing = (await db.execute(
                select(PollCategory).where(PollCategory.key == clean_key)
            )).scalar_one_or_none()
            
            if existing:
                # Update existing
                existing.name = clean_name
                existing.emoji = clean_emoji
                existing.sortOrder = catInput.sortOrder
                categoryMap[clean_key] = existing.id
                details.append(ImportResultItem(
                    type="category",
                    action="updated",
                    key=clean_key,
                    name=clean_name
                ))
            else:
                # Create new
                category = PollCategory(
                    id=str(uuid.uuid4()),
                    key=clean_key,
                    name=clean_name,
                    emoji=clean_emoji,
                    sortOrder=catInput.sortOrder
                )
                db.add(category)
                await db.flush()
                categoryMap[clean_key] = category.id
                categoriesCreated += 1
                details.append(ImportResultItem(
                    type="category",
                    action="created",
                    key=clean_key,
                    name=clean_name
                ))
                
        except Exception as e:
            error_msg = f"Category '{catInput.key}': {str(e)}"
            errors.append(error_msg)
            details.append(ImportResultItem(
                type="category",
                action="skipped",
                key=catInput.key,
                name=catInput.name,
                error=str(e)
            ))
    
    # Commit categories first
    await db.commit()
    
    # Second pass: create templates
    for tmplInput in data.templates:
        try:
            # Get category ID
            categoryId = categoryMap.get(tmplInput.categoryKey)
            if not categoryId:
                # Look up category by key in database
                cat = (await db.execute(
                    select(PollCategory).where(PollCategory.key == tmplInput.categoryKey)
                )).scalar_one_or_none()
                if not cat:
                    raise ValueError(f"Category '{tmplInput.categoryKey}' not found")
                categoryId = cat.id
            
            # Sanitize inputs
            clean_key = sanitize.sanitizeKey(tmplInput.key)
            clean_title = sanitize.sanitizeTitle(tmplInput.title)
            clean_question = sanitize.sanitizeQuestion(tmplInput.question) if tmplInput.question else None
            
            # Check if template exists
            existing_tmpl = (await db.execute(
                select(PollTemplate).where(PollTemplate.key == clean_key)
            )).scalar_one_or_none()
            
            if existing_tmpl:
                details.append(ImportResultItem(
                    type="template",
                    action="skipped",
                    key=clean_key,
                    name=clean_title,
                    error="Template with this key already exists"
                ))
                continue
            
            # Create template
            template = PollTemplate(
                id=str(uuid.uuid4()),
                categoryId=categoryId,
                key=clean_key,
                title=clean_title,
                question=clean_question,
                pollType=tmplInput.pollType,
                maxRank=tmplInput.maxRank,
                audience=tmplInput.audience,
                durationDays=tmplInput.durationDays,
                isActive=tmplInput.isActive,
                featured=tmplInput.featured
            )
            db.add(template)
            await db.flush()
            
            # Create options
            for optInput in tmplInput.options:
                clean_opt_key = sanitize.sanitizeKey(optInput.key)
                clean_label = sanitize.sanitizeLabel(optInput.label)
                
                option = PollTemplateOption(
                    id=str(uuid.uuid4()),
                    templateId=template.id,
                    label=clean_label,
                    sortOrder=optInput.sortOrder
                )
                db.add(option)
            
            templatesCreated += 1
            details.append(ImportResultItem(
                type="template",
                action="created",
                key=clean_key,
                name=clean_title
            ))
            
        except Exception as e:
            error_msg = f"Template '{tmplInput.key}': {str(e)}"
            errors.append(error_msg)
            details.append(ImportResultItem(
                type="template",
                action="skipped",
                key=tmplInput.key,
                name=tmplInput.title,
                error=str(e)
            ))
    
    await db.commit()
    
    # Log the import action
    await logAdminAction(
        db=db,
        action="IMPORT_DATA",
        adminKeyHash=admin.adminKeyHash,
        ipAddress=admin.ipAddress,
        userAgent=admin.userAgent,
        extraData={
            "categoriesCreated": categoriesCreated,
            "templatesCreated": templatesCreated,
            "errorCount": len(errors)
        }
    )
    
    return ImportResult(
        categoriesCreated=categoriesCreated,
        templatesCreated=templatesCreated,
        errors=errors,
        details=details
    )


# -----------------------------
# Preset Option Sets
# -----------------------------

@router.get("/presets", response_model=PresetListResponse)
async def listPresets(
    admin: AdminContext = Depends(requireAdmin),
    db: AsyncSession = Depends(getDb),
):
    """List all preset option sets"""
    stmt = select(PresetOptionSet).order_by(PresetOptionSet.name)
    result = await db.execute(stmt)
    presets = result.scalars().all()
    
    return PresetListResponse(
        presets=[
            PresetOptionSetResponse(
                id=preset.id,
                name=preset.name,
                description=preset.description,
                options=preset.options if isinstance(preset.options, list) else [],
                createdAt=preset.createdAt.isoformat(),
                updatedAt=preset.updatedAt.isoformat(),
            )
            for preset in presets
        ]
    )


@router.post("/presets", response_model=PresetOptionSetResponse)
async def createPreset(
    input: CreatePresetInput,
    admin: AdminContext = Depends(requireAdmin),
    db: AsyncSession = Depends(getDb),
):
    """Create a new preset option set"""
    # Check if name already exists
    stmt = select(PresetOptionSet).where(PresetOptionSet.name == input.name)
    existing = await db.execute(stmt)
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Preset with name '{input.name}' already exists")
    
    # Convert options to JSONB format
    options_data = [
        {
            "optionId": opt.optionId,
            "label": sanitize.sanitizeLabel(opt.label),
            "sortOrder": opt.sortOrder,
        }
        for opt in input.options
    ]
    
    preset = PresetOptionSet(
        id=str(uuid.uuid4()),
        name=sanitize.sanitizeName(input.name),
        description=sanitize.sanitizeTitle(input.description) if input.description else None,
        options=options_data,
    )
    
    db.add(preset)
    await db.commit()
    await db.refresh(preset)
    
    await logAdminAction(
        db=db,
        action="CREATE_PRESET",
        entityType="preset",
        entityId=preset.id,
        adminKeyHash=admin.adminKeyHash,
        ipAddress=admin.ipAddress,
        userAgent=admin.userAgent,
        extraData={"name": preset.name, "optionCount": len(options_data)}
    )
    
    return PresetOptionSetResponse(
        id=preset.id,
        name=preset.name,
        description=preset.description,
        options=preset.options if isinstance(preset.options, list) else [],
        createdAt=preset.createdAt.isoformat(),
        updatedAt=preset.updatedAt.isoformat(),
    )


@router.get("/presets/{preset_id}", response_model=PresetOptionSetResponse)
async def getPreset(
    preset_id: str,
    admin: AdminContext = Depends(requireAdmin),
    db: AsyncSession = Depends(getDb),
):
    """Get a specific preset by ID"""
    stmt = select(PresetOptionSet).where(PresetOptionSet.id == preset_id)
    result = await db.execute(stmt)
    preset = result.scalar_one_or_none()
    
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    return PresetOptionSetResponse(
        id=preset.id,
        name=preset.name,
        description=preset.description,
        options=preset.options if isinstance(preset.options, list) else [],
        createdAt=preset.createdAt.isoformat(),
        updatedAt=preset.updatedAt.isoformat(),
    )


@router.put("/presets/{preset_id}", response_model=PresetOptionSetResponse)
async def updatePreset(
    preset_id: str,
    input: UpdatePresetInput,
    admin: AdminContext = Depends(requireAdmin),
    db: AsyncSession = Depends(getDb),
):
    """Update a preset option set"""
    stmt = select(PresetOptionSet).where(PresetOptionSet.id == preset_id)
    result = await db.execute(stmt)
    preset = result.scalar_one_or_none()
    
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    changes = {}
    
    if input.name is not None:
        # Check if new name conflicts with another preset
        check_stmt = select(PresetOptionSet).where(
            PresetOptionSet.name == input.name,
            PresetOptionSet.id != preset_id
        )
        existing = await db.execute(check_stmt)
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"Preset with name '{input.name}' already exists")
        
        preset.name = sanitize.sanitizeName(input.name)
        changes["name"] = preset.name
    
    if input.description is not None:
        preset.description = sanitize.sanitizeTitle(input.description) if input.description else None
        changes["description"] = preset.description
    
    if input.options is not None:
        options_data = [
            {
                "optionId": opt.optionId,
                "label": sanitize.sanitizeLabel(opt.label),
                "sortOrder": opt.sortOrder,
            }
            for opt in input.options
        ]
        preset.options = options_data
        changes["optionCount"] = len(options_data)
    
    await db.commit()
    await db.refresh(preset)
    
    await logAdminAction(
        db=db,
        action="UPDATE_PRESET",
        entityType="preset",
        entityId=preset.id,
        adminKeyHash=admin.adminKeyHash,
        ipAddress=admin.ipAddress,
        userAgent=admin.userAgent,
        changes=changes
    )
    
    return PresetOptionSetResponse(
        id=preset.id,
        name=preset.name,
        description=preset.description,
        options=preset.options if isinstance(preset.options, list) else [],
        createdAt=preset.createdAt.isoformat(),
        updatedAt=preset.updatedAt.isoformat(),
    )


@router.delete("/presets/{preset_id}")
async def deletePreset(
    preset_id: str,
    admin: AdminContext = Depends(requireAdmin),
    db: AsyncSession = Depends(getDb),
):
    """Delete a preset option set"""
    stmt = select(PresetOptionSet).where(PresetOptionSet.id == preset_id)
    result = await db.execute(stmt)
    preset = result.scalar_one_or_none()
    
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    preset_name = preset.name
    
    await db.delete(preset)
    await db.commit()
    
    await logAdminAction(
        db=db,
        action="DELETE_PRESET",
        entityType="preset",
        entityId=preset_id,
        adminKeyHash=admin.adminKeyHash,
        ipAddress=admin.ipAddress,
        userAgent=admin.userAgent,
        extraData={"name": preset_name}
    )
    
    return {"message": "Preset deleted successfully"}
