from fastapi import APIRouter, Depends, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_role
from app.core.errors import ApiError
from app.db.models import Batch, BatchState, BatchStatus, Role, User
from app.schemas.batches import BatchCreate, BatchOut, BatchUpdate
from app.schemas.common import Page, PageParams
from app.services import batches as svc

router = APIRouter(dependencies=[Depends(get_current_user)])
supervisor = require_role(Role.supervisor)


@router.get("/batches", response_model=Page[BatchOut])
def list_batches(include_deleted: bool = False, status: BatchStatus | None = None,
                 p: PageParams = Depends(), db: Session = Depends(get_db)):
    q = svc.batch_query()
    if not include_deleted:
        q = q.where(Batch.deleted_at.is_(None))
    if status is not None:
        q = q.where(Batch.status == status.value)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.execute(q.order_by(BatchState.rul_h.asc().nulls_last(), Batch.id).limit(p.limit).offset(p.offset)).all()
    return Page(items=[svc.to_out(*r) for r in rows], total=total, limit=p.limit, offset=p.offset)


@router.get("/batches/{batch_id}", response_model=BatchOut)
def get_batch(batch_id: int, include_deleted: bool = False, db: Session = Depends(get_db)):
    row = db.execute(svc.batch_query().where(Batch.id == batch_id)).first()
    if row is None or (row[0].deleted_at is not None and not include_deleted):
        raise ApiError(404, "batch_not_found", "Batch not found")
    return svc.to_out(*row)


@router.post("/batches", response_model=BatchOut, status_code=201)
def create_batch(body: BatchCreate, db: Session = Depends(get_db), user: User = Depends(supervisor)):
    return svc.create_batch(db, user, body)


@router.patch("/batches/{batch_id}", response_model=BatchOut)
def update_batch(batch_id: int, body: BatchUpdate, db: Session = Depends(get_db), user: User = Depends(supervisor)):
    return svc.update_batch(db, user, batch_id, body)


@router.delete("/batches/{batch_id}", status_code=204)
def delete_batch(batch_id: int, db: Session = Depends(get_db), user: User = Depends(supervisor)):
    svc.delete_batch(db, user, batch_id)
    return Response(status_code=204)
