from datetime import timedelta

import pytest
from conftest import NOW

from app.db.models import Batch, BatchState, BatchStateHistory, Telemetry
from app.services.rul_jobs import recompute_all, recompute_batch


def add_readings(db, zone, start, temps, device="esp32-chiller-01"):
    for i, T in enumerate(temps):
        db.add(Telemetry(device_id=device, zone_id=zone, ts=start + timedelta(hours=i), seq=i, temperature_c=T, humidity_pct=85))
    db.commit()


def test_recompute_sets_state_and_predicted_expiry(db, seeded, products):
    b = db.query(Batch).filter_by(code="CHK-001").one()
    add_readings(db, "chiller-a", b.received_at, [4] * 13)
    s = recompute_batch(db, b, products["chicken-breast"], b.received_at + timedelta(hours=12))
    assert s.rul_h == pytest.approx(228)
    assert s.predicted_expiry == b.received_at + timedelta(hours=12 + 228)


def test_deleted_batches_skipped(db, seeded, products):
    db.query(Batch).filter_by(code="CHK-002").one().deleted_at = NOW
    db.commit()
    codes = {db.get(Batch, s.batch_id).code for s in recompute_all(db, products, NOW)}
    assert "CHK-002" not in codes and "CHK-001" in codes


def test_no_readings_full_rul(db, seeded, products):
    b = db.query(Batch).filter_by(code="CHK-001").one()
    assert recompute_batch(db, b, products["chicken-breast"], b.received_at).rul_ratio == 1.0


def test_batches_list_sorted_by_rul(client, db, seeded, products):
    recompute_all(db, products, NOW)
    ruls = [b["rul_h"] for b in client.get("/api/v1/batches").json()["items"]]
    assert ruls and None not in ruls and ruls == sorted(ruls)


def test_recompute_twice_same_now_upserts_and_appends_history(db, seeded, products):
    recompute_all(db, products, NOW)
    recompute_all(db, products, NOW)
    assert db.query(BatchState).count() == 4
    assert db.query(BatchStateHistory).count() == 8


def test_non_active_skipped(db, seeded, products):
    db.query(Batch).filter_by(code="CHK-003").one().status = "dispatched"
    db.commit()
    assert len(recompute_all(db, products, NOW)) == 3


def test_rul_endpoint(client, db, seeded, products):
    recompute_all(db, products, NOW)
    b = db.query(Batch).filter_by(code="CHK-001").one()
    r = client.get(f"/api/v1/batches/{b.id}/rul").json()
    assert r["batch_id"] == b.id and r["current"]["rul_h"] is not None
    assert len(r["history"]) == 1 and set(r["history"][0]) == {"computed_at", "rul_h", "rul_ratio"}
    assert client.get("/api/v1/batches/9999/rul").json()["error"]["code"] == "batch_not_found"


def test_unknown_product_skipped_others_computed(db, seeded, products):
    from app.db.models import Product
    db.merge(Product(**{**products["chicken-breast"].model_dump(), "id": "fish"}))
    db.query(Batch).filter_by(code="CHK-004").one().product_id = "fish"
    db.commit()
    states = recompute_all(db, products, NOW)
    assert len(states) == 3 and db.query(BatchState).count() == 3
