# app/adminAuth.py
import secrets
from fastapi import Header, HTTPException, Request
from .settings import settings
from .abuse import hashAdminKey

class AdminContext:
    """Context object for admin requests with audit info"""
    def __init__(self, adminKeyHash: str, ipAddress: str, userAgent: str):
        self.adminKeyHash = adminKeyHash
        self.ipAddress = ipAddress
        self.userAgent = userAgent

async def requireAdmin(
    request: Request,
    xAdminKey: str = Header(default="", alias="x-admin-key")
) -> AdminContext:
    """Verify admin key and return context for audit logging"""
    # Use constant-time comparison to prevent timing attacks
    if not secrets.compare_digest(xAdminKey.encode(), settings.adminKey.encode()):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Build context for audit logging
    adminKeyHash = hashAdminKey(xAdminKey)
    ipAddress = request.client.host if request.client else None
    userAgent = request.headers.get("user-agent", "")
    
    return AdminContext(
        adminKeyHash=adminKeyHash,
        ipAddress=ipAddress,
        userAgent=userAgent
    )
