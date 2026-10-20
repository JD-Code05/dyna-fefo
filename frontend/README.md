# FreshOps frontend

Next.js 15 wrapper around the dashboard exported from Figma Make. The screens still run on **mock data**; this guide is how to connect them to the backend (step 3).

## Run it

```bash
docker compose --profile ui up -d --build    # backend + frontend
```

- Dashboard: http://localhost:3000
- API docs: http://localhost:8000/docs

For hot reload while editing, run the backend in Docker and the frontend locally:

```bash
docker compose up -d
cd frontend && npm install && npm run dev
```

After any backend API change, regenerate the types (backend must be running):

```bash
npm run gen:api
```

## Where the data comes from

Every screen reads data through **one hook**: `useInventory()` in `src/data/InventoryContext.tsx`. Its seed arrays (`sensorSeed`, `stockSeed` from `src/data/dispatch.ts`) are the mock data. **Replace the inside of `InventoryProvider` with API calls and keep the same field names**, and most components don't need to change.

Use the helper in `src/api/client.ts`:

```ts
import { api, type Schemas } from '../api/client'

type Page<T> = { items: T[]; total: number; limit: number; offset: number }
const batches = await api<Page<Schemas['BatchOut']>>('/batches')
```

Errors throw `{ code, message, details }`; show `message` to the user.

## Step 3 checklist

Poll every 3–5 s (`setInterval` + `api(...)` inside a `useEffect`), then refetch right after any edit/delete/decision.

### 1. Stock (batches): `stocks`, `updateStock`, `deleteStock`, `addStock`

`GET /batches` → map each `BatchOut` to the existing `StockRecord` shape:

| Mock field | From the API |
|---|---|
| `key` | `String(b.id)` (send this back as the id for PATCH/DELETE) |
| `id` / `identifier` | `b.code` |
| `product` | `b.product_name` |
| `zone` | `b.zone_id` |
| `units` | `b.quantity` |
| `detail` | `b.notes ?? ''` |
| `staticHours` | hours from now to `b.printed_expiry` |
| `dynamicHours` | `b.rul_h ?? 0` |
| `value`, `demand`, `confidence`, `saves` | **no API field: remove from the UI** (group decided no money values) |

- Edit form → `PATCH /batches/{id}` with only changed fields: `{ code, zone_id, notes, quantity }`. The "Value" input becomes "Quantity".
- Delete → `DELETE /batches/{id}` (soft delete; it shows in the change history).
- Quick Add stock → `POST /batches` with `{ code, product_id: "chicken-breast", zone_id, received_at, printed_expiry, quantity }`. Dates must be ISO with a timezone: `new Date(...).toISOString()`.
- A duplicate code returns 409 `batch_code_taken`; show its message.

### 2. Sensors: `sensors`, `updateSensor`, `deleteSensor`, `addSensor`

`GET /devices` + `GET /zones` (latest reading per zone):

| Mock field | From the API |
|---|---|
| `key` / `id` | `d.id` (e.g. `esp32-chiller-01`); **read-only in the editor** |
| `name` | `d.name` |
| `location` | `d.zone_id` |
| `temperature`, `humidity` | the zone's `latest.temperature_c` / `latest.humidity_pct` |
| `status` | `latest.danger ? 'Critical' : latest ? 'Online' : 'Offline'` |
| `battery`, `signal` | not in the API, so remove or hide them |

- Edit → `PATCH /devices/{id}` with `{ name, zone_id }`.
- Delete → `DELETE /devices/{id}`.
- Quick Add sensor → `POST /devices` with `{ id, name, zone_id }`. The response's `api_key` is shown **once**, so display it.
- `locations` in the context becomes the zone ids from `GET /zones`.

### 3. Manager Decisions / Priority Dispatch (`QueueCard`, `DispatchQueueModal`)

`GET /recommendations?status=pending` → each has `batch_code`, `type` (`PRIORITY_DISPATCH` | `SALVAGE`), `rationale.rul_h`, `rationale.rul_ratio`, `rationale.predicted_expiry`, `rationale.printed_expiry`.

- Build the card text from those fields; there is no free-text `rec`.
- Approve/Reject buttons → `POST /recommendations/{id}/decision` with `{ "decision": "approve" | "reject", "note": "..." }`.
- A batch can have both a dispatch and a salvage card pending.
- Approving does **not** change the batch status. If the team wants "Dispatched", also `PATCH /batches/{id}` with `{ "status": "dispatched" }`.

### 4. Shelf-life decay and temperature charts

- RUL history for one batch → `GET /batches/{id}/rul`.
- Zone temperature chart → `GET /telemetry?zone_id=chiller-a` (replace `temperatureSeries()` mock).

### 5. Change history (new screen)

`GET /audit-log?entity=batch|device|recommendation&action=create|update|delete|approve|reject`. Each row has `ts`, `user`, `action`, `entity`, `entity_id`, `before`, `after` (only the changed fields).

### 6. Header

`GET /me` → `{ username, role }`. Logout stays local (no login backend yet).

## Notes

- Only `http://localhost:3000` is allowed by the backend (CORS).
- The simulator only drives `chiller-a`; `chiller-b` shows no live reading.
- With `SIM_SPEEDUP` > 1, `predicted_expiry` is in simulated time.
