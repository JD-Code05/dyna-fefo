import hashlib
import secrets
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.deps import get_live
from app.core.errors import ApiError
from app.db.models import AuditAction, AuditEntity, Device, User, Zone
from app.schemas.devices import DeviceCreate, DeviceUpdate
from app.services.audit import changed, record, snapshot

FIELDS = ("id", "name", "zone_id", "created_at", "deleted_at")


def _check_zone(db: Session, zone_id: str) -> None:
    if db.get(Zone, zone_id) is None:
        raise ApiError(422, "unknown_zone", f"Unknown zone '{zone_id}'")


def create_device(db: Session, user: User, body: DeviceCreate) -> tuple[Device, str]:
    existing = db.get(Device, body.id)
    if existing is not None and existing.deleted_at is None:
        raise ApiError(409, "device_id_taken", f"Device id '{body.id}' is already used")
    _check_zone(db, body.zone_id)
    key = secrets.token_urlsafe(24)
    # A deleted device keeps its row (audit, telemetry); re-adding the same hardware revives it with a new key.
    before = snapshot(existing, FIELDS) if existing else None
    dev = existing or Device(id=body.id)
    dev.name, dev.zone_id, dev.deleted_at = body.name, body.zone_id, None
    dev.api_key_hash = hashlib.sha256(key.encode()).hexdigest()
    db.add(dev)
    db.flush()
    db.refresh(dev)
    record(db, user, AuditAction.create, AuditEntity.device, dev.id, before, snapshot(dev, FIELDS))
    db.commit()
    return dev, key


def update_device(db: Session, user: User, device_id: str, body: DeviceUpdate) -> Device:
    dev = get_live(db, Device, device_id, "device_not_found")
    patch = body.model_dump(exclude_unset=True)
    if "zone_id" in patch:
        _check_zone(db, patch["zone_id"])
    before = snapshot(dev, patch)
    for k, v in patch.items():
        setattr(dev, k, v)
    b, a = changed(before, patch)
    if a:
        record(db, user, AuditAction.update, AuditEntity.device, dev.id, b, a)
    db.commit()
    return dev


def delete_device(db: Session, user: User, device_id: str) -> None:
    dev = get_live(db, Device, device_id, "device_not_found")
    before = snapshot(dev, FIELDS)
    dev.deleted_at = datetime.now(UTC)
    record(db, user, AuditAction.delete, AuditEntity.device, dev.id, before, None)
    db.commit()
