from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.api.v1.auth import get_current_user
from src.models.user import User

router = APIRouter(prefix="/columns", tags=["columns"])


@router.post("/")
async def create_column(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return {"message": "Column created"}
