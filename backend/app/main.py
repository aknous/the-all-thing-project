# app/main.py
from fastapi import FastAPI
from .publicRoutes import router as publicRouter
from .adminRoutes import router as adminRouter
from .healthRoutes import router as healthRouter

app = FastAPI(title="The All Thing Project API")

app.include_router(publicRouter)
app.include_router(adminRouter)
app.include_router(healthRouter)
