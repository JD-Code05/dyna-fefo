import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Eye, Flag, Search, ShieldAlert, Truck, Undo2, X } from 'lucide-react'
import { Checkbox } from './ui'
import {
  HIGH_VALUE,
  isPriorityDispatchCandidate,
  temperatureSeries,
  type Action,
  type DispatchBatch,
} from '../data/dispatch'
import { useInventory } from '../data/InventoryContext'

type Filter = 'all' | 'breached' | 'high'
type Status = 'confirmed' | 'reviewed' | 'audit'

const COLS = 'grid-cols-[18px_190px_170px_190px_minmax(0,1fr)_210px]'
const LIMIT = 5 // °C chill-chain ceiling

const actionMeta: Record<
  Action,
  { label: string; done: Status; button: string; icon: typeof Truck; iconTone: string }
> = {
  dispatch: {
    label: 'Confirm FEFO Dispatch',
    done: 'confirmed',
    button: 'bg-sky/10 text-sky ring-1 ring-inset ring-sky/20 hover:bg-sky/15',
    icon: Truck,
    iconTone: 'bg-sky/12 text-sky',
  },
  review: {
    label: 'Review Risk Details',
    done: 'reviewed',
    button: 'bg-warn/10 text-warn ring-1 ring-inset ring-warn/20 hover:bg-warn/15',
    icon: Eye,
    iconTone: 'bg-warn/12 text-warn',
  },
  audit: {
    label: 'Reject / Manual Audit',
    done: 'audit',
    button: 'text-danger ring-1 ring-inset ring-danger/60 hover:bg-danger/10',
    icon: ShieldAlert,
    iconTone: 'bg-danger/15 text-danger',
  },
}

const statusLabel: Record<Status, string> = {
  confirmed: 'Dispatch confirmed',
  reviewed: 'Risk reviewed',
  audit: 'Sent to audit',
}

const money = (n: number) => `$${n.toLocaleString('en-US')}`

