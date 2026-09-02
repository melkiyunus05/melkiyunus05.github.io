# Personal Student Dashboard

A personal dashboard for managing university schedule, assignments,
competition progress, class notes, study plans, and daily finances.

**Stack:** FastAPI (backend) + Streamlit (frontend UI) + SQLite (database),
with a Notion API integration for class notes.

## Status

Being built iteratively. Current step: **Step 1 — Setup & Schema**.

## Project structure

```
student-dashboard/
├── backend/
│   ├── __init__.py
│   ├── database.py     # SQLAlchemy engine/session setup
│   └── models.py        # ORM models: Schedule, Tasks, Competitions, Finances
├── frontend/             # Streamlit app (added in Step 3)
├── data/                 # SQLite database file lives here (gitignored)
└── requirements.txt
```

## Data models (Step 1)

- **ScheduleItem** — a recurring weekly class slot (course, day, time, location, lecturer).
- **Task** — an assignment/exam/personal to-do with category, priority, status, due date.
- **Competition** + **CompetitionMilestone** — a competition to track, with deadlines and milestone checkpoints.
- **Transaction** — a single income/expense entry for the finance tracker.

## Setup

```bash
cd student-dashboard
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -c "from backend.database import init_db; init_db()"
```

This creates `data/dashboard.db` with all tables.
