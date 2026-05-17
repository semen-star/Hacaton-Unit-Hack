from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from src.models.notification import Notification
from src.models.user import User
from src.schemas.notification import NotificationCreate, NotificationResponse


class NotificationService:
    """Сервис для работы с уведомлениями"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_notification(
        self, 
        user_id: int, 
        title: str, 
        message: str, 
        notification_type: str = "info"
    ) -> Notification:
        """Создание уведомления для пользователя"""
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notification_type
        )
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)
        return notification
    
    async def create_notification_for_all_admins(
        self, 
        title: str, 
        message: str, 
        notification_type: str = "info"
    ) -> list[Notification]:
        """Создание уведомления для всех администраторов"""
        # Находим всех админов
        result = await self.db.execute(
            select(User).where(User.role == "admin", User.is_active == True)
        )
        admins = result.scalars().all()
        
        notifications = []
        for admin in admins:
            notif = await self.create_notification(
                user_id=admin.id,
                title=title,
                message=message,
                notification_type=notification_type
            )
            notifications.append(notif)
        
        return notifications
    
    async def get_user_notifications(
        self, 
        user_id: int, 
        limit: int = 50, 
        only_unread: bool = False
    ) -> list[Notification]:
        """Получение уведомлений пользователя"""
        query = select(Notification).where(Notification.user_id == user_id)
        
        if only_unread:
            query = query.where(Notification.is_read == False)
        
        query = query.order_by(desc(Notification.created_at)).limit(limit)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def mark_as_read(self, notification_id: int, user_id: int) -> Notification | None:
        """Отметить уведомление как прочитанное"""
        result = await self.db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id
            )
        )
        notification = result.scalar_one_or_none()
        
        if notification:
            notification.is_read = True
            await self.db.commit()
            await self.db.refresh(notification)
        
        return notification
    
    async def mark_all_as_read(self, user_id: int) -> int:
        """Отметить все уведомления пользователя как прочитанные"""
        result = await self.db.execute(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
        )
        notifications = result.scalars().all()
        
        for notification in notifications:
            notification.is_read = True
        
        await self.db.commit()
        return len(notifications)
    
    async def delete_notification(self, notification_id: int, user_id: int) -> bool:
        """Удалить уведомление"""
        result = await self.db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id
            )
        )
        notification = result.scalar_one_or_none()
        
        if notification:
            await self.db.delete(notification)
            await self.db.commit()
            return True
        
        return False
    
    async def get_unread_count(self, user_id: int) -> int:
        """Получить количество непрочитанных уведомлений"""
        result = await self.db.execute(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
        )
        return len(result.scalars().all())