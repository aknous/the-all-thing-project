# app/adminCli.py
"""
Admin CLI for The All Thing backend operations
Usage: python -m app.adminCli <command> [options]
"""
from __future__ import annotations

import asyncio
import random
import sys
import uuid
from datetime import datetime, date
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy import select, func, desc, asc
from sqlalchemy.orm import selectinload

from .db import sessionFactory
from .models import (
    PollCategory, PollTemplate, PollPlan, PollInstance,
    PollResultSnapshot, VoteBallot, VoteRanking, PollInstanceOption,
)
from .auditLog import AdminAuditLog
from .hashUtil import hashString


def printHelp():
    """Print CLI help"""
    print("""
Admin CLI for The All Thing

Commands:
  audit-logs              View admin audit logs
  categories              List all poll categories
  templates               List all poll templates
  plans                   List all poll plans
  instances               List poll instances (optionally filter by date)
  snapshots               List poll result snapshots
  votes                   Show vote statistics
  
  rollover                Run rollover for a specific date
  close-date              Close all polls for a specific date
  close-all-polls         Close ALL open polls (creates snapshots)
  recreate-date           Delete and recreate all polls for a specific date
  close-instance          Close and snapshot a specific poll instance
  replace-instance        Replace a poll instance with fresh one from template+plan
  update-instance-category Update an instance's category
  update-template-category Update a template's category
  clean-duplicates        Remove duplicate instances (keeps most recent OPEN per template/date)
  
  find-missing-snapshots  Find closed polls without snapshots
  create-missing-snapshots Create snapshots for closed polls missing them
  regenerate-snapshots    Regenerate all snapshots (updates data structure)
  
  test-vote               Create test vote(s) on a poll instance (bypasses all checks)
  
  create-category         Create a new poll category
  
Options:
  --limit N               Limit results (default: 20)
  --date YYYY-MM-DD      Filter by date
  --category-id ID       Filter by category ID
  --parent-category-id ID Parent category ID (for creating sub-categories)
  --status STATUS        Filter by status (OPEN, CLOSED)
  --instance-id ID       Instance ID for instance operations
  --template-id ID       Template ID for template operations
  --count N              Number of test votes to create (default: 1)
  --rankings OPTIONIDS   Comma-separated option IDs in rank order (for test-vote)
  --random               Randomize vote selections for each test vote
  --help                 Show this help

Examples:
  python -m app.adminCli audit-logs --limit 50
  python -m app.adminCli instances --date 2025-12-30
  python -m app.adminCli close-instance --instance-id abc123
  python -m app.adminCli replace-instance --instance-id abc123
  python -m app.adminCli rollover --date 2025-12-30
  python -m app.adminCli close-date --date 2025-12-30
  python -m app.adminCli find-missing-snapshots
  python -m app.adminCli create-missing-snapshots
  python -m app.adminCli regenerate-snapshots
  python -m app.adminCli test-vote --instance-id abc123 --rankings "opt1,opt2,opt3"
  python -m app.adminCli test-vote --instance-id abc123 --count 10
  python -m app.adminCli test-vote --instance-id abc123 --count 50 --random
""")


async def viewAuditLogs(limit: int = 20):
    """View admin audit logs"""
    async with sessionFactory() as db:
        stmt = (
            select(AdminAuditLog)
            .order_by(desc(AdminAuditLog.createdAt))
            .limit(limit)
        )
        result = await db.execute(stmt)
        logs = result.scalars().all()
        
        if not logs:
            print("No audit logs found.")
            return
        
        print(f"\n{'='*100}")
        print(f"Admin Audit Logs (most recent {limit})")
        print(f"{'='*100}\n")
        
        for log in logs:
            status = "✓" if log.success else "✗"
            print(f"{status} [{log.createdAt.strftime('%Y-%m-%d %H:%M:%S')}] {log.action}")
            if log.entityType and log.entityId:
                print(f"  Entity: {log.entityType} ({log.entityId})")
            if log.adminKeyHash:
                print(f"  Admin: {log.adminKeyHash[:12]}...")
            if log.ipAddress:
                print(f"  IP: {log.ipAddress}")
            if log.changes:
                print(f"  Changes: {log.changes}")
            if not log.success and log.errorMessage:
                print(f"  Error: {log.errorMessage}")
            print()


