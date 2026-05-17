from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from src.core.database import get_db
from src.api.v1.auth import get_current_user, get_current_admin
from src.models.user import User
from src.models.board import Board
from src.models.column import Column

# Pydantic схемы
class ColumnCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    board_id: int
    position: Optional[int] = 0


class ColumnResponse(BaseModel):
    id: int
    title: str
    board_id: int
    position: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ⚠️ ВАЖНО: prefix убран, теперь весь путь формируется в main.py
router = APIRouter(tags=["columns"])


@router.post("", response_model=ColumnResponse, status_code=status.HTTP_201_CREATED)
async def create_column(
    column_data: ColumnCreate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Создание новой колонки (только админ)"""
    result = await db.execute(select(Board).where(Board.id == column_data.board_id))
    board = result.scalar_one_or_none()
    
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Board with id {column_data.board_id} not found"
        )
    
    new_column = Column(
        title=column_data.title,
        board_id=column_data.board_id,
        position=column_data.position or 0
    )
    
    db.add(new_column)
    await db.commit()
    await db.refresh(new_column)
    
    return ColumnResponse(
        id=new_column.id,
        title=new_column.title,
        board_id=new_column.board_id,
        position=new_column.position,
        created_at=getattr(new_column, 'created_at', None)
    )


@router.get("/", response_model=List[ColumnResponse])
async def get_all_columns(
    board_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение всех колонок (опционально по board_id)"""
    if board_id:
        result = await db.execute(
            select(Column)
            .where(Column.board_id == board_id)
            .order_by(Column.position)
        )
    else:
        result = await db.execute(select(Column).order_by(Column.position))
    
    columns = result.scalars().all()
    
    return [
        ColumnResponse(
            id=col.id,
            title=col.title,
            board_id=col.board_id,
            position=col.position,
            created_at=getattr(col, 'created_at', None)
        )
        for col in columns
    ]


@router.get("/{column_id}", response_model=ColumnResponse)
async def get_column(
    column_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение информации о колонке по ID"""
    result = await db.execute(select(Column).where(Column.id == column_id))
    column = result.scalar_one_or_none()
    
    if not column:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Column with id {column_id} not found"
        )
    
    return ColumnResponse(
        id=column.id,
        title=column.title,
        board_id=column.board_id,
        position=column.position,
        created_at=getattr(column, 'created_at', None)
    )


@router.put("/{column_id}", response_model=ColumnResponse)
async def update_column(
    column_id: int,
    title: str,
    position: Optional[int] = None,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Обновление колонки (только админ)"""
    result = await db.execute(select(Column).where(Column.id == column_id))
    column = result.scalar_one_or_none()
    
    if not column:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Column with id {column_id} not found"
        )
    
    column.title = title
    if position is not None:
        column.position = position
    
    await db.commit()
    await db.refresh(column)
    
    return ColumnResponse(
        id=column.id,
        title=column.title,
        board_id=column.board_id,
        position=column.position,
        created_at=getattr(column, 'created_at', None)
    )


@router.delete("/{column_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_column(
    column_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Удаление колонки (только админ)"""
    result = await db.execute(select(Column).where(Column.id == column_id))
    column = result.scalar_one_or_none()
    
    if not column:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Column with id {column_id} not found"
        )
    
    await db.delete(column)
    await db.commit()
    
    return None


@router.get("/board/{board_id}", response_model=List[ColumnResponse])
async def get_columns_by_board(
    board_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение всех колонок конкретной доски"""
    result = await db.execute(
        select(Column)
        .where(Column.board_id == board_id)
        .order_by(Column.position)
    )
    columns = result.scalars().all()
    
    return [
        ColumnResponse(
            id=col.id,
            title=col.title,
            board_id=col.board_id,
            position=col.position,
            created_at=getattr(col, 'created_at', None)
        )
        for col in columns
    ]
