from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_user, get_db
from app.db.models import Telemetry
from app.schemas.telemetry import HistoryOut, StoredOut, TelemetryIn
from app.services import telemetry as svc

router = APIRouter()


@router.post("/telemetry", status_code=202, response_model=StoredOut)
def post_telemetry(data: TelemetryIn, x_device_key: str = Header(), db: Session = Depends(get_db)):
    return {"stored": svc.ingest(db, data, x_device_key)}


@router.get("/telemetry", response_model=HistoryOut, dependencies=[Depends(get_current_user)])
def get_history(
    zone_id: str,
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = None,
    db: Session = Depends(get_db),
):
    if to is None:
        # sim timestamps can run ahead of the wall clock (SIM_SPEEDUP)
        latest = (
            db.scalar(select(func.max(Telemetry.ts)).where(Telemetry.zone_id == zone_id))
            if get_settings().sim_mode
            else None
        )
        to = latest or datetime.now(UTC)
    return svc.history(db, zone_id, from_ or to - timedelta(hours=24), to)
