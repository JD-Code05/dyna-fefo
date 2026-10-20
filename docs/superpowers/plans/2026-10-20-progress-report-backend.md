# Progress-Report Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Dockerized FastAPI backend that ingests simulated sensor data, computes live RUL per batch, raises dispatch/salvage recommendations, and supports audited create/edit/soft-delete of batches and sensors.

**Architecture:** One `backend/` Python package used by two containers: `api` (FastAPI) and `worker` (MQTT subscriber + APScheduler RUL/recommendation jobs). `engine/` holds pure functions; `services/` holds DB logic; routers stay thin. A separate `simulator/` container publishes telemetry over MQTT.

**Tech Stack:** Python 3.12, uv, FastAPI, Pydantic v2, pydantic-settings, SQLAlchemy 2 + psycopg 3, Alembic, PostgreSQL 16 + TimescaleDB, Mosquitto + paho-mqtt, APScheduler, NumPy, PyYAML, pytest, httpx, ruff, mypy.

**Spec:** `docs/superpowers/specs/2026-10-20-progress-report-backend-design.md` (overrides `CLAUDE.md` where they differ; read both).

## Global Constraints

- All endpoints under `/api/v1`. OpenAPI at `/openapi.json`, docs at `/docs`.
- Lists return `{ items, total, limit, offset }`; query `?limit=50&offset=0` (max limit 200).
- Errors return `{ "error": { "code": str, "message": str, "details": {} } }` with the correct HTTP status.
- CORS allows `http://localhost:3000` only (configurable via `CORS_ORIGINS`).
- All timestamps UTC `timestamptz`; API emits ISO-8601 with `Z`/offset.
- Recommendation types: only `PRIORITY_DISPATCH`, `SALVAGE`. No price, discount, value, or sentiment fields anywhere.
- Deletes are soft (`deleted_at`). Nothing hard-deletes batches, devices, telemetry, or audit rows.
- `AUTH_MODE=demo`: every request is user `demo-supervisor` (role `supervisor`). Mutations still go through `require_role("supervisor")`.
- `backend/app/engine/` imports nothing from `db`, `services`, `api`, or FastAPI.
- Must run offline: `docker compose up`. Tests: `docker compose run --rm api pytest -q`.
- Thresholds and RUL parameters come from `data/products.yaml`, never hardcoded in services.
- Conventional commit messages. **No `Co-Authored-By` or "Generated with" lines.**

## Review Focus

1. **Batch `code` reused.** Creating or editing a batch to a `code` held by another non-deleted batch → 409 `batch_code_taken`; reusing a deleted batch's code succeeds. (Task 6)
2. **Duplicate and out-of-order telemetry.** Same `(device_id, seq)` twice stores one row; readings older than the previous one do not move effective age backwards. (Tasks 3, 4)
3. **PATCH that changes nothing.** Returns 200 with the current record and writes no audit row. (Tasks 5, 6)
4. **Deleted things stay dead.** Telemetry from a deleted device → 404 `device_not_found` (MQTT: dropped); PATCH/DELETE on a deleted record → 404; decision on a recommendation of a deleted batch → 404. (Tasks 4, 5, 6, 8)
5. **New batch with no readings, or readings before `received_at`.** RUL is full (`rul_ratio == 1.0`), pre-receipt readings are ignored, no recommendation is raised. (Tasks 3, 7)

---

## File Structure

```
docker-compose.yml               # db, mqtt, api, worker, simulator
.env.example
infra/mosquitto/mosquitto.conf
infra/db/init-test-db.sql        # creates dynafefo_test database
data/products.yaml               # chicken breast params + thresholds
backend/
  pyproject.toml  Dockerfile  alembic.ini
  alembic/env.py  alembic/versions/0001_initial.py
  app/
    main.py                      # create_app(): routers, CORS, error handlers
    core/config.py               # Settings
    core/errors.py               # ApiError + handlers
    core/deps.py                 # get_db, get_current_user, require_role, page_params
    core/products.py             # load_products(path) -> dict[str, ProductConfig]
    db/base.py  db/session.py  db/models.py  db/seed.py
    schemas/common.py            # Page[T], PageParams
    schemas/{telemetry,zones,devices,batches,recommendations,audit,me}.py
    engine/rul.py  engine/recommend.py
    services/{audit,telemetry,devices,batches,rul_jobs,recommendations}.py
    api/v1/{health,me,telemetry,zones,products,devices,batches,recommendations,audit}.py
    ingest/mqtt_sub.py           # handle_message() + run()
    worker.py                    # MQTT thread + scheduler
  tests/
    conftest.py                  # test DB (alembic upgrade once), truncate per test, client fixture
    test_health.py test_rul.py test_recommend.py test_telemetry.py
    test_devices.py test_batches.py test_rul_jobs.py test_recommendations.py
simulator/Dockerfile  simulator/sim.py
```

