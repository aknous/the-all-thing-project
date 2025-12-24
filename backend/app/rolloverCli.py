# app/rolloverCli.py
from __future__ import annotations

import asyncio
from datetime import date, datetime
from zoneinfo import ZoneInfo

from .db import sessionFactory
from .rollover import ensureInstancesForDate


def getEasternToday() -> date:
    return datetime.now(ZoneInfo("America/New_York")).date()


async def runRollover():
    pollDate = getEasternToday()

    async with sessionFactory() as session:
        createdCount = await ensureInstancesForDate(session, pollDate)

    print(f"rollover pollDate={pollDate} createdCount={createdCount}")


if __name__ == "__main__":
    asyncio.run(runRollover())
