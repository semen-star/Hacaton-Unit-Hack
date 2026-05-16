from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class Column(Base):
    __tablename__ = "columns"

    id: Mapped[int] = mapped_column(primary_key=True)
    board_id: Mapped[int] = mapped_column(Integer, ForeignKey("boards.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("board_id", "position", name="uq_board_position"),
    )

    board: Mapped["Board"] = relationship(back_populates="columns", lazy="selectin")
    tasks: Mapped[list["Task"]] = relationship(back_populates="column", lazy="selectin", order_by="Task.created_at")