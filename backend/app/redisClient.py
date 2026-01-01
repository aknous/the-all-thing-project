# app/redisClient.py
import redis.asyncio as redis
from .settings import settings
from typing import Any

redisClient = redis.from_url(
    settings.redisUrl,
    decode_responses=True,
    socket_timeout=5,
    socket_connect_timeout=5,
    health_check_interval=30,
    retry_on_timeout=True,
    max_connections=50,
)

# Wrapper functions with graceful degradation
async def safeRedisGet(key: str, default: Any = None) -> Any:
    """Get from Redis with failover - returns default if Redis is down"""
    try:
        return await redisClient.get(key)
    except Exception:
        return default

async def safeRedisSet(key: str, value: Any, ex: int | None = None) -> bool:
    """Set in Redis with failover - returns False if Redis is down"""
    try:
        await redisClient.set(key, value, ex=ex)
        return True
    except Exception:
        return False

async def safeRedisDelete(key: str) -> bool:
    """Delete from Redis with failover - returns False if Redis is down"""
    try:
        await redisClient.delete(key)
        return True
    except Exception:
        return False

async def safeRedisIncr(key: str) -> int | None:
    """Increment in Redis with failover - returns None if Redis is down"""
    try:
        return await redisClient.incr(key)
    except Exception:
        return None

async def safeRedisExpire(key: str, seconds: int) -> bool:
    """Set expiry in Redis with failover - returns False if Redis is down"""
    try:
        await redisClient.expire(key, seconds)
        return True
    except Exception:
        return False
