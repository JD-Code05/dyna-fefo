import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Eye, Flag, History, Search, ShieldAlert, Truck, X } from 'lucide-react'
import { Checkbox } from './ui'
import { actionTone } from './WorkspaceViews'
import { api, type Schemas } from '../api/client'
import { type Action } from '../data/dispatch'
import { useInventory, type StockRecord } from '../data/InventoryContext'

type Filter = 'all' | 'breached' | 'salvage' | 'history'
type AuditRow = Schemas['AuditOut']
type Status = 'confirmed' | 'reviewed' | 'audit'

const COLS = 'grid-cols-[18px_minmax(120px,190px)_minmax(150px,170px)_minmax(130px,190px)_minmax(120px,1fr)_210px]'
const LIMIT = 5 // °C chill-chain ceiling

const actionMeta: Record<
  Action,
  { label: string; done: Status; button: string; icon: typeof Truck; iconTone: string }
> = {
  dispatch: {
    label: 'Approve dispatch',
    done: 'confirmed',
    button: 'bg-accent text-night hover:brightness-105',
    icon: Truck,
    iconTone: 'bg-pill text-fg',
  },
  review: {
    label: 'Mark reviewed',
    done: 'reviewed',
    button: 'bg-warn/10 text-warn ring-1 ring-inset ring-warn/20 hover:bg-warn/15',
    icon: Eye,
    iconTone: 'bg-warn/12 text-warn',
  },
  audit: {
    label: 'Approve salvage',
    done: 'confirmed',
    button: 'text-danger ring-1 ring-inset ring-danger/60 hover:bg-danger/10',
    icon: ShieldAlert,
    iconTone: 'bg-danger/15 text-danger',
  },
}

const statusLabel: Record<Status, string> = {
  confirmed: 'Approved',
  reviewed: 'Reviewed',
  audit: 'Rejected',
}

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—'

