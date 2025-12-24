# app/main.py
from fastapi import FastAPI
from .publicRoutes import router as publicRouter
from .adminRoutes import router as adminRouter
from .healthRoutes import router as healthRouter

app = FastAPI(
    title="The All Thing Project API",
    version="0.1.0",
    description="Public opinion polling with daily snapshots and ranked-choice voting",
)

app.include_router(publicRouter)
app.include_router(adminRouter)
app.include_router(healthRouter)

@app.get("/")
async def root():
    return {"ok": True, "service": "the-all-thing-project-api"}
