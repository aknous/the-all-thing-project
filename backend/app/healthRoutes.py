# app/healthRoutes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from .db import getDb
from .redisClient import redisClient

router = APIRouter(tags=["health"])

@router.get("/healthz")
async def healthz():
    return {"ok": True}

@router.get("/readyz")
async def readyz(db: AsyncSession = Depends(getDb)):
    # Postgres check
    await db.execute(text("SELECT 1"))

    # Redis check
    if not await redisClient.ping():
        raise HTTPException(status_code=503, detail="Redis unavailable")

    return {"ok": True}
