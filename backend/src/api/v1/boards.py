from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from src.core.database import get_db
from src.api.v1.auth import get_current_user
from src.models.user import User
from src.models.board import Board
from src.models.column import Column

router = APIRouter(tags=["boards"])

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_board(
    title: str = "Main Board",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    board = Board(title=title, owner_id=current_user.id)
    db.add(board)
    await db.commit()
    await db.refresh(board)
    return board


@router.get("/{board_id}")
async def get_board(
    board_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение доски с колонками и задачами"""
    result = await db.execute(
        select(Board)
        .where(Board.id == board_id)
        .options(
            selectinload(Board.columns).selectinload(Column.tasks)
        )
    )
    board = result.scalar_one_or_none()
    
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    return board
