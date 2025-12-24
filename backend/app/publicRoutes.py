# app/publicRoutes.py
from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Request, Response, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from .db import getDb
from .schemas import VoteInput
from .net import getClientIp
from .redisClient import redisClient
from .abuse import rateLimit, hasVoted, markVoted, setIdempotency
from .hashUtil import hashString
from .resultsService import buildResults
from .pollsService import buildPollsForDate
from .settings import settings
from . import voterToken

from .models import PollInstance, VoteBallot, VoteRanking, PollResultSnapshot


router = APIRouter(prefix="/polls", tags=["public"])


def newId() -> str:
    return str(uuid.uuid4())

def getEasternToday() -> date:
    return datetime.now(ZoneInfo("America/New_York")).date()


def getCoarseGeo(request: Request) -> tuple[str | None, str | None]:
    # Cloudflare commonly provides CF-IPCountry (2-letter). Region headers vary by plan/config.
    countryCode = request.headers.get("cf-ipcountry")
    regionCode = request.headers.get("cf-region") or request.headers.get("cf-region-code")
    if countryCode:
        countryCode = countryCode.strip().upper()
    if regionCode:
        regionCode = regionCode.strip()
    return countryCode, regionCode


def getVoterIdentityOrSetCookie(request: Request, response: Response) -> str:
    signedToken = request.cookies.get(voterToken.cookieName)
    rawToken = voterToken.verifyToken(signedToken) if signedToken else None

    if not rawToken:
        signedNew = voterToken.mintToken()
        rawToken = voterToken.verifyToken(signedNew)
        # host-only cookie is simplest; if you want shared across subdomains, set domain to ".theallthingproject.com"
        response.set_cookie(
            key=voterToken.cookieName,
            value=signedNew,
            httponly=True,
            secure=settings.cookieSecure,
            samesite="lax",
            path="/",
            # domain=".theallthingproject.com",  # enable if you want cookie shared to subdomains
            max_age=60 * 60 * 24 * 365,
        )

    if not rawToken:
        raise HTTPException(status_code=500, detail="Unable to establish voter identity")

    return voterToken.hashToken(rawToken)


@router.get("/today")
async def getTodayPolls(db: AsyncSession = Depends(getDb)):
    pollDate = getEasternToday()
    cacheKey = f"polls:today:{pollDate}"

    cached = await redisClient.get(cacheKey)
    if cached:
        return {"cached": True, "data": json.loads(cached)}

    data = await buildPollsForDate(db, pollDate)
    await redisClient.set(cacheKey, json.dumps(data), ex=10)
    return {"cached": False, "data": data}


@router.get("")
async def getPolls(pollDate: date = Query(...), db: AsyncSession = Depends(getDb)):
    cacheKey = f"polls:date:{pollDate}"

    cached = await redisClient.get(cacheKey)
    if cached:
        return {"cached": True, "data": json.loads(cached)}

    data = await buildPollsForDate(db, pollDate)
    await redisClient.set(cacheKey, json.dumps(data), ex=10)
    return {"cached": False, "data": data}


