
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.core.database import get_db
from src.api.v1.auth import get_current_user, get_current_admin
from src.models.user import User
from src.models.board import Board
from src.models.column import Column
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# Pydantic схемы для колонок
class ColumnCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    board_id: int
    order: Optional[int] = 0


class ColumnResponse(BaseModel):
    id: int
    title: str
    board_id: int
    order: int
    created_at: datetime

    class Config:
        from_attributes = True


router = APIRouter(prefix="/columns", tags=["columns"])


@router.post("/", response_model=ColumnResponse, status_code=status.HTTP_201_CREATED)
async def create_column(
    column_data: ColumnCreate,
    current_user: User = Depends(get_current_admin),  # Только админ
    db: AsyncSession = Depends(get_db)
):
    """Создание новой колонки"""
    # Проверяем, существует ли доска
    result = await db.execute(select(Board).where(Board.id == column_data.board_id))
    board = result.scalar_one_or_none()
    
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Board with id {column_data.board_id} not found"
        )
    
    # Создаём колонку
    new_column = Column(
        title=column_data.title,
        board_id=column_data.board_id,
        order=column_data.order or 0
    )
    
    db.add(new_column)
    await db.commit()
    await db.refresh(new_column)
    
    return ColumnResponse(
        id=new_column.id,
        title=new_column.title,
        board_id=new_column.board_id,
        order=new_column.order,
        created_at=new_column.created_at
    )


@router.get("/{column_id}")
async def get_column(
    column_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение информации о колонке"""
    result = await db.execute(select(Column).where(Column.id == column_id))
    column = result.scalar_one_or_none()
    
    if not column:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Column with id {column_id} not found"
        )
    
    return {
        "id": column.id,
        "title": column.title,
        "board_id": column.board_id,
        "order": column.order,
        "created_at": column.created_at
    }


@router.put("/{column_id}")
async def update_column(
    column_id: int,
    title: str,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Обновление колонки"""
    result = await db.execute(select(Column).where(Column.id == column_id))
    column = result.scalar_one_or_none()
    
    if not column:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Column with id {column_id} not found"
        )
    
    column.title = title
    await db.commit()
    
    return {"message": "Column updated"}


@router.delete("/{column_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_column(
    column_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Удаление колонки"""
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


@router.get("/board/{board_id}")
async def get_board_columns(
    board_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение всех колонок доски"""
    result = await db.execute(
        select(Column)
        .where(Column.board_id == board_id)
        .order_by(Column.order)
    )
    columns = result.scalars().all()
    
    return [
        {
            "id": col.id,
            "title": col.title,
            "board_id": col.board_id,
            "order": col.order,
            "created_at": col.created_at
        }
        for col in columns
    ]
