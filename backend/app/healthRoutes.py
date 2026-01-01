# app/healthRoutes.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from .db import getDb
from .redisClient import redisClient
from .logger import logError

router = APIRouter(tags=["health"])

@router.get("/healthz")
async def healthz():
    """Basic liveness check - always returns OK if server is running"""
    return {"ok": True, "status": "healthy"}

@router.get("/readyz")
async def readyz(db: AsyncSession = Depends(getDb)):
    """Readiness check - verifies dependencies are available"""
    status = {
        "ok": True,
        "components": {}
    }
    
    # Check PostgreSQL
    try:
        await db.execute(text("SELECT 1"))
        status["components"]["database"] = "healthy"
    except Exception as e:
        status["ok"] = False
        status["components"]["database"] = "unhealthy"
        logError("health_check_database_failed", str(e))
    
    # Check Redis
    try:
        if await redisClient.ping():
            status["components"]["redis"] = "healthy"
        else:
            status["ok"] = False
            status["components"]["redis"] = "unhealthy"
    except Exception as e:
        status["ok"] = False
        status["components"]["redis"] = "unhealthy"
        logError("health_check_redis_failed", str(e))
    
    if not status["ok"]:
        status["status"] = "degraded"
        return status
    
    status["status"] = "healthy"
    return status
