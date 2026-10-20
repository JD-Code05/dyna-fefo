import logging
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.products import ProductConfig
from app.db.models import Batch, BatchState, BatchStateHistory, BatchStatus, Telemetry
from app.engine.rul import Reading, RulParams, compute_rul
from app.services.recommendations import refresh_for_batch

log = logging.getLogger(__name__)


def params_for(cfg: ProductConfig) -> RulParams:
    return RulParams(cfg.shelf_life_ref_hours, cfg.t_ref_c, cfg.q10, cfg.rate_floor, cfg.max_dt_hours)


def recompute_batch(db: Session, batch: Batch, cfg: ProductConfig, now: datetime) -> BatchState:
    """Upsert the batch's state and append a history row. Flushes; the caller commits."""
    rows = db.execute(select(Telemetry.ts, Telemetry.temperature_c, Telemetry.humidity_pct)
                      .where(Telemetry.zone_id == batch.zone_id, Telemetry.ts >= batch.received_at,
                              Telemetry.ts <= now)
                      .order_by(Telemetry.ts)).all()
    res = compute_rul([Reading(*r) for r in rows], batch.received_at, now, params_for(cfg))
    wall = datetime.now(UTC)  # write time, not the (possibly simulated) `now`
    state = db.get(BatchState, batch.id) or BatchState(batch_id=batch.id)
    state.effective_age_h, state.rul_h, state.rul_ratio = res.effective_age_h, res.rul_h, res.rul_ratio
    state.last_telemetry_ts, state.predicted_expiry, state.computed_at = res.last_ts, res.predicted_expiry, wall
    db.add(state)
    # shortcut: a history row per batch per run, no retention; prune or downsample if the worker runs for days
    db.add(BatchStateHistory(batch_id=batch.id, computed_at=wall, rul_h=res.rul_h,
                             rul_ratio=res.rul_ratio, effective_age_h=res.effective_age_h))
    db.flush()
    return state


def recompute_all(db: Session, products: dict[str, ProductConfig], now: datetime | None = None) -> list[BatchState]:
    sim = get_settings().sim_mode
    batches = db.scalars(select(Batch).where(Batch.deleted_at.is_(None), Batch.status == BatchStatus.active.value)
                         .order_by(Batch.id)).all()
    states = []
    for b in batches:
        t = now
        if t is None:
            # In sim mode the clock is the zone's latest reading (SIM_SPEEDUP); else wall clock.
            latest = db.scalar(select(func.max(Telemetry.ts)).where(Telemetry.zone_id == b.zone_id)) if sim else None
            t = latest or datetime.now(UTC)
        cfg = products.get(b.product_id)
        if cfg is None:
            log.warning("batch %s: unknown product %r, skipped", b.id, b.product_id)
            continue
        try:
            with db.begin_nested():  # savepoint: a failing batch leaves no partial rows
                state = recompute_batch(db, b, cfg, t)
                refresh_for_batch(db, b, state, cfg)
        except Exception:
            log.exception("batch %s: recompute failed, skipped", b.id)
            continue
        states.append(state)
    db.commit()
    return states
