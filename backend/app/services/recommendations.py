from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.products import ProductConfig
from app.db.models import (
    AuditAction,
    AuditEntity,
    Batch,
    BatchState,
    Recommendation,
    RecStatus,
    RecType,
    User,
)
from app.engine.recommend import Thresholds, decide
from app.schemas.recommendations import DecisionIn, RecommendationOut
from app.services.audit import record, snapshot

AUDIT_FIELDS = ("id", "batch_id", "type", "status", "decision_note")


def rec_query():
    """Recommendation + batch code + decider name, live batches only."""
    return (select(Recommendation, Batch.code, User.username)
            .join(Batch, Batch.id == Recommendation.batch_id)
            .outerjoin(User, User.id == Recommendation.decided_by)
            .where(Batch.deleted_at.is_(None)))


def to_out(rec: Recommendation, batch_code: str, decider: str | None) -> RecommendationOut:
    return RecommendationOut(
        **{f: getattr(rec, f) for f in ("id", "batch_id", "type", "status", "rationale", "created_at",
                                        "decided_at", "decision_note")},
        batch_code=batch_code, decided_by=decider)


def refresh_for_batch(db: Session, batch: Batch, state: BatchState, cfg: ProductConfig) -> Recommendation | None:
    """Create or update the batch's pending recommendation. Flushes; the caller commits."""
    th = Thresholds(cfg.salvage_ratio, cfg.dispatch_ratio)
    kind = decide(state.rul_h, state.rul_ratio, th)
    if kind is None:
        return None  # existing pending recommendations are left for the supervisor
    value = th.salvage_ratio if kind == "SALVAGE" else th.dispatch_ratio
    rationale = {
        "rul_h": state.rul_h, "rul_ratio": state.rul_ratio,
        "threshold": {"name": f"{kind.lower()}_ratio", "value": value},
        "predicted_expiry": state.predicted_expiry.isoformat() if state.predicted_expiry else None,
        "printed_expiry": batch.printed_expiry.isoformat(),
    }
    rec = db.scalar(select(Recommendation).where(
        Recommendation.batch_id == batch.id, Recommendation.type == kind)
        .order_by(Recommendation.id.desc()).limit(1))
    if rec is not None and rec.status != RecStatus.pending.value:
        return rec  # already decided: do not re-raise
    if rec is None:
        rec = Recommendation(batch_id=batch.id, type=RecType(kind).value, rationale=rationale)
        db.add(rec)
    else:
        rec.rationale = rationale
    db.flush()
    return rec


def decide_recommendation(db: Session, user: User, rec_id: int, body: DecisionIn) -> RecommendationOut:
    row = db.execute(rec_query().where(Recommendation.id == rec_id).with_for_update(of=Recommendation)).first()
    if row is None:
        raise ApiError(404, "recommendation_not_found", "Recommendation not found")
    rec = row[0]
    if rec.status != RecStatus.pending.value:
        raise ApiError(409, "already_decided", "Recommendation has already been decided")
    before = snapshot(rec, AUDIT_FIELDS)
    rec.status = RecStatus.approved.value if body.decision == "approve" else RecStatus.rejected.value
    rec.decided_by, rec.decided_at, rec.decision_note = user.id, datetime.now(UTC), body.note
    record(db, user, AuditAction(body.decision), AuditEntity.recommendation, rec.id, before,
           snapshot(rec, AUDIT_FIELDS))
    db.commit()
    return to_out(*db.execute(rec_query().where(Recommendation.id == rec_id)).one())
