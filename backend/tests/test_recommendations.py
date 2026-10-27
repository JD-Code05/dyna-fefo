from datetime import timedelta

import pytest
from conftest import AGED_NOW, STAFF

from app.db.models import Recommendation
from app.services.rul_jobs import recompute_all


def test_refresh_does_not_duplicate(db, products, aged_batch_with_rec):
    _, batch_id = aged_batch_with_rec
    recompute_all(db, products, AGED_NOW)  # second run, same state
    assert db.query(Recommendation).filter_by(batch_id=batch_id, status="pending").count() == 1


def test_dispatch_upgrades_to_salvage_in_place(db, products, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec  # pending PRIORITY_DISPATCH at ratio 0.125
    recompute_all(db, products, AGED_NOW + timedelta(hours=10))  # 10 h later: ratio ~0.08
    pending = db.query(Recommendation).filter_by(batch_id=batch_id, status="pending").all()
    assert [(r.id, r.type) for r in pending] == [(rec_id, "SALVAGE")]


def test_rationale_and_type(client, aged_batch_with_rec):
    rec_id, _ = aged_batch_with_rec
    item = next(r for r in client.get("/api/v1/recommendations?status=pending").json()["items"] if r["id"] == rec_id)
    assert item["type"] == "PRIORITY_DISPATCH" and item["batch_code"] == "CHK-004" and item["decided_by"] is None
    assert item["rationale"]["threshold"]["value"] == 0.5


def approve(client, rec_id):
    return client.post(f"/api/v1/recommendations/{rec_id}/decision", json={"decision": "approve", "note": "ok"})


def task(client, rec_id, **body):
    return client.post(f"/api/v1/recommendations/{rec_id}/task", json=body, headers=STAFF)


def test_approve_keeps_batch_active(client, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec
    r = approve(client, rec_id)
    assert r.json()["status"] == "approved" and r.json()["decided_by"] == "demo-supervisor"
    assert client.get(f"/api/v1/batches/{batch_id}").json()["status"] == "active"
    assert client.get("/api/v1/audit-log?entity=recommendation").json()["items"][0]["action"] == "approve"
    assert client.get("/api/v1/audit-log?entity=batch").json()["items"] == []


def test_reject_keeps_batch_active(client, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec
    client.post(f"/api/v1/recommendations/{rec_id}/decision", json={"decision": "reject"})
    assert client.get(f"/api/v1/batches/{batch_id}").json()["status"] == "active"


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


@pytest.mark.parametrize("decision", ["approve", "reject"])
def test_decided_recommendation_not_reraised(client, db, products, aged_batch_with_rec, decision):
    rec_id, batch_id = aged_batch_with_rec
    client.post(f"/api/v1/recommendations/{rec_id}/decision", json={"decision": decision})
    recompute_all(db, products, AGED_NOW)
    assert db.query(Recommendation).filter_by(batch_id=batch_id, type="PRIORITY_DISPATCH").count() == 1
    assert db.query(Recommendation).filter_by(batch_id=batch_id, status="pending").count() == 0


def test_rec_out_has_handled_fields(client, aged_batch_with_rec):
    item = client.get("/api/v1/recommendations").json()["items"][0]
    assert item["handled_by"] is None and item["handled_at"] is None and item["flag_reason"] is None


def test_staff_done_dispatch(client, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec
    approve(client, rec_id)
    r = task(client, rec_id, result="done")
    assert r.json()["status"] == "done" and r.json()["handled_by"] == "demo-staff" and r.json()["handled_at"]
    assert client.get(f"/api/v1/batches/{batch_id}").json()["status"] == "dispatched"
    audit = client.get("/api/v1/audit-log").json()["items"][:2]
    assert {(a["action"], a["user"]) for a in audit} == {("complete", "demo-staff"), ("update", "demo-staff")}


def test_staff_done_salvage(client, db, products, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec
    recompute_all(db, products, AGED_NOW + timedelta(hours=10))  # upgrades the pending rec to SALVAGE
    approve(client, rec_id)
    assert task(client, rec_id, result="done").json()["type"] == "SALVAGE"
    assert client.get(f"/api/v1/batches/{batch_id}").json()["status"] == "salvaged"


def test_staff_flag_keeps_batch(client, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec
    approve(client, rec_id)
    r = task(client, rec_id, result="flagged", reason="not_found")
    assert r.json()["status"] == "flagged" and r.json()["flag_reason"] == "not_found"
    assert client.get(f"/api/v1/batches/{batch_id}").json()["status"] == "active"
    audit = client.get("/api/v1/audit-log").json()["items"]
    assert audit[0]["action"] == "flag" and audit[0]["after"]["flag_reason"] == "not_found"
    assert [a["action"] for a in audit].count("update") == 0


@pytest.mark.parametrize("state", ["pending", "rejected", "done", "flagged"])
def test_task_on_non_open_order_409(client, aged_batch_with_rec, state):
    rec_id, _ = aged_batch_with_rec
    if state == "rejected":
        client.post(f"/api/v1/recommendations/{rec_id}/decision", json={"decision": "reject"})
    elif state != "pending":
        approve(client, rec_id)
        task(client, rec_id, result=state, **({"reason": "spoiled"} if state == "flagged" else {}))
    r = task(client, rec_id, result="done")  # for "done" this is the double tap
    assert r.status_code == 409 and r.json()["error"]["code"] == "not_an_open_task"


@pytest.mark.parametrize("body", [{"result": "flagged"}, {"result": "done", "reason": "spoiled"}])
def test_task_reason_rules_422(client, aged_batch_with_rec, body):
    rec_id, _ = aged_batch_with_rec
    approve(client, rec_id)
    assert task(client, rec_id, **body).status_code == 422


def test_task_on_deleted_batch_404(client, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec
    approve(client, rec_id)
    client.delete(f"/api/v1/batches/{batch_id}")
    r = task(client, rec_id, result="done")
    assert r.status_code == 404 and r.json()["error"]["code"] == "recommendation_not_found"


def test_done_leaves_hand_edited_batch_alone(client, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec
    approve(client, rec_id)
    client.patch(f"/api/v1/batches/{batch_id}", json={"status": "salvaged"})
    before = len(client.get("/api/v1/audit-log").json()["items"])
    assert task(client, rec_id, result="done").json()["status"] == "done"
    assert client.get(f"/api/v1/batches/{batch_id}").json()["status"] == "salvaged"
    audit = client.get("/api/v1/audit-log").json()["items"]
    assert len(audit) == before + 1 and audit[0]["action"] == "complete"


def test_supervisor_cannot_call_task_403(client, aged_batch_with_rec):
    rec_id, _ = aged_batch_with_rec
    approve(client, rec_id)
    r = client.post(f"/api/v1/recommendations/{rec_id}/task", json={"result": "done"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "forbidden"


def test_no_new_rec_while_order_open(client, db, products, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec
    approve(client, rec_id)
    recompute_all(db, products, AGED_NOW + timedelta(hours=10))  # now in salvage range
    assert db.query(Recommendation).filter_by(batch_id=batch_id).count() == 1


def test_flag_lets_salvage_be_raised(client, db, products, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec
    approve(client, rec_id)
    task(client, rec_id, result="flagged", reason="spoiled")
    recompute_all(db, products, AGED_NOW + timedelta(hours=10))
    pending = db.query(Recommendation).filter_by(batch_id=batch_id, status="pending").one()
    assert pending.type == "SALVAGE"