async def listCategories():
    """List all poll categories"""
    async with sessionFactory() as db:
        stmt = select(PollCategory).order_by(PollCategory.sortOrder, PollCategory.name)
        result = await db.execute(stmt)
        categories = result.scalars().all()
        
        if not categories:
            print("No categories found.")
            return
        
        print(f"\n{'='*80}")
        print("Poll Categories")
        print(f"{'='*80}\n")
        
        for cat in categories:
            print(f"ID: {cat.id}")
            print(f"Name: {cat.name}")
            print(f"Key: {cat.key}")
            print(f"Sort Order: {cat.sortOrder}")
            print()


async def listTemplates(categoryId: Optional[str] = None, isActive: Optional[bool] = None):
    """List all poll templates"""
    async with sessionFactory() as db:
        stmt = select(PollTemplate).order_by(PollTemplate.categoryId, PollTemplate.key)
        
        if categoryId:
            stmt = stmt.where(PollTemplate.categoryId == categoryId)
        if isActive is not None:
            stmt = stmt.where(PollTemplate.isActive == isActive)
        
        result = await db.execute(stmt)
        templates = result.scalars().all()
        
        if not templates:
            print("No templates found.")
            return
        
        print(f"\n{'='*80}")
        print(f"Poll Templates{f' (Category: {categoryId})' if categoryId else ''}{f' (Active: {isActive})' if isActive is not None else ''}")
        print(f"{'='*80}\n")
        
        for template in templates:
            print(f"ID: {template.id}")
            print(f"Category ID: {template.categoryId}")
            print(f"Key: {template.key}")
            print(f"Title: {template.title}")
            print(f"Question: {template.question}")
            print(f"Poll Type: {template.pollType}")
            print(f"Active: {template.isActive}")
            print()


async def listPlans(limit: int = 20):
    """List poll plans"""
    async with sessionFactory() as db:
        stmt = (
            select(PollPlan)
            .options(selectinload(PollPlan.template))
            .order_by(desc(PollPlan.pollDate))
            .limit(limit)
        )
        result = await db.execute(stmt)
        plans = result.scalars().all()
        
        if not plans:
            print("No plans found.")
            return
        
        print(f"\n{'='*80}")
        print(f"Poll Plans (most recent {limit})")
        print(f"{'='*80}\n")
        
        for plan in plans:
            print(f"ID: {plan.id}")
            print(f"Template: {plan.template.title if plan.template else 'N/A'}")
            print(f"Scheduled Date: {plan.pollDate}")
            print(f"Enabled: {plan.isEnabled}")
            if plan.questionOverride:
                print(f"Question Override: {plan.questionOverride}")
            print()


async def listInstances(pollDate: date, status: Optional[str] = None):
    """List poll instances for a specific date (REQUIRED)"""
    async with sessionFactory() as db:
        # Match admin route: always filter by pollDate, order by templateId
        stmt = (
            select(PollInstance)
            .where(PollInstance.pollDate == pollDate)
            .options(selectinload(PollInstance.options))
            .order_by(PollInstance.templateId)
        )
        
        if status:
            stmt = stmt.where(PollInstance.status == status)
        
        result = await db.execute(stmt)
        instances = result.scalars().all()
        
        if not instances:
            print("No instances found.")
            return
        
        print(f"\n{'='*80}")
        print(f"Poll Instances{f' (Date: {pollDate})' if pollDate else ''}{f' (Status: {status})' if status else ''}")
        print(f"{'='*80}\n")
        
        for instance in instances:
            print(f"ID: {instance.id}")
            print(f"Template ID: {instance.templateId}")
            print(f"Category ID: {instance.categoryId}")
            print(f"Title: {instance.title}")
            print(f"Question: {instance.question}")
            print(f"Poll Type: {instance.pollType}")
            print(f"Status: {instance.status}")
            print(f"Options: {len(instance.options)} option(s)")
            print()


