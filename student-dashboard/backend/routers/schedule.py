"""CRUD endpoints for the weekly class schedule."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("/", response_model=list[schemas.ScheduleItemRead])
def list_schedule_items(db: Session = Depends(get_db)):
    return db.query(models.ScheduleItem).order_by(
        models.ScheduleItem.day_of_week, models.ScheduleItem.start_time
    ).all()


@router.post("/", response_model=schemas.ScheduleItemRead, status_code=201)
def create_schedule_item(
    item: schemas.ScheduleItemCreate, db: Session = Depends(get_db)
):
    db_item = models.ScheduleItem(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


@router.get("/{item_id}", response_model=schemas.ScheduleItemRead)
def get_schedule_item(item_id: int, db: Session = Depends(get_db)):
    db_item = db.get(models.ScheduleItem, item_id)
    if db_item is None:
        raise HTTPException(status_code=404, detail="Schedule item not found")
    return db_item


@router.put("/{item_id}", response_model=schemas.ScheduleItemRead)
def update_schedule_item(
    item_id: int, item: schemas.ScheduleItemUpdate, db: Session = Depends(get_db)
):
    db_item = db.get(models.ScheduleItem, item_id)
    if db_item is None:
        raise HTTPException(status_code=404, detail="Schedule item not found")
    for field, value in item.model_dump(exclude_unset=True).items():
        setattr(db_item, field, value)
    db.commit()
    db.refresh(db_item)
    return db_item


@router.delete("/{item_id}", status_code=204)
def delete_schedule_item(item_id: int, db: Session = Depends(get_db)):
    db_item = db.get(models.ScheduleItem, item_id)
    if db_item is None:
        raise HTTPException(status_code=404, detail="Schedule item not found")
    db.delete(db_item)
    db.commit()
