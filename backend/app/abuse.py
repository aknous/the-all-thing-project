# app/abuse.py
import time
from .redisClient import redisClient

async def rateLimit(key: str, limit: int, windowSeconds: int) -> bool:
    bucket = int(time.time() // windowSeconds)
    redisKey = f"rl:{key}:{bucket}"

    count = await redisClient.incr(redisKey)
    if count == 1:
        await redisClient.expire(redisKey, windowSeconds + 1)

    return count <= limit

async def setIdempotency(key: str, ttlSeconds: int = 60) -> bool:
    result = await redisClient.set(key, "1", ex=ttlSeconds, nx=True)
    return result is True

async def markVoted(pollId: str, identityHash: str, ttlSeconds: int) -> None:
    await redisClient.set(
        f"voted:{pollId}:{identityHash}",
        "1",
        ex=ttlSeconds,
    )

async def hasVoted(pollId: str, identityHash: str) -> bool:
    return await redisClient.exists(
        f"voted:{pollId}:{identityHash}"
    ) == 1