async def listSnapshots(limit: int = 20):
    """List poll result snapshots"""
    async with sessionFactory() as db:
        stmt = (
            select(PollResultSnapshot)
            .order_by(desc(PollResultSnapshot.createdAt))
            .limit(limit)
        )
        result = await db.execute(stmt)
        snapshots = result.scalars().all()
        
        if not snapshots:
            print("No snapshots found.")
            return
        
        print(f"\n{'='*80}")
        print(f"Poll Result Snapshots (most recent {limit})")
        print(f"{'='*80}\n")
        
        for snapshot in snapshots:
            print(f"ID: {snapshot.id}")
            print(f"Poll Instance: {snapshot.instanceId}")
            print(f"Created At: {snapshot.createdAt.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"Total Votes: {snapshot.totalVotes}")
            if snapshot.winnerOptionId:
                print(f"Winner: {snapshot.winnerOptionId}")
            print()


async def showVoteStats():
    """Show vote statistics with detailed breakdowns"""
    from .models import VoteRanking, PollInstanceOption
    
    async with sessionFactory() as db:
        # Total votes
        totalVotes = await db.scalar(select(func.count()).select_from(VoteBallot))
        
        print(f"\n{'='*100}")
        print("Vote Statistics")
        print(f"{'='*100}\n")
        print(f"Total Votes Cast: {totalVotes}\n")
        
        # Get recent instances with votes
        stmt = (
            select(PollInstance)
            .options(
                selectinload(PollInstance.options),
            )
            .order_by(desc(PollInstance.pollDate))
            .limit(10)
        )
        instances = (await db.execute(stmt)).scalars().all()
        
        if not instances:
            print("No poll instances found.")
            return
        
        print(f"Recent Poll Results (last 10):")
        print(f"{'='*100}\n")
        
        for instance in instances:
            # Count votes for this instance
            voteCount = await db.scalar(
                select(func.count())
                .select_from(VoteBallot)
                .where(VoteBallot.instanceId == instance.id)
            )
            
            print(f"[{instance.pollDate}] {instance.title}")
            print(f"  Status: {instance.status} | Type: {instance.pollType} | Total Votes: {voteCount}")
            
            if voteCount > 0:
                # Get vote breakdown by option
                for option in sorted(instance.options, key=lambda o: o.sortOrder):
                    # Count first-choice votes for this option
                    firstChoiceCount = await db.scalar(
                        select(func.count())
                        .select_from(VoteBallot)
                        .where(VoteBallot.instanceId == instance.id)
                        .where(VoteBallot.firstChoiceOptionId == option.id)
                    )
                    
                    # For ranked polls, also count all rankings
                    if instance.pollType == "RANKED":
                        allRankingsCount = await db.scalar(
                            select(func.count())
                            .select_from(VoteRanking)
                            .join(VoteBallot, VoteRanking.ballotId == VoteBallot.id)
                            .where(VoteBallot.instanceId == instance.id)
                            .where(VoteRanking.optionId == option.id)
                        )
                        percentage = (firstChoiceCount / voteCount * 100) if voteCount > 0 else 0
                        print(f"    • {option.label}: {firstChoiceCount} first-choice ({percentage:.1f}%), {allRankingsCount} total rankings")
                    else:
                        percentage = (firstChoiceCount / voteCount * 100) if voteCount > 0 else 0
                        print(f"    • {option.label}: {firstChoiceCount} votes ({percentage:.1f}%)")
            
            print()


async def createCategory(name: str, key: str, sortOrder: int = 0, parentCategoryId: Optional[str] = None):
    """Create a new poll category"""
    async with sessionFactory() as db:
        async with db.begin():
            # If parentCategoryId provided, verify it exists
            if parentCategoryId:
                parent = (await db.execute(
                    select(PollCategory).where(PollCategory.id == parentCategoryId)
                )).scalar_one_or_none()
                if not parent:
                    print(f"Error: Parent category not found: {parentCategoryId}")
                    sys.exit(1)
            
            category = PollCategory(
                id=str(uuid.uuid4()),
                name=name,
                key=key,
                sortOrder=sortOrder,
                parentCategoryId=parentCategoryId
            )
            db.add(category)
        
        if parentCategoryId:
            print(f"✓ Created sub-category: {name} (ID: {category.id}, Key: {key}, Parent: {parentCategoryId})")
        else:
            print(f"✓ Created category: {name} (ID: {category.id}, Key: {key}, Sort: {sortOrder})")


async def runRolloverForDate(pollDate: date):
    """Run rollover for a specific date"""
    from .rollover import ensureInstancesForDate
    
    async with sessionFactory() as db:
        createdCount = await ensureInstancesForDate(db, pollDate)
    
    print(f"✓ Rollover complete for {pollDate}: created {createdCount} instance(s)")


async def recreateDate(pollDate: date):
    """Delete all instances for a date and recreate them fresh"""
    from .rollover import ensureInstancesForDate
    
    async with sessionFactory() as db:
        # Get all instances for this date
        instances = (await db.execute(
            select(PollInstance).where(PollInstance.pollDate == pollDate)
        )).scalars().all()
        
        if not instances:
            print(f"No instances found for {pollDate}")
        else:
            print(f"\n{'='*100}")
            print(f"Deleting {len(instances)} instance(s) for {pollDate}")
            print(f"{'='*100}\n")
            
            for inst in instances:
                print(f"Deleting: {inst.title} (ID: {inst.id}, Status: {inst.status})")
                await db.delete(inst)
            
            await db.commit()
            print(f"\n✓ Deleted {len(instances)} instance(s)\n")
        
        # Recreate instances
        print(f"{'='*100}")
        print(f"Creating fresh instances for {pollDate}")
        print(f"{'='*100}\n")
        
        createdCount = await ensureInstancesForDate(db, pollDate)
        
        print(f"\n{'='*100}")
        print(f"✓ Recreated {createdCount} instance(s) for {pollDate}")
        print(f"{'='*100}")


async def closePollsByDate(pollDate: date):
    """Close all polls for a specific date"""
    from .closeService import closeAndSnapshotForDate
    
    async with sessionFactory() as db:
        result = await closeAndSnapshotForDate(db, pollDate)
    
    print(f"✓ Closed {result.get('closedCount', 0)} poll(s) for {pollDate}")
    print(f"  Created {result.get('snapCount', 0)} snapshot(s)")


async def closeInstance(instanceId: str):
    """Close and snapshot a specific poll instance"""
    from .snapshotService import upsertResultSnapshot
    
    async with sessionFactory() as db:
        # Get the instance
        instance = (await db.execute(
            select(PollInstance).where(PollInstance.id == instanceId)
        )).scalar_one_or_none()
        
        if not instance:
            print(f"✗ Error: Instance {instanceId} not found")
            return
        
        if instance.status == "CLOSED":
            print(f"✗ Error: Instance {instanceId} is already closed")
            return
        
        # Create snapshot
        snapshotOk = await upsertResultSnapshot(db, instanceId)
        
        # Close the instance
        instance.status = "CLOSED"
        await db.commit()
        
        print(f"✓ Closed instance {instanceId}")
        print(f"  Template: {instance.templateId}")
        print(f"  Date: {instance.pollDate}")
        print(f"  Snapshot created: {snapshotOk}")


async def closeAllPolls():
    """Close all open poll instances and create snapshots"""
    from .snapshotService import upsertResultSnapshot
    
    async with sessionFactory() as db:
        # Get all open instances
        openInstances = (await db.execute(
            select(PollInstance)
            .where(PollInstance.status == "OPEN")
            .order_by(PollInstance.pollDate.desc())
        )).scalars().all()
        
        if not openInstances:
            print("No open polls found.")
            return
        
        print(f"\n{'='*100}")
        print(f"Found {len(openInstances)} open poll(s) to close")
        print(f"{'='*100}\n")
        
        closedCount = 0
        snapshotCount = 0
        
        for instance in openInstances:
            print(f"Closing: {instance.pollDate} - {instance.title} (ID: {instance.id})")
            
            # Create snapshot
            snapshotOk = await upsertResultSnapshot(db, instance.id)
            if snapshotOk:
                snapshotCount += 1
                print(f"  ✓ Snapshot created")
            else:
                print(f"  ✗ Snapshot failed")
            
            # Close the instance
            instance.status = "CLOSED"
            closedCount += 1
            print(f"  ✓ Poll closed")
            print()
        
        await db.commit()
        
        print(f"\n{'='*100}")
        print(f"✓ Closed {closedCount} poll(s), created {snapshotCount} snapshot(s)")
        print(f"{'='*100}")


async def replaceInstance(instanceId: str):
    """Replace a poll instance with fresh one from template+plan"""
    from .snapshotService import upsertResultSnapshot
    from .rollover import chooseInstanceOptions
    from .models import PollInstanceOption, PollTemplate, PollPlan
    
    async with sessionFactory() as db:
        # Get the current instance
        currentInstance = (await db.execute(
            select(PollInstance).where(PollInstance.id == instanceId)
        )).scalar_one_or_none()
        
        if not currentInstance:
            print(f"✗ Error: Instance {instanceId} not found")
            return
        
        if currentInstance.status == "CLOSED":
            print(f"✗ Error: Cannot replace a closed instance")
            return
        
        # Get the template
        template = (await db.execute(
            select(PollTemplate)
            .where(PollTemplate.id == currentInstance.templateId)
            .options(selectinload(PollTemplate.defaultOptions))
        )).scalar_one_or_none()
        
        if not template:
            print(f"✗ Error: Template not found")
            return
        
        # Get plan for this date
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
        
        # Store properties before deletion
        templateId = currentInstance.templateId
        categoryId = currentInstance.categoryId
        pollDate = currentInstance.pollDate
        title = currentInstance.title
        pollType = currentInstance.pollType
        maxRank = currentInstance.maxRank
        audience = currentInstance.audience
        
        # Determine question from plan or template
        question = plan.questionOverride if (plan and plan.questionOverride) else template.question
        
        # Determine options from plan or template
        optionData = chooseInstanceOptions(template, plan)
        
        # Delete old instance
        await db.delete(currentInstance)
        await db.flush()
        
        # Create new instance
        newInstanceId = str(uuid.uuid4())
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
                id=str(uuid.uuid4()),
                instanceId=newInstanceId,
                label=opt["label"],
                sortOrder=opt["sortOrder"],
            ))
        
        await db.commit()
        
        print(f"✓ Replaced instance")
        print(f"  Old instance: {instanceId} (closed, snapshot created: {snapshotOk})")
        print(f"  New instance: {newInstanceId} (OPEN)")
        print(f"  Date: {pollDate}")
        print(f"  Used plan: {plan is not None}")


