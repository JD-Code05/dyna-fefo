# Staff Task Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supervisor approval becomes an order; floor staff confirm it ("done") or flag it ("not found" / "spoiled") in one or two taps, and every tap lands in Change history under the staff user.

**Architecture:** A demo staff identity chosen by an `X-Demo-User` header; three nullable columns on `recommendations` plus two new statuses; a staff-only `POST /recommendations/{id}/task`; the worker stops raising recommendations for a batch with an open order. The frontend sends the header on the staff dashboard, turns the pull list into a task list with buttons, and teaches Change history the two new actions.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, PostgreSQL/TimescaleDB, pytest (in Docker); Next.js 15, React, TypeScript, Tailwind v4, `openapi-typescript`.

**Spec:** `docs/superpowers/specs/2026-10-27-staff-task-confirmation-design.md`

## Global Constraints

- Branch: `feat/staff-dashboard` (already holds the staff draft). Commit after each task; conventional commits; **no `Co-Authored-By: Claude` line**; do not push.
- Offline, no new dependencies. Business logic in `backend/app/services/`, routers stay thin.
- Backend checks: `docker compose run --rm api pytest -q` and `docker compose run --rm api sh -c "ruff check . && ruff format --check ."` (the stack must be up: `docker compose --profile ui up -d`).
- Frontend checks: `cd frontend && npx tsc --noEmit -p .`; after frontend edits `docker compose --profile ui up -d --build frontend`, then hard-reload the browser (the old build is cached).
- Statuses and actions, verbatim: `RecStatus` gains `done`, `flagged`; `AuditAction` gains `complete`, `flag`; flag reasons `not_found`, `spoiled`; header `X-Demo-User`, value `demo-staff`; staff user `demo-staff` role `staff`.
- Error codes, verbatim: 404 `recommendation_not_found`, 409 `not_an_open_task`, 403 `forbidden` (existing).
- UI: the owner reviews **one UI pass at a time** (Tasks 6 and 7 each stop for a look before the next starts). Same card styles and tokens as the existing dashboard.

## Review Focus

- **Two taps on one order** (double-click, or two staff on two screens): the second call must get 409 `not_an_open_task`, and the UI must show the error, not crash or duplicate the audit row. → test in Task 3, UI handling in Task 6.
- **Batch deleted while its order is open:** the task call returns 404 like decisions do; the row disappears from the staff list on refresh. → test in Task 3.
- **Supervisor edits the batch status by hand while an order is open:** staff "done" still closes the order but leaves the batch alone, with only one audit row. → test in Task 3.
- **Staff reading everything:** with the header, every GET still works; only supervisor writes return 403. → test in Task 1.
- **Network error on a tap:** the row stays on the list with a visible message, and the buttons work again. → step in Task 6.

---

### Task 1: Demo staff identity

**Files:**
- Modify: `backend/app/db/seed.py` (add `demo-staff`)
- Modify: `backend/app/core/deps.py` (`get_current_user`)
- Modify: `backend/tests/conftest.py` (shared `STAFF` header)
- Test: `backend/tests/test_basics.py`

**Interfaces:**
- Produces: header `X-Demo-User: demo-staff` makes `get_current_user()` return the `demo-staff` user (role `staff`); no header or any other value returns `demo-supervisor`. `require_role(Role.staff)` is usable by later tasks. `STAFF = {"X-Demo-User": "demo-staff"}` in `conftest.py`, imported by tests like `AGED_NOW` is (`from conftest import STAFF`).

- [ ] **Step 1: Write the failing tests** in `test_basics.py` (after adding `STAFF` to `conftest.py`):

```python
def test_me_as_staff(client, seeded):
    assert client.get("/api/v1/me", headers=STAFF).json()["role"] == "staff"
    assert client.get("/api/v1/me", headers={"X-Demo-User": "nobody"}).json()["username"] == "demo-supervisor"

def test_staff_can_read_but_not_write(client, seeded):
    for path in ("/batches", "/zones", "/devices", "/recommendations", "/audit-log", "/products"):
        assert client.get(f"/api/v1{path}", headers=STAFF).status_code == 200
    r = client.delete("/api/v1/batches/1", headers=STAFF)
    assert r.status_code == 403 and r.json()["error"]["code"] == "forbidden"
```

- [ ] **Step 2: Run** `docker compose run --rm api pytest -q tests/test_basics.py -k staff`. Expected: FAIL (role is `supervisor`).

