# backend/src/models/board.py
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base

if TYPE_CHECKING:
    from src.models.automation_rule import AutomationRule
    from src.models.column import Column
    from src.models.user import User


class Board(Base):
    __tablename__ = "boards"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default="CURRENT_TIMESTAMP",
        nullable=False,
    )

    # Связи
    owner: Mapped["User"] = relationship("User", back_populates="owned_boards")
    columns: Mapped[List["Column"]] = relationship(
        "Column",
        back_populates="board",
        cascade="all, delete-orphan",
        order_by="Column.position",
    )
    automation_rules: Mapped[List["AutomationRule"]] = relationship(
        "AutomationRule", back_populates="board", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Board(id={self.id}, title='{self.title}')>"