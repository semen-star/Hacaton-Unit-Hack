# backend/src/models/__init__.py
from src.models.base import Base
from src.models.user import User
from src.models.board import Board
from src.models.column import Column
from src.models.tag import Tag
from src.models.task import Task
from src.models.task_tag import TaskTag
from src.models.automation_rule import AutomationRule
from src.models.notification import Notification

__all__ = [
    "Base",
    "User",
    "Board",
    "Column",
    "Tag",
    "Task",
    "TaskTag",
    "AutomationRule",
    "Notification",
]
