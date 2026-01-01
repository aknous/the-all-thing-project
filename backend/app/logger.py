# app/logger.py
import logging
import sys
from datetime import datetime
from typing import Any
import json

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("allthing")


def logStructured(
    level: str,
    event: str,
    **kwargs: Any
) -> None:
    """
    Log structured JSON events for easier parsing and monitoring.
    
    Args:
        level: Log level (INFO, WARNING, ERROR, etc.)
        event: Event name/type
        **kwargs: Additional context fields
    """
    logData = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "event": event,
        **kwargs
    }
    
    logMessage = json.dumps(logData)
    
    if level == "INFO":
        logger.info(logMessage)
    elif level == "WARNING":
        logger.warning(logMessage)
    elif level == "ERROR":
        logger.error(logMessage)
    elif level == "CRITICAL":
        logger.critical(logMessage)
    else:
        logger.debug(logMessage)


def logVote(pollId: str, voterHash: str, ipHash: str, success: bool, reason: str | None = None) -> None:
    """Log vote attempts"""
    logStructured(
        "INFO" if success else "WARNING",
        "vote_attempt",
        pollId=pollId,
        voterHash=voterHash[:8],  # Only log prefix for privacy
        ipHash=ipHash[:8],
        success=success,
        reason=reason,
    )


def logError(event: str, error: str, **context: Any) -> None:
    """Log errors with context"""
    logStructured(
        "ERROR",
        event,
        error=error,
        **context
    )


def logSecurity(event: str, severity: str, **context: Any) -> None:
    """Log security-related events"""
    logStructured(
        severity,
        f"security_{event}",
        **context
    )


def logRateLimit(limitType: str, identifier: str, endpoint: str) -> None:
    """Log rate limit violations"""
    logStructured(
        "WARNING",
        "rate_limit_exceeded",
        limitType=limitType,
        identifier=identifier[:8],  # Hash prefix only
        endpoint=endpoint,
    )
