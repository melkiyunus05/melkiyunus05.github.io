"""FastAPI application entry point for the Personal Student Dashboard."""

from fastapi import FastAPI

from .database import init_db
from .routers import competitions, finances, schedule, tasks

app = FastAPI(
    title="Personal Student Dashboard API",
    description="CRUD API for schedule, tasks, competitions, and finances.",
    version="0.1.0",
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/", tags=["health"])
def root():
    return {"status": "ok", "service": "personal-student-dashboard"}


app.include_router(schedule.router)
app.include_router(tasks.router)
app.include_router(competitions.router)
app.include_router(finances.router)
