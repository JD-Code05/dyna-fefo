import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BatteryMedium,
  Check,
  Clock3,
  Droplets,
  MapPin,
  Pencil,
  Radio,
  Search,
  Save,
  Thermometer,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import { type DispatchBatch } from '../data/dispatch'
import { useInventory, type SensorRecord, type StockRecord, type StockState } from '../data/InventoryContext'
import ShelfLifeComparisonBar from './ShelfLifeComparisonBar'
import { card, CardHint, CardTitle, Dropdown } from './ui'

const tempData = [3.2, 3.4, 3.3, 3.8, 4.1, 3.9, 3.6]
const humidityData = [82, 84, 83, 80, 78, 81, 80]
const rulData = [74, 69, 64, 60, 57, 54, 52]
const expirationDate = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000)
const expirationDateLabel = (hours: number) => {
  return expirationDate(hours).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}
const expirationLabel = (hours: number) => {
  const date = expirationDate(hours)
  return `${date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} · ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}
const weekLabels = Array.from({ length: 7 }, (_, index) => {
  const date = new Date()
  date.setDate(date.getDate() - (6 - index))
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
})

export function ManagerDecisionsCard({ onOpenQueue }: { onOpenQueue: () => void }) {
  const [approved, setApproved] = useState<string[]>([])
  const decisions = [
    { id: 'B-409', label: 'Expedite strawberries to Metro Hub', tone: 'text-danger' },
    { id: 'S-377', label: 'Move salmon into dispatch wave 1', tone: 'text-warn' },
  ]

  return (
    <section className={`${card} flex h-full flex-col p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="text-[13px]">Manager Decisions</CardTitle>
          <CardHint>Actions awaiting supervisor approval</CardHint>
        </div>
        <button type="button" onClick={onOpenQueue} className="text-[10px] font-semibold text-sky hover:text-fg">
          Review all
        </button>
      </div>
      <div className="mt-2 divide-y divide-line">
        {decisions.map((decision) => {
          const done = approved.includes(decision.id)
          return (
            <div key={decision.id} className="flex items-center gap-2 py-2">
              <span className={`font-mono text-[9px] font-semibold ${decision.tone}`}>{decision.id}</span>
              <p className="min-w-0 flex-1 truncate text-[9.5px] text-fg/80">{decision.label}</p>
              <button
                type="button"
                onClick={() => setApproved((items) => (items.includes(decision.id) ? items : [...items, decision.id]))}
                className={`grid size-6 place-items-center rounded-md border ${
                  done ? 'border-ok/30 bg-ok/10 text-ok' : 'border-line text-muted hover:text-fg'
                }`}
                aria-label={`Approve ${decision.label}`}
              >
                <Check className="size-3" strokeWidth={2.5} />
              </button>
            </div>
          )
        })}
      </div>
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
}: {
  title: string
  hint: string
  data: number[]
  color: 'sky' | 'warn' | 'violet' | 'ok'
  unit: string
  stat: string
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
        <div className="absolute inset-x-0 bottom-0 grid grid-cols-7 font-mono text-[7.5px] uppercase text-muted">
          {weekLabels.map((label) => (
            <span key={label} className="text-center">{label}</span>
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
    <section className={`${card} flex min-h-0 flex-col overflow-hidden p-5`}>
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
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ViewHeading
        eyebrow="Warehouse analytics"
        title="Shelf-life & Environmental Analytics"
        detail="Review one full week of daily environmental and shelf-life trends alongside the current printed-versus-estimated expiration snapshot."
      />
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3">
        <ExpirationChart />
        <TrendCard title="Temperature Over Time" hint="Daily all-zone average · last 7 days" data={tempData} color="warn" stat="3.6" unit="°C TODAY" />
        <TrendCard title="Humidity Over Time" hint="Daily relative humidity · last 7 days" data={humidityData} color="sky" stat="80" unit="% RH TODAY" />
        <TrendCard title="Remaining Useful Life (RUL)" hint="Daily average RUL · last 7 days" data={rulData} color="violet" stat="52" unit="HRS TODAY" />
      </div>
    </div>
  )
}

type StockFilter = 'all' | StockState

export function StockOverviewView() {
  const { stocks, updateStock, deleteStock } = useInventory()
  const [editing, setEditing] = useState<StockRecord | null>(null)
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
  const totalValue = rows.reduce((sum, batch) => sum + batch.value, 0)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ViewHeading
        eyebrow="Inventory catalog"
        title="Stock Overview"
        detail="Search the complete stock catalog and filter inventory by warehouse location, identification number, item details, and current value."
      />

      <div className="grid grid-cols-3 gap-3">
        <SensorStat label="Stock items" value={String(rows.length)} hint="Matching inventory records" tone="text-fg" />
        <SensorStat label="Warehouse zones" value={String(new Set(rows.map((batch) => batch.zone)).size)} hint="Locations represented" tone="text-violet" />
        <SensorStat label="Stock value" value={`$${totalValue.toLocaleString('en-US')}`} hint="Value of filtered inventory" tone="text-ok" />
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
          <span>Value</span>
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
                    <strong className="block truncate text-[10px] text-fg">{batch.product}</strong>
                    <small className="block truncate text-[7.5px] text-muted">{batch.category}</small>
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
                  <span className="font-mono text-[9px] text-muted">{expirationDateLabel(batch.staticHours)}</span>
                  <span className="font-mono text-[10px] font-semibold text-fg">${batch.value.toLocaleString('en-US')}</span>
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditing(batch)}
                      aria-label={`Edit ${batch.product}`}
                      className="grid size-7 place-items-center rounded-md border border-line text-muted hover:text-sky"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteStock(batch.key)}
                      aria-label={`Delete ${batch.product}`}
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
      {editing && <StockEditor stock={editing} onClose={() => setEditing(null)} onSave={updateStock} />}
    </div>
  )
}

