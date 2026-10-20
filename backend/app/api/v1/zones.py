from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import Telemetry, Zone
from app.schemas.common import Page, PageParams
from app.schemas.zones import Latest, ZoneOut

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/zones", response_model=Page[ZoneOut])
def list_zones(p: PageParams = Depends(), db: Session = Depends(get_db)):
    zones = db.scalars(select(Zone).order_by(Zone.id).limit(p.limit).offset(p.offset)).all()
    total = db.scalar(select(func.count()).select_from(Zone))
    items = []
    for z in zones:
        t = db.scalars(select(Telemetry).where(Telemetry.zone_id == z.id).order_by(Telemetry.ts.desc()).limit(1)).first()
        latest = t and Latest(ts=t.ts, temperature_c=t.temperature_c, humidity_pct=t.humidity_pct, danger=t.temperature_c > 4.0)
        items.append(ZoneOut(id=z.id, name=z.name, latest=latest))
    return Page(items=items, total=total, limit=p.limit, offset=p.offset)
