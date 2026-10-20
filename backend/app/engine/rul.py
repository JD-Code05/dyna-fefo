"""Q10 remaining-useful-life engine. Pure: stdlib only, no I/O, all datetimes UTC-aware."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass(frozen=True)
class Reading:
    ts: datetime
    temperature_c: float
    humidity_pct: float


@dataclass(frozen=True)
class RulParams:
    shelf_life_ref_hours: float
    t_ref_c: float
    q10: float
    rate_floor: float = 0.5
    max_dt_hours: float = 1.0


@dataclass(frozen=True)
class RulResult:
    effective_age_h: float
    rul_h: float
    rul_ratio: float
    last_ts: datetime | None
    predicted_expiry: datetime


def rate(temperature_c: float, p: RulParams) -> float:
    return max(p.rate_floor, float(p.q10 ** ((temperature_c - p.t_ref_c) / 10)))


def _hours(delta: timedelta) -> float:
    return delta.total_seconds() / 3600


def compute_rul(readings: Sequence[Reading], received_at: datetime, now: datetime, p: RulParams) -> RulResult:
    # Dedupe by timestamp (last wins), drop pre-receipt readings, sort ascending.
    by_ts = {r.ts: r for r in readings if r.ts >= received_at}
    pts = [by_ts[ts] for ts in sorted(by_ts)]

    # Piecewise-constant: each reading's rate holds until the next reading, capped per gap.
    age = 0.0
    prev_ts = received_at
    prev_rate = rate(pts[0].temperature_c, p) if pts else 1.0
    for r in pts:
        age += prev_rate * min(_hours(r.ts - prev_ts), p.max_dt_hours)
        prev_ts, prev_rate = r.ts, rate(r.temperature_c, p)

    # Extrapolate the last reading forward to now, capped so silence is not assumed constant.
    anchor = pts[-1].ts if pts else received_at
    if now > anchor:
        age += prev_rate * min(_hours(now - anchor), p.max_dt_hours)

    rul_h = max(0.0, p.shelf_life_ref_hours - age)
    return RulResult(
        effective_age_h=age,
        rul_h=rul_h,
        rul_ratio=rul_h / p.shelf_life_ref_hours,
        last_ts=pts[-1].ts if pts else None,
        predicted_expiry=anchor + timedelta(hours=rul_h),
    )
