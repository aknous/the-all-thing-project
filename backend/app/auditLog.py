# app/auditLog.py
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import String, DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.ext.asyncio import AsyncSession

from .db import Base

try:
    from sqlalchemy.dialects.postgresql import JSONB as JsonType
except Exception:
    from sqlalchemy import JSON as JsonType  # type: ignore


class AdminAuditLog(Base):
    """Track all admin actions for security and debugging"""
    __tablename__ = "adminAuditLogs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    
    # Action details
    action: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    entityType: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    entityId: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    
    # Who & when
    adminKeyHash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    ipAddress: Mapped[str | None] = mapped_column(String(45), nullable=True)  # IPv6 max length
    userAgent: Mapped[str | None] = mapped_column(String(256), nullable=True)
    
    # What changed
    changes: Mapped[dict | None] = mapped_column(JsonType, nullable=True)
    extraData: Mapped[dict | None] = mapped_column(JsonType, nullable=True)
    
    # Result
    success: Mapped[bool] = mapped_column(nullable=False, default=True, index=True)
    errorMessage: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    createdAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True
    )


async def logAdminAction(
    db: AsyncSession,
    action: str,
    entityType: str | None = None,
    entityId: str | None = None,
    adminKeyHash: str | None = None,
    ipAddress: str | None = None,
    userAgent: str | None = None,
    changes: dict | None = None,
    extraData: dict | None = None,
    success: bool = True,
    errorMessage: str | None = None,
) -> None:
    """Log an admin action to the audit log"""
    auditLog = AdminAuditLog(
        id=str(uuid.uuid4()),
        action=action,
        entityType=entityType,
        entityId=entityId,
        adminKeyHash=adminKeyHash,
        ipAddress=ipAddress,
        userAgent=userAgent,
        changes=changes,
        extraData=extraData,
        success=success,
        errorMessage=errorMessage,
    )
    
    db.add(auditLog)
    # Note: Caller should commit the transaction
