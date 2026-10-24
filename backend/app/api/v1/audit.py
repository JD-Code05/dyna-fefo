from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import AuditLog, User
from app.schemas.audit import AuditOut
from app.schemas.common import Page, PageParams

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/audit-log", response_model=Page[AuditOut])
def list_audit(
    entity: str | None = None,
    action: str | None = None,
    entity_id: str | None = None,
    p: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    q = select(AuditLog, User.username).join(User, User.id == AuditLog.user_id)
    for col, val in ((AuditLog.entity, entity), (AuditLog.action, action), (AuditLog.entity_id, entity_id)):
        if val is not None:
            q = q.where(col == val)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.execute(q.order_by(AuditLog.ts.desc(), AuditLog.id.desc()).limit(p.limit).offset(p.offset)).all()
    items = [AuditOut(user=u, **{f: getattr(a, f) for f in AuditOut.model_fields if f != "user"}) for a, u in rows]
    return Page(items=items, total=total, limit=p.limit, offset=p.offset)
