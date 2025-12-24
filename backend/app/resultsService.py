# app/resultsService.py
from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import PollInstance, VoteBallot, VoteRanking
from .tally import irvTally


async def buildResults(db: AsyncSession, pollId: str) -> dict[str, Any]:
    """
    Returns results payload for a poll instance (SINGLE or RANKED).
    """
    instance = (await db.execute(
        select(PollInstance)
        .where(PollInstance.id == pollId)
        .options(selectinload(PollInstance.options))
    )).scalar_one_or_none()

    if not instance:
        return {
            "found": False,
            "pollId": pollId,
        }

    options = sorted(instance.options or [], key=lambda o: o.sortOrder)
    optionIds = [o.id for o in options]
    optionLabelById = {o.id: o.label for o in options}

    base = {
        "found": True,
        "pollId": instance.id,
        "pollDate": str(instance.pollDate),
        "title": instance.title,
        "question": instance.question,
        "pollType": instance.pollType,
        "maxRank": instance.maxRank,
        "audience": instance.audience,
        "status": instance.status,
        "options": [{"optionId": o.id, "label": o.label, "sortOrder": o.sortOrder} for o in options],
    }

    if instance.pollType == "SINGLE":
        return {**base, **(await buildSingleResults(db, instance.id, optionIds, optionLabelById))}

    if instance.pollType == "RANKED":
        return {**base, **(await buildRankedResults(db, instance.id, optionIds))}

    return {**base, "error": "Unknown pollType"}


async def buildSingleResults(
    db: AsyncSession,
    instanceId: str,
    optionIds: list[str],
    optionLabelById: dict[str, str],
) -> dict[str, Any]:
    # Aggregate counts by first choice
    rows = (await db.execute(
        select(VoteBallot.firstChoiceOptionId, func.count(VoteBallot.id))
        .where(VoteBallot.instanceId == instanceId)
        .group_by(VoteBallot.firstChoiceOptionId)
    )).all()

    countsByOptionId: dict[str, int] = {oid: 0 for oid in optionIds}
    totalVotes = 0

    for firstChoiceOptionId, count in rows:
        if firstChoiceOptionId in countsByOptionId:
            countsByOptionId[firstChoiceOptionId] = int(count)
            totalVotes += int(count)

    results = [
        {
            "optionId": oid,
            "label": optionLabelById.get(oid, ""),
            "count": countsByOptionId[oid],
        }
        for oid in optionIds
    ]

    # Sort descending by count, but keep stable tie order by optionIds order
    results.sort(key=lambda r: (-r["count"], optionIds.index(r["optionId"])))

    return {
        "totalVotes": totalVotes,
        "results": results,
    }


async def buildRankedResults(
    db: AsyncSession,
    instanceId: str,
    optionIds: list[str],
) -> dict[str, Any]:
    """
    Load all rankings for this instance and run IRV.
    """
    # Pull all rankings for ballots in this instance
    rankingRows = (await db.execute(
        select(VoteRanking.ballotId, VoteRanking.rank, VoteRanking.optionId)
        .join(VoteBallot, VoteBallot.id == VoteRanking.ballotId)
        .where(VoteBallot.instanceId == instanceId)
        .order_by(VoteRanking.ballotId, VoteRanking.rank)
    )).all()

    ballotsByBallotId: dict[str, list[str]] = defaultdict(list)
    for ballotId, rank, optionId in rankingRows:
        ballotsByBallotId[str(ballotId)].append(str(optionId))

    ballots = list(ballotsByBallotId.values())

    tally = irvTally(ballots=ballots, optionIds=optionIds)

    return {
        "totalBallots": len(ballots),
        "winnerOptionId": tally.get("winnerOptionId"),
        "rounds": tally.get("rounds", []),
    }
