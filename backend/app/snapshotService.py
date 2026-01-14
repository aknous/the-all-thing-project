# app/snapshotService.py
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import PollResultSnapshot
from .resultsService import buildResults


def newId() -> str:
    return str(uuid.uuid4())


def extractSnapshotFields(results: dict[str, Any]) -> dict[str, Any]:
    # Normalize convenience fields across SINGLE vs RANKED payloads
    totalVotes = results.get("totalVotes")
    totalBallots = results.get("totalBallots")
    winnerOptionId = results.get("winnerOptionId")

    return {
        "totalVotes": int(totalVotes) if totalVotes is not None else None,
        "totalBallots": int(totalBallots) if totalBallots is not None else None,
        "winnerOptionId": winnerOptionId,
    }


async def upsertResultSnapshot(db: AsyncSession, pollId: str, minVotes: int = 10) -> bool:
    """
    Builds final results for pollId and upserts a snapshot.
    Only creates snapshots if there are at least minVotes votes.
    Returns True if inserted/updated, False if poll not found or insufficient votes.
    """
    results = await buildResults(db, pollId)
    if not results.get("found"):
        return False

    # Extract vote counts to check minimum threshold
    fields = extractSnapshotFields(results)
    
    # Skip snapshot creation if insufficient votes
    if fields["totalBallots"] < minVotes:
        # Delete existing snapshot if present (poll might have had votes that were removed)
        existing = (await db.execute(
            select(PollResultSnapshot).where(PollResultSnapshot.instanceId == pollId)
        )).scalar_one_or_none()
        if existing:
            await db.delete(existing)
        return False

    existing = (await db.execute(
        select(PollResultSnapshot).where(PollResultSnapshot.instanceId == pollId)
    )).scalar_one_or_none()

    if not existing:
        snap = PollResultSnapshot(
            id=newId(),
            instanceId=pollId,
            resultsJson=results,
            totalVotes=fields["totalVotes"],
            totalBallots=fields["totalBallots"],
            winnerOptionId=fields["winnerOptionId"],
        )
        db.add(snap)
    else:
        existing.resultsJson = results
        existing.totalVotes = fields["totalVotes"]
        existing.totalBallots = fields["totalBallots"]
        existing.winnerOptionId = fields["winnerOptionId"]

    # Do not commit here; let the caller control transaction boundaries
    return True