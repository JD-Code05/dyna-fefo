# Progress-Report Backend Slice: Design

Date: 2026-10-20
Status: draft, awaiting approval

## Intent

The group has a progress report coming up and wants real, working pieces of both the frontend and the backend to show. The frontend is a Figma Make dashboard ("FreshOps", React + Vite + Tailwind v4) that two groupmates will port to Next.js. This document covers the backend slice that dashboard connects to.

The backend follows `CLAUDE.md` except where this document says otherwise. Where they disagree, this document wins for the progress report, and `CLAUDE.md` gets updated afterwards.

## Scope changes from CLAUDE.md (group decisions)

| Change | Decision |
|---|---|
| Markdowns and discount tiers | **Out.** Moved to a separate future project. Recommendation types are only `PRIORITY_DISPATCH` and `SALVAGE`. |
| NLP sentiment | **Out** of this project (`/feedback`, `/sentiment/summary`, `engine/sentiment.py`, review data). |
| Dollar values | **Out.** No `unit_price`, no inventory value, no revenue. |
| Stock movement | **Out.** Removed from the frontend too. |
| Edit/delete batches and sensors | **In.** Needed for testing, and must persist in the backend. |
| Change history | **In.** The group wants to see what was edited and deleted. |
| Login | **Deferred.** The dashboard runs as an already logged-in user. |

## Goals

1. `docker compose up` starts everything offline: `db`, `mqtt`, `api`, `worker`, `simulator`.
2. The simulator streams temperature and humidity. Zones show their latest reading.
3. Batches show live RUL and a **predicted expiry** next to the printed expiry date.
4. `PRIORITY_DISPATCH` and `SALVAGE` recommendations appear and can be approved or rejected.
5. Batches and sensors can be created, edited, and deleted through the API.
6. Every create, edit, delete, approve, and reject is recorded and listed in a change history.
7. `/openapi.json` is live so the frontend can generate types.

## Non-goals (this slice)

- Login, JWT, stream tokens, password hashing
- SSE stream (the frontend polls every 3–5 s)
- `scripts/evaluate.py`
- Chilled fish or any second product
- Updating `CLAUDE.md` and `README.md` (done after the progress report)

## Anti-goals

- Hard-deleting rows. A delete must never lose telemetry, RUL history, or audit history.
- Changing a recommendation's status automatically. Only an explicit decision call does that.
- Reintroducing price or value fields "for later."

## Auth for now: demo user

- Setting `AUTH_MODE=demo` (the only mode for now). A seed creates one user, `demo-supervisor`, with role `supervisor`.
- A dependency `get_current_user()` returns that user for every request. `require_role("supervisor")` still runs on mutating endpoints, so real JWT login later only replaces `get_current_user()`.
- `GET /api/v1/me` returns `{ id, username, role }`.
- Device ingest (`POST /telemetry`) still checks `X-Device-Key`.

## Data model

As in `CLAUDE.md`, with these changes:

- **users:** as in CLAUDE.md; `password_hash` nullable for now.
- **products:** as in CLAUDE.md, minus `base_price`. Loaded from `data/products.yaml` (chicken breast only).
- **zones:** as in CLAUDE.md.
- **devices:** `id` (string, e.g. `esp32-chiller-01`, immutable), `name` (display name, e.g. "Chiller Bay 2 Thermal Probe 204"), `zone_id`, `api_key_hash`, `created_at`, `deleted_at` (nullable).
- **batches:** `id`, `code` (human batch ID shown in the UI, unique among non-deleted), `product_id`, `zone_id`, `received_at`, `printed_expiry`, `quantity` (units, no money), `notes` (nullable text), `status` (`active` | `dispatched` | `salvaged`), `created_at`, `updated_at`, `deleted_at` (nullable). **No `unit_price`.**
- **telemetry**, **batch_state:** as in CLAUDE.md. `batch_state` adds `predicted_expiry` (`timestamptz`) = time of last reading + `rul_h`.
- **recommendations:** as in CLAUDE.md, but `type` is `PRIORITY_DISPATCH` | `SALVAGE`, and `discount_pct` and `sentiment_factor` are dropped.
- **audit_log:** `id`, `user_id`, `action` (`create` | `update` | `delete` | `approve` | `reject`), `entity` (`batch` | `device` | `recommendation`), `entity_id`, `before` (JSON, nullable), `after` (JSON, nullable), `ts`.

