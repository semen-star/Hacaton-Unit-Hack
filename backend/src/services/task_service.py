from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from typing import List

from src.models.task import Task
from src.models.tag import Tag
from src.models.task_tag import TaskTag
from src.models.column import Column
from src.models.board import Board
from src.schemas.task import TaskCreate, TaskUpdate, TaskResponse, BoardResponse, ColumnResponse


class TaskService:
    
    @staticmethod
    async def get_board(session: AsyncSession, board_id: int) -> BoardResponse:
        """Получить доску со всеми колонками и задачами"""
        result = await session.execute(
            select(Board)
            .options(
                selectinload(Board.columns)
                .selectinload(Column.tasks)
                .selectinload(Task.task_tags)
                .selectinload(TaskTag.tag)
            )
            .where(Board.id == board_id)
        )
        board = result.scalar_one_or_none()
        if not board:
            raise HTTPException(status_code=404, detail="Доска не найдена")
        return board
    
    @staticmethod
    async def create_task(session: AsyncSession, data: TaskCreate) -> TaskResponse:
        """Создать задачу"""
        # Проверяем, что колонка существует
        column = await session.get(Column, data.column_id)
        if not column:
            raise HTTPException(status_code=404, detail="Колонка не найдена")
        
        task = Task(
            title=data.title,
            description=data.description,
            priority=data.priority,
            column_id=data.column_id,
        )
        session.add(task)
        await session.flush()
        
        # Добавляем теги
        if data.tags:
            for tag_name in data.tags:
                # Ищем или создаём тег
                result = await session.execute(
                    select(Tag).where(Tag.name == tag_name)
                )
                tag = result.scalar_one_or_none()
                if not tag:
                    tag = Tag(name=tag_name, color="#3498db")
                    session.add(tag)
                    await session.flush()
                
                task_tag = TaskTag(task_id=task.id, tag_id=tag.id)
                session.add(task_tag)
        
        await session.commit()
        await session.refresh(task)
        
        return await TaskService._task_to_response(session, task)
    
    @staticmethod
    async def update_task(session: AsyncSession, task_id: int, data: TaskUpdate) -> TaskResponse:
        """Обновить задачу"""
        task = await session.get(Task, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        if data.title is not None:
            task.title = data.title
        if data.description is not None:
            task.description = data.description
        if data.priority is not None:
            task.priority = data.priority
        if data.column_id is not None:
            # Проверяем колонку
            column = await session.get(Column, data.column_id)
            if not column:
                raise HTTPException(status_code=404, detail="Колонка не найдена")
            task.column_id = data.column_id
        
        task.version += 1
        await session.commit()
        await session.refresh(task)
        
        return await TaskService._task_to_response(session, task)
    
    @staticmethod
    async def move_task(session: AsyncSession, task_id: int, new_column_id: int) -> TaskResponse:
        """Переместить задачу в другую колонку"""
        task = await session.get(Task, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        column = await session.get(Column, new_column_id)
        if not column:
            raise HTTPException(status_code=404, detail="Колонка не найдена")
        
        task.column_id = new_column_id
        task.version += 1
        await session.commit()
        await session.refresh(task)
        
        return await TaskService._task_to_response(session, task)
    
    @staticmethod
    async def delete_task(session: AsyncSession, task_id: int):
        """Удалить задачу"""
        task = await session.get(Task, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        await session.delete(task)
        await session.commit()
        return {"status": "deleted", "task_id": task_id}
    
    @staticmethod
    async def _task_to_response(session: AsyncSession, task: Task) -> TaskResponse:
        """Конвертировать модель в ответ"""
        # Получаем теги
        result = await session.execute(
            select(Tag)
            .join(TaskTag)
            .where(TaskTag.task_id == task.id)
        )
        tags = [tag.name for tag in result.scalars().all()]
        
        return TaskResponse(
            id=task.id,
            column_id=task.column_id,
            title=task.title,
            description=task.description,
            priority=task.priority,
            assignee_id=task.assignee_id,
            deadline=task.deadline,
            created_at=task.created_at,
            updated_at=task.updated_at,
            version=task.version,
            tags=tags,
        )