async def updateInstanceCategory(instanceId: str, categoryId: str):
    """Update an instance's category"""
    async with sessionFactory() as db:
        # Get instance
        instance = (await db.execute(
            select(PollInstance).where(PollInstance.id == instanceId)
        )).scalar_one_or_none()
        
        if not instance:
            print(f"Error: Instance not found: {instanceId}")
            sys.exit(1)
        
        # Validate category exists
        category = (await db.execute(
            select(PollCategory).where(PollCategory.id == categoryId)
        )).scalar_one_or_none()
        
        if not category:
            print(f"Error: Category not found: {categoryId}")
            sys.exit(1)
        
        oldCategoryId = instance.categoryId
        instance.categoryId = categoryId
        
        await db.commit()
        
        print(f"✓ Updated instance category")
        print(f"  Instance: {instanceId}")
        print(f"  Title: {instance.title}")
        print(f"  Date: {instance.pollDate}")
        print(f"  Old Category: {oldCategoryId}")
        print(f"  New Category: {categoryId} ({category.name})")


async def updateTemplateCategory(templateId: str, categoryId: str):
    """Update a template's category"""
    async with sessionFactory() as db:
        # Get template
        template = (await db.execute(
            select(PollTemplate).where(PollTemplate.id == templateId)
        )).scalar_one_or_none()
        
        if not template:
            print(f"Error: Template not found: {templateId}")
            sys.exit(1)
        
        # Validate category exists
        category = (await db.execute(
            select(PollCategory).where(PollCategory.id == categoryId)
        )).scalar_one_or_none()
        
        if not category:
            print(f"Error: Category not found: {categoryId}")
            sys.exit(1)
        
        oldCategoryId = template.categoryId
        template.categoryId = categoryId
        
        await db.commit()
        
        print(f"✓ Updated template category")
        print(f"  Template: {templateId}")
        print(f"  Title: {template.title}")
        print(f"  Old Category: {oldCategoryId}")
        print(f"  New Category: {categoryId} ({category.name})")


