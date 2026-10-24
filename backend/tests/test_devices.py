def test_create_device_returns_key_once_and_audits(client, seeded):
    r = client.post("/api/v1/devices", json={"id": "esp32-chiller-03", "name": "Probe 3", "zone_id": "chiller-a"})
    assert r.status_code == 201 and r.json()["api_key"]
    assert "api_key" not in client.get("/api/v1/devices").json()["items"][0]
    log = client.get("/api/v1/audit-log?entity=device").json()["items"][0]
    assert (log["action"], log["entity_id"], log["user"]) == ("create", "esp32-chiller-03", "demo-supervisor")


def test_patch_device_audits_only_changes(client, seeded):
    client.patch("/api/v1/devices/esp32-chiller-01", json={"name": "Renamed", "zone_id": "chiller-a"})
    log = client.get("/api/v1/audit-log?action=update").json()["items"][0]
    assert log["before"] == {"name": "Chiller A Probe 01"}
    assert log["after"] == {"name": "Renamed"}


def test_noop_patch_writes_no_audit(client, seeded):
    name = client.get("/api/v1/devices").json()["items"][0]["name"]
    client.patch("/api/v1/devices/esp32-chiller-01", json={"name": name})
    assert client.get("/api/v1/audit-log?action=update").json()["total"] == 0


def test_device_id_immutable(client, seeded):
    assert client.patch("/api/v1/devices/esp32-chiller-01", json={"id": "x"}).status_code == 422


def test_soft_delete_hides_and_404s_after(client, seeded):
    assert client.delete("/api/v1/devices/esp32-chiller-02").status_code == 204
    ids = [d["id"] for d in client.get("/api/v1/devices").json()["items"]]
    assert "esp32-chiller-02" not in ids
    all_ids = [d["id"] for d in client.get("/api/v1/devices?include_deleted=true").json()["items"]]
    assert "esp32-chiller-02" in all_ids
    assert client.delete("/api/v1/devices/esp32-chiller-02").status_code == 404
    assert client.patch("/api/v1/devices/esp32-chiller-02", json={"name": "z"}).status_code == 404


def test_readd_deleted_device_revives_with_new_key(client, seeded):
    client.delete("/api/v1/devices/esp32-chiller-02")
    r = client.post("/api/v1/devices", json={"id": "esp32-chiller-02", "name": "Probe 2b", "zone_id": "chiller-a"})
    assert r.status_code == 201 and r.json()["deleted_at"] is None and r.json()["zone_id"] == "chiller-a"
    assert "esp32-chiller-02" in [d["id"] for d in client.get("/api/v1/devices").json()["items"]]
    log = client.get("/api/v1/audit-log?entity=device&action=create").json()["items"][0]
    assert log["before"]["deleted_at"] is not None and log["after"]["deleted_at"] is None
    reading = {
        "device_id": "esp32-chiller-02",
        "zone_id": "chiller-a",
        "ts": "2026-10-19T13:45:00Z",
        "temperature_c": 4.0,
        "humidity_pct": 85.0,
        "seq": 1,
    }
    assert client.post("/api/v1/telemetry", json=reading, headers={"X-Device-Key": "dev-key-02"}).status_code == 401


def test_duplicate_id_and_unknown_zone(client, seeded):
    body = {"id": "esp32-chiller-01", "name": "x", "zone_id": "chiller-a"}
    r = client.post("/api/v1/devices", json=body)
    assert (r.status_code, r.json()["error"]["code"]) == (409, "device_id_taken")
    r = client.post("/api/v1/devices", json={**body, "id": "new-dev", "zone_id": "nope"})
    assert (r.status_code, r.json()["error"]["code"]) == (422, "unknown_zone")


def test_patch_explicit_null_rejected(client, seeded):
    for body in ({"name": None}, {"zone_id": None}):
        assert client.patch("/api/v1/devices/esp32-chiller-01", json=body).status_code == 422
