"""CRUD endpoints for assignments, exams, and personal to-dos."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/", response_model=list[schemas.TaskRead])
def list_tasks(
    status: models.TaskStatus | None = None,
    category: models.TaskCategory | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Task)
    if status is not None:
        query = query.filter(models.Task.status == status)
    if category is not None:
        query = query.filter(models.Task.category == category)
    return query.order_by(models.Task.due_date).all()


@router.post("/", response_model=schemas.TaskRead, status_code=201)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    db_task = models.Task(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.get("/{task_id}", response_model=schemas.TaskRead)
def get_task(task_id: int, db: Session = Depends(get_db)):
    db_task = db.get(models.Task, task_id)
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return db_task


@router.put("/{task_id}", response_model=schemas.TaskRead)
def update_task(
    task_id: int, task: schemas.TaskUpdate, db: Session = Depends(get_db)
):
    db_task = db.get(models.Task, task_id)
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in task.model_dump(exclude_unset=True).items():
        setattr(db_task, field, value)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    db_task = db.get(models.Task, task_id)
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(db_task)
    db.commit()
