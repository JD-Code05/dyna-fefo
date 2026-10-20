from conftest import AGED_NOW

from app.db.models import Recommendation
from app.services.rul_jobs import recompute_all


def test_refresh_does_not_duplicate(db, products, aged_batch_with_rec):
    _, batch_id = aged_batch_with_rec
    recompute_all(db, products, AGED_NOW)  # second run, same state
    assert db.query(Recommendation).filter_by(batch_id=batch_id, status="pending").count() == 1


def test_rationale_and_type(client, aged_batch_with_rec):
    rec_id, _ = aged_batch_with_rec
    item = next(r for r in client.get("/api/v1/recommendations?status=pending").json()["items"] if r["id"] == rec_id)
    assert item["type"] == "PRIORITY_DISPATCH" and item["batch_code"] == "CHK-004" and item["decided_by"] is None
    assert item["rationale"]["threshold"]["value"] == 0.5


def test_approve_audits_and_keeps_batch_status(client, db, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec
    r = client.post(f"/api/v1/recommendations/{rec_id}/decision", json={"decision": "approve", "note": "ok"})
    assert r.json()["status"] == "approved" and r.json()["decided_by"] == "demo-supervisor"
    assert client.get(f"/api/v1/batches/{batch_id}").json()["status"] == "active"
    assert client.get("/api/v1/audit-log?entity=recommendation").json()["items"][0]["action"] == "approve"


def test_second_decision_409(client, aged_batch_with_rec):
    rec_id, _ = aged_batch_with_rec
    client.post(f"/api/v1/recommendations/{rec_id}/decision", json={"decision": "reject"})
    r = client.post(f"/api/v1/recommendations/{rec_id}/decision", json={"decision": "approve"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "already_decided"


def test_deleted_batch_rec_hidden_and_404(client, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec
    client.delete(f"/api/v1/batches/{batch_id}")
    assert rec_id not in [r["id"] for r in client.get("/api/v1/recommendations").json()["items"]]
    assert client.post(f"/api/v1/recommendations/{rec_id}/decision", json={"decision": "approve"}).status_code == 404
