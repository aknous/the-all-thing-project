# app/closeCli.py
from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from .db import sessionFactory
from .closeService import closeAndSnapshotForDate, closeAndSnapshotBeforeDate


def getEasternToday() -> date:
    return datetime.now(ZoneInfo("America/New_York")).date()


async def runCloseJob():
    easternToday = getEasternToday()
    yesterday = easternToday - timedelta(days=1)

    async with sessionFactory() as db:
        # Primary: snapshot + close yesterday
        r1 = await closeAndSnapshotForDate(db, yesterday)

        # Safety sweep: snapshot + close anything older still OPEN (missed schedule protection)
        r2 = await closeAndSnapshotBeforeDate(db, easternToday)

    print(f"closeJob easternToday={easternToday} yesterday={yesterday} r1={r1} r2={r2}")


if __name__ == "__main__":
    asyncio.run(runCloseJob())
