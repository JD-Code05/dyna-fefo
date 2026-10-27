# API changelog

Breaking and notable changes to `/api/v1`, newest first. After pulling, regenerate the frontend types: `cd frontend && npm run gen:api`.

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