- [ ] **Step 3: Implement.** `seed()` adds `User(username="demo-staff", password_hash=None, role=Role.staff.value)` if missing, same pattern as `demo-supervisor`. `get_current_user(db, x_demo_user: str | None = Header(None))` looks up `"demo-staff"` when the header equals it, else `"demo-supervisor"`; keep the existing 500 `demo_user_missing` error when the row is absent. Update its comment: demo auth, anyone can send the header.

- [ ] **Step 4: Run** the two tests, then the full suite. Expected: all PASS (existing tests send no header).

- [ ] **Step 5: Commit** `feat: add a demo staff identity chosen by the X-Demo-User header`

---

### Task 2: Order fields and statuses (migration 0002)

**Files:**
- Create: `backend/alembic/versions/0002_staff_tasks.py`
- Modify: `backend/app/db/models.py` (`RecStatus`, `AuditAction`, `Recommendation`)
- Modify: `backend/app/schemas/recommendations.py` (`RecommendationOut`, new `TaskIn`)
- Modify: `backend/app/services/recommendations.py` (`rec_query`, `to_out`)
- Test: `backend/tests/test_recommendations.py`

**Interfaces:**
- Produces: `Recommendation.handled_by: int | None` (FK `users.id`), `handled_at: datetime | None`, `flag_reason: str | None`. `RecStatus.done`, `RecStatus.flagged`. `AuditAction.complete`, `AuditAction.flag`. `RecommendationOut` adds `handled_by: str | None` (username), `handled_at: datetime | None`, `flag_reason: Literal["not_found", "spoiled"] | None`. `TaskIn` = `result: Literal["done", "flagged"]`, `reason: Literal["not_found", "spoiled"] | None = None`, with a model validator: `reason` required iff `result == "flagged"` (422 otherwise).

- [ ] **Step 1: Write the failing test:**

```python
def test_rec_out_has_handled_fields(client, aged_batch_with_rec):
    item = client.get("/api/v1/recommendations").json()["items"][0]
    assert item["handled_by"] is None and item["handled_at"] is None and item["flag_reason"] is None
```

- [ ] **Step 2: Run** it. Expected: FAIL (`KeyError: 'handled_by'`).

- [ ] **Step 3: Implement.** Migration `0002` (`down_revision = "0001"`): add the three columns (`handled_at` as `sa.DateTime(timezone=True)`), then the data fix from the spec's "Existing data" section:

```sql
UPDATE recommendations r SET status = 'done'
FROM batches b
WHERE r.batch_id = b.id AND r.status = 'approved' AND b.status <> 'active'
```

`downgrade()` sets `done`/`flagged` rows back to `approved` and drops the columns. In `rec_query`, add a second aliased outer join on `User` for `handled_by` and return its username; `to_out` maps the three fields. Add `TaskIn` beside `DecisionIn`.

- [ ] **Step 4: Run** the full suite. Expected: all PASS (conftest migrates to head).

- [ ] **Step 5: Commit** `feat: add handled_by, handled_at and flag_reason to recommendations`

---

### Task 3: Approve becomes an order; staff confirm or flag it

**Files:**
- Modify: `backend/app/services/recommendations.py` (`decide_recommendation`, new `complete_task`)
- Modify: `backend/app/api/v1/recommendations.py` (new route)
- Create: `docs/CHANGELOG-API.md`
- Test: `backend/tests/test_recommendations.py`

**Interfaces:**
- Consumes: Task 1 header and `require_role(Role.staff)`; Task 2 fields, statuses and `TaskIn`.
- Produces: `complete_task(db: Session, user: User, rec_id: int, body: TaskIn) -> RecommendationOut`; route `POST /api/v1/recommendations/{rec_id}/task`, staff only.

- [ ] **Step 1: Write the failing tests.** Replace `test_approve_dispatch_sets_batch_dispatched` with `test_approve_keeps_batch_active` (approve → rec `approved`, batch still `active`, no batch audit row). Add, with a helper `approve(client, rec_id)` and `STAFF` from Task 1:

