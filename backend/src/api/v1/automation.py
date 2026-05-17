from fastapi import APIRouter, Depends

from src.api.v1.auth import get_current_user
from src.models.user import User

router = APIRouter(prefix="/automation", tags=["automation"])


@router.get("/rules")
async def get_rules(current_user: User = Depends(get_current_user)):
    return {"rules": []}
