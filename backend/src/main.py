from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pathlib import Path
from .core.config import get_settings
from .core.database import engine, Base
from .api.v1 import tasks, init, auth, boards, columns, notification, automation, tags, ws

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version="2.0.0",
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

# API роутеры
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(tasks.router, prefix="/api/v1", tags=["tasks"])
app.include_router(boards.router, prefix="/api/v1", tags=["boards"])
app.include_router(columns.router, prefix="/api/v1/columns", tags=["columns"])
app.include_router(notification.router, prefix="/api/v1", tags=["notifications"])
app.include_router(init.router, prefix="/api/v1", tags=["init"])

# Frontend
frontend_path = Path(__file__).resolve().parent.parent.parent / "frontend"

if frontend_path.exists():
    # Монтируем статические файлы
    app.mount("/static", StaticFiles(directory=str(frontend_path)), name="static")
    
    # Страница входа (теперь открывается первой)
    @app.get("/")
    async def root():
        login_file = frontend_path / "login register" / "index.html"
        if login_file.exists():
            return FileResponse(str(login_file))
        return Response(status_code=404)
    
    # Основная доска (защищена через фронт)
    @app.get("/main")
    async def main_board():
        main_file = frontend_path / "main" / "index.html"
        if main_file.exists():
            return FileResponse(str(main_file))
        return Response(status_code=404)
    
    # Админ панель (защищена через фронт)
    @app.get("/admin")
    async def admin_panel():
        admin_file = frontend_path / "admin" / "admin.html"
        if admin_file.exists():
            return FileResponse(str(admin_file))
        return Response(status_code=404)
    
    # Страница логина/регистрации (прямой доступ)
    @app.get("/login%20register")
    @app.get("/login")
    @app.get("/register")
    async def login_register():
        login_file = frontend_path / "login register" / "index.html"
        if login_file.exists():
            return FileResponse(str(login_file))
        return Response(status_code=404)
    
    # Обслуживание favicon
    @app.get("/favicon.ico")
    async def favicon():
        favicon_file = frontend_path / "favicon.ico"
        if favicon_file.exists():
            return FileResponse(str(favicon_file))
        return Response(status_code=204)
    
    # Fallback для SPA маршрутов
    @app.get("/{path:path}")
    async def catch_all(path: str):
        # Проверяем, есть ли запрошенный файл
        file_path = frontend_path / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        
        # Если нет, но это похоже на маршрут фронта - отдаём соответствующую страницу
        if path.startswith("main") or path == "main":
            main_file = frontend_path / "main" / "index.html"
            if main_file.exists():
                return FileResponse(str(main_file))
        elif path.startswith("admin") or path == "admin":
            admin_file = frontend_path / "admin" / "admin.html"
            if admin_file.exists():
                return FileResponse(str(admin_file))
        elif path.startswith("login") or path.startswith("register"):
            login_file = frontend_path / "login register" / "index.html"
            if login_file.exists():
                return FileResponse(str(login_file))
        
        return Response(status_code=404)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": "2.0.0"
    }


@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        # Создаём все таблицы (включая users, notifications)
        await conn.run_sync(Base.metadata.create_all)
    print(f">>> {settings.APP_NAME} v2.0.0 started!")
    print(f">>> API Docs: http://localhost:8000/docs")
    print(f">>> Frontend login: http://localhost:8000/")
    print(f">>> Main board: http://localhost:8000/main")
    print(f">>> Admin panel: http://localhost:8000/admin")


@app.on_event("shutdown")
async def shutdown_event():
    print(">>> Server stopped")