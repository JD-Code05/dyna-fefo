import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, type Schemas } from '../api/client'
import type { Action, Breach } from './dispatch'

type Page<T> = { items: T[]; total: number; limit: number; offset: number }
type Batch = Schemas['BatchOut']
type Device = Schemas['DeviceOut']
type Zone = Schemas['ZoneOut']
export type Recommendation = Schemas['RecommendationOut']
export type ZoneHistory = Schemas['HistoryOut']

const POLL_MS = 5000
const DANGER_C = 4 // CLAUDE.md: any reading above 4 °C is flagged
const HOUR = 3_600_000
const HISTORY_MS = HOUR // one hour keeps one point per reading, so charts move every poll

export type SensorRecord = {
  key: string
  id: string
  name: string
  location: string
  temperature: number | null
  humidity: number | null
  updated: string | null
  status: 'Online' | 'Critical' | 'No data'
}

export type StockState = 'moving' | 'dispatched' | 'stored' | 'hold' | 'inspection'

export type StockRecord = {
  key: string
  id: string
  product: string
  zone: string
  units: number
  avgTemp: number
  peakTemp: number
  /** Index of the reading where the peak occurred, within `series`. */
  peakAt: number
  /** Zone temperatures over the last 24 h, oldest first. */
  series: number[]
  breach: Breach
  staticHours: number
  dynamicHours: number
  printedExpiry: string
  predictedExpiry: string | null
  rec: string
  action: Action
  recommendation: Recommendation | null
  category: string
  detail: string
  identifier: string
  activity: { state: StockState; label: string; detail: string; updated: string }
}

/** An approved recommendation waiting for floor staff, with the batch it is about. */
export type StockOrder = { rec: Recommendation; stock: StockRecord }
export type TaskReason = 'not_found' | 'spoiled'

export type StockInput ={ code: string; zone: string; units: number; detail?: string; printedExpiration: string }
export type StockUpdate = Pick<StockRecord, 'identifier' | 'zone' | 'detail' | 'units'>

