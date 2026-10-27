from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_role
from app.db.models import Recommendation, RecStatus, Role, User
from app.schemas.common import Page, PageParams
from app.schemas.recommendations import DecisionIn, RecommendationOut, TaskIn
from app.services import recommendations as svc

router = APIRouter(dependencies=[Depends(get_current_user)])
supervisor = require_role(Role.supervisor)
staff = require_role(Role.staff)


@router.get("/recommendations", response_model=Page[RecommendationOut])
def list_recommendations(status: RecStatus | None = None, p: PageParams = Depends(), db: Session = Depends(get_db)):
    q = svc.rec_query()
    if status is not None:
        q = q.where(Recommendation.status == status.value)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.execute(
        q.order_by(Recommendation.created_at.desc(), Recommendation.id.desc()).limit(p.limit).offset(p.offset)
    ).all()
    return Page(items=[svc.to_out(*r) for r in rows], total=total, limit=p.limit, offset=p.offset)


@router.post("/recommendations/{rec_id}/decision", response_model=RecommendationOut)
def decide(rec_id: int, body: DecisionIn, db: Session = Depends(get_db), user: User = Depends(supervisor)):
    return svc.decide_recommendation(db, user, rec_id, body)


@router.post("/recommendations/{rec_id}/task", response_model=RecommendationOut)
def complete_task(rec_id: int, body: TaskIn, db: Session = Depends(get_db), user: User = Depends(staff)):
    return svc.complete_task(db, user, rec_id, body)
