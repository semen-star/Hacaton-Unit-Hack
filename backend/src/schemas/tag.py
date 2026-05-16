# backend/src/models/tag.py
from typing import TYPE_CHECKING, List

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base

if TYPE_CHECKING:
    from src.models.automation_rule import AutomationRule
    from src.models.task_tag import TaskTag


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#3498db", nullable=False)

    # Связи
    task_tags: Mapped[List["TaskTag"]] = relationship(
        "TaskTag", back_populates="tag", cascade="all, delete-orphan"
    )
    automation_rules: Mapped[List["AutomationRule"]] = relationship(
        "AutomationRule", back_populates="action_tag"
    )

    def __repr__(self) -> str:
        return f"<Tag(id={self.id}, name='{self.name}')>"