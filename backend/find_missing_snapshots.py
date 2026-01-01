#!/usr/bin/env python3
"""Find closed polls missing snapshots."""
import asyncio
from app.db import sessionFactory
from app.models import PollInstance, PollResultSnapshot
from sqlalchemy import select


async def main():
    async with sessionFactory() as db:
        # Get all closed instances
        closed_instances = (await db.execute(
            select(PollInstance)
            .where(PollInstance.status == "CLOSED")
            .order_by(PollInstance.pollDate.desc())
        )).scalars().all()
        
        print(f"Total closed polls: {len(closed_instances)}")
        
        missing = []
        for inst in closed_instances:
            snap = (await db.execute(
                select(PollResultSnapshot)
                .where(PollResultSnapshot.instanceId == inst.id)
            )).scalar_one_or_none()
            
            if not snap:
                missing.append(inst)
                print(f"MISSING SNAPSHOT: {inst.pollDate} - {inst.title} - ID: {inst.id}")
        
        if not missing:
            print("All closed polls have snapshots!")
        else:
            print(f"\nTotal missing snapshots: {len(missing)}")


if __name__ == "__main__":
    asyncio.run(main())
