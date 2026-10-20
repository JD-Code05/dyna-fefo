NEW = {"code": "CHK-100", "product_id": "chicken-breast", "zone_id": "chiller-a", "received_at": "2026-10-20T00:00:00Z", "printed_expiry": "2026-10-30T00:00:00Z", "quantity": 12}


def test_create_and_get(client, seeded):
    b = client.post("/api/v1/batches", json=NEW).json()
    got = client.get(f"/api/v1/batches/{b['id']}").json()
    assert got["code"] == "CHK-100" and got["product_name"] and got["rul_h"] is None
    assert "unit_price" not in b


def test_code_taken_409_but_reusable_after_delete(client, seeded):
    b = client.post("/api/v1/batches", json=NEW).json()
    r = client.post("/api/v1/batches", json=NEW)
    assert r.status_code == 409 and r.json()["error"]["code"] == "batch_code_taken"
    client.delete(f"/api/v1/batches/{b['id']}")
    assert client.post("/api/v1/batches", json=NEW).status_code == 201


def test_edit_to_taken_code_409(client, seeded):
    b = client.post("/api/v1/batches", json=NEW).json()
    r = client.patch(f"/api/v1/batches/{b['id']}", json={"code": "CHK-001"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "batch_code_taken"


def test_patch_audits_before_after_and_bumps_updated_at(client, seeded):
    old = client.get("/api/v1/batches/1").json()["updated_at"]
    new = client.patch("/api/v1/batches/1", json={"quantity": 5, "notes": "dented box"}).json()
    assert new["updated_at"] > old
    log = client.get("/api/v1/audit-log?entity=batch&action=update").json()["items"][0]
    assert log["after"] == {"quantity": 5, "notes": "dented box"} and set(log["before"]) == {"quantity", "notes"}


def test_noop_patch_no_audit(client, seeded):
    q = client.get("/api/v1/batches/1").json()["quantity"]
    client.patch("/api/v1/batches/1", json={"quantity": q})
    assert client.get("/api/v1/audit-log?entity=batch").json()["total"] == 0


def test_expiry_before_receipt_422(client, seeded):
    r = client.post("/api/v1/batches", json=NEW | {"printed_expiry": "2026-10-19T00:00:00Z"})
    assert r.json()["error"]["code"] == "expiry_before_receipt"


def test_patch_expiry_checked_against_merged_values(client, seeded):
    cur = client.get("/api/v1/batches/1").json()
    r = client.patch("/api/v1/batches/1", json={"received_at": cur["printed_expiry"]})
    assert (r.status_code, r.json()["error"]["code"]) == (422, "expiry_before_receipt")


def test_unknown_refs_422(client, seeded):
    assert client.post("/api/v1/batches", json=NEW | {"product_id": "x"}).json()["error"]["code"] == "unknown_product"
    assert client.patch("/api/v1/batches/1", json={"zone_id": "x"}).json()["error"]["code"] == "unknown_zone"


def test_patch_null_and_unknown_field_rejected(client, seeded):
    assert client.patch("/api/v1/batches/1", json={"quantity": None}).status_code == 422
    assert client.patch("/api/v1/batches/1", json={"id": 9}).status_code == 422
    assert client.patch("/api/v1/batches/1", json={"notes": None}).status_code == 200


def test_status_patch_and_filter(client, seeded):
    assert client.patch("/api/v1/batches/1", json={"status": "dispatched"}).json()["status"] == "dispatched"
    items = client.get("/api/v1/batches?status=dispatched").json()["items"]
    assert [b["id"] for b in items] == [1]


def test_deleted_batch_hidden_and_404(client, seeded):
    assert client.delete("/api/v1/batches/1").status_code == 204
    assert 1 not in [b["id"] for b in client.get("/api/v1/batches").json()["items"]]
    assert client.get("/api/v1/batches/1").status_code == 404
    assert client.get("/api/v1/batches/1?include_deleted=true").status_code == 200
    assert client.patch("/api/v1/batches/1", json={"quantity": 1}).status_code == 404
    log = client.get("/api/v1/audit-log?entity=batch&action=delete").json()["items"][0]
    assert log["after"] is None and log["before"]["code"] == "CHK-001"
