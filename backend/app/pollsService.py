# app/pollsService.py
from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from .models import PollCategory, PollInstance, PollResultSnapshot


async def buildPollsForDate(db: AsyncSession, pollDate: date) -> dict[str, Any]:
    # Load top-level categories with subcategories
    categories = (await db.execute(
        select(PollCategory)
        .options(selectinload(PollCategory.subCategories))
        .where(PollCategory.parentCategoryId.is_(None))
        .order_by(PollCategory.sortOrder, PollCategory.name)
    )).scalars().all()

    # Get all active polls for the date:
    # - status == OPEN (most important - poll must be open)
    # - pollDate <= given date (poll has started)
    # This ensures that polls from previous days that haven't been closed yet
    # are still shown until the rollover process closes them
    instances = (await db.execute(
        select(PollInstance)
        .where(PollInstance.status == "OPEN")
        .where(PollInstance.pollDate <= pollDate)
        # MVP: only show public polls
        .where(PollInstance.audience == "PUBLIC")
        .options(
            selectinload(PollInstance.options),
            selectinload(PollInstance.template),  # Load template to get key
        )
        .order_by(PollInstance.categoryId, PollInstance.templateId)
    )).scalars().all()

    # Check which templates have historical snapshots
    templateIds = [inst.templateId for inst in instances if inst.templateId]
    templatesWithHistory = set()
    if templateIds:
        snapshotResult = await db.execute(
            select(PollInstance.templateId)
            .join(PollResultSnapshot, PollInstance.id == PollResultSnapshot.instanceId)
            .where(PollInstance.templateId.in_(templateIds))
            .distinct()
        )
        templatesWithHistory = {row[0] for row in snapshotResult}

    instancesByCategoryId: dict[str, list[PollInstance]] = {}
    for inst in instances:
        instancesByCategoryId.setdefault(inst.categoryId, []).append(inst)

    def buildCategoryBlock(cat: PollCategory) -> dict[str, Any] | None:
        """Build category block with polls and subcategories"""
        catInstances = instancesByCategoryId.get(cat.id, [])
        
        polls = []
        for inst in catInstances:
            options = sorted(inst.options or [], key=lambda o: o.sortOrder)
            isNew = inst.templateId and inst.templateId not in templatesWithHistory
            polls.append({
                "pollId": inst.id,
                "templateId": inst.templateId,
                "templateKey": inst.template.key if inst.template else None,
                "pollDate": str(inst.pollDate),
                "closeDate": str(inst.closeDate),
                "title": inst.title,
                "question": inst.question,
                "contextText": inst.template.contextText if inst.template else None,
                "pollType": inst.pollType,
                "maxRank": inst.maxRank,
                "audience": inst.audience,
                "status": inst.status,
                "featured": inst.template.featured if inst.template else False,
                "isNew": isNew,
                "options": [
                    {"optionId": o.id, "label": o.label, "sortOrder": o.sortOrder}
                    for o in options
                ],
            })
        
        # Build subcategory blocks (only if we have them loaded)
        # We only load subCategories for top-level categories, so check if this is top-level
        subCategoryBlocks = []
        try:
            # Try to access subCategories - will work if loaded, otherwise skip
            if hasattr(cat, 'subCategories') and cat.subCategories is not None:
                for subCat in sorted(cat.subCategories, key=lambda c: (c.sortOrder, c.name)):
                    subBlock = buildCategoryBlock(subCat)
                    if subBlock:
                        subCategoryBlocks.append(subBlock)
        except:
            # If lazy loading fails, just skip subcategories
            pass
        
        # Only include category if it has polls or subcategories with polls
        if not polls and not subCategoryBlocks:
            return None
        
        return {
            "categoryId": cat.id,
            "categoryKey": cat.key,
            "categoryName": cat.name,
            "sortOrder": cat.sortOrder,
            "parentCategoryId": cat.parentCategoryId,
            "polls": polls,
            "subCategories": subCategoryBlocks,
        }

    categoryBlocks: list[dict[str, Any]] = []
    for cat in categories:
        block = buildCategoryBlock(cat)
        if block:
            categoryBlocks.append(block)

    return {
        "pollDate": str(pollDate),
        "categories": categoryBlocks,
    }
