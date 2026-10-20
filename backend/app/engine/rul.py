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


def _gap_age(gap_h: float, carried_rate: float, p: RulParams) -> float:
    # First max_dt hours of a gap age at the carried rate; the rest at the reference rate (1.0).
    return carried_rate * min(gap_h, p.max_dt_hours) + max(0.0, gap_h - p.max_dt_hours)


def compute_rul(readings: Sequence[Reading], received_at: datetime, now: datetime, p: RulParams) -> RulResult:
    # Dedupe by timestamp (last wins), drop pre-receipt readings, sort ascending.
    by_ts = {r.ts: r for r in readings if r.ts >= received_at}
    pts = [by_ts[ts] for ts in sorted(by_ts)]

    # Piecewise-constant: each reading's rate holds until the next reading. Before the first
    # reading there is no carried rate, so the first gap uses the reference rate.
    age = 0.0
    prev_ts = received_at
    prev_rate = 1.0
    for r in pts:
        age += _gap_age(_hours(r.ts - prev_ts), prev_rate, p)
        prev_ts, prev_rate = r.ts, rate(r.temperature_c, p)

    # Tail: last reading's rate carries forward to now, same gap rule.
    anchor = pts[-1].ts if pts else received_at
    if now > anchor:
        age += _gap_age(_hours(now - anchor), prev_rate, p)

    rul_h = max(0.0, p.shelf_life_ref_hours - age)
    # Expiry is counted from the last reading; with no readings, from now (the age is up to now).
    expiry_anchor = pts[-1].ts if pts else now
    return RulResult(
        effective_age_h=age,
        rul_h=rul_h,
        rul_ratio=rul_h / p.shelf_life_ref_hours,
        last_ts=pts[-1].ts if pts else None,
        predicted_expiry=expiry_anchor + timedelta(hours=rul_h),
    )
