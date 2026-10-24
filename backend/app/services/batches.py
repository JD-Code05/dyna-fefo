from contextlib import contextmanager
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_live
from app.core.errors import ApiError
from app.db.models import (
    AuditAction,
    AuditEntity,
    Batch,
    BatchState,
    Product,
    User,
    Zone,
)
from app.schemas.batches import BatchCreate, BatchOut, BatchUpdate
from app.services.audit import changed, record, snapshot

FIELDS = (
    "id",
    "code",
    "product_id",
    "zone_id",
    "received_at",
    "printed_expiry",
    "quantity",
    "notes",
    "status",
    "created_at",
    "deleted_at",
)
OUT_FIELDS = (
    "id",
    "code",
    "product_id",
    "zone_id",
    "received_at",
    "printed_expiry",
    "quantity",
    "notes",
    "status",
    "created_at",
    "updated_at",
    "deleted_at",
)


def batch_query():
    """Batch + product name + state (LEFT JOIN: null until the worker has computed it)."""
    return (
        select(Batch, Product.name, BatchState)
        .join(Product, Product.id == Batch.product_id)
        .outerjoin(BatchState, BatchState.batch_id == Batch.id)
    )


def to_out(batch: Batch, product_name: str, state: BatchState | None) -> BatchOut:
    return BatchOut(
        **{f: getattr(batch, f) for f in OUT_FIELDS},
        product_name=product_name,
        predicted_expiry=state.predicted_expiry if state else None,
        rul_h=state.rul_h if state else None,
        rul_ratio=state.rul_ratio if state else None,
        effective_age_h=state.effective_age_h if state else None,
    )


def get_out(db: Session, batch_id: int) -> BatchOut:
    return to_out(*db.execute(batch_query().where(Batch.id == batch_id)).one())


def mark_for_recompute(batch: Batch) -> None:
    # The worker recomputes every live batch each run; touching updated_at is the only signal needed.
    batch.updated_at = datetime.now(UTC)


def _check_refs(db: Session, product_id: str, zone_id: str) -> None:
    if db.get(Product, product_id) is None:
        raise ApiError(422, "unknown_product", f"Unknown product '{product_id}'")
    if db.get(Zone, zone_id) is None:
        raise ApiError(422, "unknown_zone", f"Unknown zone '{zone_id}'")


def _check_expiry(received_at: datetime, printed_expiry: datetime) -> None:
    if printed_expiry <= received_at:
        raise ApiError(422, "expiry_before_receipt", "printed_expiry must be after received_at")


@contextmanager
def _code_guard(db: Session):
    # The partial unique index is the source of truth for code uniqueness (race-safe).
    try:
        yield
    except IntegrityError as e:
        db.rollback()
        if "uq_batch_code_live" not in str(e.orig):
            raise
        raise ApiError(409, "batch_code_taken", "A live batch already uses this code") from e


def create_batch(db: Session, user: User, body: BatchCreate) -> BatchOut:
    _check_refs(db, body.product_id, body.zone_id)
    _check_expiry(body.received_at, body.printed_expiry)
    batch = Batch(**body.model_dump())
    db.add(batch)
    with _code_guard(db):
        db.flush()
    db.refresh(batch)
    record(db, user, AuditAction.create, AuditEntity.batch, batch.id, None, snapshot(batch, FIELDS))
    db.commit()
    return get_out(db, batch.id)


def update_batch(db: Session, user: User, batch_id: int, body: BatchUpdate) -> BatchOut:
    batch = get_live(db, Batch, batch_id, "batch_not_found")
    patch = body.model_dump(exclude_unset=True)
    merged = {k: patch.get(k, getattr(batch, k)) for k in ("product_id", "zone_id", "received_at", "printed_expiry")}
    _check_refs(db, merged["product_id"], merged["zone_id"])
    _check_expiry(merged["received_at"], merged["printed_expiry"])
    before = snapshot(batch, patch)
    for k, v in patch.items():
        setattr(batch, k, v)
    b, a = changed(before, snapshot(batch, patch))
    if a:
        mark_for_recompute(batch)
        record(db, user, AuditAction.update, AuditEntity.batch, batch.id, b, a)
    with _code_guard(db):
        db.commit()
    return get_out(db, batch.id)


def delete_batch(db: Session, user: User, batch_id: int) -> None:
    batch = get_live(db, Batch, batch_id, "batch_not_found")
    before = snapshot(batch, FIELDS)
    batch.deleted_at = datetime.now(UTC)
    record(db, user, AuditAction.delete, AuditEntity.batch, batch.id, before, None)
    db.commit()
