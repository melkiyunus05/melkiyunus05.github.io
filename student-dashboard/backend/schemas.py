"""Pydantic request/response schemas for the FastAPI CRUD endpoints."""

import datetime as dt

from pydantic import BaseModel, ConfigDict, Field

from .models import (
    CompetitionStatus,
    DayOfWeek,
    TaskCategory,
    TaskPriority,
    TaskStatus,
    TransactionType,
)

# --- ScheduleItem -----------------------------------------------------------


class ScheduleItemBase(BaseModel):
    course_name: str
    day_of_week: DayOfWeek
    start_time: dt.time
    end_time: dt.time
    location: str | None = None
    lecturer: str | None = None
    role: str = "Student"
    notes: str | None = None


class ScheduleItemCreate(ScheduleItemBase):
    pass


class ScheduleItemUpdate(BaseModel):
    course_name: str | None = None
    day_of_week: DayOfWeek | None = None
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    location: str | None = None
    lecturer: str | None = None
    role: str | None = None
    notes: str | None = None


class ScheduleItemRead(ScheduleItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


# --- Task ---------------------------------------------------------------


class TaskBase(BaseModel):
    title: str
    description: str | None = None
    category: TaskCategory = TaskCategory.ASSIGNMENT
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.TODO
    due_date: dt.date


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: TaskCategory | None = None
    priority: TaskPriority | None = None
    status: TaskStatus | None = None
    due_date: dt.date | None = None


class TaskRead(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: dt.datetime


# --- CompetitionMilestone -------------------------------------------------


class CompetitionMilestoneBase(BaseModel):
    title: str
    due_date: dt.date | None = None
    is_completed: bool = False
    notes: str | None = None
    submission_link: str | None = None


class CompetitionMilestoneCreate(CompetitionMilestoneBase):
    pass


class CompetitionMilestoneUpdate(BaseModel):
    title: str | None = None
    due_date: dt.date | None = None
    is_completed: bool | None = None
    notes: str | None = None
    submission_link: str | None = None


class CompetitionMilestoneRead(CompetitionMilestoneBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    competition_id: int


# --- Competition ----------------------------------------------------------


class CompetitionBase(BaseModel):
    name: str
    organizer: str | None = None
    description: str | None = None
    registration_deadline: dt.date | None = None
    final_deadline: dt.date | None = None
    status: CompetitionStatus = CompetitionStatus.PLANNED


class CompetitionCreate(CompetitionBase):
    pass


class CompetitionUpdate(BaseModel):
    name: str | None = None
    organizer: str | None = None
    description: str | None = None
    registration_deadline: dt.date | None = None
    final_deadline: dt.date | None = None
    status: CompetitionStatus | None = None


class CompetitionRead(CompetitionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: dt.datetime
    milestones: list[CompetitionMilestoneRead] = []


# --- Transaction ------------------------------------------------------------


class TransactionBase(BaseModel):
    type: TransactionType
    category: str
    amount: float
    description: str | None = None
    date: dt.date = Field(default_factory=dt.date.today)


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    type: TransactionType | None = None
    category: str | None = None
    amount: float | None = None
    description: str | None = None
    date: dt.date | None = None


class TransactionRead(TransactionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: dt.datetime


class FinanceSummary(BaseModel):
    year: int
    month: int
    total_income: float
    total_expense: float
    net: float
