import enum
from sqlalchemy import String, Integer, Boolean, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class TriggerEventType(str, enum.Enum):
    TASK_CREATED = "TASK_CREATED"
    TASK_MOVED = "TASK_MOVED"


class ActionType(str, enum.Enum):
    MOVE_TO_COLUMN = "MOVE_TO_COLUMN"
    ADD_TAG = "ADD_TAG"


class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    board_id: Mapped[int] = mapped_column(Integer, ForeignKey("boards.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    trigger_event: Mapped[TriggerEventType] = mapped_column(Enum(TriggerEventType))
    trigger_column_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("columns.id", ondelete="SET NULL"), nullable=True)
    action_type: Mapped[ActionType] = mapped_column(Enum(ActionType))
    action_column_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("columns.id", ondelete="SET NULL"), nullable=True)
    action_tag_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tags.id", ondelete="SET NULL"), nullable=True)

    board: Mapped["Board"] = relationship(back_populates="automation_rules", lazy="selectin")