type InventoryContextValue = {
  sensors: SensorRecord[]
  stocks: StockRecord[]
  recommendations: Recommendation[]
  /** Open orders for floor staff, lowest remaining life first. */
  orders: StockOrder[]
  /** The last hour of readings per zone, ending at the zone's latest reading. */
  histories: ZoneHistory[]
  locations: string[]
  categories: string[]
  error: string | null
  refresh: () => Promise<void>
  updateSensor: (key: string, updates: Pick<SensorRecord, 'name' | 'location'>) => Promise<void>
  addSensor: (id: string, name: string, location: string) => Promise<string>
  deleteSensor: (key: string) => Promise<void>
  updateStock: (key: string, updates: StockUpdate) => Promise<void>
  deleteStock: (key: string) => Promise<void>
  addStock: (input: StockInput) => Promise<void>
  decide: (recId: number, decision: 'approve' | 'reject', note?: string) => Promise<void>
  completeTask: (recId: number, result: 'done' | 'flagged', reason?: TaskReason) => Promise<void>
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

const hoursUntil = (iso: string, now: number) => Math.round((new Date(iso).getTime() - now) / HOUR)
export const timeAgo = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`
}

function recText(
  r: Recommendation | null,
  order: Recommendation | null,
  flagged: Recommendation | null,
  status: Batch['status'],
): string {
  // A pending recommendation wins: it is what the supervisor has to act on next.
  if (!r && order) return `${order.type === 'SALVAGE' ? 'Salvage' : 'Dispatch'} ordered · waiting for staff`
  if (!r && flagged) return `Flagged by staff · ${flagged.flag_reason === 'spoiled' ? 'looks spoiled' : 'not found'}`
  if (!r && status === 'dispatched') return 'Dispatched · confirmed by staff'
  if (!r && status === 'salvaged') return 'Salvaged · confirmed by staff'
  if (!r) return 'No action needed · within shelf life'
  const pct = Math.round(Number(r.rationale.rul_ratio ?? 0) * 100)
  return r.type === 'SALVAGE'
    ? `Salvage: only ${pct}% of shelf life left`
    : `Priority dispatch: ${pct}% of shelf life left`
}

const activityFor = (b: Batch): StockRecord['activity'] =>
  b.status === 'dispatched'
    ? { state: 'dispatched', label: 'Dispatched', detail: 'Left storage', updated: timeAgo(b.updated_at) }
    : b.status === 'salvaged'
      ? { state: 'hold', label: 'Salvaged', detail: 'Removed from sale', updated: timeAgo(b.updated_at) }
      : { state: 'stored', label: 'In storage', detail: `Monitored in ${b.zone_id}`, updated: timeAgo(b.updated_at) }

function toStock(
  b: Batch,
  series: number[],
  rec: Recommendation | null,
  order: Recommendation | null,
  flagged: Recommendation | null,
): StockRecord {
  // Shelf-life clock: the zone's simulated time when SIM_SPEEDUP runs ahead of the wall clock.
  const now = b.predicted_expiry && b.rul_h != null ? new Date(b.predicted_expiry).getTime() - b.rul_h * HOUR : Date.now()
  const peak = series.length ? Math.max(...series) : 0
  const latest = series.at(-1) ?? 0
  return {
    key: String(b.id),
    id: b.code,
    product: b.product_name,
    zone: b.zone_id,
    units: b.quantity,
    avgTemp: series.length ? series.reduce((s, t) => s + t, 0) / series.length : 0,
    peakTemp: peak,
    peakAt: series.indexOf(peak),
    series,
    breach: latest > DANGER_C ? 'critical' : peak > DANGER_C ? 'spike' : null,
    staticHours: Math.max(0, hoursUntil(b.printed_expiry, now)),
    // Until the worker's first run (about 30 s after start) there is no RUL yet: show the printed life, not a total loss.
    dynamicHours: b.rul_h == null ? Math.max(0, hoursUntil(b.printed_expiry, now)) : Math.round(b.rul_h),
    printedExpiry: b.printed_expiry,
    predictedExpiry: b.predicted_expiry,
    rec: recText(rec, order, flagged, b.status),
    action: rec?.type === 'SALVAGE' ? 'audit' : rec ? 'dispatch' : 'review',
    recommendation: rec,
    category: b.product_name,
    detail: b.notes ?? '',
    identifier: b.code,
    activity: activityFor(b),
  }
}

function toSensor(d: Device, zone: Zone | undefined): SensorRecord {
  const l = zone?.latest
  return {
    key: d.id,
    id: d.id,
    name: d.name,
    location: d.zone_id,
    temperature: l?.temperature_c ?? null,
    humidity: l?.humidity_pct ?? null,
    updated: l ? timeAgo(l.ts) : null,
    status: !l ? 'No data' : l.danger ? 'Critical' : 'Online',
  }
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [sensors, setSensors] = useState<SensorRecord[]>([])
  const [stocks, setStocks] = useState<StockRecord[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [orders, setOrders] = useState<StockOrder[]>([])
  const [histories, setHistories] = useState<ZoneHistory[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [batches, devices, zones, recs, approvedRecs, flaggedRecs, products] = await Promise.all([
        api<Page<Batch>>('/batches?limit=200'),
        api<Page<Device>>('/devices?limit=200'),
        api<Page<Zone>>('/zones?limit=200'),
        api<Page<Recommendation>>('/recommendations?status=pending&limit=200'),
        api<Page<Recommendation>>('/recommendations?status=approved&limit=200'),
        api<Page<Recommendation>>('/recommendations?status=flagged&limit=200'),
        api<Page<Schemas['ProductConfig']>>('/products'),
      ])
      const histories = await Promise.all(
        zones.items.map((z) => {
          // Anchor on the zone's latest reading: in sim mode its clock runs ahead of the wall clock.
          if (!z.latest) return Promise.resolve<ZoneHistory>({ zone_id: z.id, points: [] })
          const to = new Date(z.latest.ts)
          const from = new Date(to.getTime() - HISTORY_MS)
          const q = new URLSearchParams({ zone_id: z.id, from: from.toISOString(), to: to.toISOString() })
          return api<ZoneHistory>(`/telemetry?${q}`)
        }),
      )
      const series = new Map(histories.map((h) => [h.zone_id, h.points.map((p) => p.temperature_c)]))
      // Most urgent pending recommendation per batch: SALVAGE outranks PRIORITY_DISPATCH.
      const recFor = new Map<number, Recommendation>()
      for (const r of recs.items) {
        if (!recFor.has(r.batch_id) || r.type === 'SALVAGE') recFor.set(r.batch_id, r)
      }
      // Approved = an open order for staff (the backend keeps at most one per batch); flagged = staff couldn't do it.
      const orderFor = new Map(approvedRecs.items.map((r) => [r.batch_id, r]))
      const zoneById = new Map(zones.items.map((z) => [z.id, z]))
      const nextStocks = batches.items.map((b) =>
        toStock(
          b,
          series.get(b.zone_id) ?? [],
          recFor.get(b.id) ?? null,
          orderFor.get(b.id) ?? null,
          flaggedRecs.items.find((r) => r.batch_id === b.id) ?? null, // newest first
        ),
      )
      const stockById = new Map(nextStocks.map((s) => [s.key, s]))
      setStocks(nextStocks)
      setOrders(
        approvedRecs.items
          .flatMap((rec) => {
            const stock = stockById.get(String(rec.batch_id))
            return stock ? [{ rec, stock }] : []
          })
          .sort((a, b) => a.stock.dynamicHours - b.stock.dynamicHours),
      )
      setSensors(devices.items.map((d) => toSensor(d, zoneById.get(d.zone_id))))
      setRecommendations(recs.items)
      setHistories(histories)
      setLocations(zones.items.map((z) => z.id))
      setCategories(products.items.map((p) => p.name))
      setError(null)
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Cannot reach the backend at localhost:8000')
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  // Every write refetches, so the screens always show what the backend stored.
  const write = (path: string, method: string, body?: unknown) =>
    api<unknown>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }).then(refresh)

  const value: InventoryContextValue = {
    sensors,
    stocks,
    recommendations,
    orders,
    histories,
    locations,
    categories,
    error,
    refresh,
    updateSensor: (key, u) => write(`/devices/${key}`, 'PATCH', { name: u.name, zone_id: u.location }),
    addSensor: async (id, name, location) => {
      const created = await api<Schemas['DeviceCreated']>('/devices', {
        method: 'POST',
        body: JSON.stringify({ id, name, zone_id: location }),
      })
      await refresh()
      return created.api_key
    },
    deleteSensor: (key) => write(`/devices/${key}`, 'DELETE'),
    updateStock: (key, u) =>
      write(`/batches/${key}`, 'PATCH', { code: u.identifier, zone_id: u.zone, notes: u.detail || null, quantity: u.units }),
    deleteStock: (key) => write(`/batches/${key}`, 'DELETE'),
    addStock: ({ code, zone, units, detail, printedExpiration }) =>
      write('/batches', 'POST', {
        code,
        product_id: 'chicken-breast',
        zone_id: zone,
        received_at: new Date().toISOString(),
        printed_expiry: new Date(`${printedExpiration}T23:59:59`).toISOString(),
        quantity: units,
        notes: detail || null,
      }),
    decide: (recId, decision, note) => write(`/recommendations/${recId}/decision`, 'POST', { decision, note: note ?? null }),
    completeTask: (recId, result, reason) => write(`/recommendations/${recId}/task`, 'POST', { result, reason: reason ?? null }),
  }

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

export function useInventory() {
  const value = useContext(InventoryContext)
  if (!value) throw new Error('useInventory must be used within InventoryProvider')
  return value
}
