# backend/src/models/automation_rule.py
import enum

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING, Optional

from src.core.database import Base

if TYPE_CHECKING:
    from src.models.board import Board
    from src.models.column import Column
    from src.models.tag import Tag


class TriggerEventType(str, enum.Enum):
    TASK_CREATED = "TASK_CREATED"
    TASK_MOVED = "TASK_MOVED"


class ActionType(str, enum.Enum):
    MOVE_TO_COLUMN = "MOVE_TO_COLUMN"
    ADD_TAG = "ADD_TAG"


class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    board_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("boards.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )
    trigger_event: Mapped[TriggerEventType] = mapped_column(
        Enum(TriggerEventType, name="trigger_event_type", create_type=False),
        nullable=False,
    )
    trigger_column_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("columns.id", ondelete="SET NULL")
    )
    action_type: Mapped[ActionType] = mapped_column(
        Enum(ActionType, name="action_type_enum", create_type=False), nullable=False
    )
    action_column_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("columns.id", ondelete="SET NULL")
    )
    action_tag_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tags.id", ondelete="SET NULL")
    )

    # Связи
    board: Mapped["Board"] = relationship("Board", back_populates="automation_rules")
    trigger_column: Mapped[Optional["Column"]] = relationship(
        "Column", back_populates="trigger_rules", foreign_keys=[trigger_column_id]
    )
    action_column: Mapped[Optional["Column"]] = relationship(
        "Column", back_populates="action_rules", foreign_keys=[action_column_id]
    )
    action_tag: Mapped[Optional["Tag"]] = relationship(
        "Tag", back_populates="automation_rules"
    )

    def __repr__(self) -> str:
        return f"<AutomationRule(id={self.id}, name='{self.name}', trigger={self.trigger_event})>"