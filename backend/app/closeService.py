# app/closeService.py
from __future__ import annotations

from datetime import date
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .models import PollInstance
from .snapshotService import upsertResultSnapshot


async def closePollsForDate(db: AsyncSession, pollDate: date) -> int:
    stmt = (
        update(PollInstance)
        .where(PollInstance.pollDate == pollDate)
        .where(PollInstance.status == "OPEN")
        .values(status="CLOSED")
    )

    result = await db.execute(stmt)
    await db.commit()
    return int(result.rowcount or 0)


async def closePollsBeforeDate(db: AsyncSession, cutoffDate: date) -> int:
    stmt = (
        update(PollInstance)
        .where(PollInstance.pollDate < cutoffDate)
        .where(PollInstance.status == "OPEN")
        .values(status="CLOSED")
    )

    result = await db.execute(stmt)
    await db.commit()
    return int(result.rowcount or 0)


async def closeAndSnapshotForDate(db: AsyncSession, pollDate: date) -> dict:
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

    return {"pollDate": str(pollDate), "snapCount": snapCount, "closedCount": closedCount}


async def closeAndSnapshotBeforeDate(db: AsyncSession, cutoffDate: date) -> dict:
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

    return {"cutoffDate": str(cutoffDate), "snapCount": snapCount, "closedCount": closedCount}
