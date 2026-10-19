# CLAUDE.md

Guidance for Claude Code when working on this repository.

## Project

**Dynamic Perishable Inventory Management System with Sensor-Based Shelf-Life Tracking and NLP Sentiment Decision Support** (JAM SOFT capstone).

A decision-support system, not an inventory ledger. It ingests temperature and humidity telemetry, computes dynamic Remaining Useful Life (RUL) per batch, analyzes customer feedback sentiment, and recommends priority dispatch, markdowns, or salvage. A human Supervisor approves or rejects every recommendation (human-in-the-loop).

Research basis: static expiry dates (FEFO) miss cold-chain thermal abuse. We replace them with sensor-driven shelf-life estimates and tie markdown depth to remaining life (Herron et al., 2022; Buisman et al., 2019; Haijema et al., 2026; Riesenegger & Hubner, 2026).

### Team split
- Backend, data, infra: full-stack engineer (this repo's `backend/`, `simulator/`, `infra/`).
- Frontend (Next.js dashboard): two groupmates, in `frontend/`. They code against the OpenAPI contract, so **never break the API contract silently** (see "API contract rules").

## Scope decisions (locked)

| Topic | Decision |
|---|---|
| Hardware | Sensor **simulator first**, same payload schema as the ESP32 will send later |
| Primary product | Fresh **chicken breast** (empirical thermal-abuse data in Herron et al., 2022) |
| Secondary product | Chilled fish, optional, config-only (no code changes to add it) |
| Sensed parameters | Temperature and humidity only (no gas sensors in scope) |
| NLP data | Labeled/synthetic mock retail reviews. **No web scraping** |
| Live updates | SSE stream for events, plus REST for everything else (3-5 s polling is an acceptable fallback) |
| Deployment | Laptop, `docker compose up`. Must work **fully offline** (venue Wi-Fi is not trusted) |
| Roles | `staff` (read-only monitoring), `supervisor` (monitoring plus approve/reject) |
| Frontend | React / Next.js consuming REST + SSE |

### Explicit non-goals (from Chapter 1 scope)
- No automated inventory record-keeping: no stock movements, purchase orders, POS, or accounting. The batch registry is the **minimum** data needed to compute RUL and recommendations.
- No gas/VOC sensors, no computer vision.
- No web scraping, no external paid APIs at runtime.
- No auto-applied price changes: recommendations stay `pending` until a supervisor decides.

## Tech stack

| Layer | Choice |
|---|---|
| Language | Python 3.12 |
| Package manager | `uv` (fallback: pip + `requirements.txt`) |
| API | FastAPI + Pydantic v2 |
| Settings | `pydantic-settings`, `.env` (commit `.env.example` only) |
| DB | PostgreSQL 16 with TimescaleDB (`timescale/timescaledb:latest-pg16`) |
| ORM / migrations | SQLAlchemy 2.x + Alembic (psycopg 3 driver) |
| Ingestion | Mosquitto (MQTT) -> Python subscriber (`paho-mqtt`); HTTP `POST /telemetry` as fallback |
| Scheduler | APScheduler inside the `worker` service |
| RUL engine | NumPy / pandas, Q10 temperature-acceleration model |
| NLP | Hugging Face Transformers, multilingual XLM-R sentiment model, lexicon fallback |
| Live push | SSE via `sse-starlette` |
| Auth | JWT (access token), `argon2` password hashing, role claim |
| Tests / lint | `pytest`, `pytest-asyncio`, `httpx`, `ruff`, `mypy` (strict on `engine/`) |
| Containers | Docker Compose |
| Frontend (not ours) | Next.js, TypeScript. Types generated from our OpenAPI via `openapi-typescript` |

## Repository layout

```
.
├── CLAUDE.md
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── alembic/                  # migrations
│   └── app/
│       ├── main.py               # FastAPI app factory, router wiring
│       ├── core/                 # config, security (JWT), logging, deps
│       ├── db/                   # engine, session, models, seed
│       ├── schemas/              # Pydantic request/response models
│       ├── api/v1/               # routers: auth, telemetry, batches, recommendations,
│       │                         #   feedback, sentiment, stream, health
│       ├── services/             # business logic (no FastAPI imports here)
│       ├── engine/
│       │   ├── rul.py            # pure functions, fully unit tested
│       │   ├── recommend.py      # rule engine -> recommendations
│       │   └── sentiment.py      # model wrapper + lexicon fallback
│       ├── ingest/mqtt_sub.py    # MQTT subscriber entrypoint
│       ├── worker.py             # APScheduler jobs entrypoint
│       └── events.py             # in-process pub/sub feeding SSE
├── backend/tests/
├── simulator/                    # ESP32-compatible sensor simulator
│   ├── Dockerfile
│   └── sim.py
├── data/
│   ├── products.yaml             # product + RUL + markdown config
│   ├── reviews_seed.csv          # labeled/synthetic reviews
│   └── generate_reviews.py
├── scripts/
│   └── evaluate.py               # static-date FEFO vs dynamic comparison (H0/HA evidence)
├── infra/mosquitto/mosquitto.conf
└── frontend/                     # owned by groupmates
```

Keep `engine/` free of I/O (no DB, no HTTP). Services call the engine; routers call services.

## Docker Compose services

| Service | Purpose |
|---|---|
| `db` | TimescaleDB/Postgres, named volume, healthcheck |
| `mqtt` | Mosquitto, anonymous allowed on the internal network only |
| `api` | FastAPI (`uvicorn app.main:app`), runs `alembic upgrade head` on start |
| `worker` | MQTT subscriber + APScheduler (RUL recompute, recommendation refresh) |
| `simulator` | Publishes fake sensor data, scenario chosen by env var |
| `frontend` | Optional profile (`--profile ui`), so backend can run alone |

Rules: every service has a healthcheck or `depends_on: condition: service_healthy`; no host-installed dependencies; ports exposed: API `8000`, frontend `3000`, MQTT `1883` (for debugging only).

NLP model weights are large. Bake them into the image at build time (or mount a `models/` volume) so the demo never downloads anything. Load the model lazily and fall back to the lexicon scorer if it is unavailable.

## Data model (minimum viable)

- `users`: id, username, password_hash, role (`staff` | `supervisor`)
- `products`: id, name, shelf_life_ref_hours, t_ref_c, q10, humidity config, base_price (loaded from `data/products.yaml`)
- `zones`: id, name (a cold room / chiller / shelf group)
- `devices`: id, zone_id, api_key_hash
- `batches`: id, product_id, zone_id, received_at, printed_expiry (static label date), quantity, unit_price, status (`active` | `dispatched` | `salvaged`)
- `telemetry` (Timescale hypertable on `ts`): device_id, zone_id, ts, temperature_c, humidity_pct, seq
- `batch_state`: batch_id, effective_age_h, rul_h, rul_ratio, last_telemetry_ts, computed_at
- `recommendations`: id, batch_id, type (`PRIORITY_DISPATCH` | `MARKDOWN` | `SALVAGE`), discount_pct, rationale (JSON), sentiment_factor, status (`pending` | `approved` | `rejected`), created_at, decided_by, decided_at, decision_note
- `feedback`: id, product_id, text, source (`seed` | `manual`), created_at, label, score, aspects (JSON)
- `audit_log`: id, user_id, action, entity, entity_id, payload, ts

All timestamps are **UTC** (`timestamptz`). Never store local time.

## Telemetry contract (same for simulator and real ESP32)

MQTT topic: `sensors/{device_id}/telemetry`. Same JSON body is accepted by `POST /api/v1/telemetry` (header `X-Device-Key`).

```json
{
  "device_id": "esp32-chiller-01",
  "zone_id": "chiller-a",
  "ts": "2026-10-19T13:45:00Z",
  "temperature_c": 4.2,
  "humidity_pct": 86.5,
  "seq": 1042
}
```

Validation: temperature in [-40, 60], humidity in [0, 100], `ts` not more than 5 minutes in the future (except when `SIM_MODE=true`). Dedupe on `(device_id, seq)`. The RUL engine must use the **payload `ts`**, not wall-clock time, so simulator time acceleration works.

## RUL engine (`engine/rul.py`)

Model: Q10 temperature-acceleration of ageing, referenced to the chilled storage temperature.

```
rate(T)           = q10 ** ((T - t_ref_c) / 10)         # 1.0 at t_ref, >1 when warmer
effective_age_h  += rate(T) * dt_hours                  # integrate over telemetry intervals
rul_h             = max(0, shelf_life_ref_hours - effective_age_h)
rul_ratio         = rul_h / shelf_life_ref_hours
```

- Use trapezoidal or piecewise-constant integration over consecutive readings. Cap `dt_hours` per interval (default 1 h) to avoid a gap in data being treated as constant temperature.
- Below `t_ref_c`, clamp the rate to a floor (default 0.5) so freezing-adjacent readings do not extend life unrealistically.
- Humidity is a secondary multiplier from config (default `1.0`; only apply it if the product config defines a band). Keep it optional and documented. Do not invent a humidity model without data.
- Back-fill: batch age starts at `received_at`. Telemetry before receipt is ignored.

### Calibration (placeholders, to be tuned and justified in the paper)
- Chicken breast: `t_ref_c = 4`, `q10 = 2.5`, `shelf_life_ref_hours` set in `data/products.yaml` (**placeholder, confirm against the chosen source**).
- Sanity check target from Herron et al. (2022): a 24 h cyclic abuse (2 h at 4 C, 2 h at about 23 C) reduced shelf life by about 2.25 days (APC) and 1.5 days (PSY). With `q10 = 2.5`, the model loses about 2.3 days, in the right range. Encode this as a unit test with a tolerance band, and record the exact tolerance in the test.
- Danger-zone flag: any reading above 4 C is flagged, matching the paper's definition. Risk-of-loss threshold: RUL below 4 days (Herron et al.).

### Required unit tests
- Constant 4 C gives `rate = 1`, linear ageing.
- Constant warmer temperature ages faster by exactly `q10 ** ((T - 4)/10)`.
- Herron cyclic-abuse scenario lands in the tolerance band above.
- Data gap handling (capped `dt`).
- Out-of-order and duplicate telemetry are ignored or deduped.
- RUL never negative; `rul_ratio` in [0, 1].

## Recommendation engine (`engine/recommend.py`)

Evaluated by the worker after every RUL recompute. Thresholds live in `data/products.yaml` (never hardcode).

| Condition (on `rul_ratio` unless noted) | Recommendation |
|---|---|
| `rul_h <= 0` | `SALVAGE` |
| below `salvage_ratio` (default 0.10) | `SALVAGE` or deepest markdown, per config |
| below `markdown_ratio` tiers (default 0.25 / 0.15) | `MARKDOWN` with tiered `discount_pct` (default 10 / 20 / 30) |
| below `dispatch_ratio` (default 0.50) | `PRIORITY_DISPATCH` (sort batches by dynamic RUL ascending, i.e., dynamic FEFO) |
| otherwise | no action |

Sentiment adjustment (bounded, explainable): the product's recent aggregate sentiment shifts markdown depth by at most one tier, and only for freshness-related negative sentiment. Always store the base decision, the adjustment, and the reason in `rationale` JSON so the supervisor sees why.

Rules:
- One open (`pending`) recommendation per batch and type. Update it in place when conditions change; do not spam duplicates.
- Never apply a recommendation automatically. Only `POST /recommendations/{id}/decision` by a `supervisor` changes status, and it writes an `audit_log` row.
- Recommendation text shown to users comes from structured fields, not free-form LLM text.

## NLP sentiment (`engine/sentiment.py`)

- Input: review text (English, Filipino, or Taglish).
- Model: multilingual XLM-R sentiment model (for example the cardiffnlp XLM-T sentiment checkpoint). Output `label` (neg/neu/pos) and `score`.
- Aspect tagging (keyword-based is fine): `freshness`, `smell`, `price`, `packaging`.
- Fallback: simple lexicon scorer if the model fails to load, and mark `model: "lexicon"` in the response so the dashboard can show it.
- Data: `data/generate_reviews.py` generates a seeded, labeled mock dataset (`reviews_seed.csv`) including Taglish samples. The seed is fixed so demos are reproducible. State clearly in docs that the data is synthetic.
- Aggregation: `GET /sentiment/summary?product_id=` returns counts, mean score, and top aspects over a configurable window.

## Simulator (`simulator/sim.py`)

Publishes the telemetry contract above over MQTT. Config via env: `SCENARIO`, `SIM_SPEEDUP`, `DEVICE_ID`, `ZONE_ID`, `INTERVAL_S`.

Scenarios:
- `normal`: about 3-4 C with small noise
- `door_open`: short spikes to 10-15 C
- `compressor_failure`: slow climb to ambient over hours
- `ltl_abuse`: Herron et al. pattern, alternating 2 h at 4 C and 2 h at about 23 C
- `recover`: abuse then return to 4 C

`SIM_SPEEDUP` scales **virtual time** (payload `ts` advances faster than wall-clock) so decay is visible in a few minutes during a demo. Document the speedup in the dashboard header whenever it is active.

## API contract rules

- Prefix `/api/v1`. OpenAPI served at `/docs` and `/openapi.json`.
- Frontend generates TS types from `/openapi.json`. Any breaking change (renamed field, removed endpoint, changed enum) must be announced to the frontend teammates and noted in `docs/CHANGELOG-API.md`.
- Errors: `{ "error": { "code": "string", "message": "string", "details": {} } }` with correct HTTP status.
- Lists are paginated: `?limit=50&offset=0`, response `{ items, total, limit, offset }`.
- CORS: allow `http://localhost:3000` only (configurable).

### Endpoints

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/auth/login` | public | username/password -> JWT |
| POST | `/auth/stream-token` | any | short-lived (60 s) token for SSE |
| GET | `/me` | any | current user and role |
| POST | `/telemetry` | device key | HTTP fallback ingest |
| GET | `/zones` | any | zones with latest reading |
| GET | `/telemetry?zone_id=&from=&to=` | any | history for charts (downsampled) |
| GET | `/products` | any | product config summary |
| GET, POST | `/batches` | GET any, POST supervisor | minimal batch registry |
| GET | `/batches/{id}` | any | batch plus current state |
| GET | `/batches/{id}/rul` | any | RUL, effective age, history series |
| GET | `/recommendations?status=` | any | list recommendations |
| POST | `/recommendations/{id}/decision` | supervisor | body `{decision: approve|reject, note}` |
| POST | `/feedback` | any | submit text, returns sentiment |
| GET | `/sentiment/summary?product_id=` | any | aggregates |
| GET | `/stream?token=` | any | SSE event stream |
| GET | `/health` | public | liveness and DB/MQTT status |

`staff` can call every GET. Only `supervisor` can call mutating batch and decision endpoints. Enforce roles in dependencies (`require_role("supervisor")`), not in the frontend alone.

### SSE events (`GET /stream`)

`EventSource` cannot send an `Authorization` header, so the client first calls `POST /auth/stream-token`, then connects to `/stream?token=...`. Send a `: keepalive` comment every 15 s. Event names:

- `telemetry`: `{zone_id, ts, temperature_c, humidity_pct}`
- `rul_update`: `{batch_id, rul_h, rul_ratio, effective_age_h}`
- `recommendation_created` / `recommendation_updated` / `recommendation_decided`
- `alert`: `{zone_id, kind: "danger_zone" | "sensor_offline", ts}`

Also keep plain REST equivalents working, so the frontend can fall back to 3-5 s polling.

## Conventions

- Type hints everywhere; `ruff` and `mypy` clean before commit. Format with `ruff format`.
- Business logic in `services/` and `engine/`, not in routers. Routers stay thin.
- Config via environment only. Never commit secrets. Seed users come from env or `db/seed.py` with documented dev passwords for demo.
- Seed command creates: 1 supervisor, 1 staff, the chicken product, 2 zones, 3-5 sample batches.
- Migrations: every schema change gets an Alembic revision. No manual DB edits.
- Logging: structured, one line per event; do not log credentials or tokens.
- Commits: conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
- Tests must run in Docker (`docker compose run --rm api pytest`) and pass offline.
- Do not add dependencies without a reason noted in the PR/commit message.

## Common commands

```bash
docker compose up --build                  # full stack
docker compose --profile ui up --build     # include frontend
docker compose run --rm api alembic upgrade head
docker compose run --rm api python -m app.db.seed
docker compose run --rm api pytest -q
docker compose run --rm api ruff check . && ruff format --check .
SCENARIO=ltl_abuse SIM_SPEEDUP=60 docker compose up simulator
python scripts/evaluate.py --runs 50       # static FEFO vs dynamic comparison
```

## Evaluation (supports the hypothesis)

The paper claims improved freshness visibility and prevented spoilage losses. With no live deployment, we show this by simulation. `scripts/evaluate.py` runs N seeded simulated scenarios and compares:

- **Baseline:** static printed-date FEFO, no markdown.
- **System:** dynamic RUL-based priority dispatch plus tiered markdowns.

Metrics: units spoiled before sale, units sold past true safe life (food-safety risk), revenue recovered, markdown depth used. Output a CSV and a summary table. Use fixed random seeds so results are reproducible for the defense. Be explicit in docs that results come from simulation and calibrated parameters, not field trials.

## Build order (first session)

1. Compose skeleton: `db`, `mqtt`, `api` with `/health`.
2. Models, Alembic, seed script.
3. `engine/rul.py` plus unit tests (including the Herron sanity check).
4. Simulator publishing to MQTT, plus subscriber writing telemetry.
5. Worker: RUL recompute job and `batch_state`.
6. `engine/recommend.py` plus recommendation endpoints and decision flow with audit log.
7. Auth (JWT, roles), SSE stream.
8. Publish `/openapi.json` and tell the frontend teammates. This should happen as early as step 2-3 using stub responses if needed.
9. Sentiment service, seed dataset, summary endpoint.
10. `scripts/evaluate.py`.

## Open items (confirm before treating as final)

- Chicken `shelf_life_ref_hours`, `q10`, and humidity handling are placeholders. Cite a source or calibrate against Herron et al. before the defense.
- Chapter 1 says "multi-sensor" but scope limits sensing to temperature and humidity. Consider "multi-parameter" wording in the paper.
- Final discount tier percentages and thresholds are defaults, to be agreed with the team and the adviser.
