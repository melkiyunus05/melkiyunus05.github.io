# Personal Student Dashboard

A personal dashboard for managing university schedule, assignments,
competition progress, class notes, study plans, and daily finances.

**Stack:** FastAPI (backend) + Streamlit (frontend UI) + SQLite (database),
with a Notion API integration for class notes.

## Status

Being built iteratively. Current step: **Step 3 - Frontend Foundation (Streamlit layout)**.

## Project structure

```
student-dashboard/
├── backend/
│   ├── __init__.py
│   ├── database.py       # SQLAlchemy engine/session setup
│   ├── models.py         # ORM models: Schedule, Tasks, Competitions, Finances
│   ├── schemas.py        # Pydantic request/response schemas
│   ├── main.py            # FastAPI app entry point
│   └── routers/           # CRUD endpoints, one router per resource
│       ├── schedule.py
│       ├── tasks.py
│       ├── competitions.py
│       └── finances.py
├── frontend/
│   └── app.py              # Streamlit app: sidebar nav + page layout (placeholders for now)
├── data/                   # SQLite database file lives here (gitignored)
└── requirements.txt
```

## Data models

- **ScheduleItem** — a recurring weekly class slot (course, day, time, location, lecturer, `role` — e.g. Student vs. Teaching Assistant).
- **Task** — an assignment/exam/personal to-do with category, priority, status, due date.
- **Competition** + **CompetitionMilestone** — a competition to track, with deadlines, milestone checkpoints, and a `submission_link` per milestone.
- **Transaction** — a single income/expense entry for the finance tracker.

## Setup

```bash
cd student-dashboard
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

The database (`data/dashboard.db`) and all tables are created automatically on
API startup — no manual init step needed.

## Running the API locally

```bash
uvicorn backend.main:app --reload
```

The API will be live at `http://127.0.0.1:8000`. FastAPI's interactive docs
are available at:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

### Endpoints

All resources support the standard CRUD pattern (`GET /`, `POST /`,
`GET /{id}`, `PUT /{id}`, `DELETE /{id}`):

- `/schedule` — weekly class schedule
- `/tasks` — assignments/exams/personal to-dos (filterable by `status`, `category`)
- `/competitions` — competitions (filterable by `status`)
  - `/competitions/{id}/milestones` — milestones nested under a competition
- `/finances` — income/expense transactions (filterable by `year`, `month`, `type`)
  - `/finances/summary?year=YYYY&month=MM` — monthly income/expense/net summary

### Quick test

```bash
curl -X POST http://127.0.0.1:8000/tasks/ \
  -H "Content-Type: application/json" \
  -d '{"title": "Finish Lab Report", "category": "Assignment", "priority": "High", "due_date": "2026-09-10"}'

curl http://127.0.0.1:8000/tasks/
```

Or just open `/docs` in a browser and try requests interactively.

## Running the Streamlit app locally

```bash
streamlit run frontend/app.py
```

The UI will be live at `http://localhost:8501`. It has a sidebar with five
sections — Dashboard (Home), Schedule & Tasks, Competitions, Finances, and
Class Notes. Right now every page besides the Dashboard is a placeholder
(titles/headers/containers only); the Dashboard has placeholder sections for
Today's Agenda, Urgent Deadlines, and a Quick Financial Glance. None of this
is wired to the FastAPI backend yet — that's Step 4.
