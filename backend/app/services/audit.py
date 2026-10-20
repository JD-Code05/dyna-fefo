from collections.abc import Iterable
from datetime import UTC, date, datetime
from enum import Enum
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import AuditAction, AuditEntity, AuditLog, User


def snapshot(obj, fields: Iterable[str]) -> dict[str, Any]:
    out = {}
    for f in fields:
        v = getattr(obj, f)
        out[f] = v.isoformat() if isinstance(v, date) else v.value if isinstance(v, Enum) else v
    return out


def changed(before: dict, after: dict) -> tuple[dict, dict]:
    keys = [k for k in after if before.get(k) != after[k]]
    return {k: before.get(k) for k in keys}, {k: after[k] for k in keys}


def record(db: Session, user: User, action: AuditAction, entity: AuditEntity, entity_id: str,
           before: dict | None, after: dict | None) -> AuditLog:
    row = AuditLog(user_id=user.id, action=action.value, entity=entity.value, entity_id=str(entity_id),
                   before=before, after=after, ts=datetime.now(UTC))
    db.add(row)
    return row
