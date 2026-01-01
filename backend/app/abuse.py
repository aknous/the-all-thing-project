# app/abuse.py
import time
import hashlib
from .redisClient import redisClient, safeRedisIncr, safeRedisExpire, safeRedisSet, safeRedisGet
from .logger import logError

async def rateLimit(key: str, limit: int, windowSeconds: int) -> bool:
    """Rate limit for specific operations (e.g., voting on a specific poll)"""
    try:
        bucket = int(time.time() // windowSeconds)
        redisKey = f"rl:{key}:{bucket}"

        count = await safeRedisIncr(redisKey)
        if count is None:
            # Redis is down, fail open (allow request)
            logError("rate_limit_redis_unavailable", "Redis unavailable, allowing request", key=key)
            return True
        
        if count == 1:
            await safeRedisExpire(redisKey, windowSeconds + 1)

        return count <= limit
    except Exception as e:
        # Fail open on error
        logError("rate_limit_error", str(e), key=key)
        return True

async def globalRateLimit(clientIp: str, limit: int = 100, windowSeconds: int = 60) -> bool:
    """Global rate limit per IP across all endpoints"""
    try:
        bucket = int(time.time() // windowSeconds)
        redisKey = f"grl:{clientIp}:{bucket}"
        
        count = await safeRedisIncr(redisKey)
        if count is None:
            # Redis is down, fail open
            return True
        
        if count == 1:
            await safeRedisExpire(redisKey, windowSeconds + 1)
        
        return count <= limit
    except Exception:
        # Fail open if Redis is down
        return True

async def setIdempotency(key: str, ttlSeconds: int = 60) -> bool:
    """Set idempotency key - returns True if set, False if already exists or Redis down"""
    try:
        result = await redisClient.set(key, "1", ex=ttlSeconds, nx=True)
        return result is True
    except Exception:
        # Redis down, allow request (no idempotency check)
        return True

async def markVoted(pollId: str, identityHash: str, ttlSeconds: int) -> None:
    """Mark that this identity has voted - gracefully handles Redis failures"""
    try:
        await safeRedisSet(
            f"voted:{pollId}:{identityHash}",
            "1",
            ex=ttlSeconds,
        )
    except Exception:
        pass  # Silent fail - vote still recorded in database

async def hasVoted(pollId: str, identityHash: str) -> bool:
    """Check if identity has voted - returns False if Redis is down"""
    try:
        result = await safeRedisGet(f"voted:{pollId}:{identityHash}")
        return result is not None
    except Exception:
        return False  # Fail open - let database constraint catch duplicates

async def markVotedByIp(pollId: str, ipHash: str, ttlSeconds: int) -> None:
    """Track votes by IP hash to prevent multiple votes from same IP"""
    try:
        await safeRedisSet(
            f"voted:ip:{pollId}:{ipHash}",
            "1",
            ex=ttlSeconds,
        )
    except Exception:
        pass  # Silent fail

async def hasVotedByIp(pollId: str, ipHash: str) -> bool:
    """Check if this IP has already voted on this poll"""
    try:
        result = await safeRedisGet(f"voted:ip:{pollId}:{ipHash}")
        return result is not None
    except Exception:
        return False  # Fail open

def hashAdminKey(adminKey: str) -> str:
    """Hash admin key for audit logging (privacy)"""
    return hashlib.sha256(adminKey.encode()).hexdigest()[:16]
