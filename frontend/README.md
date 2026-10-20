# FreshOps frontend

Next.js 15 dashboard for the perishable-inventory system. Every desktop screen reads live data from the backend API (polling every 5 s).

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

Every desktop screen reads through **one hook**, `useInventory()` in `src/data/InventoryContext.tsx`. It polls `/batches`, `/devices`, `/zones`, `/recommendations?status=pending`, `/products` and 24 h of `/telemetry` per zone, and maps them to the fields the screens use (`StockRecord`, `SensorRecord`). Writes (`addStock`, `updateStock`, `deleteStock`, `addSensor`, `updateSensor`, `deleteSensor`, `decide`) call the API and then refetch.

| Screen | API |
|---|---|
| Overview: shelf-life decay, sensor readings | `GET /batches`, `GET /zones`, `GET /telemetry` |
| Manager Decisions, Priority Dispatch, decision board | `GET /recommendations`, `POST /recommendations/{id}/decision` |
| Stock Overview (edit / delete with confirmation) | `PATCH` / `DELETE /batches/{id}` |
| Sensors (edit / delete with confirmation) | `PATCH` / `DELETE /devices/{id}` |
| Quick Add | `POST /batches`, `POST /devices` (shows the device key once) |
| Change History | `GET /audit-log` |

Errors come back as `{ code, message, details }` and screens show `message`.

Not shown because the system does not compute them: money values, confidence, demand, battery and signal.

## Notes

- Only `http://localhost:3000` is allowed by the backend (CORS).
- The simulator only drives `chiller-a`; `chiller-b` shows no live reading.
- With `SIM_SPEEDUP` > 1, `predicted_expiry` is in simulated time.