async def findMissingSnapshots():
    """Find closed polls without snapshots"""
    async with sessionFactory() as db:
        # Get all closed instances
        closedInstances = (await db.execute(
            select(PollInstance)
            .where(PollInstance.status == "CLOSED")
            .order_by(PollInstance.pollDate.desc())
        )).scalars().all()
        
        if not closedInstances:
            print("No closed polls found.")
            return
        
        print(f"\n{'='*100}")
        print(f"Checking {len(closedInstances)} closed polls for missing snapshots...")
        print(f"{'='*100}\n")
        
        missing = []
        for inst in closedInstances:
            snap = (await db.execute(
                select(PollResultSnapshot)
                .where(PollResultSnapshot.instanceId == inst.id)
            )).scalar_one_or_none()
            
            if not snap:
                missing.append(inst)
                print(f"✗ MISSING SNAPSHOT")
                print(f"  Date: {inst.pollDate}")
                print(f"  Title: {inst.title}")
                print(f"  Instance ID: {inst.id}")
                print(f"  Template ID: {inst.templateId}")
                print()
        
        if not missing:
            print("✓ All closed polls have snapshots!")
        else:
            print(f"\n{'='*100}")
            print(f"Total missing snapshots: {len(missing)}")
            print(f"{'='*100}\n")
            print("Run 'python -m app.adminCli create-missing-snapshots' to fix this.")