All timestamps UTC. One Alembic revision creates the schema.

## Delete and edit behavior

- **Delete = soft delete.** Sets `deleted_at`. Lists hide deleted rows by default. `?include_deleted=true` shows them.
- **Deleted batch:** the worker stops recomputing it, and its `pending` recommendations are hidden from `GET /recommendations`. Its history stays.
- **Deleted device:** its telemetry is rejected from then on (HTTP returns 404 `device_not_found`; MQTT messages are dropped with a log line). Past readings stay.
- **Edit:** `PATCH` with only the fields that change. The audit row stores `before` and `after` for the changed fields only.
- **Batch edits that affect RUL** (`zone_id`, `received_at`, `product_id`) trigger an RUL recompute for that batch on the next worker run.
- Editing a deleted record returns 404.

## API (all under `/api/v1`)

Conventions from CLAUDE.md apply: paginated lists `{ items, total, limit, offset }`, error body `{ error: { code, message, details } }`, CORS for `http://localhost:3000`.

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/health` | public | DB and MQTT status |
| GET | `/me` | any | demo user |
| POST | `/telemetry` | device key | HTTP fallback ingest |
| GET | `/zones` | any | with latest reading |
| GET | `/telemetry?zone_id=&from=&to=` | any | history, downsampled |
| GET | `/products` | any | |
| GET | `/devices` | any | `?include_deleted=` |
| POST | `/devices` | supervisor | returns the device key once |
| PATCH | `/devices/{id}` | supervisor | `name`, `zone_id` |
| DELETE | `/devices/{id}` | supervisor | soft delete |
| GET | `/batches` | any | with current RUL, `predicted_expiry`, `?include_deleted=`, sorted by RUL ascending |
| POST | `/batches` | supervisor | |
| GET | `/batches/{id}` | any | batch + state |
| PATCH | `/batches/{id}` | supervisor | `code`, `product_id`, `zone_id`, `received_at`, `printed_expiry`, `quantity`, `notes`, `status` |
| DELETE | `/batches/{id}` | supervisor | soft delete |
| GET | `/batches/{id}/rul` | any | RUL history series |
| GET | `/recommendations?status=` | any | |
| POST | `/recommendations/{id}/decision` | supervisor | `{ decision: approve \| reject, note }` |
| GET | `/audit-log?entity=&action=&entity_id=` | any | newest first, paginated |

## RUL and recommendations

- RUL engine exactly as in CLAUDE.md, with its required unit tests (including the Herron cyclic-abuse check).
- Recommendation rules, with thresholds read from `data/products.yaml`:
  - `rul_h <= 0` or `rul_ratio < salvage_ratio` (0.10) → `SALVAGE`
  - `rul_ratio < dispatch_ratio` (0.50) → `PRIORITY_DISPATCH`
  - otherwise no recommendation
- One `pending` recommendation per batch and type, updated in place.
- Approving a `PRIORITY_DISPATCH` recommendation sets an `active` batch's `status` to `dispatched` and writes a batch audit row (changed 2026-10-24, Lab 5 scenario). Approving `SALVAGE` only records the decision; a supervisor sets `salvaged` with `PATCH /batches/{id}`. Nothing changes without a supervisor decision.
- A decision on a recommendation whose batch is deleted returns 404. (Builder's call.)

## Seed data

`python -m app.db.seed` creates: `demo-supervisor`, the chicken product, 2 zones, 2 devices (one per zone), 4 batches with varied `received_at` so RUL values differ at startup.

## Constraints

- Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 + Alembic, Postgres 16 + TimescaleDB, Mosquitto, APScheduler (stack per CLAUDE.md).
- Must run fully offline with `docker compose up`.
- `engine/` stays pure (no DB or HTTP).
- Commits must not include Claude attribution lines.

## Left to the builder

- Internal module layout within the CLAUDE.md structure
- Downsampling method for telemetry history
- Worker schedule interval (suggested: every 30 s of wall time)
- Exact simulator scenario defaults

## Frontend mapping notes (for the groupmates)

The Figma "Edit Stock Item" form maps to `PATCH /batches/{id}` like this: Item name → product (from `/products`), Identification number → `code`, Location → `zone_id`, Detail → `notes`, Value → `quantity` (assumed: with dollar value removed, "Value" should become "Quantity" in the form). The sensor editor's ID field must be read-only, because the device ID is what the sensor sends with every reading.
