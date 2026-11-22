# API changelog

Breaking and notable changes to `/api/v1`, newest first. After pulling, regenerate the frontend types: `cd frontend && npm run gen:api`.

## 2026-11-22: MQTT logins and topic rules

Not an HTTP API change. Anything publishing to the broker must now log in.

- Mosquitto refuses anonymous clients. Sensors log in with username = device ID and password = device key (the same key `POST /telemetry` checks); the worker logs in as `ingest`. Logins come from `MQTT_DEVICES` / `MQTT_INGEST_PASSWORD` (dev defaults in `.env.example`), hashed by `mosquitto_passwd` when the broker starts.
- `infra/mosquitto/acl`: a sensor may only publish to `sensors/<its id>/telemetry`; only `ingest` may read the sensor topics.
- The subscriber drops a reading whose `device_id` doesn't match the topic it arrived on (logged as `topic_mismatch`).

## 2026-11-22: real sign-in (breaking)

- **`X-Demo-User` is removed.** Every endpoint except `GET /health`, `POST /auth/login` and `POST /telemetry` (device key) now needs `Authorization: Bearer <token>`. Missing, expired or tampered tokens get 401 `not_authenticated`.
- **New `POST /auth/login`** `{username, password}` returns `{access_token, token_type: "bearer", username, role}`. The token is a JWT (HS256) valid for 8 hours. Passwords are stored as argon2 hashes.
- Wrong password and unknown username both return 401 `bad_credentials` with the same message. After 5 failures in 15 minutes the account returns 423 `account_locked` for 15 minutes.
- The audit log gains `action: "login" | "login_failed"` with `entity: "user"` (`GET /audit-log?entity=user`).
- Demo passwords come from `DEMO_SUPERVISOR_PASSWORD` / `DEMO_STAFF_PASSWORD` (dev defaults in `.env.example`); the signing key from `JWT_SECRET`. Existing databases get the hashes on the next API start (the seed fills empty hashes), so no `down -v` is needed.
- Frontend: `api()` in `src/api/client.ts` sends the token; `setDemoUser` is replaced by `setToken`. Run `npm run gen:api`.

## 2026-11-21: recommendations come from an MDP

Not breaking; two rationale fields added. Recommendation outcomes change.

- Dispatch and salvage lines now come from a Markov Decision Process solved per product (`backend/app/engine/mdp.py`), not the flat 0.50 / 0.10 in `products.yaml`. Chicken: dispatch below 0.19, salvage below 0.15; milk 0.14 / 0.11; tomato dish 0.24 / 0.19. When a chiller's latest reading is above 4 °C the warm lines apply (chicken dispatch below 0.44).
- `rationale` adds `policy` (`"mdp"`) and `chiller` (`"normal"` or `"warm"`). `rationale.threshold.value` is now the MDP line that was crossed.
- Seed: CHK-004 is 137 h old and MLK-002 204 h, so a fresh start shows Dispatch on CHK-004 and MLK-002 and Salvage on CHK-005 and TOM-002. CHK-003 is held (no recommendation). Reset with `docker compose --profile ui down -v` to see it.

## 2026-11-18: one chiller per product

Not breaking; one field added.

- `GET /telemetry` points add `temperature_max_c`: the highest raw reading in each downsampling bucket (`temperature_c` stays the bucket average). Use it for peaks over long ranges, where averaging hides short spikes.
- The seed has 3 zones and 3 devices: Chiller A (chicken, `esp32-chiller-01`), Chiller B (milk, `esp32-chiller-02`) and the new Chiller C (tomato dish, `esp32-chiller-03`, dev key `dev-key-03`). Each product's batches sit in their own chiller.
- Simulated setpoints: A 2 °C / 88 %, B 3.5 °C / 80 %, C 3 °C / 75 %. **Humidity is simulated and does not affect shelf life.**
- A batch's history follows its current `zone_id` (moves between zones are not tracked).

## 2026-11-06: products from the synthetic dataset

Not breaking; no schema changes.

- `GET /products` now returns 3 items: `chicken-breast`, `fresh-milk`, `tomato-dish`. Their `shelf_life_ref_hours` and `q10` are fitted from `data/shelf_life_by_temperature.csv` (chicken is now 168 h and 2.97, was 240 h and 2.5).
- `POST /batches` accepts any of those `product_id`s. The Add batch form now has a product dropdown.
- The seed has 9 batches (CHK-001…005, MLK-001/002, TOM-001/002).

## 2026-10-27: staff task confirmation

Design: `docs/superpowers/specs/2026-10-27-staff-task-confirmation-design.md`

### Breaking

- **Approve no longer dispatches.** `POST /recommendations/{id}/decision` with `approve` now only marks the recommendation `approved`, which is an open order for floor staff. The batch stays `active` until staff confirm it. (Reverses the PR #4 behaviour where approving a dispatch set the batch to `dispatched`.)
- **New recommendation statuses:** `status` can now be `done` (staff confirmed) or `flagged` (staff couldn't do it). `GET /recommendations?status=` accepts both.
- **New fields on `RecommendationOut`:** `handled_by` (staff username or `null`), `handled_at` (UTC timestamp or `null`), `flag_reason` (`"not_found"`, `"spoiled"` or `null`).
- **Demo staff identity:** send `X-Demo-User: demo-staff` and every request runs as the seeded `demo-staff` user (role `staff`). `GET /me` then returns it. Without the header (or with any other value) requests run as `demo-supervisor`, as before.
- **Roles enforced for staff:** supervisor-only endpoints (batch and device create/edit/delete, decisions) return `403` with code `forbidden` for `demo-staff`. All `GET` endpoints still work for staff.

### New

`POST /recommendations/{id}/task` (staff only)

| Body | Effect |
|---|---|
| `{"result": "done"}` | Recommendation → `done`. Batch `active` → `dispatched` (for `PRIORITY_DISPATCH`) or `salvaged` (for `SALVAGE`). If the batch is no longer `active`, it is left alone. |
| `{"result": "flagged", "reason": "not_found" \| "spoiled"}` | Recommendation → `flagged` with `flag_reason`. Batch unchanged. |

Returns the updated `RecommendationOut`. Errors:

| Status | Code | When |
|---|---|---|
| 404 | `recommendation_not_found` | No such recommendation, or its batch was deleted |
| 409 | `not_an_open_task` | Status is not `approved` (pending, rejected, already done or flagged) |
| 403 | `forbidden` | Caller is not staff |
| 422 | (validation) | `reason` missing when flagged, or sent when done |

Every call writes to `/audit-log` as the staff user: action `complete` or `flag` on the recommendation, plus an `update` row on the batch when its status changes.

### Worker

While a batch has an open (`approved`) order, the worker raises no new recommendation for it. After the order is flagged, a new one (for example a `SALVAGE`) can be raised.
