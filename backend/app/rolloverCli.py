# app/rolloverCli.py
from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from .db import sessionFactory
from .rollover import ensureInstancesForDate
from .closeService import closeAndSnapshotForDate, closeAndSnapshotBeforeDate


def getEasternToday() -> date:
    return datetime.now(ZoneInfo("America/New_York")).date()


async def runRollover():
    pollDate = getEasternToday()
    yesterday = pollDate - timedelta(days=1)

    async with sessionFactory() as session:
        # 1. Close and snapshot yesterday's polls
        closeResult = await closeAndSnapshotForDate(session, yesterday)
        
        # 2. Safety sweep: close any older polls still open
        sweepResult = await closeAndSnapshotBeforeDate(session, pollDate)
        
        # 3. Create today's poll instances
        createdCount = await ensureInstancesForDate(session, pollDate)

    print(f"rollover pollDate={pollDate} createdCount={createdCount} yesterday={yesterday} closed={closeResult.get('closedCount', 0)} snapshots={closeResult.get('snapCount', 0)} swept={sweepResult.get('closedCount', 0)}")


if __name__ == "__main__":
    asyncio.run(runRollover())
