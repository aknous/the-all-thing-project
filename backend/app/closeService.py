# app/closeService.py
from __future__ import annotations

from datetime import date
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .models import PollInstance
from .snapshotService import upsertResultSnapshot
from .logger import logError, logStructured


async def closePollsForDate(db: AsyncSession, pollDate: date) -> int:
    try:
        async with db.begin():
            stmt = (
                update(PollInstance)
                .where(PollInstance.pollDate == pollDate)
                .where(PollInstance.status == "OPEN")
                .values(status="CLOSED")
            )
            
            result = await db.execute(stmt)
            count = int(result.rowcount or 0)
            
            logStructured("INFO", "polls_closed", pollDate=str(pollDate), count=count)
            return count
    except Exception as e:
        logError("close_polls_failed", str(e), pollDate=str(pollDate))
        raise


async def closePollsBeforeDate(db: AsyncSession, cutoffDate: date) -> int:
    try:
        async with db.begin():
            stmt = (
                update(PollInstance)
                .where(PollInstance.pollDate < cutoffDate)
                .where(PollInstance.status == "OPEN")
                .values(status="CLOSED")
            )
            
            result = await db.execute(stmt)
            count = int(result.rowcount or 0)
            
            logStructured("INFO", "polls_closed_before_date", cutoffDate=str(cutoffDate), count=count)
            return count
    except Exception as e:
        logError("close_polls_before_date_failed", str(e), cutoffDate=str(cutoffDate))
        raise


async def closeAndSnapshotForDate(db: AsyncSession, pollDate: date) -> dict:
    try:
        async with db.begin():
            instances = (await db.execute(
                select(PollInstance)
                .where(PollInstance.pollDate == pollDate)
                .where(PollInstance.status == "OPEN")
            )).scalars().all()

            snapCount = 0
            for inst in instances:
                ok = await upsertResultSnapshot(db, inst.id)
                if ok:
                    snapCount += 1

            result = await db.execute(
                update(PollInstance)
                .where(PollInstance.pollDate == pollDate)
                .where(PollInstance.status == "OPEN")
                .values(status="CLOSED")
            )

            closedCount = int(result.rowcount or 0)
            
        logStructured(
            "INFO",
            "polls_closed_with_snapshots",
            pollDate=str(pollDate),
            snapCount=snapCount,
            closedCount=closedCount
        )
        return {"pollDate": str(pollDate), "snapCount": snapCount, "closedCount": closedCount}
    except Exception as e:
        logError("close_and_snapshot_failed", str(e), pollDate=str(pollDate))
        raise


async def closeAndSnapshotBeforeDate(db: AsyncSession, cutoffDate: date) -> dict:
    try:
        async with db.begin():
            instances = (await db.execute(
                select(PollInstance)
                .where(PollInstance.pollDate < cutoffDate)
                .where(PollInstance.status == "OPEN")
            )).scalars().all()

            snapCount = 0
            for inst in instances:
                ok = await upsertResultSnapshot(db, inst.id)
                if ok:
                    snapCount += 1

            result = await db.execute(
                update(PollInstance)
                .where(PollInstance.pollDate < cutoffDate)
                .where(PollInstance.status == "OPEN")
                .values(status="CLOSED")
            )

            closedCount = int(result.rowcount or 0)
            
        logStructured(
            "INFO",
            "polls_closed_before_date_with_snapshots",
            cutoffDate=str(cutoffDate),
            snapCount=snapCount,
            closedCount=closedCount
        )
        return {"cutoffDate": str(cutoffDate), "snapCount": snapCount, "closedCount": closedCount}
    except Exception as e:
        logError("close_and_snapshot_before_date_failed", str(e), cutoffDate=str(cutoffDate))
        raise
