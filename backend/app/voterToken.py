# app/voterToken.py
import secrets
import hashlib
from itsdangerous import URLSafeSerializer
from .settings import settings

cookieName = "vt"
serializer = URLSafeSerializer(settings.secretKey, salt="voter-token")

def mintToken() -> str:
    rawToken = secrets.token_urlsafe(32)
    return serializer.dumps({"t": rawToken})

def verifyToken(signedToken: str) -> str | None:
    try:
        data = serializer.loads(signedToken)
        return data.get("t")
    except Exception:
        return None

def hashToken(rawToken: str) -> str:
    return hashlib.sha256(rawToken.encode()).hexdigest()
