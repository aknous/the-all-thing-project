# app/main.py
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .publicRoutes import router as publicRouter
from .adminRoutes import router as adminRouter
from .healthRoutes import router as healthRouter
from .settings import settings
from .abuse import globalRateLimit
from .net import getClientIp
from .logger import logRateLimit

app = FastAPI(
    title="The All Thing Project API",
    version="0.1.0",
    description="Public opinion polling with daily snapshots and ranked-choice voting",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.corsOrigins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Global Rate Limiting Middleware
@app.middleware("http")
async def globalRateLimitMiddleware(request: Request, callNext):
    # Skip rate limiting for health checks
    if request.url.path.startswith("/health"):
        return await callNext(request)
    
    clientIp = getClientIp(request)
    allowed = await globalRateLimit(clientIp)
    if not allowed:
        logRateLimit("global", clientIp, request.url.path)
        raise HTTPException(
            status_code=429,
            detail="Global rate limit exceeded. Please slow down."
        )
    
    return await callNext(request)

app.include_router(publicRouter)
app.include_router(adminRouter)
app.include_router(healthRouter)

@app.get("/")
async def root():
    return {"ok": True, "service": "the-all-thing-project-api"}