---

### Task 1: Compose skeleton, app factory, conventions, `/health`

**Files:**
- Create: `docker-compose.yml`, `.env.example`, `infra/mosquitto/mosquitto.conf`, `infra/db/init-test-db.sql`, `backend/pyproject.toml`, `backend/Dockerfile`, `backend/app/main.py`, `backend/app/core/{config,errors}.py`, `backend/app/db/session.py`, `backend/app/schemas/common.py`, `backend/app/api/v1/health.py`, `backend/tests/conftest.py`
- Test: `backend/tests/test_health.py`

**Interfaces:**
- Produces:
  - `Settings` (pydantic-settings) fields: `database_url: str`, `test_database_url: str`, `mqtt_host: str = "mqtt"`, `mqtt_port: int = 1883`, `cors_origins: list[str] = ["http://localhost:3000"]`, `auth_mode: Literal["demo"] = "demo"`, `sim_mode: bool = False`, `products_path: str = "/data/products.yaml"`; `get_settings() -> Settings` (cached).
  - `ApiError(status: int, code: str, message: str, details: dict | None = None)` exception; `register_error_handlers(app)` also maps `RequestValidationError` → 422 `validation_error` and `HTTPException` → its status in the error shape.
  - `engine` / `SessionLocal` in `db/session.py`; `get_db() -> Iterator[Session]` (lives in `core/deps.py`, created here).
  - `Page[T]` generic model `{items: list[T], total: int, limit: int, offset: int}`; `PageParams` with `limit: int = Query(50, ge=1, le=200)`, `offset: int = Query(0, ge=0)`.
  - `create_app() -> FastAPI`; module-level `app = create_app()`.
  - Fixtures: `client` (httpx/TestClient against `create_app()` with `get_db` overridden to the test DB), `db` (Session).

- [ ] **Step 1: Write compose + infra.** Services: `db` (`timescale/timescaledb:latest-pg16`, named volume, `pg_isready` healthcheck, mounts `infra/db/init-test-db.sql` into `/docker-entrypoint-initdb.d/`), `mqtt` (`eclipse-mosquitto:2`, conf allows anonymous on listener 1883, healthcheck via `mosquitto_sub -t '$SYS/#' -C 1 -W 3`), `api` (build `backend/`, mounts `./data:/data:ro`, command `sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"`, port 8000, depends on healthy db + mqtt, healthcheck on `/api/v1/health`). Leave `worker` and `simulator` for Tasks 4 and 7.
- [ ] **Step 2: Write the failing test**

```python
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

def test_cors_allows_frontend(client):
    r = client.options("/api/v1/health", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"
```

- [ ] **Step 3: Run:** `docker compose run --rm api pytest tests/test_health.py -v` → FAIL (no app).
- [ ] **Step 4: Implement** settings, errors, session, `Page`, `create_app()`, and `GET /health` returning `{status, db, mqtt}` (`db` from `SELECT 1`; `mqtt` from a 1 s TCP connect to `mqtt_host:mqtt_port`, `"ok"`/`"down"`; `status` is `"ok"` when db is ok). `conftest.py`: on session start run `alembic upgrade head` against `test_database_url` (no-op until Task 2 adds a revision); per test, truncate all tables `RESTART IDENTITY CASCADE`.
- [ ] **Step 5: Run** the same command → PASS. Also `docker compose up -d db mqtt api` and `curl localhost:8000/api/v1/health` → `"status":"ok"`.
- [ ] **Step 6: Commit** `chore: add compose skeleton and api health endpoint`

---

### Task 2: Schema, migration, product config, seed, demo user, `/me`, `/products`

**Files:**
- Create: `backend/app/db/{base,models,seed}.py`, `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/versions/0001_initial.py`, `backend/app/core/{deps,products}.py`, `backend/app/schemas/me.py`, `backend/app/api/v1/{me,products}.py`, `data/products.yaml`
- Test: `backend/tests/test_health.py` (extend) → rename to `test_basics.py`