async def createMissingSnapshots():
    """Create snapshots for closed polls missing them"""
    from .snapshotService import upsertResultSnapshot
    
    async with sessionFactory() as db:
        # Get all closed instances
        closedInstances = (await db.execute(
            select(PollInstance)
            .where(PollInstance.status == "CLOSED")
            .order_by(PollInstance.pollDate.desc())
        )).scalars().all()
        
        if not closedInstances:
            print("No closed polls found.")
            return
        
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
            print("✓ All closed polls already have snapshots!")
            return
        
        print(f"\n{'='*100}")
        print(f"Creating snapshots for {len(missing)} closed poll(s)...")
        print(f"{'='*100}\n")
        
        createdCount = 0
        for inst in missing:
            print(f"Creating snapshot for: {inst.pollDate} - {inst.title}")
            success = await upsertResultSnapshot(db, inst.id)
            if success:
                createdCount += 1
                print(f"  ✓ Snapshot created (ID: {inst.id})")
            else:
                print(f"  ✗ Failed to create snapshot (ID: {inst.id})")
        
        await db.commit()
        
        print(f"\n{'='*100}")
        print(f"✓ Created {createdCount} snapshot(s)")
        print(f"{'='*100}")


async def regenerateSnapshots():
    """Regenerate snapshots for all closed polls to update data structure"""
    from .snapshotService import upsertResultSnapshot
    
    async with sessionFactory() as db:
        # Get all closed instances
        closedInstances = (await db.execute(
            select(PollInstance)
            .where(PollInstance.status == "CLOSED")
            .order_by(PollInstance.pollDate.desc())
        )).scalars().all()
        
        if not closedInstances:
            print("No closed polls found.")
            return
        
        print(f"\n{'='*100}")
        print(f"Regenerating snapshots for {len(closedInstances)} closed poll(s)...")
        print(f"{'='*100}\n")
        
        regeneratedCount = 0
        for inst in closedInstances:
            print(f"Regenerating snapshot for: {inst.pollDate} - {inst.title}")
            success = await upsertResultSnapshot(db, inst.id)
            if success:
                regeneratedCount += 1
                print(f"  ✓ Snapshot regenerated (ID: {inst.id})")
            else:
                print(f"  ✗ Failed to regenerate snapshot (ID: {inst.id})")
        
        await db.commit()
        
        print(f"\n{'='*100}")
        print(f"✓ Regenerated {regeneratedCount} snapshot(s)")
        print(f"{'='*100}")


async def testVote(instanceId: str, rankings: Optional[list[str]] = None, count: int = 1, randomize: bool = False):
    """
    Create test vote(s) on a poll instance, bypassing all duplicate checks.
    Useful for testing voting flows, tally logic, and result displays.
    
    Args:
        instanceId: ID of the poll instance to vote on
        rankings: List of option IDs in rank order (optional - will use first option if not specified)
        count: Number of test votes to create (default: 1)
        randomize: If True, randomize rankings for each vote (ignores rankings param)
    """
    async with sessionFactory() as db:
        # Load the poll instance with options
        stmt = (
            select(PollInstance)
            .where(PollInstance.id == instanceId)
            .options(selectinload(PollInstance.options))
        )
        instance = (await db.execute(stmt)).scalar_one_or_none()
        
        if not instance:
            print(f"Error: Poll instance not found: {instanceId}")
            sys.exit(1)
        
        if not instance.options:
            print(f"Error: Poll has no options")
            sys.exit(1)
        
        allOptionIds = [opt.id for opt in instance.options]
        
        # If randomize is True, we'll generate random rankings for each vote
        if randomize:
            print(f"\n{'='*100}")
            print(f"Creating {count} test vote(s) with RANDOM rankings for: {instance.title} ({instance.pollDate})")
            print(f"Poll Type: {instance.pollType}")
            print(f"Available Options: {len(allOptionIds)}")
            print(f"{'='*100}\n")
        else:
            # If no rankings specified, use first option only
            if not rankings:
                rankings = [allOptionIds[0]]
            
            # Validate all option IDs exist
            validOptionIds = set(allOptionIds)
            for optId in rankings:
                if optId not in validOptionIds:
                    print(f"Error: Invalid option ID: {optId}")
                    print(f"Valid options: {', '.join(validOptionIds)}")
                    sys.exit(1)
            
            print(f"\n{'='*100}")
            print(f"Creating {count} test vote(s) for: {instance.title} ({instance.pollDate})")
            print(f"Poll Type: {instance.pollType}")
            print(f"Rankings: {rankings}")
            print(f"{'='*100}\n")
        
        createdCount = 0
        for i in range(count):
            # Generate random rankings for this vote if randomize is True
            if randomize:
                if instance.pollType == "SINGLE":
                    # For single choice, pick exactly one option
                    voteRankings = [random.choice(allOptionIds)]
                else:
                    # For ranked choice, pick 1 to N options in random order
                    voteRankings = random.sample(allOptionIds, k=random.randint(1, len(allOptionIds)))
            else:
                voteRankings = rankings
            
            # Generate unique voter token hash for each test vote
            testToken = f"test-vote-{uuid.uuid4()}"
            voterHash = hashString(testToken)
            
            # Create ballot
            ballotId = str(uuid.uuid4())
            ballot = VoteBallot(
                id=ballotId,
                instanceId=instance.id,
                voterTokenHash=voterHash,
                ipHash=f"test-ip-{i}",  # Unique IP hash for each vote
                userAgentHash="test-user-agent",
                countryCode=None,
                regionCode=None,
                firstChoiceOptionId=voteRankings[0],
                createdAt=datetime.now(),
            )
            db.add(ballot)
            await db.flush()
            
            # Create rankings
            for rank, optionId in enumerate(voteRankings, start=1):
                ranking = VoteRanking(
                    id=str(uuid.uuid4()),
                    ballotId=ballotId,
                    rank=rank,
                    optionId=optionId,
                )
                db.add(ranking)
            
            createdCount += 1
            if count <= 10:  # Only show details for small batches
                print(f"  ✓ Vote #{i+1} created (Ballot ID: {ballotId})")
        
        await db.commit()
        
        print(f"\n{'='*100}")
        print(f"✓ Created {createdCount} test vote(s)")
        print(f"{'='*100}")


