"""SQLAlchemy ORM models for the Personal Student Dashboard.

Covers the four core data domains from Step 1: weekly Schedule, Tasks,
Competitions (with milestones), and Finances.
"""

import enum
from datetime import date, datetime, time

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class DayOfWeek(str, enum.Enum):
    MONDAY = "Monday"
    TUESDAY = "Tuesday"
    WEDNESDAY = "Wednesday"
    THURSDAY = "Thursday"
    FRIDAY = "Friday"
    SATURDAY = "Saturday"
    SUNDAY = "Sunday"


class TaskCategory(str, enum.Enum):
    ASSIGNMENT = "Assignment"
    EXAM = "Exam"
    PERSONAL = "Personal"


class TaskPriority(str, enum.Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class TaskStatus(str, enum.Enum):
    TODO = "To Do"
    IN_PROGRESS = "In Progress"
    DONE = "Done"


class CompetitionStatus(str, enum.Enum):
    PLANNED = "Planned"
    REGISTERED = "Registered"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    DROPPED = "Dropped"


class TransactionType(str, enum.Enum):
    INCOME = "Income"
    EXPENSE = "Expense"


class ScheduleItem(Base):
    """A recurring weekly university class slot."""

    __tablename__ = "schedule_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_name: Mapped[str] = mapped_column(String(120), nullable=False)
    day_of_week: Mapped[DayOfWeek] = mapped_column(Enum(DayOfWeek), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    location: Mapped[str | None] = mapped_column(String(120), nullable=True)
    lecturer: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class Task(Base):
    """A single assignment, exam, or personal to-do."""

    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[TaskCategory] = mapped_column(
        Enum(TaskCategory), default=TaskCategory.ASSIGNMENT, nullable=False
    )
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority), default=TaskPriority.MEDIUM, nullable=False
    )
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus), default=TaskStatus.TODO, nullable=False
    )
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Competition(Base):
    """A competition, hackathon, or similar external event to track."""

    __tablename__ = "competitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    organizer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    registration_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    final_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[CompetitionStatus] = mapped_column(
        Enum(CompetitionStatus), default=CompetitionStatus.PLANNED, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    milestones: Mapped[list["CompetitionMilestone"]] = relationship(
        back_populates="competition",
        cascade="all, delete-orphan",
        order_by="CompetitionMilestone.due_date",
    )


class CompetitionMilestone(Base):
    """A single milestone/checkpoint within a competition's progress."""

    __tablename__ = "competition_milestones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    competition_id: Mapped[int] = mapped_column(
        ForeignKey("competitions.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_completed: Mapped[bool] = mapped_column(default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    competition: Mapped["Competition"] = relationship(back_populates="milestones")


class Transaction(Base):
    """A single income or expense entry for the daily finance tracker."""

    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
