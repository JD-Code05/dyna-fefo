# Staff Task Confirmation: Design

Date: 2026-10-27
Status: draft, awaiting approval
Builds on: `2026-10-20-progress-report-backend-design.md` and the staff dashboard draft (branch `feat/staff-dashboard`)

## Intent

The staff dashboard draft shows floor staff a read-only pull list of batches the supervisor approved. Two gaps remain: nobody confirms the work happened, and the list only grows. Lab 5 observed supervisors "repeatedly asking floor staff for verbal status updates" over walkie-talkies; this closes that loop inside the system.

Staff get **one tap** per task: done, or can't do it. No forms, no quantities, no free text. The owner's words: more than that is "micromanagement". The supervisor sees every confirmation in Change history, under the staff member's name.

Chapter 1 excludes automated inventory record-keeping. A confirmation is an audit event on a supervisor's order, not a stock movement: no quantities move, no locations change.

## The flow

1. The worker opens a pending `PRIORITY_DISPATCH` or `SALVAGE` recommendation (unchanged).
2. The supervisor **approves** it. That is now an **order**. The batch stays `active`. (Today, approving a dispatch sets the batch to `dispatched` at once; that behaviour is removed.)
3. The order appears on the staff dashboard: **To ship** for a dispatch, **To salvage** for a salvage, most urgent (lowest RUL) first.
4. A staff member taps one of:
   - **Shipment done** / **Salvage done**: the recommendation becomes `done`; the batch becomes `dispatched` / `salvaged`.
   - **Can't do it**, then one of two reasons: **Not found** or **Looks spoiled**. The recommendation becomes `flagged` with that reason; the batch stays `active`.
5. Every tap writes an audit row as the staff user. The supervisor sees it in Change history, and flagged orders are visible on the supervisor dashboard with their reason.
6. A rejected recommendation never reaches staff (unchanged).

### Resolving a flagged order (supervisor)

The supervisor resolves a flag with tools that already exist: edit the batch status by hand (e.g. mark it `salvaged`), or leave it; the worker keeps the batch's RUL updated. A flagged order stays flagged; it does not reopen to staff. *(My call: smallest version. "Send back to staff" can be added later if the group wants it.)*

### The worker while an order is open (owner's decision)

Because approval no longer moves the batch out of `active`, the worker keeps recomputing its RUL. Rule:

- **While a batch has an open order** (a recommendation with status `approved`), `refresh_for_batch` raises or updates **no** recommendation for it. RUL keeps updating, so the staff list shows the batch's live remaining life (red under 24 h).
- **After a flag**, the order is closed, so the worker may raise a fresh recommendation as usual. A batch flagged "Looks spoiled" that has dropped into the salvage range reaches the supervisor as a pending `SALVAGE`.
- Existing rule kept: a type that was already decided (`approved`, `rejected`, `done` or `flagged`) is not re-raised for the same batch. So a flagged dispatch is not re-raised as a dispatch; only an escalation to `SALVAGE` can appear.
- Result: a batch has **at most one open order**, so completing it never leaves a second order behind.

## Goals

1. Approving no longer changes the batch; a staff confirmation does.
2. Staff can confirm or flag an approved order in one tap (two for a flag: "Can't do it", then the reason).
3. Every confirmation and flag is in Change history as the staff user.
4. The staff list shows only open orders (approved, not yet done or flagged), so it no longer only grows.
5. Write endpoints are role-checked on the server for both roles, using a demo staff identity.

## Non-goals

- Real login, passwords, JWT (still deferred).
- Free-text notes, quantities, photos, partial completion.
- Notifications or escalation when a supervisor is away (Lab 5 "managerial inaction"; later).
- Reopening a flagged order to staff.
- Any change to the RUL model or the dispatch/salvage thresholds.

## Anti-goals

- Staff changing anything other than the status of an order assigned to the floor (no batch edits, no approvals).
- Moving the batch status without an audit row.
- A confirm step that needs more than two taps.

## Identity: demo staff