```python
def test_staff_done_dispatch(client, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec
    approve(client, rec_id)
    r = client.post(f"/api/v1/recommendations/{rec_id}/task", json={"result": "done"}, headers=STAFF)
    assert r.json()["status"] == "done" and r.json()["handled_by"] == "demo-staff"
    assert client.get(f"/api/v1/batches/{batch_id}").json()["status"] == "dispatched"
    audit = client.get("/api/v1/audit-log").json()["items"][:2]
    assert {(a["action"], a["user"]) for a in audit} == {("complete", "demo-staff"), ("update", "demo-staff")}

def test_staff_done_salvage(...)   # raise to SALVAGE via recompute_all(..., AGED_NOW + timedelta(hours=10)), approve, done → batch "salvaged"
def test_staff_flag_keeps_batch(...)  # {"result": "flagged", "reason": "not_found"} → rec "flagged", flag_reason "not_found", batch "active", one audit row action "flag"
@pytest.mark.parametrize("state", ["pending", "rejected", "done", "flagged"])
def test_task_on_non_open_order_409(...)  # error code "not_an_open_task"; the "done" case is the double-tap from Review Focus
@pytest.mark.parametrize("body", [{"result": "flagged"}, {"result": "done", "reason": "spoiled"}])
def test_task_reason_rules_422(...)
def test_task_on_deleted_batch_404(...)   # code "recommendation_not_found"
def test_done_leaves_hand_edited_batch_alone(...)  # PATCH batch status "salvaged" as supervisor, then staff done on the dispatch → rec "done", batch stays "salvaged", only the "complete" audit row
def test_supervisor_cannot_call_task_403(...)
```

- [ ] **Step 2: Run** `docker compose run --rm api pytest -q tests/test_recommendations.py`. Expected: the new tests FAIL (404 route missing; approve still dispatches).

- [ ] **Step 3: Implement.** In `decide_recommendation`, delete the block that sets the batch to `dispatched` and its batch audit row. Add `complete_task`, mirroring `decide_recommendation`'s shape: lock the row (`with_for_update(of=Recommendation)`), 404 when missing, 409 `not_an_open_task` unless `approved`, snapshot before/after with `AUDIT_FIELDS` extended by `flag_reason`, set `status`, `handled_by`, `handled_at=datetime.now(UTC)`, `flag_reason`; record `AuditAction.complete` or `AuditAction.flag`; on `done` with the batch `active`, set it to `dispatched` (dispatch) or `salvaged` (salvage) and record a batch `update` row `{"status": "active"} → {"status": <new>}`; one commit. Route: thin, `user: User = Depends(require_role(Role.staff))`.

- [ ] **Step 4: Write `docs/CHANGELOG-API.md`** with a dated `2026-10-27` entry listing the spec's five breaking changes (approve no longer dispatches; new statuses and fields; `status` filter accepts `done`/`flagged`; `/me` with the header; 403 for staff on supervisor writes) and the new endpoint with its body and errors.

- [ ] **Step 5: Run** the full suite and ruff. Expected: all PASS, ruff clean.

- [ ] **Step 6: Commit** `feat: make approval an order that floor staff confirm or flag`

---

### Task 4: Worker holds while an order is open

**Files:**
- Modify: `backend/app/services/recommendations.py` (`refresh_for_batch`)
- Test: `backend/tests/test_recommendations.py`

**Interfaces:**
- Consumes: Task 3's statuses on real rows.
- Produces: no new names; `refresh_for_batch` returns `None` while the batch has an `approved` recommendation.

- [ ] **Step 1: Write the failing tests:**

```python
def test_no_new_rec_while_order_open(client, db, products, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec
    approve(client, rec_id)
    recompute_all(db, products, AGED_NOW + timedelta(hours=10))  # now in salvage range
    assert db.query(Recommendation).filter_by(batch_id=batch_id).count() == 1

def test_flag_lets_salvage_be_raised(client, db, products, aged_batch_with_rec):
    rec_id, batch_id = aged_batch_with_rec
    approve(client, rec_id)
    client.post(f"/api/v1/recommendations/{rec_id}/task", json={"result": "flagged", "reason": "spoiled"}, headers=STAFF)
    recompute_all(db, products, AGED_NOW + timedelta(hours=10))
    pending = db.query(Recommendation).filter_by(batch_id=batch_id, status="pending").one()
    assert pending.type == "SALVAGE"
```

- [ ] **Step 2: Run** them. Expected: the first FAILS (a pending SALVAGE is created).

- [ ] **Step 3: Implement.** At the top of `refresh_for_batch`, after computing `kind`, return `None` if any recommendation for the batch has status `approved`. Keep the existing "already decided: do not re-raise" rule, which covers `done` and `flagged` of the same type. Update the docstring with the rule.

- [ ] **Step 4: Run** the full suite. Expected: all PASS, including `test_decided_recommendation_not_reraised`.

- [ ] **Step 5: Commit** `feat: hold new recommendations while a batch has an open order`

---

### Task 5: Frontend data: staff header, orders and the task call

**Files:**
- Modify: `frontend/src/api/client.ts`, `frontend/src/api/schema.d.ts` (regenerated)
- Modify: `frontend/src/App.tsx`, `frontend/src/components/DesktopHeader.tsx`
- Modify: `frontend/src/data/InventoryContext.tsx`

