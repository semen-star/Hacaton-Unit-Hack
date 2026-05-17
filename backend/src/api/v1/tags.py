from fastapi import APIRouter, Depends

from src.api.v1.auth import get_current_user
from src.models.user import User

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("/")
async def get_tags(current_user: User = Depends(get_current_user)):
    return {"tags": []}
