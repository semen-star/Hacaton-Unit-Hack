# backend/src/models/column.py
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base

if TYPE_CHECKING:
    from src.models.automation_rule import AutomationRule
    from src.models.board import Board
    from src.models.task import Task


class Column(Base):
    __tablename__ = "columns"
    __table_args__ = (
        UniqueConstraint("board_id", "position", name="uq_board_position"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    board_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("boards.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Связи
    board: Mapped["Board"] = relationship("Board", back_populates="columns")
    tasks: Mapped[List["Task"]] = relationship(
        "Task",
        back_populates="column",
        cascade="all, delete-orphan",
        order_by="Task.created_at",
    )
    # Правила, где эта колонка — триггер
    trigger_rules: Mapped[List["AutomationRule"]] = relationship(
        "AutomationRule",
        back_populates="trigger_column",
        foreign_keys="AutomationRule.trigger_column_id",
    )
    # Правила, где эта колонка — цель действия
    action_rules: Mapped[List["AutomationRule"]] = relationship(
        "AutomationRule",
        back_populates="action_column",
        foreign_keys="AutomationRule.action_column_id",
    )

    def __repr__(self) -> str:
        return f"<Column(id={self.id}, title='{self.title}', position={self.position})>"