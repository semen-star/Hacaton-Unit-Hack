from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class TaskPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    column_id: int
    tags: list[str] = []


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    column_id: Optional[int] = None


class TaskMove(BaseModel):
    task_id: int
    new_column_id: int


class TaskResponse(BaseModel):
    id: int
    column_id: int
    title: str
    description: Optional[str] = None
    priority: TaskPriority
    assignee_id: Optional[int] = None
    deadline: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    version: int
    tags: list[str] = []

    model_config = {"from_attributes": True}


class ColumnResponse(BaseModel):
    id: int
    title: str
    position: int
    tasks: list[TaskResponse] = []

    model_config = {"from_attributes": True}


class BoardResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    columns: list[ColumnResponse] = []

    model_config = {"from_attributes": True}