export default function DispatchQueueModal({ onClose }: { onClose: () => void }) {
  const { stocks, decide } = useInventory()
  const atRiskBatches = useMemo(() => stocks.filter((b) => b.recommendation || b.breach), [stocks])
  // A batch can have a dispatch and a salvage recommendation; key decisions by recommendation.
  const rowKey = (b: StockRecord) => (b.recommendation ? `rec-${b.recommendation.id}` : b.id)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, Status>>({})
  const dialogRef = useRef<HTMLDivElement>(null)
  // Close plays the exit animation first; the modal unmounts when it ends (see onAnimationEnd).
  const [closing, setClosing] = useState(false)
  const close = () => {
    setClosing(true)
    window.setTimeout(onClose, 300) // fallback if animationend never fires (e.g. a throttled background tab)
  }
  const closeRef = useRef(close)
  closeRef.current = close
  const [history, setHistory] = useState<AuditRow[]>([])
  const [historyError, setHistoryError] = useState<string | null>(null)

  // Past approvals and rejections; refetched whenever the polled data changes, so a new decision shows up.
  useEffect(() => {
    api<{ items: AuditRow[] }>('/audit-log?limit=100&entity=recommendation')
      .then((page) => { setHistory(page.items); setHistoryError(null) })
      .catch((e) => setHistoryError((e as { message?: string }).message ?? 'Unable to load decision history'))
  }, [stocks])

  useEffect(() => {
    // Focus the dialog, not the search box: a focused input always shows its focus ring.
    dialogRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const counts = {
    all: atRiskBatches.length,
    breached: atRiskBatches.filter((b) => b.breach).length,
    salvage: atRiskBatches.filter((b) => b.recommendation?.type === 'SALVAGE').length,
    history: history.length,
  }

  const codeFor = (batchId: unknown) => stocks.find((b) => b.key === String(batchId))?.id ?? `batch #${batchId}`
  const decisions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return history
      .map((row) => {
        const rec = (row.after ?? row.before ?? {}) as Record<string, unknown>
        return {
          row,
          batch: codeFor(rec.batch_id),
          type: String(rec.type ?? '').replace('_', ' ').toLowerCase(),
          note: rec.decision_note ? String(rec.decision_note) : '',
        }
      })
      .filter((d) => !q || [d.batch, d.type, d.note, d.row.user, d.row.action].some((f) => f.toLowerCase().includes(q)))
  }, [history, query, stocks])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return atRiskBatches.filter((b) => {
      if (filter === 'breached' && !b.breach) return false
      if (filter === 'salvage' && b.recommendation?.type !== 'SALVAGE') return false
      if (!q) return true
      return [b.id, b.product, b.zone, b.rec].some((f) => f.toLowerCase().includes(q))
    })
  }, [atRiskBatches, filter, query])

  // Only rows with a recommendation can be decided; breach-only rows are shown for monitoring.
  const pendingRows = rows.filter((r) => r.recommendation && !statuses[rowKey(r)])
  const selectedPending = selected.filter((id) => { const b = atRiskBatches.find((x) => x.id === id); return b && !statuses[rowKey(b)] })
  const selectedBatches = atRiskBatches.filter((b) => selectedPending.includes(b.id))
  const allVisibleSelected = pendingRows.length > 0 && pendingRows.every((r) => selected.includes(r.id))
  const someVisibleSelected = pendingRows.some((r) => selected.includes(r.id))
  const atRiskUnits = atRiskBatches.filter((b) => !statuses[rowKey(b)]).reduce((s, b) => s + b.units, 0)

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const toggleAll = () =>
    setSelected((s) =>
      allVisibleSelected
        ? s.filter((id) => !pendingRows.some((r) => r.id === id))
        : [...new Set([...s, ...pendingRows.map((r) => r.id)])],
    )
  // Approve/reject is recorded by the backend (and in the change history); it cannot be undone.
  const resolve = async (ids: string[], status?: Status) => {
    setError(null)
    for (const id of ids) {
      const b = atRiskBatches.find((x) => x.id === id)
      if (!b) continue
      const done = status ?? actionMeta[b.action].done
      try {
        if (b.recommendation) await decide(b.recommendation.id, done === 'audit' ? 'reject' : 'approve')
        setStatuses((st) => ({ ...st, [rowKey(b)]: done }))
      } catch (e) {
        setError(`${b.id}: ${(e as { message?: string }).message ?? 'Unable to save the decision'}`)
      }
    }
    setSelected((s) => s.filter((id) => !ids.includes(id)))
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-night/75 backdrop-blur-[4px] ${closing ? 'backdrop-out' : 'backdrop-in'}`}
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        onAnimationEnd={(e) => e.target === e.currentTarget && closing && onClose()}
        aria-modal="true"
        aria-labelledby="dispatch-title"
        className={`${closing ? 'modal-out' : 'modal-in'} flex h-[700px] outline-none max-h-full w-[1200px] max-w-full flex-col overflow-hidden rounded-[18px] bg-surface text-fg shadow-[0_30px_80px_-24px_rgb(0_0_0/0.6)] ring-1 ring-line`}
      >
        {/* Header */}
        <header className="shrink-0 px-6 pt-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold text-muted">
                <span className="size-1.5 rounded-full bg-warn/80" />
                Live inventory risk
              </p>
              <h2
                id="dispatch-title"
                className="mt-2 text-2xl font-bold leading-none tracking-[-0.012em]"
              >
                At-risk product register
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Stat label="To review" value={String(atRiskBatches.filter((b) => !statuses[rowKey(b)]).length)} />
              <Stat label="Breached" value={String(counts.breached)} tone="text-danger" />
              <Stat label="Units at risk" value={String(atRiskUnits)} tone="text-warn" />
              <button
                type="button"
                onClick={close}
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
                  ['all', 'All at-risk'],
                  ['breached', 'Temp breaches'],
                  ['salvage', 'Salvage'],
                  ['history', 'History'],
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
                    className={`flex h-8 items-center gap-2 rounded-md pl-3 pr-2 text-xs font-semibold transition-colors ${
                      on ? 'bg-pill text-fg' : 'text-muted hover:bg-white/[0.04] hover:text-fg'
                    }`}
                  >
                    {key === 'breached' && (
                      <span className={`size-2 rounded-full ${on ? 'bg-danger' : 'bg-danger/80'}`} />
                    )}
                    {key === 'history' && <History className="size-3.5" strokeWidth={2.2} />}
                    {label}
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-xs font-bold ${
                        on ? 'bg-night/10' : 'bg-white/[0.08] text-white/60'
                      }`}
                    >
                      {counts[key]}
                    </span>
                  </button>
                )
              })}
            </div>

            <label className="ml-auto flex h-10 w-[340px] items-center gap-2.5 rounded-lg bg-night/60 px-3 ring-1 ring-inset ring-line focus-within:ring-accent/40">
              <Search className="size-4 shrink-0 text-muted" strokeWidth={2.2} />
              <span className="sr-only">Search batches</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={filter === 'history' ? 'Search batch, decision, note, user...' : 'Search product, batch, zone, risk signal...'}
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
              />
              {query ? (
                <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="text-muted hover:text-fg">
                  <X className="size-4" />
                </button>
              ) : (
                <span className="font-mono text-xs text-muted">Updated now</span>
              )}
            </label>
          </div>
        </header>

        {filter === 'history' ? (
          <div className="mx-6 mb-6 mt-4 flex min-h-0 flex-1 flex-col">
            <div className="grid shrink-0 grid-cols-[130px_100px_minmax(0,1fr)_150px] gap-x-3.5 border-b border-line px-4 pb-2.5 text-xs font-semibold text-muted">
              <span>When</span>
              <span>Decision</span>
              <span>Recommendation &amp; note</span>
              <span>By</span>
            </div>
            {historyError && (
              <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{historyError}</p>
            )}
            <ul className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
              {decisions.map(({ row, batch, type, note }) => (
                <li
                  key={row.id}
                  className="grid min-h-[52px] shrink-0 grid-cols-[130px_100px_minmax(0,1fr)_150px] items-center gap-x-3.5 rounded-xl bg-raised/45 px-4 py-2.5 ring-1 ring-inset ring-line"
                >
                  <span className="font-mono text-xs text-muted">{shortDate(row.ts)}</span>
                  <span className={`w-fit rounded-full px-2 py-0.5 font-mono text-xs font-semibold capitalize ${actionTone[row.action] ?? 'text-muted'}`}>
                    {row.action === 'approve' ? 'Approved' : row.action === 'reject' ? 'Rejected' : row.action}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold capitalize text-fg">
                      {type || 'recommendation'} <span className="font-mono normal-case text-muted">· {batch}</span>
                    </span>
                    {note && <span className="block break-words text-xs text-muted">“{note}”</span>}
                  </span>
                  <span className="truncate font-mono text-xs text-muted" title={row.user ?? undefined}>{row.user}</span>
                </li>
              ))}
              {decisions.length === 0 && !historyError && (
                <li className="grid flex-1 place-items-center rounded-2xl border border-dashed border-white/10 py-16 text-center text-sm text-muted">
                  {query ? `No decisions match “${query}”.` : 'No decisions yet. Approvals and rejections appear here.'}
                </li>
              )}
            </ul>
          </div>
        ) : (
        <>
        {/* Column headings */}
        <div
          className={`mx-6 mt-4 grid shrink-0 ${COLS} items-center gap-x-3.5 border-b border-line px-4 pb-2.5 text-xs font-semibold whitespace-nowrap text-muted`}
        >
          <Checkbox
            label="Select all visible pending batches"
            checked={allVisibleSelected}
            indeterminate={!allVisibleSelected && someVisibleSelected}
            onChange={toggleAll}
            disabled={pendingRows.length === 0}
          />
          <span>Batch &amp; product</span>
          <span>Temperature, last hour</span>
          <span>Printed vs sensor-adjusted life</span>
          <span>Recommendation</span>
          <span>Review status</span>
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
              status={statuses[rowKey(b)]}
              onToggle={() => toggle(b.id)}
              onPrimary={() => resolve([b.id])}
              onAudit={() => resolve([b.id], 'audit')}
            />
          ))}
          {rows.length === 0 && (
            <li className="grid flex-1 place-items-center rounded-2xl border border-dashed border-white/10 py-16 text-center text-sm text-muted">
              No batches match “{query}” in this view.
            </li>
          )}
        </ul>

        {/* Bulk action bar */}
        <footer className="mx-4 mb-4 flex h-[60px] shrink-0 items-center gap-4 rounded-[18px] bg-raised pl-5 pr-2.5 ring-1 ring-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-accent/10 font-mono text-xs font-bold text-accent ring-1 ring-inset ring-accent/20">
              {selectedPending.length}
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">
                {selectedPending.length ? 'Products selected' : 'No products selected'}
              </p>
              <p className="font-mono text-xs text-muted">
                {selectedBatches.length ? selectedBatches.map((b) => b.id).join(' · ') : 'Select rows for risk review'}
              </p>
            </div>
          </div>
          <span className="h-8 w-px bg-white/10" />
          <p role="status" className={`font-mono text-xs ${error ? 'text-danger' : 'text-muted'}`}>
            {error ?? `${selectedBatches.reduce((s, b) => s + b.units, 0)} units selected`}
          </p>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={!selectedPending.length}
              onClick={() => setSelected([])}
              className="h-10 rounded-full px-4 text-sm font-semibold text-white/60 hover:text-fg disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={!selectedPending.length}
              onClick={() => resolve(selectedPending, 'audit')}
              className="flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-fg/90 ring-1 ring-inset ring-white/15 hover:bg-white/5 disabled:opacity-40"
            >
              <Flag className="size-4" strokeWidth={2.2} />
              Reject selected
            </button>
            <button
              type="button"
              disabled={!selectedPending.length}
              onClick={() => resolve(selectedPending)}
              className="flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-bold text-night transition hover:brightness-105 active:scale-[0.98] disabled:bg-white/10 disabled:text-muted disabled:ring-0"
            >
              <Check className="size-4" strokeWidth={2.8} />
              Approve selected ({selectedPending.length})
            </button>
          </div>
        </footer>
        </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, tone = 'text-fg' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3.5 py-2 ring-1 ring-inset ring-white/[0.06]">
      <p className=" text-xs font-semibold text-muted">{label}</p>
      <p className={`mt-0.5 font-mono text-base font-bold leading-none ${tone}`}>{value}</p>
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
}: {
  batch: StockRecord
  selected: boolean
  status?: Status
  onToggle: () => void
  onPrimary: () => void
  onAudit: () => void
}) {
  const meta = actionMeta[b.action]
  const RecIcon = meta.icon
  const staticH = Math.max(1, b.staticHours)
  const gap = Math.round(((b.dynamicHours - staticH) / staticH) * 100)
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
        selected ? '!ring-accent/40 bg-accent/[0.025]' : ''
      } ${status ? 'opacity-50' : ''}`}
    >
      <span className={`absolute inset-y-2.5 left-0 w-[3px] rounded-r-full ${accent}`} aria-hidden />
      <Checkbox
        label={`Select batch ${b.id}`}
        checked={selected && !status}
        onChange={onToggle}
        disabled={!!status || !b.recommendation}
      />

      {/* Batch */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-muted">#{b.id}</span>
          {b.breach && (
            <span
              className={`rounded-full px-1.5 py-px text-xs font-bold ${
                b.breach === 'critical'
                  ? 'bg-danger/10 text-danger ring-1 ring-inset ring-danger/20'
                  : 'bg-warn/10 text-warn ring-1 ring-inset ring-warn/20'
              }`}
            >
              {b.breach === 'critical' ? 'Breach' : 'Spike'}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm font-bold">{b.product}</p>
        <p className="truncate font-mono text-xs text-muted">
          {b.zone} · {b.units} units
        </p>
      </div>

      {/* Telemetry */}
      <div className="flex items-center gap-3">
        <Sparkline batch={b} />
        <div className="font-mono text-xs leading-[1.45]">
          <p className="text-muted">
            Avg <span className="font-semibold text-fg/90">{b.series.length ? `${b.avgTemp.toFixed(1)}°C` : '—'}</span>
          </p>
          <p className="text-muted">
            Peak{' '}
            <span
              className={`font-bold ${
                b.breach === 'critical' ? 'text-danger' : b.breach === 'spike' ? 'text-warn' : 'text-fg/90'
              }`}
            >
              {b.series.length ? `${b.peakTemp.toFixed(1)}°C` : '—'}
            </span>
          </p>
        </div>
      </div>

      {/* Static vs dynamic */}
      <div>
        <div className="flex items-baseline justify-between font-mono text-xs">
          <span className="text-muted">
            Static <span className="text-white/65 line-through decoration-white/30">{Math.round(b.staticHours)}h</span>
          </span>
          <span className="text-muted">
            RUL <span className="font-bold text-fg">{b.dynamicHours}h</span>
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-l-full bg-series" style={{ width: `${Math.min(100, (b.dynamicHours / staticH) * 100)}%` }} />
            <div
              className={`h-full flex-1 ${gap <= -35 ? 'hatch-danger' : gap <= -15 ? 'hatch-warn' : 'hatch-muted'}`}
            />
          </div>
          <span className={`rounded-full px-1.5 py-0.5 font-mono text-xs font-bold ${gapTone}`}>{gap}%</span>
        </div>
      </div>

      {/* Recommendation */}
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${meta.iconTone}`}>
          <RecIcon className="size-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="line-clamp-2 text-xs font-semibold leading-[1.3] text-fg/90">{b.rec}</p>
          <p className="mt-0.5 font-mono text-xs text-muted">
            Predicted expiry {shortDate(b.predictedExpiry)}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5">
        {status ? (
          <span className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/[0.07] text-xs font-bold text-fg/90">
            <Check className="size-3.5 text-ok" strokeWidth={3} />
            {statusLabel[status]}
          </span>
        ) : !b.recommendation ? (
          // shortcut: breach-only rows have no backend "reviewed" status yet, so there is nothing to save; add the action once it exists.
          <span className="flex h-9 flex-1 items-center justify-center rounded-full text-xs font-semibold text-muted ring-1 ring-inset ring-line">
            Monitoring only
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={onPrimary}
              className={`h-9 flex-1 whitespace-nowrap rounded-full px-3 text-xs font-bold transition active:scale-[0.98] ${meta.button}`}
            >
              {meta.label}
            </button>
            {b.recommendation && (
              <button
                type="button"
                onClick={onAudit}
                aria-label={`Reject recommendation for ${b.id}`}
                title="Reject recommendation"
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

function Sparkline({ batch }: { batch: StockRecord }) {
  const W = 72
  const H = 30
  const series = batch.series
  if (series.length < 2) return <span className="w-[72px] shrink-0 font-mono text-xs text-muted">No readings</span>
  const y = (t: number) => H - 3 - (Math.min(Math.max(t, 0), 10) / 10) * (H - 6)
  const x = (i: number) => (i / (series.length - 1)) * W
  const d = series.map((t, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(t).toFixed(1)}`).join(' ')
  const peakIdx = series.indexOf(Math.max(...series))
  const color = batch.breach === 'critical' ? 'var(--color-danger)' : batch.breach === 'spike' ? 'var(--color-warn)' : 'var(--color-muted)'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 overflow-visible" aria-hidden>
      <rect x="0" y="0" width={W} height={y(LIMIT)} fill={color} fillOpacity="0.07" />
      <line x1="0" x2={W} y1={y(LIMIT)} y2={y(LIMIT)} stroke="#fff" strokeOpacity="0.25" strokeDasharray="2 2" />
      <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill={color} fillOpacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(peakIdx)} cy={y(series[peakIdx])} r="2.6" fill={color} stroke="var(--color-surface)" strokeWidth="1.2" />
    </svg>
  )
}