**Interfaces:**
- Consumes: `Settings`, `get_db`, `ApiError`, `Page`.
- Produces:
  - Models exactly per spec "Data model": `User`, `Product`, `Zone`, `Device`, `Batch`, `Telemetry`, `BatchState`, `Recommendation`, `AuditLog`. Enums as Python `StrEnum`: `Role{staff,supervisor}`, `BatchStatus{active,dispatched,salvaged}`, `RecType{PRIORITY_DISPATCH,SALVAGE}`, `RecStatus{pending,approved,rejected}`, `AuditAction{create,update,delete,approve,reject}`, `AuditEntity{batch,device,recommendation}`.
  - Keys: `Product.id: str` (e.g. `"chicken-breast"`), `Zone.id: str` (`"chiller-a"`), `Device.id: str`, `Batch.id: int`, `Recommendation.id: int`, `AuditLog.id: int`, `User.id: int`.
  - `Telemetry`: PK `(device_id, seq, ts)` (a hypertable requires `ts` in every unique index); columns `zone_id, ts, temperature_c, humidity_pct`; index on `(zone_id, ts)`; migration calls `create_hypertable('telemetry', 'ts')`. Dedupe on `(device_id, seq)` is an existence check in Task 4's `ingest`.
  - `BatchState`: PK `batch_id`; `effective_age_h, rul_h, rul_ratio, last_telemetry_ts, predicted_expiry, computed_at`. Separate table `batch_state_history(batch_id, computed_at, rul_h, rul_ratio, effective_age_h)` for `/batches/{id}/rul`.
  - Unique partial index `uq_batch_code_live ON batches(code) WHERE deleted_at IS NULL`.
  - `ProductConfig` (pydantic): `id, name, shelf_life_ref_hours: float, t_ref_c: float, q10: float, rate_floor: float = 0.5, max_dt_hours: float = 1.0, salvage_ratio: float = 0.10, dispatch_ratio: float = 0.50`; `load_products(path: str) -> dict[str, ProductConfig]`.
  - `get_current_user(db) -> User` (returns `demo-supervisor`; raises `ApiError(500, "demo_user_missing", ...)` if unseeded); `require_role(role: Role) -> Callable` dependency raising `ApiError(403, "forbidden", ...)`.
  - `seed(db) -> None`, idempotent, run via `python -m app.db.seed`.

- [ ] **Step 1: Write `data/products.yaml`** with one product: `id: chicken-breast`, `name: Fresh chicken breast`, `shelf_life_ref_hours: 240` (placeholder, comment says so per CLAUDE.md open items), `t_ref_c: 4`, `q10: 2.5`, `rate_floor: 0.5`, `max_dt_hours: 1.0`, `salvage_ratio: 0.10`, `dispatch_ratio: 0.50`.
- [ ] **Step 2: Write the failing tests**

```python
def test_me_is_demo_supervisor(client, seeded):
    r = client.get("/api/v1/me")
    assert r.json() == {"id": 1, "username": "demo-supervisor", "role": "supervisor"}

def test_products_lists_chicken(client, seeded):
    items = client.get("/api/v1/products").json()["items"]
    assert [p["id"] for p in items] == ["chicken-breast"]
    assert "base_price" not in items[0]

def test_seed_is_idempotent(db):
    seed(db); seed(db)
    assert db.query(Batch).count() == 4
    assert db.query(Device).count() == 2
    assert db.query(Zone).count() == 2
```

(`seeded` fixture calls `seed(db)`.)
- [ ] **Step 3: Run** `docker compose run --rm api pytest tests/test_basics.py -v` → FAIL.
- [ ] **Step 4: Implement** models, migration `0001_initial` (enable `timescaledb` extension, all tables, hypertable, partial unique index), `load_products`, deps, `/me`, `/products` (paginated, from DB rows synced from YAML by seed), and `seed`: user `demo-supervisor` (`password_hash` null), product from YAML (upsert), zones `chiller-a` "Chiller A" and `chiller-b` "Chiller B", devices `esp32-chiller-01` named "Chiller A Probe 01" (zone a) and `esp32-chiller-02` named "Chiller B Probe 02" (zone b) with dev keys `dev-key-01` / `dev-key-02` hashed with `hashlib.sha256` (documented in `.env.example` as dev-only), 4 batches `CHK-001..004` (001–002 in `chiller-a`, 003–004 in `chiller-b`) with `received_at` = now minus 12 h, 72 h, 150 h, 210 h, `printed_expiry` = `received_at + 10 days`, quantities 40/30/25/20.
- [ ] **Step 5: Run** → PASS.
- [ ] **Step 6: Commit** `feat: add schema, seed, demo user, products endpoint`

---

### Task 3: RUL engine (pure)

**Files:**
- Create: `backend/app/engine/rul.py`
- Test: `backend/tests/test_rul.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) Reading(ts: datetime, temperature_c: float, humidity_pct: float)`
  - `@dataclass(frozen=True) RulParams(shelf_life_ref_hours: float, t_ref_c: float, q10: float, rate_floor: float = 0.5, max_dt_hours: float = 1.0)`; `RulParams.from_product(cfg: ProductConfig)` is NOT here (engine stays I/O-free) — services build it.
  - `rate(temperature_c: float, p: RulParams) -> float` = `max(p.rate_floor, p.q10 ** ((T - p.t_ref_c) / 10))`
  - `@dataclass(frozen=True) RulResult(effective_age_h: float, rul_h: float, rul_ratio: float, last_ts: datetime | None, predicted_expiry: datetime)`
  - `compute_rul(readings: Sequence[Reading], received_at: datetime, now: datetime, p: RulParams) -> RulResult`

