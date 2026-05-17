from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from src.core.database import get_db
from src.api.v1.auth import get_current_user
from src.models.user import User

router = APIRouter(prefix="/boards", tags=["boards"])


@router.get("/{board_id}")
async def get_board(
    board_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return {"id": board_id, "title": "Main Board", "columns": []}
