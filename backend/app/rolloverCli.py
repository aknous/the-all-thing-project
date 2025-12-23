# app/rolloverCli.py
import asyncio
from datetime import date
from .db import sessionFactory
from .rollover import ensureInstancesForDate

async def runRollover():
    async with sessionFactory() as session:
        today = date.today()
        await ensureInstancesForDate(session, today)

if __name__ == "__main__":
    asyncio.run(runRollover())