- Seed a second user, `demo-staff`, role `staff`.
- `get_current_user()` reads a request header `X-Demo-User`. Value `demo-staff` → the staff user; missing or anything else → `demo-supervisor` (today's behaviour, so the supervisor screens and existing tests change nothing).
- The frontend sends `X-Demo-User: demo-staff` on every request while the staff dashboard is open. `/me` then answers `demo-staff`, so the header's hard-coded label in the draft is removed.
- `require_role("supervisor")` on existing writes now rejects staff with 403. New staff endpoint uses `require_role("staff")`.
- This is still demo auth: anyone can send the header. Real login later only replaces `get_current_user()`.
- CORS already allows every header (`allow_headers=["*"]` in `backend/app/main.py`); no change needed.

## Data model

Migration `0002` (Alembic), on `recommendations`:

| Column | Type | Meaning |
|---|---|---|
| `handled_by` | FK `users.id`, nullable | Staff user who confirmed or flagged |
| `handled_at` | `timestamptz`, nullable | When |
| `flag_reason` | string, nullable | `not_found` or `spoiled` when flagged |

`status` stays a plain string column (no DB enum), so new values need no constraint change. `RecStatus` gains `done` and `flagged`. `AuditAction` gains `complete` and `flag`.

## API (under `/api/v1`)

New:

| Method | Path | Role | Body | Result |
|---|---|---|---|---|
| POST | `/recommendations/{id}/task` | staff | `{ "result": "done" }` or `{ "result": "flagged", "reason": "not_found" \| "spoiled" }` | Updated `RecommendationOut` |

Rules:
- 404 `recommendation_not_found` if missing.
- 409 `not_an_open_task` unless status is `approved`.
- `reason` required when `result` is `flagged`, rejected (422) when `done`.
- On `done`: rec → `done`; batch `active` → `dispatched` (dispatch) or `salvaged` (salvage). If the batch is no longer `active` (supervisor changed it by hand), the rec still becomes `done` and the batch is left alone.
- One audit row for the rec (`complete` or `flag`, with before/after including `flag_reason`), plus one `update` row for the batch status when it changes. Same transaction, row locked (`with_for_update`), like `decide_recommendation`.

Changed (breaking, must go in `docs/CHANGELOG-API.md` and be announced to the frontend groupmates):
- `POST /recommendations/{id}/decision` approve no longer sets the batch to `dispatched`. (Reverses a PR #4 change.)
- `RecommendationOut.status` can be `done` or `flagged`; new fields `handled_by`, `handled_at`, `flag_reason`.
- `GET /recommendations?status=` accepts `done` and `flagged`.
- `/me` returns `demo-staff` when the header is sent.
- Supervisor-only endpoints return 403 for `demo-staff`.

## Frontend

Staff dashboard (`PullListCard`):
- Source changes from "batches with status `dispatched`" to "recommendations with status `approved`", joined to their batch, lowest RUL first.
- Each row: task label (**To ship** / **To salvage**), batch, product, zone, units, RUL, approved time, and the buttons. "Can't do it" opens a two-option choice (Not found / Looks spoiled) in place; no modal.
- After a tap the row leaves the list on the next refresh (the context already refetches after writes).
- Empty state stays "Nothing to pull".

Supervisor dashboard:
- Change history renders `complete` and `flag` rows ("demo-staff shipped CHK-003", "demo-staff flagged CHK-003: not found").
- Flagged orders are visible with their reason. *(My call: as a row state in the existing Decisions view, not a new card.)*
- Stock/decision text that says "approved · mark batch as dispatched" is updated to read from the order state (approved → waiting for staff, done → dispatched/salvaged, flagged → reason).

`api/client.ts` adds the `X-Demo-User` header when the staff dashboard is active. Types are regenerated from `/openapi.json`.

## Tests

Backend (pytest, in Docker, offline):
- Approve no longer changes the batch (updates the existing PR #4 test).
- Staff `done` on a dispatch → rec `done`, batch `dispatched`, two audit rows as `demo-staff`.
- Staff `done` on a salvage → batch `salvaged`.
- Staff `flagged` with reason → rec `flagged`, `flag_reason` stored, batch unchanged.
- 409 on a pending, rejected, done or flagged rec; 422 for missing/extra reason.
- 403: staff calling a supervisor endpoint; supervisor calling the staff endpoint.
- No header → supervisor (existing tests unchanged).
- Worker: a batch with an approved order whose RUL drops into the salvage range gets no new recommendation; after that order is flagged, a pending `SALVAGE` is raised.

Frontend: `tsc` clean; browser check of both dashboards end to end (approve as supervisor → confirm as staff → see it in Change history).

## Existing data

The demo database has CHK-003 already `dispatched` by the old approve behaviour, with its rec `approved`. After this change that rec would show as an open order for an already-dispatched batch. *(My call: the migration marks any `approved` rec whose batch is no longer `active` as `done`, with `handled_by` null, so old approvals don't reappear as staff tasks.)*

Approved `SALVAGE` recs whose batch is still `active` are left as they are, so they appear on the staff list as **To salvage** right after the migration. *(My call: the old approve never moved a salvage batch, so those salvages really are approved and not yet done.)*

## Constraints

- Offline, `docker compose up`, no new dependencies.
- Business logic in `services/`, thin routers, ruff and tsc clean.
- Conventional commits, no Claude co-author line.
- One UI pass at a time for the owner's review.

## Left to the builder

- Exact button styling and wording within the existing card style.
- Where the order-state text lives in `InventoryContext`.
- Splitting the work into commits.
