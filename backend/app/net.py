# app/net.py
from fastapi import Request

def getClientIp(request: Request) -> str:
    cfIp = request.headers.get("cf-connecting-ip")
    if cfIp:
        return cfIp.strip()

    xForwardedFor = request.headers.get("x-forwarded-for")
    if xForwardedFor:
        return xForwardedFor.split(",")[0].strip()

    return request.client.host if request.client else "unknown"
