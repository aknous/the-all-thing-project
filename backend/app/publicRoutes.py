# app/publicRoutes.py
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from .db import getDb
from .schemas import VoteInput
from .net import getClientIp
from . import voterToken
from .abuse import rateLimit, hasVoted, markVoted
from .redisClient import redisClient
from .models import VoteBallot, VoteRanking
import uuid

router = APIRouter(prefix="/polls", tags=["public"])

@router.post("/{pollId}/vote")
async def submitVote(
    pollId: str,
    payload: VoteInput,
    request: Request,
    db: AsyncSession = Depends(getDb),
):
    clientIp = getClientIp(request)

    signedToken = request.cookies.get(voterToken.cookieName)
    rawToken = voterToken.verifyToken(signedToken) if signedToken else None
    if not rawToken:
        raise HTTPException(status_code=400, detail="Missing voter token")

    voterHash = voterToken.hashToken(rawToken)

    if not await rateLimit(
        key=f"vote:{pollId}:{clientIp}",
        limit=10,
        windowSeconds=60,
    ):
        raise HTTPException(status_code=429, detail="Too many attempts")

    if await hasVoted(pollId, voterHash):
        raise HTTPException(status_code=409, detail="Already voted")

    ballot = VoteBallot(
        id=str(uuid.uuid4()),
        pollId=pollId,
        voterTokenHash=voterHash,
    )

    db.add(ballot)
    await db.flush()

    for index, optionId in enumerate(payload.rankedChoices, start=1):
        db.add(
            VoteRanking(
                ballotId=ballot.id,
                rank=index,
                optionId=optionId,
            )
        )

    await db.commit()

    await markVoted(
        pollId=pollId,
        identityHash=voterHash,
        ttlSeconds=86400,
    )

    await redisClient.delete(f"results:{pollId}")

    return {"ok": True}
