"""CRUD endpoints for competitions and their progress milestones."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/competitions", tags=["competitions"])


def _get_competition_or_404(competition_id: int, db: Session) -> models.Competition:
    db_competition = db.get(models.Competition, competition_id)
    if db_competition is None:
        raise HTTPException(status_code=404, detail="Competition not found")
    return db_competition


@router.get("/", response_model=list[schemas.CompetitionRead])
def list_competitions(
    status: models.CompetitionStatus | None = None, db: Session = Depends(get_db)
):
    query = db.query(models.Competition)
    if status is not None:
        query = query.filter(models.Competition.status == status)
    return query.order_by(models.Competition.final_deadline).all()


@router.post("/", response_model=schemas.CompetitionRead, status_code=201)
def create_competition(
    competition: schemas.CompetitionCreate, db: Session = Depends(get_db)
):
    db_competition = models.Competition(**competition.model_dump())
    db.add(db_competition)
    db.commit()
    db.refresh(db_competition)
    return db_competition


@router.get("/{competition_id}", response_model=schemas.CompetitionRead)
def get_competition(competition_id: int, db: Session = Depends(get_db)):
    return _get_competition_or_404(competition_id, db)


@router.put("/{competition_id}", response_model=schemas.CompetitionRead)
def update_competition(
    competition_id: int,
    competition: schemas.CompetitionUpdate,
    db: Session = Depends(get_db),
):
    db_competition = _get_competition_or_404(competition_id, db)
    for field, value in competition.model_dump(exclude_unset=True).items():
        setattr(db_competition, field, value)
    db.commit()
    db.refresh(db_competition)
    return db_competition


@router.delete("/{competition_id}", status_code=204)
def delete_competition(competition_id: int, db: Session = Depends(get_db)):
    db_competition = _get_competition_or_404(competition_id, db)
    db.delete(db_competition)
    db.commit()


# --- Milestones (nested under a competition) --------------------------------


@router.get(
    "/{competition_id}/milestones",
    response_model=list[schemas.CompetitionMilestoneRead],
)
def list_milestones(competition_id: int, db: Session = Depends(get_db)):
    _get_competition_or_404(competition_id, db)
    return (
        db.query(models.CompetitionMilestone)
        .filter(models.CompetitionMilestone.competition_id == competition_id)
        .order_by(models.CompetitionMilestone.due_date)
        .all()
    )


@router.post(
    "/{competition_id}/milestones",
    response_model=schemas.CompetitionMilestoneRead,
    status_code=201,
)
def create_milestone(
    competition_id: int,
    milestone: schemas.CompetitionMilestoneCreate,
    db: Session = Depends(get_db),
):
    _get_competition_or_404(competition_id, db)
    db_milestone = models.CompetitionMilestone(
        **milestone.model_dump(), competition_id=competition_id
    )
    db.add(db_milestone)
    db.commit()
    db.refresh(db_milestone)
    return db_milestone


def _get_milestone_or_404(
    competition_id: int, milestone_id: int, db: Session
) -> models.CompetitionMilestone:
    db_milestone = db.get(models.CompetitionMilestone, milestone_id)
    if db_milestone is None or db_milestone.competition_id != competition_id:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return db_milestone


@router.put(
    "/{competition_id}/milestones/{milestone_id}",
    response_model=schemas.CompetitionMilestoneRead,
)
def update_milestone(
    competition_id: int,
    milestone_id: int,
    milestone: schemas.CompetitionMilestoneUpdate,
    db: Session = Depends(get_db),
):
    db_milestone = _get_milestone_or_404(competition_id, milestone_id, db)
    for field, value in milestone.model_dump(exclude_unset=True).items():
        setattr(db_milestone, field, value)
    db.commit()
    db.refresh(db_milestone)
    return db_milestone


@router.delete("/{competition_id}/milestones/{milestone_id}", status_code=204)
def delete_milestone(
    competition_id: int, milestone_id: int, db: Session = Depends(get_db)
):
    db_milestone = _get_milestone_or_404(competition_id, milestone_id, db)
    db.delete(db_milestone)
    db.commit()