def parseArgs() -> tuple[str, dict]:
    """Parse command line arguments"""
    if len(sys.argv) < 2 or sys.argv[1] in ['--help', '-h', 'help']:
        printHelp()
        sys.exit(0)
    
    command = sys.argv[1]
    options = {}
    
    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        
        if arg == '--limit':
            options['limit'] = int(sys.argv[i + 1])
            i += 2
        elif arg == '--date':
            options['pollDate'] = datetime.strptime(sys.argv[i + 1], '%Y-%m-%d').date()
            i += 2
        elif arg == '--category-id':
            options['categoryId'] = sys.argv[i + 1]
            i += 2
        elif arg == '--parent-category-id':
            options['parentCategoryId'] = sys.argv[i + 1]
            i += 2
        elif arg == '--status':
            options['status'] = sys.argv[i + 1]
            i += 2
        elif arg == '--name':
            options['name'] = sys.argv[i + 1]
            i += 2
        elif arg == '--key':
            options['key'] = sys.argv[i + 1]
            i += 2
        elif arg == '--instance-id':
            options['instanceId'] = sys.argv[i + 1]
            i += 2
        elif arg == '--template-id':
            options['templateId'] = sys.argv[i + 1]
            i += 2
        elif arg == '--count':
            options['count'] = int(sys.argv[i + 1])
            i += 2
        elif arg == '--rankings':
            # Parse comma-separated option IDs
            options['rankings'] = sys.argv[i + 1].split(',')
            i += 2
        elif arg == '--random':
            options['random'] = True
            i += 1
        elif arg == '--sort-order':
            options['sortOrder'] = int(sys.argv[i + 1])
            i += 2
        elif arg == '--active':
            options['isActive'] = sys.argv[i + 1].lower() == 'true'
            i += 2
        else:
            i += 1
    
    return command, options


