# app/turnstile.py
"""Cloudflare Turnstile verification for bot protection."""

import httpx
from .settings import settings
from .logger import logError

async def verifyTurnstile(token: str, clientIp: str) -> bool:
    """
    Verify Cloudflare Turnstile token.
    Returns True if verification passes or if Turnstile is not configured.
    Returns False only if verification explicitly fails.
    """
    # If no secret key configured, skip verification (fail open)
    if not settings.turnstileSecretKey:
        return True
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                json={
                    "secret": settings.turnstileSecretKey,
                    "response": token,
                    "remoteip": clientIp,
                }
            )
            
            if response.status_code != 200:
                logError("turnstile_verify_error", f"HTTP {response.status_code}", token=token[:20])
                return False
            
            data = response.json()
            success = data.get("success", False)
            
            if not success:
                error_codes = data.get("error-codes", [])
                logError("turnstile_verify_failed", f"Errors: {error_codes}", token=token[:20])
            
            return success
            
    except httpx.TimeoutException:
        logError("turnstile_timeout", "Turnstile verification timed out")
        # Fail open on timeout to avoid blocking legitimate users
        return True
    except Exception as e:
        logError("turnstile_exception", str(e))
        # Fail open on unexpected errors
        return True
