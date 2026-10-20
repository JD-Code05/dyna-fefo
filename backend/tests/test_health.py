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
