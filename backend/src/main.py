# backend/src/main.py
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Starting Kanban System...")
    yield
    # Shutdown
    print("👋 Shutting down...")


app = FastAPI(
    title="Kanban System API",
    description="Event-driven канбан-система с real-time синхронизацией",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS (пока открытый, позже настроим)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "kanban-api"}


@app.get("/")
async def root():
    return {
        "message": "Kanban System API",
        "docs": "/docs",
        "version": "1.0.0",
    }