`compute_rul` algorithm (the tests do not fully determine it):
```
pts = sorted({r.ts: r for r in readings if r.ts >= received_at}.values(), key=ts)  # dedupe by ts, drop pre-receipt
age = 0; prev_ts = received_at; prev_rate = 1.0 if not pts else rate(pts[0].temperature_c)
for r in pts:                              # piecewise-constant, left value
    dt = min((r.ts - prev_ts).h, p.max_dt_hours); age += prev_rate * dt
    prev_ts, prev_rate = r.ts, rate(r.temperature_c)
anchor = pts[-1].ts if pts else received_at
age += prev_rate * min((now - anchor).h, p.max_dt_hours) if now > anchor else 0
rul_h = max(0, ref - age); ratio = rul_h / ref; predicted_expiry = anchor + rul_h hours
```
Note: with no readings, `age` grows only by at most `max_dt_hours` (a gap is not assumed constant); `rul_ratio` therefore stays ≥ `1 - max_dt/ref`. The Review Focus test pins `now == received_at`.

- [ ] **Step 1: Write the failing tests**

```python
P = RulParams(shelf_life_ref_hours=240, t_ref_c=4, q10=2.5)
def hourly(t0, temps): return [Reading(t0 + timedelta(hours=i), T, 85) for i, T in enumerate(temps)]

def test_rate_is_one_at_reference(): assert rate(4, P) == 1.0
def test_rate_warmer_matches_q10(): assert rate(14, P) == pytest.approx(2.5)
def test_rate_floor_below_reference(): assert rate(-20, P) == 0.5

def test_constant_reference_ages_linearly():
    r = compute_rul(hourly(T0, [4]*25), T0, T0 + timedelta(hours=24), P)
    assert r.effective_age_h == pytest.approx(24)
    assert r.rul_h == pytest.approx(216)

def test_herron_cyclic_abuse_band():
    # 24 h: alternating 2 h at 4 C and 2 h at 23 C, 15-min readings.
    # Tolerance: extra shelf-life loss vs. 24 h at 4 C must be 1.5..3.0 days
    # (Herron et al. 2022 report ~1.5 d PSY, ~2.25 d APC).
    rs = [Reading(T0 + timedelta(minutes=15*i), 4 if (i // 8) % 2 == 0 else 23, 85) for i in range(97)]
    r = compute_rul(rs, T0, T0 + timedelta(hours=24), P)
    lost_days = (r.effective_age_h - 24) / 24
    assert 1.5 <= lost_days <= 3.0

def test_gap_is_capped():
    rs = [Reading(T0, 30, 85), Reading(T0 + timedelta(hours=10), 30, 85)]
    r = compute_rul(rs, T0, T0 + timedelta(hours=10), P)
    assert r.effective_age_h == pytest.approx(rate(30, P) * 1.0)

def test_duplicates_and_out_of_order_ignored():
    rs = hourly(T0, [4]*5)
    assert compute_rul(rs + rs[::-1], T0, T0 + timedelta(hours=4), P) == compute_rul(rs, T0, T0 + timedelta(hours=4), P)

def test_pre_receipt_readings_ignored_and_new_batch_full():
    rs = [Reading(T0 - timedelta(hours=5), 40, 85)]
    r = compute_rul(rs, T0, T0, P)
    assert r.rul_ratio == 1.0 and r.effective_age_h == 0

def test_rul_never_negative():
    r = compute_rul(hourly(T0, [40]*200), T0, T0 + timedelta(hours=199), P)
    assert r.rul_h == 0 and 0 <= r.rul_ratio <= 1
```

- [ ] **Step 2: Run** `docker compose run --rm api pytest tests/test_rul.py -v` → FAIL.
- [ ] **Step 3: Implement** `rate`, `compute_rul` per the algorithm above.
- [ ] **Step 4: Run** → PASS. Run `mypy --strict app/engine` → clean.
- [ ] **Step 5: Commit** `feat: add Q10 RUL engine with Herron sanity test`

---

### Task 4: Telemetry ingest (HTTP + MQTT), zones, history, simulator, worker container

**Files:**
- Create: `backend/app/schemas/{telemetry,zones}.py`, `backend/app/services/telemetry.py`, `backend/app/api/v1/{telemetry,zones}.py`, `backend/app/ingest/mqtt_sub.py`, `backend/app/worker.py`, `simulator/{Dockerfile,sim.py}`
- Modify: `docker-compose.yml` (add `worker`, `simulator`)
- Test: `backend/tests/test_telemetry.py`