export default function DispatchQueueModal({ onClose }: { onClose: () => void }) {
  const { stocks } = useInventory()
  const atRiskBatches = useMemo(
    () => stocks.filter(isPriorityDispatchCandidate),
    [stocks],
  )
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>(['B-409', 'G-218'])
  const [statuses, setStatuses] = useState<Record<string, Status>>({})
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const counts = {
    all: atRiskBatches.length,
    breached: atRiskBatches.filter((b) => b.breach).length,
    high: atRiskBatches.filter((b) => b.value >= HIGH_VALUE).length,
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return atRiskBatches.filter((b) => {
      if (filter === 'breached' && !b.breach) return false
      if (filter === 'high' && b.value < HIGH_VALUE) return false
      if (!q) return true
      return [b.id, b.product, b.zone, b.rec].some((f) => f.toLowerCase().includes(q))
    })
  }, [atRiskBatches, filter, query])

  const pendingRows = rows.filter((r) => !statuses[r.id])
  const selectedPending = selected.filter((id) => !statuses[id])
  const selectedBatches = atRiskBatches.filter((b) => selectedPending.includes(b.id))
  const allVisibleSelected = pendingRows.length > 0 && pendingRows.every((r) => selected.includes(r.id))
  const someVisibleSelected = pendingRows.some((r) => selected.includes(r.id))
  const atRisk = atRiskBatches.filter((b) => !statuses[b.id]).reduce((s, b) => s + b.value, 0)

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const toggleAll = () =>
    setSelected((s) =>
      allVisibleSelected
        ? s.filter((id) => !pendingRows.some((r) => r.id === id))
        : [...new Set([...s, ...pendingRows.map((r) => r.id)])],
    )
  const resolve = (ids: string[], status?: Status) => {
    setStatuses((st) => {
      const next = { ...st }
      for (const id of ids) {
        const b = atRiskBatches.find((x) => x.id === id)
        if (b) next[id] = status ?? actionMeta[b.action].done
      }
      return next
    })
    setSelected((s) => s.filter((id) => !ids.includes(id)))
  }
  const undo = (id: string) =>
    setStatuses((st) => {
      const next = { ...st }
      delete next[id]
      return next
    })

  return (
    <div
      className="absolute inset-0 z-50 grid place-items-center bg-night/75 backdrop-blur-[4px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispatch-title"
        className="rise-in flex h-[700px] w-[1200px] flex-col overflow-hidden rounded-[18px] bg-surface text-fg shadow-[0_30px_80px_-24px_rgb(0_0_0/0.6)] ring-1 ring-line"
      >
        {/* Header */}
        <header className="shrink-0 px-6 pt-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                <span className="size-1.5 rounded-full bg-warn/80" />
                Live Perishable Inventory Risk
              </p>
              <h2
                id="dispatch-title"
                className="mt-2 text-[24px] font-bold leading-none tracking-[-0.012em]"
              >
                At-Risk Product Register
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Stat label="To review" value={String(atRiskBatches.length - Object.keys(statuses).length)} />
              <Stat label="Breached" value={String(counts.breached)} tone="text-danger" />
              <Stat label="Value at risk" value={money(atRisk)} tone="text-warn" />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dispatch verification"
                className="ml-2 grid size-11 place-items-center rounded-full bg-white/[0.06] text-white/80 transition hover:bg-white/10 hover:text-fg"
              >
                <X className="size-5" strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <div role="tablist" aria-label="Queue filters" className="flex gap-1 rounded-lg border border-line bg-night/60 p-1">
              {(
                [
                  ['all', 'All At-Risk'],
                  ['breached', 'Temp Breaches'],
                  ['high', 'High Value'],
                ] as const
              ).map(([key, label]) => {
                const on = filter === key
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setFilter(key)}
                    className={`flex h-8 items-center gap-2 rounded-md pl-3 pr-2 text-[11.5px] font-semibold transition-colors ${
                      on ? 'bg-pill text-fg' : 'text-muted hover:bg-white/[0.04] hover:text-fg'
                    }`}
                  >
                    {key === 'breached' && (
                      <span className={`size-2 rounded-full ${on ? 'bg-danger' : 'bg-danger/80'}`} />
                    )}
                    {label}
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                        on ? 'bg-night/10' : 'bg-white/[0.08] text-white/60'
                      }`}
                    >
                      {counts[key]}
                    </span>
                  </button>
                )
              })}
            </div>

            <label className="ml-auto flex h-10 w-[340px] items-center gap-2.5 rounded-lg bg-night/60 px-3 ring-1 ring-inset ring-line focus-within:ring-sky/40">
              <Search className="size-4 shrink-0 text-muted" strokeWidth={2.2} />
              <span className="sr-only">Search batches</span>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search product, batch, zone, risk signal..."
                className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-white/35"
              />
              {query ? (
                <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="text-muted hover:text-fg">
                  <X className="size-4" />
                </button>
              ) : (
                <span className="font-mono text-[9px] text-muted">Updated now</span>
              )}
            </label>
          </div>
        </header>

        {/* Column headings */}
        <div
          className={`mx-6 mt-4 grid shrink-0 ${COLS} items-center gap-x-3.5 border-b border-line px-4 pb-2.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.05em] whitespace-nowrap text-muted`}
        >
          <Checkbox
            label="Select all visible pending batches"
            checked={allVisibleSelected}
            indeterminate={!allVisibleSelected && someVisibleSelected}
            onChange={toggleAll}
            disabled={pendingRows.length === 0}
          />
          <span>Batch ID &amp; Product</span>
          <span>Sensor Telemetry 24h</span>
          <span>Static Expiry vs Dynamic RUL</span>
          <span>Risk Signal &amp; Recommendation</span>
          <span>Review Status</span>
        </div>

        {/* Rows */}
        <ul
          className="no-scrollbar mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-6 pb-6"
          style={{ maskImage: 'linear-gradient(to bottom, #000 calc(100% - 36px), transparent)' }}
        >
          {rows.map((b) => (
            <Row
              key={b.id}
              batch={b}
              selected={selected.includes(b.id)}
              status={statuses[b.id]}
              onToggle={() => toggle(b.id)}
              onPrimary={() => resolve([b.id])}
              onAudit={() => resolve([b.id], 'audit')}
              onUndo={() => undo(b.id)}
            />
          ))}
          {rows.length === 0 && (
            <li className="grid flex-1 place-items-center rounded-2xl border border-dashed border-white/10 py-16 text-center text-[13px] text-muted">
              No batches match “{query}” in this view.
            </li>
          )}
        </ul>

        {/* Bulk action bar */}
        <footer className="mx-4 mb-4 flex h-[60px] shrink-0 items-center gap-4 rounded-[18px] bg-raised pl-5 pr-2.5 ring-1 ring-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-sky/10 font-mono text-[12px] font-bold text-sky ring-1 ring-inset ring-sky/20">
              {selectedPending.length}
            </span>
            <div className="leading-tight">
              <p className="text-[12.5px] font-semibold">
                {selectedPending.length ? 'Products selected' : 'No products selected'}
              </p>
              <p className="font-mono text-[10.5px] text-muted">
                {selectedBatches.length ? selectedBatches.map((b) => b.id).join(' · ') : 'Select rows for risk review'}
              </p>
            </div>
          </div>
          <span className="h-8 w-px bg-white/10" />
          <p className="font-mono text-[11px] text-muted">
            Est. loss prevented{' '}
            <span className="font-bold text-ok">{money(selectedBatches.reduce((s, b) => s + b.saves, 0))}</span>
          </p>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={!selectedPending.length}
              onClick={() => setSelected([])}
              className="h-10 rounded-full px-4 text-[12.5px] font-semibold text-white/60 hover:text-fg disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={!selectedPending.length}
              onClick={() => resolve(selectedPending, 'audit')}
              className="flex h-10 items-center gap-2 rounded-full px-4 text-[12.5px] font-semibold text-fg/90 ring-1 ring-inset ring-white/15 hover:bg-white/5 disabled:opacity-40"
            >
              <Flag className="size-4" strokeWidth={2.2} />
              Send to Manual Audit
            </button>
            <button
              type="button"
              disabled={!selectedPending.length}
              onClick={() => resolve(selectedPending)}
              className="flex h-10 items-center gap-2 rounded-full bg-sky/10 px-5 text-[13px] font-bold text-sky ring-1 ring-inset ring-sky/20 transition hover:bg-sky/15 active:scale-[0.98] disabled:bg-white/10 disabled:text-muted disabled:ring-0"
            >
              <Check className="size-4" strokeWidth={2.8} />
              Mark Reviewed ({selectedPending.length})
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function Stat({ label, value, tone = 'text-fg' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3.5 py-2 ring-1 ring-inset ring-white/[0.06]">
      <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className={`mt-0.5 font-mono text-[15px] font-bold leading-none ${tone}`}>{value}</p>
    </div>
  )
}

function Row({
  batch: b,
  selected,
  status,
  onToggle,
  onPrimary,
  onAudit,
  onUndo,
}: {
  batch: DispatchBatch
  selected: boolean
  status?: Status
  onToggle: () => void
  onPrimary: () => void
  onAudit: () => void
  onUndo: () => void
}) {
  const meta = actionMeta[b.action]
  const RecIcon = meta.icon
  const gap = Math.round(((b.dynamicHours - b.staticHours) / b.staticHours) * 100)
  const surface = 'bg-raised/45 ring-line'
  const accent = b.breach === 'critical' ? 'bg-danger/75' : b.breach === 'spike' ? 'bg-warn/75' : 'bg-muted/30'
  const gapTone =
    gap <= -35
      ? 'bg-danger/10 text-danger ring-1 ring-inset ring-danger/20'
      : gap <= -15
        ? 'bg-warn/10 text-warn ring-1 ring-inset ring-warn/20'
        : 'bg-white/[0.04] text-muted'

  return (
    <li
      className={`relative grid shrink-0 ${COLS} min-h-[60px] items-center gap-x-3.5 rounded-xl px-4 py-2.5 ring-1 ring-inset transition ${surface} ${
        selected ? '!ring-sky/40 bg-sky/[0.025]' : ''
      } ${status ? 'opacity-50' : ''}`}
    >
      <span className={`absolute inset-y-2.5 left-0 w-[3px] rounded-r-full ${accent}`} aria-hidden />
      <Checkbox
        label={`Select batch ${b.id}`}
        checked={selected && !status}
        onChange={onToggle}
        disabled={!!status}
      />

      {/* Batch */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] font-bold text-muted">#{b.id}</span>
          {b.breach && (
            <span
              className={`rounded-full px-1.5 py-px font-mono text-[8.5px] font-bold uppercase tracking-[0.06em] ${
                b.breach === 'critical'
                  ? 'bg-danger/10 text-danger ring-1 ring-inset ring-danger/20'
                  : 'bg-warn/10 text-warn ring-1 ring-inset ring-warn/20'
              }`}
            >
              {b.breach === 'critical' ? 'Breach' : 'Spike'}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[13.5px] font-bold">{b.product}</p>
        <p className="truncate font-mono text-[10px] text-muted">
          {b.zone} · {b.units}u · {money(b.value)}
        </p>
      </div>

      {/* Telemetry */}
      <div className="flex items-center gap-3">
        <Sparkline batch={b} />
        <div className="font-mono text-[10.5px] leading-[1.45]">
          <p className="text-muted">
            Avg <span className="font-semibold text-fg/90">{b.avgTemp.toFixed(1)}°C</span>
          </p>
          <p className="text-muted">
            Peak{' '}
            <span
              className={`font-bold ${
                b.breach === 'critical' ? 'text-danger' : b.breach === 'spike' ? 'text-warn' : 'text-fg/90'
              }`}
            >
              {b.peakTemp.toFixed(1)}°C
            </span>
          </p>
        </div>
      </div>

      {/* Static vs dynamic */}
      <div>
        <div className="flex items-baseline justify-between font-mono text-[10.5px]">
          <span className="text-muted">
            Static <span className="text-white/65 line-through decoration-white/30">{Math.round(b.staticHours)}h</span>
          </span>
          <span className="text-muted">
            RUL <span className="font-bold text-fg">{b.dynamicHours}h</span>
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-l-full bg-sky" style={{ width: `${(b.dynamicHours / b.staticHours) * 100}%` }} />
            <div
              className={`h-full flex-1 ${gap <= -35 ? 'hatch-danger' : gap <= -15 ? 'hatch-warn' : 'hatch-muted'}`}
            />
          </div>
          <span className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold ${gapTone}`}>{gap}%</span>
        </div>
      </div>

      {/* Recommendation */}
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${meta.iconTone}`}>
          <RecIcon className="size-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="line-clamp-2 text-[12px] font-semibold leading-[1.3] text-fg/90">{b.rec}</p>
          <p className="mt-0.5 font-mono text-[10px] text-muted">
            Conf. {b.confidence}% · saves <span className="text-ok">{money(b.saves)}</span>
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5">
        {status ? (
          <>
            <span className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/[0.07] text-[12px] font-bold text-fg/90">
              <Check className="size-3.5 text-ok" strokeWidth={3} />
              {statusLabel[status]}
            </span>
            <button
              type="button"
              onClick={onUndo}
              aria-label={`Undo decision for ${b.id}`}
              title="Undo"
              className="grid size-9 shrink-0 place-items-center rounded-full text-white/60 ring-1 ring-inset ring-white/15 hover:bg-white/5 hover:text-fg"
            >
              <Undo2 className="size-4" strokeWidth={2.2} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onPrimary}
              className={`h-9 flex-1 whitespace-nowrap rounded-full px-3 text-[12px] font-bold transition active:scale-[0.98] ${meta.button}`}
            >
              {meta.label}
            </button>
            {b.action !== 'audit' && (
              <button
                type="button"
                onClick={onAudit}
                aria-label={`Reject ${b.id} and send to manual audit`}
                title="Reject / Manual Audit"
                className="grid size-9 shrink-0 place-items-center rounded-full text-white/60 ring-1 ring-inset ring-white/15 hover:bg-white/5 hover:text-danger"
              >
                <Flag className="size-4" strokeWidth={2.2} />
              </button>
            )}
          </>
        )}
      </div>
    </li>
  )
}

function Sparkline({ batch }: { batch: DispatchBatch }) {
  const W = 72
  const H = 30
  const series = temperatureSeries(batch)
  const y = (t: number) => H - 3 - (Math.min(Math.max(t, 0), 10) / 10) * (H - 6)
  const x = (i: number) => (i / (series.length - 1)) * W
  const d = series.map((t, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(t).toFixed(1)}`).join(' ')
  const peakIdx = series.indexOf(Math.max(...series))
  const color = batch.breach === 'critical' ? '#FF5C5C' : batch.breach === 'spike' ? '#F5A623' : '#8E929E'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 overflow-visible" aria-hidden>
      <rect x="0" y="0" width={W} height={y(LIMIT)} fill={color} fillOpacity="0.07" />
      <line x1="0" x2={W} y1={y(LIMIT)} y2={y(LIMIT)} stroke="#fff" strokeOpacity="0.25" strokeDasharray="2 2" />
      <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill={color} fillOpacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(peakIdx)} cy={y(series[peakIdx])} r="2.6" fill={color} stroke="#18191E" strokeWidth="1.2" />
    </svg>
  )
}