async def cleanDuplicateInstances():
    """Remove duplicate poll instances, keeping only the most recent OPEN instance per template/date"""
    async with sessionFactory() as db:
        # Find all instances grouped by (templateId, pollDate)
        result = await db.execute(
            select(PollInstance)
            .order_by(PollInstance.templateId, PollInstance.pollDate, desc(PollInstance.status))
        )
        instances = result.scalars().all()
        
        # Group by (templateId, pollDate)
        from collections import defaultdict
        groups = defaultdict(list)
        for instance in instances:
            key = (instance.templateId, instance.pollDate)
            groups[key].append(instance)
        
        # Find duplicates
        duplicates = {k: v for k, v in groups.items() if len(v) > 1}
        
        if not duplicates:
            print("No duplicate instances found.")
            return
        
        print(f"Found {len(duplicates)} duplicate groups:\n")
        
        deleted_count = 0
        for (templateId, pollDate), instances_list in duplicates.items():
            print(f"Template: {templateId}, Date: {pollDate}")
            print(f"  Found {len(instances_list)} instances:")
            
            # Sort: OPEN first, then by creation (assuming earlier IDs = earlier creation for UUIDs)
            instances_list.sort(key=lambda x: (0 if x.status == "OPEN" else 1, x.id), reverse=True)
            
            # Keep the first one (most recent OPEN if any, otherwise most recent CLOSED)
            keeper = instances_list[0]
            to_delete = instances_list[1:]
            
            for inst in instances_list:
                status_marker = "✓ KEEP" if inst.id == keeper.id else "✗ DELETE"
                print(f"    {status_marker} - {inst.id} ({inst.status}) - {inst.title}")
            
            # Delete the duplicates
            for inst in to_delete:
                await db.delete(inst)
                deleted_count += 1
            
            print()
        
        await db.commit()
        print(f"✓ Deleted {deleted_count} duplicate instances")


async def main():
    """Main CLI entry point"""
    command, options = parseArgs()
    
    try:
        if command == 'audit-logs':
            await viewAuditLogs(options.get('limit', 20))
        
        elif command == 'categories':
            await listCategories()
        
        elif command == 'templates':
            await listTemplates(
                categoryId=options.get('categoryId'),
                isActive=options.get('isActive')
            )
        
        elif command == 'plans':
            await listPlans(options.get('limit', 20))
        
        elif command == 'instances':
            if 'pollDate' not in options:
                print("Error: --date YYYY-MM-DD is required for instances command")
                sys.exit(1)
            await listInstances(
                pollDate=options['pollDate'],
                status=options.get('status')
            )
        
        elif command == 'snapshots':
            await listSnapshots(options.get('limit', 20))
        
        elif command == 'rollover':
            if 'pollDate' not in options:
                print("Error: --date YYYY-MM-DD is required")
                sys.exit(1)
            await runRolloverForDate(options['pollDate'])
        
        elif command == 'recreate-date':
            if 'pollDate' not in options:
                print("Error: --date YYYY-MM-DD is required")
                sys.exit(1)
            await recreateDate(options['pollDate'])
        
        elif command == 'close-date':
            if 'pollDate' not in options:
                print("Error: --date YYYY-MM-DD is required")
                sys.exit(1)
            await closePollsByDate(options['pollDate'])
        
        elif command == 'close-all-polls':
            await closeAllPolls()
        
        elif command == 'close-instance':
            if 'instanceId' not in options:
                print("Error: --instance-id is required")
                sys.exit(1)
            await closeInstance(options['instanceId'])
        
        elif command == 'replace-instance':
            if 'instanceId' not in options:
                print("Error: --instance-id is required")
                sys.exit(1)
            await replaceInstance(options['instanceId'])
        
        elif command == 'update-instance-category':
            if 'instanceId' not in options or 'categoryId' not in options:
                print("Error: --instance-id and --category-id are required")
                sys.exit(1)
            await updateInstanceCategory(options['instanceId'], options['categoryId'])
        
        elif command == 'update-template-category':
            if 'templateId' not in options or 'categoryId' not in options:
                print("Error: --template-id and --category-id are required")
                sys.exit(1)
            await updateTemplateCategory(options['templateId'], options['categoryId'])
        
        elif command == 'find-missing-snapshots':
            await findMissingSnapshots()
        
        elif command == 'create-missing-snapshots':
            await createMissingSnapshots()
        
        elif command == 'regenerate-snapshots':
            await regenerateSnapshots()
        
        elif command == 'test-vote':
            if 'instanceId' not in options:
                print("Error: --instance-id is required")
                sys.exit(1)
            await testVote(
                instanceId=options['instanceId'],
                rankings=options.get('rankings'),
                count=options.get('count', 1),
                randomize=options.get('random', False)
            )
        
        elif command == 'votes':
            await showVoteStats()
        
        elif command == 'clean-duplicates':
            await cleanDuplicateInstances()
        
        elif command == 'create-category':
            if 'name' not in options or 'key' not in options:
                print("Error: --name and --key are required")
                sys.exit(1)
            await createCategory(
                options['name'],
                options['key'],
                options.get('sortOrder', 0),
                options.get('parentCategoryId')
            )
        
        else:
            print(f"Unknown command: {command}")
            printHelp()
            sys.exit(1)
    
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
