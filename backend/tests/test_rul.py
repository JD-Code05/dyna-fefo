from datetime import UTC, datetime, timedelta

import pytest

from app.engine.rul import Reading, RulParams, compute_rul, rate

T0 = datetime(2026, 10, 20, tzinfo=UTC)
P = RulParams(shelf_life_ref_hours=240, t_ref_c=4, q10=2.5)


def hourly(t0, temps):
    return [Reading(t0 + timedelta(hours=i), T, 85) for i, T in enumerate(temps)]


def test_rate_is_one_at_reference():
    assert rate(4, P) == 1.0


def test_rate_warmer_matches_q10():
    assert rate(14, P) == pytest.approx(2.5)


def test_rate_floor_below_reference():
    assert rate(-20, P) == 0.5


def test_constant_reference_ages_linearly():
    r = compute_rul(hourly(T0, [4] * 25), T0, T0 + timedelta(hours=24), P)
    assert r.effective_age_h == pytest.approx(24)
    assert r.rul_h == pytest.approx(216)


def test_herron_cyclic_abuse_band():
    # 24 h: alternating 2 h at 4 C and 2 h at 23 C, 15-min readings.
    # Tolerance: extra shelf-life loss vs. 24 h at 4 C must be 1.5..3.0 days
    # (Herron et al. 2022 report ~1.5 d PSY, ~2.25 d APC).
    rs = [Reading(T0 + timedelta(minutes=15 * i), 4 if (i // 8) % 2 == 0 else 23, 85) for i in range(97)]
    r = compute_rul(rs, T0, T0 + timedelta(hours=24), P)
    lost_days = (r.effective_age_h - 24) / 24
    assert 1.5 <= lost_days <= 3.0


def test_gap_beyond_cap_ages_at_reference_rate():
    rs = [Reading(T0, 30, 85), Reading(T0 + timedelta(hours=10), 30, 85)]
    r = compute_rul(rs, T0, T0 + timedelta(hours=10), P)
    assert r.effective_age_h == pytest.approx(rate(30, P) * 1.0 + 9.0)


def test_no_readings_ages_at_reference():
    r = compute_rul([], T0, T0 + timedelta(hours=100), P)
    assert r.effective_age_h == pytest.approx(100)
    assert r.rul_h == pytest.approx(140)
    assert r.last_ts is None
    assert r.predicted_expiry == T0 + timedelta(hours=100 + 140)


def test_tail_extrapolation_capped():
    r = compute_rul([Reading(T0, 30, 85)], T0, T0 + timedelta(hours=5), P)
    assert r.effective_age_h == pytest.approx(rate(30, P) * 1.0 + 4.0)


def test_duplicates_and_out_of_order_ignored():
    rs = hourly(T0, [4] * 5)
    assert compute_rul(rs + rs[::-1], T0, T0 + timedelta(hours=4), P) == compute_rul(rs, T0, T0 + timedelta(hours=4), P)


def test_pre_receipt_readings_ignored_and_new_batch_full():
    rs = [Reading(T0 - timedelta(hours=5), 40, 85)]
    r = compute_rul(rs, T0, T0, P)
    assert r.rul_ratio == 1.0 and r.effective_age_h == 0


def test_rul_never_negative():
    r = compute_rul(hourly(T0, [40] * 200), T0, T0 + timedelta(hours=199), P)
    assert r.rul_h == 0 and 0 <= r.rul_ratio <= 1
