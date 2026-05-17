from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pathlib import Path
from .core.config import get_settings
from .api.v1 import tasks, init
from .core.database import engine, Base

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API
app.include_router(tasks.router)
app.include_router(init.router)

# Frontend
frontend_path = Path(__file__).resolve().parent.parent.parent / "frontend"
if frontend_path.exists():
    @app.get("/")
    async def root():
        return FileResponse(str(frontend_path / "index.html"))

    @app.get("/favicon.ico")
    async def favicon():
        favicon_file = frontend_path / "favicon.ico"
        if favicon_file.exists():
            return FileResponse(str(favicon_file))
        return Response(status_code=204)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": "1.0.0"
    }


@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print(f">>> {settings.APP_NAME} started!")
    print(f">>> Docs: http://localhost:8000/docs")


@app.on_event("shutdown")
async def shutdown_event():
    print(">>> Server stopped")