**Interfaces:**
- Consumes: Tasks 1–4 API.
- Produces: `setDemoUser(username: string | null): void` in `client.ts` (every `api()` call sends `X-Demo-User` when set). From `useInventory()`: `orders: StockOrder[]` where `type StockOrder = { rec: Recommendation; stock: StockRecord }`, the open (`approved`) orders joined to their batch, sorted by `stock.dynamicHours` ascending; `completeTask(recId: number, result: 'done' | 'flagged', reason?: 'not_found' | 'spoiled'): Promise<void>` (posts, then refetches like the other writes).

- [ ] **Step 1: Regenerate types:** `cd frontend && npm run gen:api`. Expected: `schema.d.ts` contains `TaskIn` and `flag_reason`.

- [ ] **Step 2: Implement.** `client.ts`: module-level `demoUser`, `setDemoUser`, header merge. `App.tsx`: call `setDemoUser(r === 'staff' ? 'demo-staff' : null)` before `setRole(r)` for both buttons and on logout. `DesktopHeader.tsx`: remove the hard-coded staff label (`/me` now answers `demo-staff`), re-fetch `/me` when `role` changes. `InventoryContext`: the approved-recs fetch also feeds `orders`; add a fetch for `status=flagged`; `recText` reads the order state: approved → `Dispatch ordered · waiting for staff` / `Salvage ordered · waiting for staff`; flagged → `Flagged by staff · not found` / `Flagged by staff · looks spoiled`; no open or flagged order and batch `dispatched` / `salvaged` → `Dispatched · confirmed by staff` / `Salvaged · confirmed by staff` (done orders are not fetched, so read the batch status; without this a confirmed batch would fall through to "No action needed"). Remove the "mark batch as dispatched/salvaged" strings.

- [ ] **Step 3: Verify** `npx tsc --noEmit -p .` is clean. Rebuild the frontend; in the browser, as staff, `GET /me` in the network panel carries `X-Demo-User: demo-staff` and the header shows `demo-staff · staff`; as supervisor no header is sent.

- [ ] **Step 4: Commit** `feat: send the staff identity and load open orders in the dashboard`

---

### Task 6: Staff task list with Done / Can't do it (UI pass 1)

**Files:**
- Modify: `frontend/src/components/PullListCard.tsx`

**Interfaces:**
- Consumes: Task 5 `orders`, `completeTask`.

- [ ] **Step 1: Implement.** Source rows from `orders` instead of dispatched stocks. Each row adds a task label (**To ship** for `PRIORITY_DISPATCH`, **To salvage** for `SALVAGE`) and, on the right, a primary button (**Shipment done** / **Salvage done**) and a secondary **Can't do it**. "Can't do it" swaps the row's buttons in place for **Not found**, **Looks spoiled** and a **Cancel** link (no modal). While a call is in flight, that row's buttons are disabled. On error (including 409 from a double tap) show the API `message` under the row in `text-danger` and re-enable the buttons. Badge text: `{n} open`. Keep the empty state ("Nothing to pull") and the approved-time column. Buttons at least 24 px tall.

- [ ] **Step 2: Verify** `tsc` clean, rebuild, and in the browser: approve a dispatch as supervisor → it appears as To ship for staff → Shipment done removes it and the batch shows Dispatched on the supervisor view; flag another → it leaves the staff list and the supervisor's Decisions row reads "Flagged by staff · …". Stop the API (`docker compose stop api`), tap Done → message shows, row stays; restart the API.

- [ ] **Step 3: Owner review.** Show the result and wait for a yes before Task 7.

- [ ] **Step 4: Commit** `feat: let staff confirm or flag orders from the pull list`

---

### Task 7: Change history shows staff confirmations (UI pass 2)

**Files:**
- Modify: `frontend/src/components/WorkspaceViews.tsx` (`actionTone`, `changeSummary`)

- [ ] **Step 1: Implement.** `actionTone`: `complete: 'bg-ok/10 text-ok'`, `flag: 'bg-warn/10 text-warn'`. `changeSummary`: `complete` → `Shipped batch #<batch_id>` (dispatch) or `Salvaged batch #<batch_id>` (salvage); `flag` → `Flagged batch #<batch_id> · not found` / `· looks spoiled`. The existing "user" column already shows `demo-staff`.

- [ ] **Step 2: Verify** `tsc` clean, rebuild, open Change history as supervisor after Task 6's actions: one `complete` row and one `flag` row by `demo-staff` with readable text; the batch status `update` row by `demo-staff` sits beside the `complete` row.

- [ ] **Step 3: Owner review**, then **commit** `feat: show staff confirmations and flags in change history`
