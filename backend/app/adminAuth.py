# app/adminAuth.py
from fastapi import Header, HTTPException
from .settings import settings

async def requireAdmin(xAdminKey: str = Header(default="")):
    if xAdminKey != settings.adminKey:
        raise HTTPException(status_code=401, detail="Unauthorized")