@router.post("/{pollId}/vote")
async def submitVote(
    pollId: str,
    payload: VoteInput,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(getDb),
):
    # 1) identity + metadata
    voterHash = getVoterIdentityOrSetCookie(request, response)

    clientIp = getClientIp(request)
    ipHash = hashString(clientIp)

    userAgent = request.headers.get("user-agent", "")
    userAgentHash = hashString(userAgent) if userAgent else None

    countryCode, regionCode = getCoarseGeo(request)

    # 2) rate limiting (per poll + ip)
    # Tune these later; MVP defaults
    allowed = await rateLimit(
        key=f"vote:{pollId}:{ipHash}",
        limit=10,
        windowSeconds=60,
    )
    if not allowed:
        raise HTTPException(status_code=429, detail="Too many attempts")

    # 3) idempotency (optional but recommended)
    if payload.idempotencyKey:
        idemKey = f"idem:{pollId}:{voterHash}:{payload.idempotencyKey}"
        if not await setIdempotency(idemKey, ttlSeconds=60):
            # Same request already processed very recently
            return {"ok": True, "deduped": True}

    # 4) fast-path already voted
    if await hasVoted(pollId, voterHash):
        raise HTTPException(status_code=409, detail="Already voted")

    # 5) load poll instance + options
    instance = (await db.execute(
        select(PollInstance)
        .where(PollInstance.id == pollId)
        .options(selectinload(PollInstance.options))
    )).scalar_one_or_none()

    if not instance:
        raise HTTPException(status_code=404, detail="Poll not found")

    if instance.status != "OPEN":
        raise HTTPException(status_code=409, detail="Poll is closed")

    optionById = {o.id: o for o in (instance.options or [])}
    if len(optionById) < 2:
        raise HTTPException(status_code=500, detail="Poll options misconfigured")

    # 6) validate payload according to poll type
    rankedChoices = payload.rankedChoices

    # No duplicates
    if len(set(rankedChoices)) != len(rankedChoices):
        raise HTTPException(status_code=422, detail="Duplicate optionIds in rankedChoices")

    # All optionIds must belong to this instance
    for optionId in rankedChoices:
        if optionId not in optionById:
            raise HTTPException(status_code=422, detail="Invalid optionId for this poll")

    if instance.pollType == "SINGLE":
        if len(rankedChoices) != 1:
            raise HTTPException(status_code=422, detail="SINGLE polls require exactly 1 choice")
    elif instance.pollType == "RANKED":
        if instance.maxRank is not None and len(rankedChoices) > instance.maxRank:
            raise HTTPException(status_code=422, detail="Too many ranked choices for this poll")
        if len(rankedChoices) < 2:
            raise HTTPException(status_code=422, detail="RANKED polls require at least 2 ranked choices")
    else:
        raise HTTPException(status_code=500, detail="Unknown pollType")

    # 7) write ballot + rankings transactionally
    ballotId = newId()
    ballot = VoteBallot(
        id=ballotId,
        instanceId=instance.id,
        voterTokenHash=voterHash,
        ipHash=ipHash,
        userAgentHash=userAgentHash,
        countryCode=countryCode,
        regionCode=regionCode,
        firstChoiceOptionId=rankedChoices[0] if rankedChoices else None,
        createdAt=datetime.now(timezone.utc),
    )

    db.add(ballot)
    await db.flush()

    for idx, optionId in enumerate(rankedChoices, start=1):
        db.add(VoteRanking(
            id=newId(),
            ballotId=ballotId,
            rank=idx,
            optionId=optionId,
        ))

    try:
        await db.commit()
    except IntegrityError:
        # Most likely: unique constraint instanceId + voterTokenHash (already voted)
        await db.rollback()
        raise HTTPException(status_code=409, detail="Already voted")

    # 8) mark voted in Redis (TTL: until end of day or 24h MVP)
    # MVP: 24h TTL is acceptable; later compute until instance pollDate end (America/New_York)
    await markVoted(
        pollId=instance.id,
        identityHash=voterHash,
        ttlSeconds=60 * 60 * 24,
    )

    # 9) bust results cache
    await redisClient.delete(f"results:{instance.id}")

    return {"ok": True}


@router.get("/{pollId}/results")
async def getResults(
    pollId: str,
    db: AsyncSession = Depends(getDb),
):
    # If poll is CLOSED, return snapshot (source of truth)
    instance = (await db.execute(
        select(PollInstance).where(PollInstance.id == pollId)
    )).scalar_one_or_none()

    if not instance:
        raise HTTPException(status_code=404, detail="Poll not found")

    if instance.status == "CLOSED":
        snap = (await db.execute(
            select(PollResultSnapshot).where(PollResultSnapshot.instanceId == pollId)
        )).scalar_one_or_none()

        if snap:
            return {"cached": True, "data": snap.resultsJson}

        # Fallback: if for some reason snapshot missing, compute once
        data = await buildResults(db, pollId)
        return {"cached": False, "data": data}

    # OPEN poll: use Redis cache (short TTL)
    cacheKey = f"results:{pollId}"
    cached = await redisClient.get(cacheKey)
    if cached:
        return {"cached": True, "data": json.loads(cached)}

    data = await buildResults(db, pollId)
    await redisClient.set(cacheKey, json.dumps(data), ex=10)
    return {"cached": False, "data": data}




