"""CRUD endpoints for the daily income/expense tracker, plus a monthly summary."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/finances", tags=["finances"])


@router.get("/", response_model=list[schemas.TransactionRead])
def list_transactions(
    year: int | None = None,
    month: int | None = None,
    type: models.TransactionType | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Transaction)
    if year is not None:
        query = query.filter(extract("year", models.Transaction.date) == year)
    if month is not None:
        query = query.filter(extract("month", models.Transaction.date) == month)
    if type is not None:
        query = query.filter(models.Transaction.type == type)
    return query.order_by(models.Transaction.date.desc()).all()


@router.post("/", response_model=schemas.TransactionRead, status_code=201)
def create_transaction(
    transaction: schemas.TransactionCreate, db: Session = Depends(get_db)
):
    db_transaction = models.Transaction(**transaction.model_dump())
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction


@router.get("/summary", response_model=schemas.FinanceSummary)
def get_monthly_summary(
    year: int = date.today().year,
    month: int = date.today().month,
    db: Session = Depends(get_db),
):
    income = (
        db.query(func.coalesce(func.sum(models.Transaction.amount), 0.0))
        .filter(
            extract("year", models.Transaction.date) == year,
            extract("month", models.Transaction.date) == month,
            models.Transaction.type == models.TransactionType.INCOME,
        )
        .scalar()
    )
    expense = (
        db.query(func.coalesce(func.sum(models.Transaction.amount), 0.0))
        .filter(
            extract("year", models.Transaction.date) == year,
            extract("month", models.Transaction.date) == month,
            models.Transaction.type == models.TransactionType.EXPENSE,
        )
        .scalar()
    )
    return schemas.FinanceSummary(
        year=year,
        month=month,
        total_income=income,
        total_expense=expense,
        net=income - expense,
    )


@router.get("/{transaction_id}", response_model=schemas.TransactionRead)
def get_transaction(transaction_id: int, db: Session = Depends(get_db)):
    db_transaction = db.get(models.Transaction, transaction_id)
    if db_transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return db_transaction


@router.put("/{transaction_id}", response_model=schemas.TransactionRead)
def update_transaction(
    transaction_id: int,
    transaction: schemas.TransactionUpdate,
    db: Session = Depends(get_db),
):
    db_transaction = db.get(models.Transaction, transaction_id)
    if db_transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for field, value in transaction.model_dump(exclude_unset=True).items():
        setattr(db_transaction, field, value)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    db_transaction = db.get(models.Transaction, transaction_id)
    if db_transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(db_transaction)
    db.commit()
