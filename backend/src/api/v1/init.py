from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps import get_db
from src.models.user import User, UserRole
from src.models.board import Board
from src.models.column import Column
from src.models.tag import Tag

router = APIRouter(prefix="/api/v1", tags=["init"])


@router.post("/init")
async def init_database(session: AsyncSession = Depends(get_db)):
    """Заполнить базу начальными данными (выполнить один раз)"""
    
    # Проверяем, есть ли уже данные
    from sqlalchemy import select, func
    result = await session.execute(select(func.count()).select_from(User))
    if result.scalar() > 0:
        return {"status": "already_initialized"}

    # Создаём админа
    admin = User(
        username="manager_alex",
        email="alex@company.com",
        password="hash_placeholder",
        role=UserRole.ADMIN,
        is_active=True,
    )
    session.add(admin)

    # Создаём пользователя
    dev = User(
        username="developer_john",
        email="john@company.com",
        password="hash_placeholder",
        role=UserRole.USER,
        is_active=True,
    )
    session.add(dev)
    await session.flush()

    # Создаём доску
    board = Board(
        title="Main Board",
        description="Основная канбан-доска",
        owner_id=admin.id,
    )
    session.add(board)
    await session.flush()

    # Создаём колонки
    columns_data = [
        ("To Do", 1),
        ("In Progress", 2),
        ("Done", 3),
    ]
    for title, pos in columns_data:
        col = Column(board_id=board.id, title=title, position=pos)
        session.add(col)

    # Создаём теги
    tags_data = [
        ("баг", "#e74c3c"),
        ("фича", "#2ecc71"),
        ("срочно", "#f39c12"),
    ]
    for name, color in tags_data:
        tag = Tag(name=name, color=color)
        session.add(tag)

    await session.commit()
    return {"status": "ok", "board_id": board.id, "message": "База заполнена начальными данными"}