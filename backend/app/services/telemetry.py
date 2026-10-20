import hashlib
import hmac
import logging
import math
from datetime import datetime, timedelta

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.db.models import Device, Telemetry
from app.schemas.telemetry import HistoryOut, Point, TelemetryIn

log = logging.getLogger(__name__)
MAX_POINTS = 500


def ingest(db: Session, data: TelemetryIn, device_key: str | None) -> bool:
    dev = db.get(Device, data.device_id)
    if dev is None or dev.deleted_at is not None:
        raise ApiError(404, "device_not_found", f"Unknown device {data.device_id}")
    if device_key is not None and not hmac.compare_digest(
        hashlib.sha256(device_key.encode()).hexdigest(), dev.api_key_hash
    ):
        raise ApiError(401, "bad_device_key", "Invalid device key")
    if data.zone_id != dev.zone_id:
        raise ApiError(422, "zone_mismatch", f"Device {dev.id} belongs to zone {dev.zone_id}")
    # PK includes ts, so dedupe on (device_id, seq) explicitly.
    if db.scalar(select(func.count()).select_from(Telemetry).where(
            Telemetry.device_id == data.device_id, Telemetry.seq == data.seq)):
        return False
    db.add(Telemetry(**data.model_dump()))
    db.commit()
    return True


def handle_message(db: Session, topic: str, payload: bytes) -> None:
    try:
        ingest(db, TelemetryIn.model_validate_json(payload), None)
    except (ApiError, ValidationError) as e:
        db.rollback()
        log.warning("dropped message on %s: %s", topic, e)


def history(db: Session, zone_id: str, start: datetime, end: datetime) -> HistoryOut:
    width = max(1, math.ceil((end - start).total_seconds() / MAX_POINTS))
    b = func.time_bucket(timedelta(seconds=width), Telemetry.ts).label("b")
    rows = db.execute(
        select(b, func.avg(Telemetry.temperature_c), func.avg(Telemetry.humidity_pct))
        .where(Telemetry.zone_id == zone_id, Telemetry.ts >= start, Telemetry.ts <= end)
        .group_by(b).order_by(b)
    ).all()
    return HistoryOut(zone_id=zone_id, points=[Point(ts=r[0], temperature_c=r[1], humidity_pct=r[2]) for r in rows])