**Interfaces:**
- Consumes: models, `ApiError`, `get_settings`.
- Produces:
  - `TelemetryIn` (pydantic): `device_id: str, zone_id: str, ts: datetime (tz-aware), temperature_c: float = Field(ge=-40, le=60), humidity_pct: float = Field(ge=0, le=100), seq: int = Field(ge=0)`; validator rejects `ts` > now + 5 min unless `sim_mode`.
  - `ingest(db: Session, data: TelemetryIn, device_key: str | None) -> bool` — `True` stored, `False` duplicate. Raises `ApiError(404, "device_not_found")` if device missing or soft-deleted; `ApiError(401, "bad_device_key")` if `device_key` is given and its sha256 ≠ `api_key_hash` (MQTT path passes `None` = trusted internal network); `ApiError(422, "zone_mismatch")` if `zone_id` ≠ device's zone.
  - `handle_message(db: Session, topic: str, payload: bytes) -> None` — parses, calls `ingest(..., None)`, logs and swallows `ApiError`/validation errors.
  - `POST /telemetry` (header `X-Device-Key` required) → 202 `{"stored": bool}`.
  - `GET /zones` → `Page[ZoneOut]`, `ZoneOut{id, name, latest: {ts, temperature_c, humidity_pct, danger: bool} | null}` (`danger` = temperature > 4.0).
  - `GET /telemetry?zone_id=&from=&to=` → `{zone_id, points: [{ts, temperature_c, humidity_pct}]}`, bucketed with `time_bucket` to at most ~500 points (builder picks bucket width from the range).
  - `worker.py`: `main()` starts `ingest.mqtt_sub.run()` in a thread (subscribe `sensors/+/telemetry`) and a `BlockingScheduler` (jobs added in Task 7).

- [ ] **Step 1: Write the failing tests**

```python
def payload(seq=1, **kw): return {"device_id": "esp32-chiller-01", "zone_id": "chiller-a", "ts": NOW_ISO, "temperature_c": 4.2, "humidity_pct": 86.5, "seq": seq} | kw
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
    db.get(Device, "esp32-chiller-01").deleted_at = NOW; db.commit()
    r = client.post("/api/v1/telemetry", json=payload(), headers=H)
    assert r.status_code == 404 and r.json()["error"]["code"] == "device_not_found"

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
    r = client.get("/api/v1/telemetry", params={"zone_id": "chiller-a", "from": iso(NOW - timedelta(hours=1)), "to": iso(NOW)})
    assert r.json()["zone_id"] == "chiller-a" and 1 <= len(r.json()["points"]) <= 500
```

