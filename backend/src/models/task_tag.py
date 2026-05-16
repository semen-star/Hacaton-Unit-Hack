from sqlalchemy import Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class TaskTag(Base):
    __tablename__ = "task_tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    tag_id: Mapped[int] = mapped_column(Integer, ForeignKey("tags.id", ondelete="CASCADE"))

    __table_args__ = (
        UniqueConstraint("task_id", "tag_id", name="uq_task_tag"),
    )

    task: Mapped["Task"] = relationship(back_populates="task_tags", lazy="selectin")
    tag: Mapped["Tag"] = relationship(back_populates="task_tags", lazy="selectin")