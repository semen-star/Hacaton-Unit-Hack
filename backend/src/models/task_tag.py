# backend/src/models/task_tag.py
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base

if TYPE_CHECKING:
    from src.models.tag import Tag
    from src.models.task import Task


class TaskTag(Base):
    __tablename__ = "task_tags"
    __table_args__ = (
        UniqueConstraint("task_id", "tag_id", name="uq_task_tag"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    tag_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tags.id", ondelete="CASCADE"), nullable=False
    )

    # Связи
    task: Mapped["Task"] = relationship("Task", back_populates="task_tags")
    tag: Mapped["Tag"] = relationship("Tag", back_populates="task_tags")

    def __repr__(self) -> str:
        return f"<TaskTag(task_id={self.task_id}, tag_id={self.tag_id})>"