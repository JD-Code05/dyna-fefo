def test_health_ok(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["db"] == "ok"


def test_unknown_route_uses_error_shape(client):
    r = client.get("/api/v1/nope")
    assert r.status_code == 404
    assert set(r.json()["error"]) == {"code", "message", "details"}
    assert r.json()["error"]["details"] == {}


def test_cors_allows_frontend(client):
    r = client.options("/api/v1/health", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_health_db_down_returns_503(client):
    class Broken:
        def execute(self, *a, **k):
            raise RuntimeError("db gone")

    from app.core.deps import get_db

    client.app.dependency_overrides[get_db] = lambda: Broken()
    r = client.get("/api/v1/health")
    assert r.status_code == 503
    assert r.json()["status"] == "down" and r.json()["db"] == "down"


def test_unhandled_exception_uses_error_shape(client):
    from fastapi.testclient import TestClient

    @client.app.get("/boom")
    def boom():
        raise RuntimeError("x")

    r = TestClient(client.app, raise_server_exceptions=False).get("/boom")
    assert r.status_code == 500
    assert r.json()["error"] == {"code": "internal_error", "message": "Internal server error", "details": {}}


def test_me_is_demo_supervisor(client, seeded):
    r = client.get("/api/v1/me")
    assert r.json() == {"id": 1, "username": "demo-supervisor", "role": "supervisor"}


def test_me_unseeded_errors(client):
    r = client.get("/api/v1/me")
    assert r.status_code == 500 and r.json()["error"]["code"] == "demo_user_missing"


def test_products_lists_chicken(client, seeded):
    items = client.get("/api/v1/products").json()["items"]
    assert [p["id"] for p in items] == ["chicken-breast"]
    assert "base_price" not in items[0]


def test_seed_is_idempotent(db):
    from app.db.models import Batch, Device, Zone
    from app.db.seed import seed

    seed(db)
    seed(db)
    assert db.query(Batch).count() == 4
    assert db.query(Device).count() == 2
    assert db.query(Zone).count() == 2


def test_require_role_forbids_staff():
    import pytest

    from app.core.deps import require_role
    from app.core.errors import ApiError
    from app.db.models import Role, User

    with pytest.raises(ApiError) as e:
        require_role(Role.supervisor)(User(username="x", role="staff"))
    assert e.value.status == 403


def test_no_duplicate_routes():
    from app.main import create_app
    # this FastAPI wraps each include_router() in an _IncludedRouter; the same router twice duplicates its routes
    routers = [id(r.original_router) for r in create_app().routes if hasattr(r, "original_router")]
    assert routers and len(routers) == len(set(routers))


def test_openapi_422_uses_error_schema(client):
    spec = client.get("/openapi.json").json()
    ref = spec["paths"]["/api/v1/batches"]["post"]["responses"]["422"]["content"]["application/json"]["schema"]["$ref"]
    assert ref.endswith("/ErrorOut")
    assert "HTTPValidationError" not in str(spec["paths"])
