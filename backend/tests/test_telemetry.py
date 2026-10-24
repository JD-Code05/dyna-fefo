import json
from datetime import timedelta

from conftest import NOW, NOW_ISO, iso

from app.db.models import Device, Telemetry
from app.services.telemetry import handle_message


def payload(seq=1, **kw):
    return {
        "device_id": "esp32-chiller-01",
        "zone_id": "chiller-a",
        "ts": NOW_ISO,
        "temperature_c": 4.2,
        "humidity_pct": 86.5,
        "seq": seq,
    } | kw


H = {"X-Device-Key": "dev-key-01"}


def test_ingest_stores_and_dedupes(client, seeded):
    assert client.post("/api/v1/telemetry", json=payload(), headers=H).json() == {"stored": True}
    assert client.post("/api/v1/telemetry", json=payload(), headers=H).json() == {"stored": False}


def test_bad_key_401(client, seeded):
    assert client.post("/api/v1/telemetry", json=payload(), headers={"X-Device-Key": "x"}).status_code == 401


def test_out_of_range_422(client, seeded):
    r = client.post("/api/v1/telemetry", json=payload(temperature_c=99), headers=H)
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"


def test_deleted_device_404(client, seeded, db):
    db.get(Device, "esp32-chiller-01").deleted_at = NOW
    db.commit()
    r = client.post("/api/v1/telemetry", json=payload(), headers=H)
    assert r.status_code == 404 and r.json()["error"]["code"] == "device_not_found"


def test_zone_mismatch_422(client, seeded):
    r = client.post("/api/v1/telemetry", json=payload(zone_id="chiller-b"), headers=H)
    assert r.status_code == 422 and r.json()["error"]["code"] == "zone_mismatch"


def test_mqtt_handler_drops_bad_and_stores_good(db, seeded):
    handle_message(db, "sensors/esp32-chiller-01/telemetry", b"not json")
    handle_message(db, "sensors/esp32-chiller-01/telemetry", json.dumps(payload(seq=7)).encode())
    assert db.query(Telemetry).count() == 1


def test_zones_show_latest_and_danger(client, seeded):
    client.post("/api/v1/telemetry", json=payload(temperature_c=9.0), headers=H)
    z = {z["id"]: z for z in client.get("/api/v1/zones").json()["items"]}
    assert z["chiller-a"]["latest"]["danger"] is True and z["chiller-b"]["latest"] is None


def test_history_returns_points(client, seeded):
    for s in range(3):
        client.post("/api/v1/telemetry", json=payload(seq=s, ts=iso(NOW - timedelta(minutes=10 - s))), headers=H)
    r = client.get(
        "/api/v1/telemetry", params={"zone_id": "chiller-a", "from": iso(NOW - timedelta(hours=1)), "to": iso(NOW)}
    )
    assert r.json()["zone_id"] == "chiller-a" and 1 <= len(r.json()["points"]) <= 500


def test_mqtt_handler_survives_unexpected_error(db, seeded, monkeypatch):
    import app.services.telemetry as svc

    real = svc.ingest
    monkeypatch.setattr(svc, "ingest", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    handle_message(db, "sensors/esp32-chiller-01/telemetry", json.dumps(payload(seq=1)).encode())
    monkeypatch.setattr(svc, "ingest", real)
    handle_message(db, "sensors/esp32-chiller-01/telemetry", json.dumps(payload(seq=2)).encode())
    assert db.query(Telemetry).count() == 1


def test_concurrent_duplicate_returns_false(db, seeded, monkeypatch):
    from app.schemas.telemetry import TelemetryIn
    from app.services.telemetry import ingest

    d = TelemetryIn(**payload(seq=5))
    assert ingest(db, d, None) is True
    # simulate losing the race: existence check sees nothing, insert hits the PK
    monkeypatch.setattr(db, "scalar", lambda *a, **k: 0)
    assert ingest(db, d, None) is False


def test_history_default_to_follows_sim_clock(client, seeded, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "sim_mode", True)
    client.post("/api/v1/telemetry", json=payload(seq=1, ts=iso(NOW + timedelta(hours=2))), headers=H)
    r = client.get("/api/v1/telemetry", params={"zone_id": "chiller-a"})
    assert len(r.json()["points"]) == 1