function StockEditor({
  stock,
  onClose,
  onSave,
}: {
  stock: StockRecord
  onClose: () => void
  onSave: (
    key: string,
    updates: Pick<StockRecord, 'product' | 'zone' | 'detail' | 'identifier' | 'units' | 'value'>,
  ) => void
}) {
  const [form, setForm] = useState({
    product: stock.product,
    zone: stock.zone,
    detail: stock.detail,
    identifier: stock.identifier,
    value: String(stock.value),
  })
  const setField = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-night/75 backdrop-blur-sm">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(stock.key, {
            product: form.product,
            zone: form.zone,
            detail: form.detail,
            identifier: form.identifier,
            units: stock.units,
            value: Number(form.value),
          })
          onClose()
        }}
        className="w-[560px] rounded-[18px] border border-line bg-surface p-6 shadow-[0_30px_90px_rgb(0_0_0/0.35)]"
      >
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-[16px]">Edit Stock Item</CardTitle>
            <CardHint>Changes update stock, movement, decisions, and dispatch views.</CardHint>
          </div>
          <button type="button" onClick={onClose} aria-label="Close stock editor" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/[0.04] hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <EditField label="Item name" value={form.product} onChange={(value) => setField('product', value)} />
          <EditField label="Identification number" value={form.identifier} onChange={(value) => setField('identifier', value)} />
          <EditField label="Location" value={form.zone} onChange={(value) => setField('zone', value)} />
          <EditField label="Detail" value={form.detail} onChange={(value) => setField('detail', value)} />
          <EditField label="Value" value={form.value} type="number" onChange={(value) => setField('value', value)} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-line px-4 text-[10.5px] font-semibold text-muted hover:text-fg">Cancel</button>
          <button type="submit" className="flex h-10 items-center gap-2 rounded-lg bg-sky px-4 text-[10.5px] font-bold text-night">
            <Save className="size-4" /> Save stock
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
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number'
}) {
  return (
    <label className="font-mono text-[8.5px] uppercase tracking-[0.07em] text-muted">
      {label}
      <input required type={type} min={type === 'number' ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-line bg-night px-3 font-sans text-[11px] normal-case tracking-normal text-fg outline-none focus:border-sky/50" />
    </label>
  )
}

export function StockView() {
  const { stocks } = useInventory()
  const [filter, setFilter] = useState<StockFilter>('all')
  const rows = stocks.filter((batch) => filter === 'all' || batch.activity.state === filter)
  const totalUnits = stocks.reduce((sum, batch) => sum + batch.units, 0)
  const movingUnits = stocks
    .filter((batch) => batch.activity.state === 'moving')
    .reduce((sum, batch) => sum + batch.units, 0)
  const atRiskUnits = stocks
    .filter((batch) => batch.breach)
    .reduce((sum, batch) => sum + batch.units, 0)
  const inventoryValue = stocks.reduce((sum, batch) => sum + batch.value, 0)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ViewHeading
        eyebrow="Inventory operations"
        title="Warehouse Stock"
        detail="Track every perishable batch, where it is located, its current condition, and what is happening to it across storage and dispatch."
      />

      <div className="grid grid-cols-4 gap-3">
        <SensorStat label="Stock on hand" value={totalUnits.toLocaleString('en-US')} hint="Units across active batches" tone="text-fg" />
        <SensorStat label="Currently moving" value={movingUnits.toLocaleString('en-US')} hint="Outbound or internal transfer" tone="text-sky" />
        <SensorStat label="Units at risk" value={atRiskUnits.toLocaleString('en-US')} hint="Requires priority attention" tone="text-danger" />
        <SensorStat label="Inventory value" value={`$${inventoryValue.toLocaleString('en-US')}`} hint="Current registered value" tone="text-ok" />
      </div>

      <section className={`${card} flex min-h-0 flex-1 flex-col overflow-hidden p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-[13px]">Stock Register</CardTitle>
            <CardHint>{rows.length} batches shown · live warehouse activity</CardHint>
          </div>
          <div className="flex rounded-lg border border-line bg-night p-1">
            {(['all', 'moving', 'dispatched', 'stored', 'hold', 'inspection'] as const).map((key) => {
              const count =
                key === 'all'
                  ? stocks.length
                  : stocks.filter((batch) => batch.activity.state === key).length
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[9px] font-semibold capitalize ${
                    filter === key ? 'bg-pill text-fg' : 'text-muted hover:text-fg'
                  }`}
                >
                  {key}
                  <span className={`rounded px-1 py-0.5 font-mono text-[7.5px] ${filter === key ? 'bg-sky/15 text-sky' : 'bg-white/[0.04]'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[1.25fr_0.85fr_0.75fr_0.8fr_1.15fr_70px] gap-3 border-b border-line px-3 pb-2 font-mono text-[8.5px] uppercase tracking-[0.06em] text-muted">
          <span>Stock item &amp; details</span>
          <span>Current location</span>
          <span>Quantity &amp; value</span>
          <span>Condition</span>
          <span>Current activity</span>
          <span>Updated</span>
        </div>

        <div className="dashboard-scroll min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {rows.map((batch) => (
            <StockRow key={batch.key} batch={batch} activity={batch.activity} />
          ))}
        </div>
      </section>
    </div>
  )
}

function StockRow({
  batch,
  activity,
}: {
  batch: DispatchBatch
  activity: StockRecord['activity']
}) {
  const condition =
    batch.breach === 'critical'
      ? { label: 'Critical', tone: 'text-danger', dot: 'bg-danger' }
      : batch.breach === 'spike'
        ? { label: 'At risk', tone: 'text-warn', dot: 'bg-warn' }
        : { label: 'Good', tone: 'text-ok', dot: 'bg-ok' }

  return (
    <div className="grid h-[48px] grid-cols-[1.25fr_0.85fr_0.75fr_0.8fr_1.15fr_70px] items-center gap-3 px-3 transition-colors hover:bg-white/[0.02]">
      <span className="min-w-0">
        <strong className="block truncate text-[10px] text-fg">{batch.product}</strong>
        <small className="block font-mono text-[7.5px] text-muted">
          Batch {batch.id} · {batch.staticHours}h printed life
        </small>
      </span>

      <span className="flex items-start gap-1.5 text-[9px] leading-tight text-muted">
        <MapPin className="mt-0.5 size-3 shrink-0 text-sky" />
        {batch.zone}
      </span>

      <span>
        <strong className="block font-mono text-[10px] text-fg">{batch.units} units</strong>
        <small className="font-mono text-[8px] text-muted">${batch.value.toLocaleString('en-US')}</small>
      </span>

      <span>
        <span className={`flex items-center gap-1.5 font-mono text-[9px] font-semibold ${condition.tone}`}>
          <i className={`size-1.5 rounded-full ${condition.dot}`} />
          {condition.label}
        </span>
        <small className="mt-1 block font-mono text-[8px] text-muted">{batch.dynamicHours}h RUL</small>
      </span>

      <ActivityStatus activity={activity} />
      <span className="font-mono text-[8px] text-muted">{activity.updated}</span>
    </div>
  )
}

function ActivityStatus({ activity }: { activity: StockRecord['activity'] }) {
  const meta = {
    moving: { text: 'text-sky', dot: 'bg-sky' },
    dispatched: { text: 'text-ok', dot: 'bg-ok' },
    stored: { text: 'text-violet', dot: 'bg-violet' },
    hold: { text: 'text-danger', dot: 'bg-danger' },
    inspection: { text: 'text-warn', dot: 'bg-warn' },
  }[activity.state]

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className={`size-1.5 shrink-0 rounded-full ${meta.dot}`} />
      <span className="min-w-0">
        <strong className={`block truncate text-[8.5px] ${meta.text}`}>{activity.label}</strong>
        <small className="block truncate text-[7.5px] text-muted">{activity.detail}</small>
      </span>
    </span>
  )
}

export function SensorsView() {
  const { sensors, updateSensor, deleteSensor } = useInventory()
  const [selectedKey, setSelectedKey] = useState(sensors[0]?.key ?? '')
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredSensors = sensors.filter((sensor) =>
    !normalizedQuery ||
    [sensor.name, sensor.id, sensor.location, sensor.status].some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    ),
  )
  const selected = sensors.find((sensor) => sensor.key === selectedKey) ?? sensors[0]
  const removeSensor = (key: string) => {
    if (key === selectedKey) {
      setSelectedKey(sensors.find((sensor) => sensor.key !== key)?.key ?? '')
    }
    deleteSensor(key)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ViewHeading
        eyebrow="Sensor management"
        title="Environmental Sensor Registry"
        detail="Review every sensor’s live temperature, humidity, battery, signal, location, and operating status. Select a row to edit its configuration."
      />
      <div className="grid grid-cols-4 gap-3">
        <SensorStat label="Total sensors" value={String(sensors.length)} hint={`Across ${new Set(sensors.map((sensor) => sensor.location)).size} warehouse zones`} tone="text-fg" />
        <SensorStat label="Online" value={String(sensors.filter((sensor) => sensor.status === 'Online').length)} hint="Reporting normally" tone="text-ok" />
        <SensorStat label="Warnings" value={String(sensors.filter((sensor) => sensor.status === 'Warning').length)} hint="Drift or low signal" tone="text-warn" />
        <SensorStat label="Critical" value={String(sensors.filter((sensor) => sensor.status === 'Critical').length)} hint="Temperature breach" tone="text-danger" />
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
              <span>Sensor</span><span>Location</span><span>Temp</span><span>Humidity</span><span>Battery</span><span>Status</span>
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
                      <strong className="min-w-0 flex-1 truncate text-[9.5px] leading-none text-fg">{sensor.name}</strong>
                      <small className="shrink-0 rounded bg-pill px-1 py-0.5 font-mono text-[6.5px] leading-none text-muted">{sensor.id}</small>
                    </span>
                    <span className="flex items-center gap-1.5 truncate text-[9px] text-muted"><MapPin className="size-3" />{sensor.location}</span>
                    <span className={`font-mono text-[10px] font-semibold ${sensor.status === 'Critical' ? 'text-danger' : 'text-fg'}`}>{sensor.temperature}°C</span>
                    <span className="font-mono text-[9.5px] text-fg">{sensor.humidity}%</span>
                    <span className="font-mono text-[9.5px] text-fg">{sensor.battery}%</span>
                    <Status status={sensor.status} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSensor(sensor.key)}
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
          <SensorEditor key={selected.key} sensor={selected} onSave={updateSensor} />
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
  const tone = status === 'Critical' ? 'bg-danger/10 text-danger border-danger/25' : status === 'Warning' ? 'bg-warn/10 text-warn border-warn/25' : 'bg-ok/10 text-ok border-ok/25'
  return <span className={`w-fit rounded-full border px-1.5 py-0.5 font-mono text-[7.5px] font-semibold ${tone}`}>{status}</span>
}

function SensorEditor({
  sensor,
  onSave,
}: {
  sensor: SensorRecord
  onSave: (key: string, updates: Pick<SensorRecord, 'name' | 'id' | 'location'>) => void
}) {
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ name: sensor.name, id: sensor.id, location: sensor.location })
  const setField = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }))
  return (
    <section className={`${card} dashboard-scroll flex min-h-0 flex-col overflow-y-auto overscroll-contain p-5`}>
      <div className="flex items-center justify-between">
        <div><CardTitle className="text-[13px]">Sensor Details</CardTitle><CardHint>{sensor.id} · live configuration</CardHint></div>
        <Pencil className="size-4 text-sky" />
      </div>
      <label className="mt-5 font-mono text-[8.5px] uppercase tracking-[0.08em] text-muted">
        Sensor name
        <input value={form.name} onChange={(event) => setField('name', event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-line bg-night px-3 font-sans text-[11px] normal-case tracking-normal text-fg outline-none focus:border-sky/50" />
      </label>
      <label className="mt-4 font-mono text-[8.5px] uppercase tracking-[0.08em] text-muted">
        Sensor ID
        <input value={form.id} onChange={(event) => setField('id', event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-line bg-night px-3 font-sans text-[11px] normal-case tracking-normal text-fg outline-none focus:border-sky/50" />
      </label>
      <label className="mt-4 font-mono text-[8.5px] uppercase tracking-[0.08em] text-muted">
        Warehouse location
        <input value={form.location} onChange={(event) => setField('location', event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-line bg-night px-3 font-sans text-[11px] normal-case tracking-normal text-fg outline-none focus:border-sky/50" />
      </label>
      <RealtimeSensorGraph sensor={sensor} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Detail icon={Thermometer} label="Temperature" value={`${sensor.temperature}°C`} />
        <Detail icon={Droplets} label="Humidity" value={`${sensor.humidity}% RH`} />
        <Detail icon={BatteryMedium} label="Battery" value={`${sensor.battery}%`} />
        <Detail icon={Radio} label="Signal" value={`${sensor.signal} dBm`} />
      </div>
      <div className="mt-auto rounded-lg border border-line bg-night/50 p-3">
        <p className="font-mono text-[8px] uppercase tracking-[0.08em] text-muted">Current status</p>
        <div className="mt-2 flex items-center justify-between"><Status status={sensor.status} /><span className="font-mono text-[8px] text-muted">Updated 12 sec ago</span></div>
      </div>
      <button type="button" onClick={() => { onSave(sensor.key, form); setSaved(true); window.setTimeout(() => setSaved(false), 1200) }} className="mt-3 flex h-10 items-center justify-center gap-2 rounded-lg bg-sky text-[10.5px] font-bold text-night hover:brightness-105">
        {saved ? <Check className="size-4" /> : <Save className="size-4" />}{saved ? 'Changes saved' : 'Save sensor'}
      </button>
    </section>
  )
}

function RealtimeSensorGraph({ sensor }: { sensor: SensorRecord }) {
  const [metric, setMetric] = useState<'temperature' | 'humidity'>('temperature')
  const [temperatureReadings, setTemperatureReadings] = useState(() =>
    Array.from({ length: 24 }, (_, index) => sensor.temperature + Math.sin(index * 0.72) * 0.18),
  )
  const [humidityReadings, setHumidityReadings] = useState(() =>
    Array.from({ length: 24 }, (_, index) => sensor.humidity + Math.cos(index * 0.58) * 1.2),
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTemperatureReadings((current) => [
        ...current.slice(1),
        sensor.temperature + Math.sin(Date.now() / 1700) * 0.16 + Math.cos(Date.now() / 900) * 0.06,
      ])
      setHumidityReadings((current) => [
        ...current.slice(1),
        sensor.humidity + Math.cos(Date.now() / 2100) * 1.1 + Math.sin(Date.now() / 1300) * 0.35,
      ])
    }, 1500)
    return () => window.clearInterval(timer)
  }, [sensor.humidity, sensor.temperature])

  const readings = metric === 'temperature' ? temperatureReadings : humidityReadings
  const limit = metric === 'temperature' ? 5 : 90
  const unit = metric === 'temperature' ? '°C' : '% RH'
  const min = Math.min(...readings, limit) - (metric === 'temperature' ? 0.25 : 2)
  const max = Math.max(...readings, limit) + (metric === 'temperature' ? 0.25 : 2)
  const y = (value: number) => 62 - ((value - min) / (max - min)) * 50
  const points = readings
    .map((value, index) => `${8 + (index / (readings.length - 1)) * 244},${y(value)}`)
    .join(' ')
  const latest = readings.at(-1) ?? (metric === 'temperature' ? sensor.temperature : sensor.humidity)
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
          <span className="mt-1.5 block text-[8px] text-muted">Live · last 60 seconds</span>
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
          {metric === 'temperature' ? '5°C LIMIT' : '90% LIMIT'}
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
  const products = useMemo(() => stocks.filter((batch) => filter === 'all' || (filter === 'priority' ? batch.action === 'dispatch' && batch.dynamicHours < 48 : Boolean(batch.breach))), [filter, stocks])
  const counts = { all: stocks.length, priority: stocks.filter((b) => b.action === 'dispatch' && b.dynamicHours < 48).length, risk: stocks.filter((b) => b.breach).length }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ViewHeading eyebrow="Decision workspace" title="Product Expiration & Priority Decisions" detail="Review every product, compare estimated expiration against printed dates, and isolate priority or at-risk inventory for manager action." />
      <section className={`${card} flex min-h-0 flex-1 flex-col overflow-hidden p-5`}>
        <div className="flex items-center">
          <div className="flex rounded-lg border border-line bg-night p-1">
            {(['all', 'priority', 'risk'] as const).map((key) => (
              <button key={key} type="button" onClick={() => setFilter(key)} className={`flex h-8 items-center gap-2 rounded-md px-3 text-[9.5px] font-semibold capitalize ${filter === key ? 'bg-pill text-fg' : 'text-muted hover:text-fg'}`}>
                {key === 'risk' ? 'At risk' : key}<span className={`rounded px-1.5 py-0.5 font-mono text-[8px] ${filter === key ? 'bg-sky/15 text-sky' : 'bg-white/[0.04]'}`}>{counts[key]}</span>
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
          {products.map((batch) => <ProductRow key={batch.id} batch={batch} />)}
        </div>
      </section>
    </div>
  )
}

function ProductRow({ batch }: { batch: DispatchBatch }) {
  const lost = batch.staticHours - batch.dynamicHours
  const critical = batch.breach === 'critical'
  return (
    <div className="grid h-[72px] grid-cols-[1.2fr_0.8fr_1fr_1fr_90px_1.2fr] items-center gap-3 px-3 hover:bg-white/[0.02]">
      <span><strong className="block text-[11px] text-fg">{batch.product}</strong><small className="font-mono text-[8.5px] text-muted">{batch.id} · {batch.units} units</small></span>
      <span className="text-[9.5px] text-muted">{batch.zone}</span>
      <span className="font-mono text-[9.5px] text-muted">{expirationLabel(batch.staticHours)}</span>
      <span className={`font-mono text-[9.5px] font-semibold ${batch.breach ? 'text-warn' : 'text-fg'}`}>{expirationLabel(batch.dynamicHours)}<small className="mt-1 block text-[8px] font-normal text-danger">{lost > 4 ? `${lost}h earlier` : 'On track'}</small></span>
      <span className={`font-mono text-[13px] font-bold ${critical ? 'text-danger' : batch.breach ? 'text-warn' : 'text-ok'}`}>{batch.dynamicHours}h</span>
      <span className="flex items-center gap-2"><span className={`grid size-7 place-items-center rounded-lg ${batch.action === 'dispatch' ? 'bg-sky/10 text-sky' : batch.action === 'audit' ? 'bg-danger/10 text-danger' : 'bg-warn/10 text-warn'}`}>{batch.action === 'dispatch' ? <Truck className="size-3.5" /> : batch.action === 'audit' ? <AlertTriangle className="size-3.5" /> : <Clock3 className="size-3.5" />}</span><span className="text-[9px] leading-tight text-fg/80">{batch.rec}</span></span>
    </div>
  )
}