- [ ] **Step 2: Run** `docker compose run --rm api pytest tests/test_telemetry.py -v` → FAIL.
- [ ] **Step 3: Implement** schemas, `ingest`, routers, `handle_message`, `run()` (paho-mqtt client, reconnect loop, new `SessionLocal()` per message), `worker.main()`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Simulator.** `sim.py` reads env `SCENARIO` (`normal|door_open|compressor_failure|ltl_abuse|recover`, default `normal`), `SIM_SPEEDUP` (default 1), `DEVICE_ID`, `ZONE_ID`, `INTERVAL_S` (default 5), `MQTT_HOST`; publishes the telemetry contract to `sensors/{DEVICE_ID}/telemetry`; virtual `ts` advances `INTERVAL_S * SIM_SPEEDUP` seconds per tick from start time; `seq` increments from 0. Scenario temperatures per CLAUDE.md "Simulator". Compose: `worker` (same image, `command: python -m app.worker`, `SIM_MODE=true`), `simulator` (two services or one with `DEVICE_ID=esp32-chiller-01`, `ZONE_ID=chiller-a`; builder's choice), api also gets `SIM_MODE=true`.
- [ ] **Step 6: Manual check:** `docker compose up -d`, wait 30 s, `curl localhost:8000/api/v1/zones` → `chiller-a.latest` non-null.
- [ ] **Step 7: Commit** `feat: add telemetry ingest, zones, simulator, worker`

---

### Task 5: Audit service, device CRUD, `/audit-log`

**Files:**
- Create: `backend/app/services/{audit,devices}.py`, `backend/app/schemas/{devices,audit}.py`, `backend/app/api/v1/{devices,audit}.py`
- Test: `backend/tests/test_devices.py`

**Interfaces:**
- Consumes: `get_current_user`, `require_role`, `Page`, `PageParams`, models.
- Produces:
  - `snapshot(obj, fields: Iterable[str]) -> dict[str, Any]` (JSON-safe: datetimes → ISO strings).
  - `changed(before: dict, after: dict) -> tuple[dict, dict]` — only keys whose values differ.
  - `record(db, user: User, action: AuditAction, entity: AuditEntity, entity_id: str, before: dict | None, after: dict | None) -> AuditLog` (adds, does not commit).
  - `get_live(db, model, id, not_found_code: str) -> Model` in `core/deps.py` — raises `ApiError(404, not_found_code)` if missing or `deleted_at` is set. Tasks 6 and 8 reuse it.
  - Device endpoints per spec. `DeviceCreate{id: str (pattern ^[a-z0-9-]{3,64}$), name, zone_id}`; `DeviceUpdate{name?: str, zone_id?: str}` (`extra="forbid"`, so `id` in body → 422); `DeviceOut{id, name, zone_id, created_at, deleted_at}`; `DeviceCreated = DeviceOut + api_key: str` (`secrets.token_urlsafe(24)`, shown once). Duplicate id among any devices → 409 `device_id_taken`. Unknown `zone_id` → 422 `unknown_zone`.
  - `GET /audit-log?entity=&action=&entity_id=` → `Page[AuditOut]`, `AuditOut{id, ts, user: str (username), action, entity, entity_id, before, after}`, ordered `ts DESC, id DESC`.

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run** `docker compose run --rm api pytest tests/test_devices.py -v` → FAIL.
- [ ] **Step 3: Implement** audit helpers, `get_live`, device service + router (mutations depend on `require_role(Role.supervisor)`), audit router. Delete audit row: `before` = full snapshot, `after` = null.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: add audited device CRUD and audit log endpoint`

---

### Task 6: Batch CRUD

**Files:**
- Create: `backend/app/schemas/batches.py`, `backend/app/services/batches.py`, `backend/app/api/v1/batches.py`
- Test: `backend/tests/test_batches.py`

**Interfaces:**
- Consumes: `get_live`, `snapshot`, `changed`, `record`, `require_role`, `Page`.
- Produces:
  - `BatchCreate{code: str (1..32), product_id: str, zone_id: str, received_at: datetime, printed_expiry: datetime, quantity: int (ge=0), notes: str | None = None}`; `BatchUpdate` = all optional + `status: BatchStatus | None` (`extra="forbid"`).
  - `BatchOut{id, code, product_id, product_name, zone_id, received_at, printed_expiry, predicted_expiry: datetime | None, quantity, notes, status, rul_h: float | None, rul_ratio: float | None, effective_age_h: float | None, created_at, updated_at, deleted_at}` (state fields null until Task 7 computes them).
  - `GET /batches?include_deleted=&status=` sorted by `rul_h ASC NULLS LAST, id`.
  - Errors: 409 `batch_code_taken` (catch the partial-unique-index `IntegrityError`), 422 `unknown_product` / `unknown_zone`, 422 `expiry_before_receipt` when `printed_expiry <= received_at`, 404 `batch_not_found`.
  - `mark_for_recompute(batch)`: sets `batch.updated_at`; Task 7's job recomputes every live batch each run, so no flag column is needed.

- [ ] **Step 1: Write the failing tests**

```python
NEW = {"code": "CHK-100", "product_id": "chicken-breast", "zone_id": "chiller-a", "received_at": "2026-10-20T00:00:00Z", "printed_expiry": "2026-10-30T00:00:00Z", "quantity": 12}

def test_create_and_get(client, seeded):
    b = client.post("/api/v1/batches", json=NEW).json()
    assert client.get(f"/api/v1/batches/{b['id']}").json()["code"] == "CHK-100"
    assert "unit_price" not in b

def test_code_taken_409_but_reusable_after_delete(client, seeded):
    b = client.post("/api/v1/batches", json=NEW).json()
    r = client.post("/api/v1/batches", json=NEW)
    assert r.status_code == 409 and r.json()["error"]["code"] == "batch_code_taken"
    client.delete(f"/api/v1/batches/{b['id']}")
    assert client.post("/api/v1/batches", json=NEW).status_code == 201

def test_edit_to_taken_code_409(client, seeded):
    b = client.post("/api/v1/batches", json=NEW).json()
    assert client.patch(f"/api/v1/batches/{b['id']}", json={"code": "CHK-001"}).status_code == 409

def test_patch_audits_before_after(client, seeded):
    client.patch("/api/v1/batches/1", json={"quantity": 5, "notes": "dented box"})
    log = client.get("/api/v1/audit-log?entity=batch&action=update").json()["items"][0]
    assert log["after"] == {"quantity": 5, "notes": "dented box"} and set(log["before"]) == {"quantity", "notes"}

def test_noop_patch_no_audit(client, seeded):
    q = client.get("/api/v1/batches/1").json()["quantity"]
    client.patch("/api/v1/batches/1", json={"quantity": q})
    assert client.get("/api/v1/audit-log?entity=batch").json()["total"] == 0

def test_expiry_before_receipt_422(client, seeded):
    r = client.post("/api/v1/batches", json=NEW | {"printed_expiry": "2026-10-19T00:00:00Z"})
    assert r.json()["error"]["code"] == "expiry_before_receipt"

def test_deleted_batch_hidden_and_404(client, seeded):
    client.delete("/api/v1/batches/1")
    assert 1 not in [b["id"] for b in client.get("/api/v1/batches").json()["items"]]
    assert client.get("/api/v1/batches/1?include_deleted=true").status_code == 200
    assert client.patch("/api/v1/batches/1", json={"quantity": 1}).status_code == 404
```

- [ ] **Step 2: Run** `docker compose run --rm api pytest tests/test_batches.py -v` → FAIL.
- [ ] **Step 3: Implement** service + router. `GET /batches/{id}` returns deleted batches only with `?include_deleted=true`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: add audited batch CRUD with soft delete`

---

### Task 7: RUL recompute job, batch state, `/batches/{id}/rul`

**Files:**
- Create: `backend/app/services/rul_jobs.py`
- Modify: `backend/app/worker.py` (schedule job), `backend/app/api/v1/batches.py` (add `/rul`), `backend/app/services/batches.py` (join state into `BatchOut`)
- Test: `backend/tests/test_rul_jobs.py`

**Interfaces:**
- Consumes: `compute_rul`, `RulParams`, `Reading`, `load_products`, models.
- Produces:
  - `params_for(cfg: ProductConfig) -> RulParams`.
  - `recompute_batch(db, batch: Batch, cfg: ProductConfig, now: datetime) -> BatchState` — loads zone telemetry with `ts >= received_at` ordered by `ts`, runs `compute_rul`, upserts `BatchState`, appends a `batch_state_history` row.
  - `recompute_all(db, products: dict[str, ProductConfig], now: datetime) -> list[BatchState]` — every batch with `deleted_at IS NULL` and `status == active`; then calls `refresh_recommendations` from Task 8 (Task 7 leaves that call out; Task 8 adds it).
  - `now` for the job = latest telemetry `ts` in the batch's zone if `sim_mode`, else wall clock (so `SIM_SPEEDUP` works).
  - Worker job: every 30 s wall time, `recompute_all`.
  - `GET /batches/{id}/rul` → `{batch_id, current: {rul_h, rul_ratio, effective_age_h, predicted_expiry}, history: [{computed_at, rul_h, rul_ratio}]}`.

- [ ] **Step 1: Write the failing tests**

```python
def add_readings(db, zone, start, temps, device="esp32-chiller-01"):
    for i, T in enumerate(temps):
        db.add(Telemetry(device_id=device, zone_id=zone, ts=start + timedelta(hours=i), seq=i, temperature_c=T, humidity_pct=85))
    db.commit()

def test_recompute_sets_state_and_predicted_expiry(db, seeded, products):
    b = db.query(Batch).filter_by(code="CHK-001").one()
    add_readings(db, "chiller-a", b.received_at, [4]*13)
    s = recompute_batch(db, b, products["chicken-breast"], b.received_at + timedelta(hours=12))
    assert s.rul_h == pytest.approx(228)
    assert s.predicted_expiry == b.received_at + timedelta(hours=12 + 228)

def test_deleted_batches_skipped(db, seeded, products):
    db.query(Batch).filter_by(code="CHK-002").one().deleted_at = NOW; db.commit()
    codes = {db.get(Batch, s.batch_id).code for s in recompute_all(db, products, NOW)}
    assert "CHK-002" not in codes

def test_no_readings_full_rul(db, seeded, products):
    b = db.query(Batch).filter_by(code="CHK-001").one()
    assert recompute_batch(db, b, products["chicken-breast"], b.received_at).rul_ratio == 1.0

def test_batches_list_sorted_by_rul(client, db, seeded, products):
    recompute_all(db, products, NOW)
    ruls = [b["rul_h"] for b in client.get("/api/v1/batches").json()["items"]]
    assert ruls == sorted(ruls)
```

(`products` fixture = `load_products` on the repo's `data/products.yaml`.)
- [ ] **Step 2: Run** `docker compose run --rm api pytest tests/test_rul_jobs.py -v` → FAIL.
- [ ] **Step 3: Implement** `rul_jobs.py`, worker scheduling, `/rul` endpoint, state join in `BatchOut`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: add RUL recompute job and batch state`

---

### Task 8: Recommendation engine, refresh, list, decision

**Files:**
- Create: `backend/app/engine/recommend.py`, `backend/app/services/recommendations.py`, `backend/app/schemas/recommendations.py`, `backend/app/api/v1/recommendations.py`
- Modify: `backend/app/services/rul_jobs.py` (call refresh after each recompute)
- Test: `backend/tests/test_recommend.py`, `backend/tests/test_recommendations.py`

**Interfaces:**
- Consumes: `BatchState`, `ProductConfig`, `get_live`, `record`, `require_role`.
- Produces:
  - `@dataclass(frozen=True) Thresholds(salvage_ratio: float = 0.10, dispatch_ratio: float = 0.50)`
  - `decide(rul_h: float, rul_ratio: float, th: Thresholds) -> Literal["SALVAGE", "PRIORITY_DISPATCH"] | None` (`SALVAGE` if `rul_h <= 0 or rul_ratio < salvage_ratio`; `PRIORITY_DISPATCH` if `rul_ratio < dispatch_ratio`; else `None`). Engine uses plain string literals `"SALVAGE"`/`"PRIORITY_DISPATCH"` to stay free of `db` imports; services map to `RecType`.
  - `refresh_for_batch(db, batch: Batch, state: BatchState, cfg: ProductConfig) -> Recommendation | None` — if `decide` returns a type: update the batch's existing `pending` rec of that type in place (`rationale`, `created_at` unchanged) or create one; a `pending` rec of the *other* type for the same batch is left alone (the supervisor sees both history and the escalation). `rationale` JSON: `{"rul_h", "rul_ratio", "threshold": {"name", "value"}, "predicted_expiry", "printed_expiry"}`.
  - `RecommendationOut{id, batch_id, batch_code, type, status, rationale, created_at, decided_by: str | None, decided_at, decision_note}`.
  - `GET /recommendations?status=` excludes recs whose batch is soft-deleted.
  - `POST /recommendations/{id}/decision` body `{decision: "approve" | "reject", note: str | None}` → 200 `RecommendationOut`; 409 `already_decided` if not `pending`; 404 `recommendation_not_found` if missing or its batch is deleted. Writes audit `approve`/`reject`, entity `recommendation`. Does **not** change the batch's `status`.

- [ ] **Step 1: Write the failing tests**

```python
TH = Thresholds()
@pytest.mark.parametrize("rul_h,ratio,expected", [(0, 0.0, "SALVAGE"), (10, 0.05, "SALVAGE"), (50, 0.2, "PRIORITY_DISPATCH"), (200, 0.8, None), (120, 0.5, None)])
def test_decide(rul_h, ratio, expected): assert decide(rul_h, ratio, TH) == expected
```
```python
def test_refresh_does_not_duplicate(db, products, aged_batch_with_rec):
    _, batch_id = aged_batch_with_rec
    recompute_all(db, products, AGED_NOW)  # second run, same state
    assert db.query(Recommendation).filter_by(batch_id=batch_id, status="pending").count() == 1

def test_approve_audits_and_keeps_batch_status(client, db, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec
    r = client.post(f"/api/v1/recommendations/{rec_id}/decision", json={"decision": "approve", "note": "ok"})
    assert r.json()["status"] == "approved" and r.json()["decided_by"] == "demo-supervisor"
    assert client.get(f"/api/v1/batches/{batch_id}").json()["status"] == "active"
    assert client.get("/api/v1/audit-log?entity=recommendation").json()["items"][0]["action"] == "approve"

def test_second_decision_409(client, aged_batch_with_rec):
    rec_id, _ = aged_batch_with_rec
    client.post(f"/api/v1/recommendations/{rec_id}/decision", json={"decision": "reject"})
    assert client.post(f"/api/v1/recommendations/{rec_id}/decision", json={"decision": "approve"}).status_code == 409

def test_deleted_batch_rec_hidden_and_404(client, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec
    client.delete(f"/api/v1/batches/{batch_id}")
    assert rec_id not in [r["id"] for r in client.get("/api/v1/recommendations").json()["items"]]
    assert client.post(f"/api/v1/recommendations/{rec_id}/decision", json={"decision": "approve"}).status_code == 404
```

(`aged_batch_with_rec` fixture: seed, add hourly 4 °C readings in `chiller-a` from `CHK-004.received_at` to `AGED_NOW` = `received_at + 210 h` (move `CHK-004` to `chiller-a` first if seeded elsewhere), `recompute_all(db, products, AGED_NOW)`, return `(pending rec id, batch id)`. `CHK-004` at 210 h of 240 h is ratio 0.125 → `PRIORITY_DISPATCH`.)
- [ ] **Step 2: Run** `docker compose run --rm api pytest tests/test_recommend.py tests/test_recommendations.py -v` → FAIL.
- [ ] **Step 3: Implement** engine, service, router, and the `refresh_for_batch` call inside `recompute_all`.
- [ ] **Step 4: Run** full suite `docker compose run --rm api pytest -q` → all PASS; `docker compose run --rm api ruff check .` → clean.
- [ ] **Step 5: End-to-end check:** `docker compose down -v && docker compose up -d --build`, `docker compose run --rm api python -m app.db.seed`, run `SCENARIO=ltl_abuse SIM_SPEEDUP=60 docker compose up -d simulator`, wait ~2 min, then `curl localhost:8000/api/v1/batches` shows RUL falling and `curl localhost:8000/api/v1/recommendations` lists at least one `pending` item. `curl localhost:8000/openapi.json` lists every path in the spec's API table.
- [ ] **Step 6: Commit** `feat: add dispatch and salvage recommendations with decision flow`
