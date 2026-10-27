from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Role(StrEnum):
    staff = "staff"
    supervisor = "supervisor"


class BatchStatus(StrEnum):
    active = "active"
    dispatched = "dispatched"
    salvaged = "salvaged"


class RecType(StrEnum):
    PRIORITY_DISPATCH = "PRIORITY_DISPATCH"
    SALVAGE = "SALVAGE"


class RecStatus(StrEnum):
    pending = "pending"
    approved = "approved"  # an open order for floor staff
    rejected = "rejected"
    done = "done"
    flagged = "flagged"


class AuditAction(StrEnum):
    create = "create"
    update = "update"
    delete = "delete"
    approve = "approve"
    reject = "reject"
    complete = "complete"
    flag = "flag"


class AuditEntity(StrEnum):
    batch = "batch"
    device = "device"
    recommendation = "recommendation"


def _ts(**kw):
    return mapped_column(DateTime(timezone=True), **kw)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True)
    password_hash: Mapped[str | None] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)


class Product(Base):
    __tablename__ = "products"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    shelf_life_ref_hours: Mapped[float] = mapped_column(Float)
    t_ref_c: Mapped[float] = mapped_column(Float)
    q10: Mapped[float] = mapped_column(Float)
    rate_floor: Mapped[float] = mapped_column(Float)
    max_dt_hours: Mapped[float] = mapped_column(Float)
    salvage_ratio: Mapped[float] = mapped_column(Float)
    dispatch_ratio: Mapped[float] = mapped_column(Float)


class Zone(Base):
    __tablename__ = "zones"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)


class Device(Base):
    __tablename__ = "devices"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    zone_id: Mapped[str] = mapped_column(ForeignKey("zones.id"))
    api_key_hash: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = _ts(server_default=func.now())
    deleted_at: Mapped[datetime | None] = _ts()


class Batch(Base):
    __tablename__ = "batches"
    __table_args__ = (Index("uq_batch_code_live", "code", unique=True, postgresql_where=text("deleted_at IS NULL")),)
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    zone_id: Mapped[str] = mapped_column(ForeignKey("zones.id"))
    received_at: Mapped[datetime] = _ts()
    printed_expiry: Mapped[datetime] = _ts()
    quantity: Mapped[int] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, default=BatchStatus.active.value)
    created_at: Mapped[datetime] = _ts(server_default=func.now())
    updated_at: Mapped[datetime] = _ts(server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = _ts()


class Telemetry(Base):
    __tablename__ = "telemetry"
    __table_args__ = (Index("ix_telemetry_zone_ts", "zone_id", "ts"),)
    device_id: Mapped[str] = mapped_column(String, primary_key=True)
    seq: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    ts: Mapped[datetime] = _ts(primary_key=True)
    zone_id: Mapped[str] = mapped_column(String)
    temperature_c: Mapped[float] = mapped_column(Float)
    humidity_pct: Mapped[float] = mapped_column(Float)


class BatchState(Base):
    __tablename__ = "batch_state"
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), primary_key=True)
    effective_age_h: Mapped[float] = mapped_column(Float)
    rul_h: Mapped[float] = mapped_column(Float)
    rul_ratio: Mapped[float] = mapped_column(Float)
    last_telemetry_ts: Mapped[datetime | None] = _ts()
    predicted_expiry: Mapped[datetime | None] = _ts()
    computed_at: Mapped[datetime] = _ts()


class BatchStateHistory(Base):
    __tablename__ = "batch_state_history"
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), primary_key=True)
    computed_at: Mapped[datetime] = _ts(primary_key=True)
    rul_h: Mapped[float] = mapped_column(Float)
    rul_ratio: Mapped[float] = mapped_column(Float)
    effective_age_h: Mapped[float] = mapped_column(Float)


class Recommendation(Base):
    __tablename__ = "recommendations"
    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"))
    type: Mapped[str] = mapped_column(String)
    rationale: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String, default=RecStatus.pending.value)
    created_at: Mapped[datetime] = _ts(server_default=func.now())
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    decided_at: Mapped[datetime | None] = _ts()
    decision_note: Mapped[str | None] = mapped_column(Text)
    handled_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    handled_at: Mapped[datetime | None] = _ts()
    flag_reason: Mapped[str | None] = mapped_column(String)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String)
    entity: Mapped[str] = mapped_column(String)
    entity_id: Mapped[str] = mapped_column(String)
    before: Mapped[dict | None] = mapped_column(JSON)
    after: Mapped[dict | None] = mapped_column(JSON)
    ts: Mapped[datetime] = _ts(server_default=func.now())
