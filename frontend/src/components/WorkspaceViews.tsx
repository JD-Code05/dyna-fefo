import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock3,
  Droplets,
  MapPin,
  Pencil,
  History,
  Radio,
  Search,
  Save,
  Thermometer,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import { api, type Schemas } from '../api/client'
import { useInventory, type SensorRecord, type StockRecord, type StockUpdate, type ZoneHistory } from '../data/InventoryContext'
import ShelfLifeComparisonBar from './ShelfLifeComparisonBar'
import { card, CardHint, CardTitle, ConfirmDelete, Dropdown } from './ui'

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—'
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
const errorText = (e: unknown) => (e as { message?: string }).message ?? 'Unable to save. Check the backend is running and try again.'

/** The zone with the most readings, so charts show the sensor that is actually reporting. */
const busiestZone = (histories: ZoneHistory[]) =>
  [...histories].sort((a, b) => b.points.length - a.points.length)[0]

export function ManagerDecisionsCard({ onOpenQueue }: { onOpenQueue: () => void }) {
  const { recommendations, decide } = useInventory()
  const [error, setError] = useState('')
  const top = [...recommendations].sort((a, b) => (a.type === 'SALVAGE' ? -1 : 0) - (b.type === 'SALVAGE' ? -1 : 0)).slice(0, 2)

  return (
    <section className={`${card} flex h-full flex-col p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="text-[13px]">Manager Decisions</CardTitle>
          <CardHint>{recommendations.length} awaiting supervisor approval</CardHint>
        </div>
        <button type="button" onClick={onOpenQueue} className="text-[10px] font-semibold text-sky hover:text-fg">
          Review all
        </button>
      </div>
      <div className="mt-2 divide-y divide-line">
        {top.length === 0 && <p className="py-3 text-[9.5px] text-muted">No recommendations pending.</p>}
        {top.map((rec) => {
          const salvage = rec.type === 'SALVAGE'
          const pct = Math.round(Number(rec.rationale.rul_ratio ?? 0) * 100)
          const label = `${salvage ? 'Salvage' : 'Priority dispatch'} · ${pct}% shelf life left`
          return (
            <div key={rec.id} className="flex items-center gap-2 py-2">
              <span className={`font-mono text-[9px] font-semibold ${salvage ? 'text-danger' : 'text-warn'}`}>{rec.batch_code}</span>
              <p className="min-w-0 flex-1 truncate text-[9.5px] text-fg/80" title={label}>{label}</p>
              <button
                type="button"
                onClick={() => decide(rec.id, 'approve').catch((e) => setError(errorText(e)))}
                className="grid size-6 place-items-center rounded-md border border-line text-muted hover:border-ok/30 hover:bg-ok/10 hover:text-ok"
                aria-label={`Approve ${label} for ${rec.batch_code}`}
              >
                <Check className="size-3" strokeWidth={2.5} />
              </button>
            </div>
          )
        })}
      </div>
      {error && <p role="alert" className="mt-1 text-[9px] font-semibold text-danger">{error}</p>}
    </section>
  )
}

function ViewHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <header className="flex h-[64px] shrink-0 items-center justify-between rounded-[14px] border border-line bg-surface px-5">
      <div>
        <p className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.12em] text-sky">{eyebrow}</p>
        <h2 className="mt-1 text-[18px] font-bold tracking-[-0.02em] text-fg">{title}</h2>
      </div>
      <p className="max-w-[480px] text-right text-[10.5px] leading-relaxed text-muted">{detail}</p>
    </header>
  )
}

function linePoints(data: number[], width = 500, height = 150) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  return data
    .map((value, index) => {
      const x = 18 + (index / (data.length - 1)) * (width - 36)
      const y = height - 18 - ((value - min) / Math.max(max - min, 1)) * (height - 42)
      return `${x},${y}`
    })
    .join(' ')
}

function TrendCard({
  title,
  hint,
  data,
  color,
  unit,
  stat,
  labels,
}: {
  title: string
  hint: string
  data: number[]
  color: 'sky' | 'warn' | 'violet' | 'ok'
  unit: string
  stat: string
  labels: string[]
}) {
  const stroke = { sky: '#38BDF8', warn: '#F5A623', violet: '#A78BFA', ok: '#10B981' }[color]
  const statTone = { sky: 'text-sky', warn: 'text-warn', violet: 'text-violet', ok: 'text-ok' }[color]
  return (
    <section className={`${card} flex min-h-0 flex-col overflow-hidden p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <CardTitle className="text-[13px]">{title}</CardTitle>
          <CardHint>{hint}</CardHint>
        </div>
        <p className={`font-mono text-[18px] font-bold ${statTone}`}>
          {stat} <span className="text-[9px] font-medium text-muted">{unit}</span>
        </p>
      </div>
      <div className="relative mt-4 min-h-0 flex-1">
        {data.length < 2 ? (
          <p className="grid h-full place-items-center text-[10px] text-muted">No readings in the last 24 hours</p>
        ) : (
        <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label={`${title} trend graph`}>
          {[24, 64, 104, 144].map((y) => (
            <line key={y} x1="0" y1={y} x2="500" y2={y} stroke="#262830" strokeWidth="1" />
          ))}
          <polygon points={`18,132 ${linePoints(data)} 482,132`} fill={stroke} fillOpacity="0.08" />
          <polyline points={linePoints(data)} fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {linePoints(data)
            .split(' ')
            .map((point, index) => {
              const [cx, cy] = point.split(',')
              return <circle key={index} cx={cx} cy={cy} r="3" fill="#18191E" stroke={stroke} strokeWidth="2" />
            })}
        </svg>
        )}
        <div className="absolute inset-x-0 bottom-0 flex justify-between px-2 font-mono text-[7.5px] uppercase text-muted">
          {labels.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

function ExpirationChart() {
  const { stocks } = useInventory()
  const items = [...stocks].sort((a, b) => a.dynamicHours - b.dynamicHours)
  const maxHours = Math.max(24, ...items.flatMap((batch) => [batch.staticHours, batch.dynamicHours]))
  const averageGap = items.length
    ? Math.round(items.reduce((sum, batch) => sum + batch.staticHours - batch.dynamicHours, 0) / items.length)
    : 0
  return (
    <section className={`${card} flex h-full min-h-0 flex-col overflow-hidden p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <CardTitle className="text-[13px]">Estimated vs Printed Expiration</CardTitle>
          <CardHint>Remaining hours by batch · shortest life first</CardHint>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-3 font-mono text-[8px] text-muted">
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-sky" /> Sensor RUL</span>
            <span className="flex items-center gap-1.5"><i className="hatch-danger size-2 rounded-sm" /> Life lost</span>
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-track ring-1 ring-inset ring-white/10" /> Printed</span>
          </div>
          <span className={`rounded-full border px-2 py-1 font-mono text-[8px] font-semibold ${
            averageGap > 12
              ? 'border-danger/25 bg-danger/10 text-danger'
              : 'border-warn/25 bg-warn/10 text-warn'
          }`}>
            -{averageGap}h avg
          </span>
        </div>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-night/35">
        <div className="grid grid-cols-[92px_minmax(0,1fr)_48px] items-end gap-3 border-b border-line px-3 py-2">
          <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-muted">Batch</span>
          <div className="flex justify-between font-mono text-[7px] text-muted">
            {[0, 0.25, 0.5, 0.75, 1].map((step) => (
              <span key={step}>{Math.round(maxHours * step)}h</span>
            ))}
          </div>
          <span className="text-right font-mono text-[7.5px] uppercase tracking-[0.08em] text-muted">Loss</span>
        </div>

        <div className="min-h-0 flex-1 divide-y divide-line/70 overflow-y-auto overscroll-contain">
          {items.length ? items.map((batch) => {
            const gap = Math.max(0, batch.staticHours - batch.dynamicHours)
            return (
              <div key={batch.key} className="grid h-[52px] grid-cols-[92px_minmax(0,1fr)_48px] items-center gap-3 px-3 hover:bg-white/[0.02]">
                <span className="min-w-0">
                  <strong className="block truncate text-[8.5px] text-fg">{batch.product}</strong>
                  <small className="mt-0.5 block truncate font-mono text-[7px] text-muted">
                    #{batch.id} · {batch.dynamicHours}h / {batch.staticHours}h
                  </small>
                </span>

                <ShelfLifeComparisonBar
                  printedHours={batch.staticHours}
                  dynamicHours={batch.dynamicHours}
                  maxHours={maxHours}
                />

                <span className={`text-right font-mono text-[8px] font-semibold ${
                  gap > 12 ? 'text-danger' : gap ? 'text-warn' : 'text-ok'
                }`}>
                  {gap ? `-${gap}h` : '0h'}
                </span>
              </div>
            )
          }) : (
            <div className="grid h-full place-items-center text-[9px] text-muted">No stock data available</div>
          )}
        </div>
      </div>
    </section>
  )
}

export function AnalyticsView() {
  const { histories } = useInventory()
  const zone = busiestZone(histories)
  const points = zone?.points ?? []
  // Keep the chart readable: at most 24 evenly spaced points.
  const step = Math.max(1, Math.ceil(points.length / 24))
  const sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1)
  const labels = sampled.length
    ? [0, 1, 2, 3].map((q) => fmtTime(sampled[Math.round((q / 3) * (sampled.length - 1))].ts))
    : []
  const last = points.at(-1)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ViewHeading
        eyebrow="Warehouse analytics"
        title="Shelf-life & Environmental Analytics"
        detail={`Printed versus sensor-estimated expiration for every batch, and the last 24 hours of readings${zone ? ` from ${zone.zone_id}` : ''}.`}
      />
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3">
        <div className="row-span-2 min-h-0">
          <ExpirationChart />
        </div>
        <TrendCard title="Temperature Over Time" hint={`${zone?.zone_id ?? 'No zone'} · last 24 hours`} data={sampled.map((p) => p.temperature_c)} color="warn" stat={last ? last.temperature_c.toFixed(1) : '—'} unit="°C NOW" labels={labels} />
        <TrendCard title="Humidity Over Time" hint={`${zone?.zone_id ?? 'No zone'} · last 24 hours`} data={sampled.map((p) => p.humidity_pct)} color="sky" stat={last ? String(Math.round(last.humidity_pct)) : '—'} unit="% RH NOW" labels={labels} />
      </div>
    </div>
  )
}

export function StockOverviewView() {
  const { stocks, updateStock, deleteStock, locations: zones } = useInventory()
  const [editing, setEditing] = useState<StockRecord | null>(null)
  const [deleting, setDeleting] = useState<StockRecord | null>(null)
  const locations = ['All locations', ...Array.from(new Set(stocks.map((batch) => batch.zone)))]
  const [location, setLocation] = useState(locations[0])
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const rows = stocks.filter((batch) => {
    const matchesLocation = location === 'All locations' || batch.zone === location
    const matchesQuery =
      !normalizedQuery ||
      [batch.product, batch.id, batch.zone, batch.category, batch.detail, batch.identifier].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      )
    return matchesLocation && matchesQuery
  })
  const totalUnits = rows.reduce((sum, batch) => sum + batch.units, 0)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ViewHeading
        eyebrow="Inventory catalog"
        title="Stock Overview"
        detail="Search every batch and filter by zone, batch code or notes. Edits and deletes are saved and appear in the change history."
      />

      <div className="grid grid-cols-3 gap-3">
        <SensorStat label="Stock items" value={String(rows.length)} hint="Matching inventory records" tone="text-fg" />
        <SensorStat label="Warehouse zones" value={String(new Set(rows.map((batch) => batch.zone)).size)} hint="Locations represented" tone="text-violet" />
        <SensorStat label="Total quantity" value={String(totalUnits)} hint="Units in the filtered batches" tone="text-ok" />
      </div>

      <section className={`${card} flex min-h-0 flex-1 flex-col overflow-hidden p-5`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-line bg-night px-3 focus-within:border-sky/50">
            <Search className="size-4 shrink-0 text-muted" strokeWidth={1.9} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search stock item, ID, category, or detail..."
              aria-label="Search stock"
              className="h-full min-w-0 flex-1 bg-transparent text-[10.5px] text-fg outline-none placeholder:text-muted"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear stock search"
                className="grid size-6 place-items-center rounded-md text-muted hover:bg-white/[0.04] hover:text-fg"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <Dropdown
            label="Filter stock by location"
            value={location}
            options={locations}
            onChange={setLocation}
            className="h-10 min-w-[170px] justify-between rounded-lg"
          />
        </div>

        <div className="mt-4 grid grid-cols-[1.05fr_1.2fr_0.9fr_0.8fr_0.85fr_0.65fr_70px] gap-3 border-b border-line px-3 pb-2 font-mono text-[8.5px] uppercase tracking-[0.06em] text-muted">
          <span>Stock item</span>
          <span>Details</span>
          <span>Identification</span>
          <span>Location</span>
          <span>Printed expiration</span>
          <span>Quantity</span>
          <span>Actions</span>
        </div>

        <div className="dashboard-scroll min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {rows.length ? (
            rows.map((batch) => {
              return (
                <div
                  key={batch.key}
                  className="grid h-[48px] grid-cols-[1.05fr_1.2fr_0.9fr_0.8fr_0.85fr_0.65fr_70px] items-center gap-3 px-3 transition-colors hover:bg-white/[0.02]"
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-[10px] text-fg" title={batch.product}>{batch.product}</strong>
                    <small className="block truncate text-[7.5px] text-muted">{batch.activity.label}</small>
                  </span>
                  <span className="text-[9px] leading-snug text-muted">{batch.detail}</span>
                  <span>
                    <strong className="block font-mono text-[9px] text-fg">{batch.identifier}</strong>
                    <small className="font-mono text-[8px] text-muted">Batch {batch.id}</small>
                  </span>
                  <span className="flex items-start gap-1.5 text-[9px] leading-tight text-muted">
                    <MapPin className="mt-0.5 size-3 shrink-0 text-sky" />
                    {batch.zone}
                  </span>
                  <span className="font-mono text-[9px] text-muted">{fmtDay(batch.printedExpiry)}</span>
                  <span className="font-mono text-[10px] font-semibold text-fg">{batch.units}</span>
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditing(batch)}
                      aria-label={`Edit batch ${batch.id}`}
                      className="grid size-7 place-items-center rounded-md border border-line text-muted hover:text-sky"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(batch)}
                      aria-label={`Delete batch ${batch.id}`}
                      className="grid size-7 place-items-center rounded-md border border-line text-muted hover:border-danger/30 hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </div>
              )
            })
          ) : (
            <div className="grid h-full min-h-[220px] place-items-center text-center">
              <div>
                <Search className="mx-auto size-6 text-muted" />
                <p className="mt-3 text-[11px] font-semibold text-fg">No stock found</p>
                <p className="mt-1 text-[9.5px] text-muted">Try another search term or warehouse location.</p>
              </div>
            </div>
          )}
        </div>
      </section>
      {editing && <StockEditor stock={editing} zones={zones} onClose={() => setEditing(null)} onSave={updateStock} />}
      {deleting && (
        <ConfirmDelete
          title={`Delete batch ${deleting.id}?`}
          body={`${deleting.units} units of ${deleting.product} in ${deleting.zone} will be removed from monitoring. The record stays in the change history.`}
          confirmLabel="Delete batch"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteStock(deleting.key)
            setDeleting(null)
          }}
        />
      )}
    </div>
  )
}

function StockEditor({
  stock,
  zones,
  onClose,
  onSave,
}: {
  stock: StockRecord
  zones: string[]
  onClose: () => void
  onSave: (key: string, updates: StockUpdate) => Promise<void>
}) {
  const [form, setForm] = useState({
    identifier: stock.identifier,
    zone: stock.zone,
    detail: stock.detail,
    units: String(stock.units),
  })
  const [error, setError] = useState('')
  const setField = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-night/75 backdrop-blur-sm">
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          try {
            await onSave(stock.key, { ...form, units: Number(form.units) })
            onClose()
          } catch (e) {
            setError(errorText(e))
          }
        }}
        className="w-[560px] rounded-[18px] border border-line bg-surface p-6 shadow-[0_30px_90px_rgb(0_0_0/0.35)]"
      >
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-[16px]">Edit batch {stock.id}</CardTitle>
            <CardHint>{stock.product} · changes are saved and recorded in the change history.</CardHint>
          </div>
          <button type="button" onClick={onClose} aria-label="Close stock editor" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/[0.04] hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <EditField label="Batch code" value={form.identifier} onChange={(value) => setField('identifier', value)} />
          <label className="font-mono text-[8.5px] uppercase tracking-[0.07em] text-muted">
            Zone
            <select value={form.zone} onChange={(event) => setField('zone', event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-line bg-night px-3 font-sans text-[11px] normal-case tracking-normal text-fg outline-none focus:border-sky/50">
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </label>
          <EditField label="Notes" value={form.detail} required={false} onChange={(value) => setField('detail', value)} />
          <EditField label="Quantity (units)" value={form.units} type="number" onChange={(value) => setField('units', value)} />
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-[10px] font-semibold text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-line px-4 text-[10.5px] font-semibold text-muted hover:text-fg">Cancel</button>
          <button type="submit" className="flex h-10 items-center gap-2 rounded-lg bg-sky px-4 text-[10.5px] font-bold text-night">
            <Save className="size-4" /> Save batch
          </button>
        </div>
      </form>
    </div>
  )
}

function EditField({
  label,
  value,
  onChange,
  type = 'text',
  required = true,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number'
  required?: boolean
}) {
  return (
    <label className="font-mono text-[8.5px] uppercase tracking-[0.07em] text-muted">
      {label}
      <input required={required} type={type} min={type === 'number' ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-line bg-night px-3 font-sans text-[11px] normal-case tracking-normal text-fg outline-none focus:border-sky/50" />
    </label>
  )
}

export function SensorsView() {
  const { sensors, updateSensor, deleteSensor, locations: zones } = useInventory()
  const [selectedKey, setSelectedKey] = useState(sensors[0]?.key ?? '')
  const [deleting, setDeleting] = useState<SensorRecord | null>(null)
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredSensors = sensors.filter((sensor) =>
    !normalizedQuery ||
    [sensor.name, sensor.id, sensor.location, sensor.status].some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    ),
  )
  const selected = sensors.find((sensor) => sensor.key === selectedKey) ?? sensors[0]
  const removeSensor = async (key: string) => {
    await deleteSensor(key)
    if (key === selectedKey) setSelectedKey(sensors.find((sensor) => sensor.key !== key)?.key ?? '')
    setDeleting(null)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ViewHeading
        eyebrow="Sensor management"
        title="Environmental Sensor Registry"
        detail="Live temperature and humidity from each sensor's zone. Select a row to edit its name or zone."
      />
      <div className="grid grid-cols-4 gap-3">
        <SensorStat label="Total sensors" value={String(sensors.length)} hint={`Across ${new Set(sensors.map((sensor) => sensor.location)).size} warehouse zones`} tone="text-fg" />
        <SensorStat label="Online" value={String(sensors.filter((sensor) => sensor.status === 'Online').length)} hint="Reporting normally" tone="text-ok" />
        <SensorStat label="No data" value={String(sensors.filter((sensor) => sensor.status === 'No data').length)} hint="Zone has no readings yet" tone="text-warn" />
        <SensorStat label="Critical" value={String(sensors.filter((sensor) => sensor.status === 'Critical').length)} hint="Above the 4°C limit" tone="text-danger" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_310px] gap-3">
        <section className={`${card} flex min-h-0 flex-col overflow-hidden p-4`}>
          <div className="mb-3 flex h-9 items-center gap-2.5 rounded-lg border border-line bg-night px-3 focus-within:border-sky/50">
            <Search className="size-3.5 shrink-0 text-muted" strokeWidth={1.9} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sensor, ID, location, or status..."
              aria-label="Search sensors"
              className="h-full min-w-0 flex-1 bg-transparent text-[9.5px] text-fg outline-none placeholder:text-muted"
            />
            <span className="shrink-0 font-mono text-[7.5px] text-muted">
              {filteredSensors.length}/{sensors.length}
            </span>
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear sensor search"
                className="grid size-6 place-items-center rounded-md text-muted hover:bg-white/[0.04] hover:text-fg"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_30px] gap-1.5 border-b border-line px-2 pb-2 font-mono text-[8.5px] uppercase tracking-[0.06em] text-muted">
            <span className="grid grid-cols-[1.35fr_1fr_80px_76px_76px_82px] gap-3">
              <span>Sensor</span><span>Zone</span><span>Temp</span><span>Humidity</span><span>Updated</span><span>Status</span>
            </span>
            <span />
          </div>
          <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain [scrollbar-color:var(--color-line)_transparent] [scrollbar-width:thin]">
            {filteredSensors.length ? (
              filteredSensors.map((sensor) => (
                <div
                  key={sensor.key}
                  className={`grid h-[42px] grid-cols-[minmax(0,1fr)_30px] items-center gap-1.5 px-2 transition-colors ${
                    selectedKey === sensor.key ? 'bg-sky/[0.06]' : 'hover:bg-white/[0.025]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedKey(sensor.key)}
                    className="grid h-full w-full grid-cols-[1.35fr_1fr_80px_76px_76px_82px] items-center gap-3 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <strong className="min-w-0 flex-1 truncate text-[9.5px] leading-none text-fg" title={sensor.name}>{sensor.name}</strong>
                      <small className="shrink-0 rounded bg-pill px-1 py-0.5 font-mono text-[6.5px] leading-none text-muted">{sensor.id}</small>
                    </span>
                    <span className="flex items-center gap-1.5 truncate text-[9px] text-muted"><MapPin className="size-3" />{sensor.location}</span>
                    <span className={`font-mono text-[10px] font-semibold ${sensor.status === 'Critical' ? 'text-danger' : 'text-fg'}`}>{sensor.temperature == null ? '—' : `${sensor.temperature.toFixed(1)}°C`}</span>
                    <span className="font-mono text-[9.5px] text-fg">{sensor.humidity == null ? '—' : `${Math.round(sensor.humidity)}%`}</span>
                    <span className="font-mono text-[9.5px] text-muted">{sensor.updated ?? 'never'}</span>
                    <Status status={sensor.status} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(sensor)}
                    aria-label={`Delete ${sensor.name}`}
                    className="grid size-6 place-items-center rounded-md border border-line text-muted hover:border-danger/30 hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))
            ) : (
              <div className="grid h-[220px] place-items-center text-center">
                <div>
                  {query ? <Search className="mx-auto size-6 text-muted" /> : <Radio className="mx-auto size-6 text-muted" />}
                  <p className="mt-3 text-[11px] font-semibold text-fg">
                    {query ? 'No sensors found' : 'No sensors registered'}
                  </p>
                  <p className="mt-1 text-[9.5px] text-muted">
                    {query ? 'Try another sensor name, ID, location, or status.' : 'Add a sensor from Quick Add to begin monitoring.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
        {selected ? (
          <SensorEditor key={selected.key} sensor={selected} zones={zones} onSave={updateSensor} />
        ) : (
          <section className={`${card} grid min-h-0 place-items-center p-5 text-center`}>
            <div>
              <Radio className="mx-auto size-6 text-muted" />
              <CardTitle className="mt-3 text-[13px]">No sensor selected</CardTitle>
              <CardHint>Add a sensor to view live configuration details.</CardHint>
            </div>
          </section>
        )}
      </div>
      {deleting && (
        <ConfirmDelete
          title={`Delete sensor ${deleting.id}?`}
          body={`${deleting.name} will stop being accepted as a data source for ${deleting.location}. Its past readings and history stay.`}
          confirmLabel="Delete sensor"
          onCancel={() => setDeleting(null)}
          onConfirm={() => removeSensor(deleting.key)}
        />
      )}
    </div>
  )
}

function SensorStat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: string }) {
  return (
    <div className={`${card} px-4 py-3`}>
      <p className="font-mono text-[8px] uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className={`mt-1 text-[21px] font-bold leading-none ${tone}`}>{value}</p>
      <p className="mt-1.5 text-[9px] text-muted">{hint}</p>
    </div>
  )
}

function Status({ status }: { status: string }) {
  const tone = status === 'Critical' ? 'bg-danger/10 text-danger border-danger/25' : status === 'No data' ? 'bg-warn/10 text-warn border-warn/25' : 'bg-ok/10 text-ok border-ok/25'
  return <span className={`w-fit rounded-full border px-1.5 py-0.5 font-mono text-[7.5px] font-semibold ${tone}`}>{status}</span>
}

function SensorEditor({
  sensor,
  zones,
  onSave,
}: {
  sensor: SensorRecord
  zones: string[]
  onSave: (key: string, updates: Pick<SensorRecord, 'name' | 'location'>) => Promise<void>
}) {
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: sensor.name, location: sensor.location })
  const setField = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }))
  const save = async () => {
    setError('')
    try {
      await onSave(sensor.key, form)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1200)
    } catch (e) {
      setError(errorText(e))
    }
  }
  return (
    <section className={`${card} dashboard-scroll flex min-h-0 flex-col overflow-y-auto overscroll-contain p-5`}>
      <div className="flex items-center justify-between">
        <div><CardTitle className="text-[13px]">Sensor Details</CardTitle><CardHint>{sensor.id} · device ID cannot change</CardHint></div>
        <Pencil className="size-4 text-sky" />
      </div>
      <label className="mt-5 font-mono text-[8.5px] uppercase tracking-[0.08em] text-muted">
        Sensor name
        <input value={form.name} onChange={(event) => setField('name', event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-line bg-night px-3 font-sans text-[11px] normal-case tracking-normal text-fg outline-none focus:border-sky/50" />
      </label>
      <label className="mt-4 font-mono text-[8.5px] uppercase tracking-[0.08em] text-muted">
        Zone
        <select value={form.location} onChange={(event) => setField('location', event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-line bg-night px-3 font-sans text-[11px] normal-case tracking-normal text-fg outline-none focus:border-sky/50">
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      </label>
      <RealtimeSensorGraph sensor={sensor} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Detail icon={Thermometer} label="Temperature" value={sensor.temperature == null ? '—' : `${sensor.temperature.toFixed(1)}°C`} />
        <Detail icon={Droplets} label="Humidity" value={sensor.humidity == null ? '—' : `${Math.round(sensor.humidity)}% RH`} />
      </div>
      <div className="mt-auto rounded-lg border border-line bg-night/50 p-3">
        <p className="font-mono text-[8px] uppercase tracking-[0.08em] text-muted">Current status</p>
        <div className="mt-2 flex items-center justify-between"><Status status={sensor.status} /><span className="font-mono text-[8px] text-muted">Updated {sensor.updated ?? 'never'}</span></div>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[10px] font-semibold text-danger">{error}</p>}
      <button type="button" onClick={save} className="mt-3 flex h-10 items-center justify-center gap-2 rounded-lg bg-sky text-[10.5px] font-bold text-night hover:brightness-105">
        {saved ? <Check className="size-4" /> : <Save className="size-4" />}{saved ? 'Changes saved' : 'Save sensor'}
      </button>
    </section>
  )
}

function RealtimeSensorGraph({ sensor }: { sensor: SensorRecord }) {
  const { histories } = useInventory()
  const [metric, setMetric] = useState<'temperature' | 'humidity'>('temperature')
  const zonePoints = histories.find((h) => h.zone_id === sensor.location)?.points ?? []
  const temperatureReadings = zonePoints.map((p) => p.temperature_c)
  const humidityReadings = zonePoints.map((p) => p.humidity_pct)
  if (zonePoints.length < 2) {
    return <p className="mt-4 rounded-xl border border-line bg-night/60 p-3 text-[9px] text-muted">No readings from {sensor.location} in the last 24 hours.</p>
  }

  const readings = metric === 'temperature' ? temperatureReadings : humidityReadings
  const limit = metric === 'temperature' ? 4 : 90
  const unit = metric === 'temperature' ? '°C' : '% RH'
  const min = Math.min(...readings, limit) - (metric === 'temperature' ? 0.25 : 2)
  const max = Math.max(...readings, limit) + (metric === 'temperature' ? 0.25 : 2)
  const y = (value: number) => 62 - ((value - min) / (max - min)) * 50
  const points = readings
    .map((value, index) => `${8 + (index / (readings.length - 1)) * 244},${y(value)}`)
    .join(' ')
  const latest = readings.at(-1) ?? 0
  const warning = latest > limit
  const graphColor = warning
    ? 'var(--color-danger)'
    : metric === 'temperature'
      ? 'var(--color-sky)'
      : 'var(--color-violet)'

  return (
    <div className="mt-4 rounded-xl border border-line bg-night/60 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex rounded-md border border-line bg-surface p-0.5">
            {(['temperature', 'humidity'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMetric(option)}
                className={`rounded px-2 py-1 font-mono text-[7.5px] font-semibold uppercase ${
                  metric === option ? 'bg-pill text-fg' : 'text-muted hover:text-fg'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <span className="mt-1.5 block text-[8px] text-muted">{sensor.location} · last 24 hours</span>
        </div>
        <span className={`flex items-center gap-1.5 font-mono text-[13px] font-bold ${warning ? 'text-danger' : 'text-ok'}`}>
          <span className={`relative size-1.5 rounded-full ${warning ? 'bg-danger' : 'bg-ok'}`}>
            <span className={`ping-soft absolute inset-0 rounded-full ${warning ? 'bg-danger' : 'bg-ok'}`} />
          </span>
          {latest.toFixed(1)}{unit}
        </span>
      </div>
      <svg viewBox="0 0 260 70" preserveAspectRatio="none" className="mt-2 h-[64px] w-full" role="img" aria-label={`Live ${metric} graph for ${sensor.name}, currently ${latest.toFixed(1)} ${unit}`}>
        {[12, 37, 62].map((lineY) => (
          <line key={lineY} x1="8" y1={lineY} x2="252" y2={lineY} stroke="var(--color-line)" strokeWidth="1" />
        ))}
        <line x1="8" y1={y(limit)} x2="252" y2={y(limit)} stroke="var(--color-danger)" strokeWidth="1" strokeDasharray="4 4" opacity="0.55" />
        <polygon points={`8,62 ${points} 252,62`} fill={graphColor} opacity="0.08" />
        <polyline points={points} fill="none" stroke={graphColor} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="252" cy={y(latest)} r="3" fill={graphColor} />
        <text x="250" y={Math.max(8, y(limit) - 4)} textAnchor="end" className="fill-danger font-mono text-[7px]">
          {metric === 'temperature' ? '4°C LIMIT' : '90% LIMIT'}
        </text>
      </svg>
    </div>
  )
}

function Detail({ icon: Icon, label, value }: { icon: typeof Thermometer; label: string; value: string }) {
  return <div className="rounded-lg border border-line p-2.5"><Icon className="size-3.5 text-muted" /><p className="mt-2 font-mono text-[7.5px] uppercase text-muted">{label}</p><p className="mt-1 font-mono text-[10px] font-semibold text-fg">{value}</p></div>
}

type DecisionFilter = 'all' | 'priority' | 'risk'

export function DecisionsView({ onOpenQueue }: { onOpenQueue: () => void }) {
  const { stocks } = useInventory()
  const [filter, setFilter] = useState<DecisionFilter>('all')
  const products = useMemo(() => stocks.filter((batch) => filter === 'all' || (filter === 'priority' ? Boolean(batch.recommendation) : Boolean(batch.breach))), [filter, stocks])
  const counts = { all: stocks.length, priority: stocks.filter((b) => b.recommendation).length, risk: stocks.filter((b) => b.breach).length }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ViewHeading eyebrow="Decision workspace" title="Product Expiration & Priority Decisions" detail="Review every product, compare estimated expiration against printed dates, and isolate priority or at-risk inventory for manager action." />
      <section className={`${card} flex min-h-0 flex-1 flex-col overflow-hidden p-5`}>
        <div className="flex items-center">
          <div className="flex rounded-lg border border-line bg-night p-1">
            {(['all', 'priority', 'risk'] as const).map((key) => (
              <button key={key} type="button" onClick={() => setFilter(key)} className={`flex h-8 items-center gap-2 rounded-md px-3 text-[9.5px] font-semibold capitalize ${filter === key ? 'bg-pill text-fg' : 'text-muted hover:text-fg'}`}>
                {key === 'risk' ? 'Temp breach' : key === 'priority' ? 'Pending decision' : key}<span className={`rounded px-1.5 py-0.5 font-mono text-[8px] ${filter === key ? 'bg-sky/15 text-sky' : 'bg-white/[0.04]'}`}>{counts[key]}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={onOpenQueue} className="ml-auto flex h-9 items-center gap-2 rounded-lg bg-sky px-4 text-[10px] font-bold text-night hover:brightness-105">
            Open decision board <ArrowRight className="size-3.5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-[1.2fr_0.8fr_1fr_1fr_90px_1.2fr] gap-3 border-b border-line px-3 pb-2 font-mono text-[8.5px] uppercase tracking-[0.06em] text-muted">
          <span>Product</span><span>Location</span><span>Printed expiration</span><span>Estimated expiration</span><span>RUL</span><span>Decision status</span>
        </div>
        <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {products.map((batch) => <ProductRow key={batch.key} batch={batch} />)}
        </div>
      </section>
    </div>
  )
}

function ProductRow({ batch }: { batch: StockRecord }) {
  const lost = batch.staticHours - batch.dynamicHours
  const critical = batch.breach === 'critical'
  return (
    <div className="grid h-[72px] grid-cols-[1.2fr_0.8fr_1fr_1fr_90px_1.2fr] items-center gap-3 px-3 hover:bg-white/[0.02]">
      <span><strong className="block text-[11px] text-fg">{batch.product}</strong><small className="font-mono text-[8.5px] text-muted">{batch.id} · {batch.units} units</small></span>
      <span className="text-[9.5px] text-muted">{batch.zone}</span>
      <span className="font-mono text-[9.5px] text-muted">{fmtDate(batch.printedExpiry)}</span>
      <span className={`font-mono text-[9.5px] font-semibold ${batch.breach ? 'text-warn' : 'text-fg'}`}>{fmtDate(batch.predictedExpiry)}<small className="mt-1 block text-[8px] font-normal text-danger">{lost > 4 ? `${lost}h earlier` : 'On track'}</small></span>
      <span className={`font-mono text-[13px] font-bold ${critical ? 'text-danger' : batch.breach ? 'text-warn' : 'text-ok'}`}>{batch.dynamicHours}h</span>
      <span className="flex items-center gap-2"><span className={`grid size-7 place-items-center rounded-lg ${batch.action === 'dispatch' ? 'bg-sky/10 text-sky' : batch.action === 'audit' ? 'bg-danger/10 text-danger' : 'bg-warn/10 text-warn'}`}>{batch.action === 'dispatch' ? <Truck className="size-3.5" /> : batch.action === 'audit' ? <AlertTriangle className="size-3.5" /> : <Clock3 className="size-3.5" />}</span><span className="text-[9px] leading-tight text-fg/80">{batch.rec}</span></span>
    </div>
  )
}

type AuditRow = Schemas['AuditOut']
const actionTone: Record<string, string> = {
  create: 'bg-ok/10 text-ok',
  update: 'bg-sky/10 text-sky',
  delete: 'bg-danger/10 text-danger',
  approve: 'bg-ok/10 text-ok',
  reject: 'bg-warn/10 text-warn',
}
const changeSummary = (row: AuditRow) => {
  const fields = Object.keys({ ...(row.before ?? {}), ...(row.after ?? {}) }).filter((k) => !['id', 'created_at', 'updated_at', 'deleted_at'].includes(k))
  if (row.action !== 'update') return fields.length ? `${fields.length} fields` : ''
  return fields.map((k) => `${k}: ${String(row.before?.[k] ?? '—')} → ${String(row.after?.[k] ?? '—')}`).join(' · ')
}

export function HistoryView() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [entity, setEntity] = useState('All')
  const [error, setError] = useState('')
  const { stocks } = useInventory() // re-fetch whenever the polled data changes

  useEffect(() => {
    const q = entity === 'All' ? '' : `&entity=${entity.toLowerCase()}`
    api<{ items: AuditRow[] }>(`/audit-log?limit=100${q}`)
      .then((page) => { setRows(page.items); setError('') })
      .catch((e) => setError(errorText(e)))
  }, [entity, stocks])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ViewHeading eyebrow="Audit trail" title="Change History" detail="Every create, edit, delete, approval and rejection, newest first. Deleted records stay here." />
      <section className={`${card} flex min-h-0 flex-1 flex-col overflow-hidden p-5`}>
        <div className="flex items-center gap-3">
          <Dropdown label="Filter by record type" value={entity} options={['All', 'Batch', 'Device', 'Recommendation']} onChange={setEntity} />
          <span className="font-mono text-[9px] text-muted">{rows.length} changes</span>
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[10px] font-semibold text-danger">{error}</p>}
        <div className="mt-4 grid grid-cols-[120px_90px_150px_120px_minmax(0,1fr)] gap-3 border-b border-line px-3 pb-2 font-mono text-[8.5px] uppercase tracking-[0.06em] text-muted">
          <span>When</span><span>Action</span><span>Record</span><span>By</span><span>Change</span>
        </div>
        <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {rows.length === 0 && !error && (
            <div className="grid h-[200px] place-items-center text-center">
              <div>
                <History className="mx-auto size-6 text-muted" />
                <p className="mt-3 text-[11px] font-semibold text-fg">No changes yet</p>
                <p className="mt-1 text-[9.5px] text-muted">Edits, deletes and decisions will appear here.</p>
              </div>
            </div>
          )}
          {rows.map((row) => (
            <div key={row.id} className="grid min-h-[44px] grid-cols-[120px_90px_150px_120px_minmax(0,1fr)] items-center gap-3 px-3 py-2">
              <span className="font-mono text-[9.5px] text-muted">{fmtDate(row.ts)}</span>
              <span className={`w-fit rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold capitalize ${actionTone[row.action] ?? 'text-muted'}`}>{row.action}</span>
              <span className="text-[10px] text-fg"><span className="capitalize">{row.entity}</span> <span className="font-mono text-muted">#{row.entity_id}</span></span>
              <span className="font-mono text-[9.5px] text-muted">{row.user}</span>
              <span className="break-words text-[9.5px] text-fg/80">{changeSummary(row)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
