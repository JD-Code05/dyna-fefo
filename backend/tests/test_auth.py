from datetime import UTC, datetime, timedelta

import jwt
from conftest import STAFF

from app.core.config import get_settings
from app.core.security import create_token
from app.db.models import AuditLog, User

LOGIN = "/api/v1/auth/login"


def login(client, username="demo-supervisor", password=None):
    password = password or get_settings().demo_supervisor_password
    return client.post(LOGIN, json={"username": username, "password": password}, headers={"Authorization": ""})


def test_passwords_are_stored_hashed(db, seeded):
    h = db.query(User).filter_by(username="demo-supervisor").one().password_hash
    assert h.startswith("$argon2") and get_settings().demo_supervisor_password not in h


def test_login_returns_a_token_that_works(client, seeded, db):
    r = login(client)
    assert r.status_code == 200 and r.json()["role"] == "supervisor"
    me = client.get("/api/v1/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"})
    assert me.json()["username"] == "demo-supervisor"
    assert db.query(AuditLog).filter_by(action="login", entity="user").count() == 1


def test_wrong_password_and_unknown_user_look_the_same(client, seeded, db):
    bad_pw, no_user = login(client, password="nope"), login(client, username="ghost", password="nope")
    assert bad_pw.status_code == no_user.status_code == 401
    assert bad_pw.json() == no_user.json()
    assert db.query(AuditLog).filter_by(action="login_failed").count() == 1  # only the real account is logged


def test_requests_without_a_valid_token_are_refused(client, seeded):
    expired = create_token("demo-supervisor", "supervisor", datetime.now(UTC) - timedelta(days=1))
    forged = jwt.encode(
        {"sub": "demo-supervisor", "role": "supervisor"}, "an-attacker-secret-that-is-long-enough", algorithm="HS256"
    )
    for auth in ("", "Bearer garbage", f"Bearer {expired}", f"Bearer {forged}"):
        r = client.get("/api/v1/batches", headers={"Authorization": auth})
        assert r.status_code == 401 and r.json()["error"]["code"] == "not_authenticated", auth


def test_five_failures_lock_the_account(client, seeded):
    for _ in range(5):
        assert login(client, password="nope").status_code == 401
    r = login(client)  # right password, still locked
    assert r.status_code == 423 and r.json()["error"]["code"] == "account_locked"
    assert login(client, username="demo-staff", password=get_settings().demo_staff_password).status_code == 200


def test_staff_token_cannot_approve(client, aged_batch_with_rec):
    rec_id, _ = aged_batch_with_rec
    r = client.post(f"/api/v1/recommendations/{rec_id}/decision", json={"decision": "approve"}, headers=STAFF)
    assert r.status_code == 403
