from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from src.core.database import get_db
from src.api.v1.auth import get_current_user
from src.models.user import User
from src.services.notification_service import NotificationService
from src.schemas.notification import NotificationResponse, NotificationCreate

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=List[NotificationResponse])
async def get_my_notifications(
    limit: int = 50,
    only_unread: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить уведомления текущего пользователя"""
    service = NotificationService(db)
    notifications = await service.get_user_notifications(
        user_id=current_user.id,
        limit=limit,
        only_unread=only_unread
    )
    return notifications


@router.get("/unread/count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить количество непрочитанных уведомлений"""
    service = NotificationService(db)
    count = await service.get_unread_count(current_user.id)
    return {"unread_count": count}


@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Отметить уведомление как прочитанное"""
    service = NotificationService(db)
    notification = await service.mark_as_read(notification_id, current_user.id)
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    return {"message": "Notification marked as read"}


@router.put("/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Отметить все уведомления как прочитанные"""
    service = NotificationService(db)
    count = await service.mark_all_as_read(current_user.id)
    return {"message": f"{count} notifications marked as read"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удалить уведомление"""
    service = NotificationService(db)
    deleted = await service.delete_notification(notification_id, current_user.id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    return {"message": "Notification deleted"}