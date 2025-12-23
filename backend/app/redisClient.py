# app/redisClient.py
import redis.asyncio as redis
from .settings import settings

redisClient = redis.from_url(
    settings.redisUrl,
    decode_responses=True,
    socket_timeout=5,
    socket_connect_timeout=5,
    health_check_interval=30,
)
