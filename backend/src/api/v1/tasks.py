from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps import get_db
from src.schemas.task import TaskCreate, TaskUpdate, TaskMove, TaskResponse, BoardResponse
from src.services.task_service import TaskService

router = APIRouter(prefix="/api/v1", tags=["tasks"])


@router.get("/boards/{board_id}", response_model=BoardResponse)
async def get_board(board_id: int, session: AsyncSession = Depends(get_db)):
    return await TaskService.get_board(session, board_id)


@router.post("/tasks", response_model=TaskResponse)
async def create_task(data: TaskCreate, session: AsyncSession = Depends(get_db)):
    return await TaskService.create_task(session, data)


@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: int, data: TaskUpdate, session: AsyncSession = Depends(get_db)):
    return await TaskService.update_task(session, task_id, data)


@router.post("/tasks/move", response_model=TaskResponse)
async def move_task(data: TaskMove, session: AsyncSession = Depends(get_db)):
    return await TaskService.move_task(session, data.task_id, data.new_column_id)


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: int, session: AsyncSession = Depends(get_db)):
    return await TaskService.delete_task(session, task_id)