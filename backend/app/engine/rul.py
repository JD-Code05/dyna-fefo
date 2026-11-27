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


def _hours_to_age(need: float, carried_rate: float, p: RulParams) -> float:
    """Inverse of _gap_age: hours into a gap until `need` more hours of age have built up."""
    first = carried_rate * p.max_dt_hours
    return need / carried_rate if need <= first else p.max_dt_hours + (need - first)


def compute_rul(readings: Sequence[Reading], received_at: datetime, now: datetime, p: RulParams) -> RulResult:
    # Dedupe by timestamp (last wins), drop pre-receipt readings, sort ascending.
    by_ts = {r.ts: r for r in readings if r.ts >= received_at}
    pts = [by_ts[ts] for ts in sorted(by_ts)]

    # Piecewise-constant: each reading's rate holds until the next reading. Before the first
    # reading there is no carried rate, so the first gap uses the reference rate. The last
    # reading's rate carries forward to now (the tail segment), same gap rule.
    segments = []  # (start, end, carried rate)
    prev_ts, prev_rate = received_at, 1.0
    for r in pts:
        segments.append((prev_ts, r.ts, prev_rate))
        prev_ts, prev_rate = r.ts, rate(r.temperature_c, p)
    if now > prev_ts:
        segments.append((prev_ts, now, prev_rate))

    life = p.shelf_life_ref_hours
    age, expired_at = 0.0, None
    for start, end, carried in segments:
        gained = _gap_age(_hours(end - start), carried, p)
        if expired_at is None and age + gained >= life:  # the moment life ran out, so it doesn't slide with the clock
            expired_at = start + timedelta(hours=_hours_to_age(life - age, carried, p))
        age += gained

    rul_h = max(0.0, life - age)
    # Expiry is counted from the last reading; with no readings, from now (the age is up to now).
    expiry_anchor = pts[-1].ts if pts else now
    return RulResult(
        effective_age_h=age,
        rul_h=rul_h,
        rul_ratio=rul_h / life,
        last_ts=pts[-1].ts if pts else None,
        predicted_expiry=expired_at or expiry_anchor + timedelta(hours=rul_h),
    )
