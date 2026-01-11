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
from .abuse import rateLimit, hasVoted, markVoted, hasVotedByIp, markVotedByIp, setIdempotency
from .hashUtil import hashString
from .resultsService import buildResults
from .pollsService import buildPollsForDate
from .settings import settings
from . import voterToken
from .logger import logVote, logRateLimit, logSecurity

from .models import PollInstance, PollTemplate, VoteBallot, VoteRanking, PollResultSnapshot


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
        # Build cookie params
        cookie_params = {
            "key": voterToken.cookieName,
            "value": signedNew,
            "httponly": True,
            "secure": settings.cookieSecure,
            "samesite": "lax",
            "path": "/",
            "max_age": 60 * 60 * 24 * 365,
        }
        # Only set domain if configured
        if settings.cookieDomain:
            cookie_params["domain"] = settings.cookieDomain
        
        response.set_cookie(**cookie_params)

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

    # 2) Cloudflare Turnstile verification (bot protection)
    if payload.turnstileToken:
        from .turnstile import verifyTurnstile
        turnstileValid = await verifyTurnstile(payload.turnstileToken, clientIp)
        if not turnstileValid:
            logVote(pollId, voterHash, ipHash, False, "turnstile_failed")
            raise HTTPException(status_code=403, detail="Bot verification failed")
    
    # 3) rate limiting (1 vote per IP per poll per day)
    allowed = await rateLimit(
        key=f"vote:{pollId}:{ipHash}",
        limit=1,
        windowSeconds=60 * 60 * 24,  # 24 hours
    )
    if not allowed:
        logRateLimit("vote", ipHash, f"/polls/{pollId}/vote")
        raise HTTPException(status_code=429, detail="Too many attempts")

    # 4) idempotency (optional but recommended)
    if payload.idempotencyKey:
        idemKey = f"idem:{pollId}:{voterHash}:{payload.idempotencyKey}"
        if not await setIdempotency(idemKey, ttlSeconds=60):
            # Same request already processed very recently
            return {"ok": True, "deduped": True}

    # 5) fast-path already voted (check both cookie and IP)
    if await hasVoted(pollId, voterHash):
        logVote(pollId, voterHash, ipHash, False, "duplicate_voter_hash")
        raise HTTPException(status_code=409, detail="Already voted")
    
    if await hasVotedByIp(pollId, ipHash):
        logVote(pollId, voterHash, ipHash, False, "duplicate_ip")
        raise HTTPException(status_code=409, detail="Already voted from this network")

    # 6) load poll instance + options
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
        # Optional demographic data from client-side survey
        ageRange=payload.ageRange,
        gender=payload.gender,
        race=payload.race,
        ethnicity=payload.ethnicity,
        state=payload.state,
        region=payload.region,
        urbanRuralSuburban=payload.urbanRuralSuburban,
        politicalParty=payload.politicalParty,
        politicalIdeology=payload.politicalIdeology,
        religion=payload.religion,
        educationLevel=payload.educationLevel,
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
        logVote(pollId, voterHash, ipHash, True)
    except IntegrityError:
        # Most likely: unique constraint instanceId + voterTokenHash (already voted)
        await db.rollback()
        logVote(pollId, voterHash, ipHash, False, "integrity_error")
        raise HTTPException(status_code=409, detail="Already voted")

    # 8) mark voted in Redis (both by identity and IP, TTL: 24h)
    ttl = 60 * 60 * 24
    await markVoted(
        pollId=instance.id,
        identityHash=voterHash,
        ttlSeconds=ttl,
    )
    await markVotedByIp(
        pollId=instance.id,
        ipHash=ipHash,
        ttlSeconds=ttl,
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


@router.get("/templates/{templateId}/history")
async def getTemplateHistory(
    templateId: str,
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(getDb),
):
    """Get historical poll results for a template (last N closed polls)"""
    
    # Verify template exists
    template = (await db.execute(
        select(PollTemplate).where(PollTemplate.id == templateId)
    )).scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get closed instances with snapshots, ordered by date descending
    instances = (await db.execute(
        select(PollInstance)
        .where(PollInstance.templateId == templateId)
        .where(PollInstance.status == "CLOSED")
        .order_by(PollInstance.pollDate.desc())
        .limit(limit)
    )).scalars().all()
    
    results = []
    for instance in instances:
        # Get snapshot for this instance
        snapshot = (await db.execute(
            select(PollResultSnapshot)
            .where(PollResultSnapshot.instanceId == instance.id)
        )).scalar_one_or_none()
        
        if snapshot and snapshot.resultsJson:
            result_data = snapshot.resultsJson
            poll_type = result_data.get('pollType')
            
            # Extract winner and vote breakdown
            winner = None
            options_breakdown = []
            total_votes = result_data.get('totalVotes', 0) or result_data.get('totalBallots', 0)
            
            if poll_type == 'SINGLE':
                # For single choice polls, get results from results array
                vote_results = result_data.get('results', [])
                for opt in vote_results:
                    count = opt.get('count', 0)
                    percentage = (count / total_votes * 100) if total_votes > 0 else 0
                    options_breakdown.append({
                        'optionId': opt.get('optionId'),
                        'label': opt.get('label'),
                        'voteCount': count,
                        'percentage': round(percentage, 1),
                    })
                
                # Winner is first option (already sorted by vote count)
                if options_breakdown and options_breakdown[0]['voteCount'] > 0:
                    winner = options_breakdown[0]
                    
            elif poll_type == 'RANKED':
                # For ranked choice, extract from rounds data
                rounds = result_data.get('rounds', [])
                winner_option_id = result_data.get('winnerOptionId')
                rank_breakdown = result_data.get('rankBreakdown', {})
                
                # Get ALL options from the snapshot (not just final round)
                all_options = result_data.get('options', [])
                
                # Get the final round to show final vote counts
                final_totals = {}
                if rounds:
                    final_round = rounds[-1]
                    final_totals = final_round.get('totals', {})
                
                # Build options breakdown for ALL options
                for opt in all_options:
                    option_id = opt['optionId']
                    count = final_totals.get(option_id, 0)
                    percentage = (count / total_votes * 100) if total_votes > 0 else 0
                    
                    # Get rank breakdown for this option
                    option_rank_breakdown = rank_breakdown.get(option_id, {})
                    
                    options_breakdown.append({
                        'optionId': option_id,
                        'label': opt.get('label', ''),
                        'voteCount': count,
                        'percentage': round(percentage, 1),
                        'isWinner': option_id == winner_option_id,
                        'rankBreakdown': option_rank_breakdown,
                    })
                
                # Sort by vote count descending
                options_breakdown.sort(key=lambda x: x['voteCount'], reverse=True)
                
                # Set winner
                if winner_option_id:
                    winner_data = next((opt for opt in options_breakdown if opt['optionId'] == winner_option_id), None)
                    if winner_data:
                        winner = winner_data
            
            poll_result = {
                'pollId': instance.id,
                'pollDate': str(instance.pollDate),
                'title': instance.title,
                'pollType': poll_type,
                'winner': winner,
                'options': options_breakdown,
                'totalVotes': total_votes,
            }
            
            # Include rounds data and totalBallots for ranked choice polls
            if poll_type == 'RANKED':
                poll_result['rounds'] = result_data.get('rounds', [])
                poll_result['totalBallots'] = result_data.get('totalBallots', total_votes)
            
            results.append(poll_result)
    
    return {"data": results}




