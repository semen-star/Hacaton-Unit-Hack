from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import get_settings
from fastapi.staticfiles import StaticFiles
from pathlib import Path

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Раздача фронтенда
frontend_path = Path(__file__).resolve().parent.parent.parent / "frontend"
if frontend_path.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_path)), name="static")
    
    from fastapi.responses import FileResponse
    
    @app.get("/")
    async def root():
        return FileResponse(str(frontend_path / "index.html"))

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": "1.0.0"
    }

@app.on_event("startup")
async def startup_event():
    print(f"🚀 {settings.APP_NAME} запущен!")
    print(f"📚 Документация: http://localhost:8000/docs")

@app.on_event("shutdown")
async def shutdown_event():
    print("👋 Сервер остановлен")