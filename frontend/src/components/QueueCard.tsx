import { AlertTriangle, ArrowRight, Clock3 } from 'lucide-react'
import { useInventory } from '../data/InventoryContext'
import { ArrowButton, card, CardTitle } from './ui'

export default function QueueCard({ onOpenQueue }: { onOpenQueue: () => void }) {
  const { stocks } = useInventory()
  const atRiskProducts = stocks
    .filter((batch) => batch.recommendation)
    .sort((a, b) => a.dynamicHours - b.dynamicHours)
    .slice(0, 5)
  const totalUnits = atRiskProducts.reduce((sum, batch) => sum + batch.units, 0)

  return (
    <section className={`${card} flex min-h-0 flex-1 flex-col p-5`}>
      <header>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-[15px]">Priority Dispatch</CardTitle>
          <ArrowButton label="Open full at-risk product register" onClick={onOpenQueue} />
        </div>
        <div className="mt-2.5 flex min-w-0 items-center gap-2">
          <span className="flex shrink-0 items-center gap-2 rounded-full border border-danger/25 bg-danger/10 py-1 pl-2 pr-2.5 font-mono text-[10.5px] text-danger">
            <span className="relative flex size-2">
              <span className="ping-soft absolute inset-0 rounded-full bg-danger" />
              <span className="relative size-2 rounded-full bg-danger" />
            </span>
            {atRiskProducts.length} require attention
          </span>
          <p className="line-clamp-2 min-w-0 text-[10px] leading-snug text-muted">
            Batches with a pending dispatch or salvage recommendation, ranked by remaining life.
          </p>
        </div>
      </header>

      <div className="mt-3 grid grid-cols-[1fr_72px_68px] gap-2 border-b border-line px-1 pb-2 font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
        <span>Product &amp; exposure</span>
        <span>RUL</span>
        <span className="text-right">Action</span>
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain [scrollbar-color:var(--color-line)_transparent] [scrollbar-width:thin]">
        {atRiskProducts.map((batch) => {
          const salvage = batch.recommendation?.type === 'SALVAGE'
          const critical = salvage || batch.breach === 'critical'
          const loss = Math.max(0, Math.round(((batch.staticHours - batch.dynamicHours) / Math.max(1, batch.staticHours)) * 100))

          return (
            <li key={batch.id} className="grid h-[50px] grid-cols-[1fr_72px_68px] items-center gap-2 px-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`size-2 shrink-0 rounded-full ${critical ? 'bg-danger' : 'bg-warn'}`} />
                  <p className="truncate text-[11px] font-semibold text-fg">{batch.product}</p>
                  <span className="shrink-0 font-mono text-[8px] text-muted">#{batch.id}</span>
                </div>
                <p className="mt-0.5 truncate pl-4 text-[9px] text-muted">
                  {batch.zone} · {batch.units} units
                </p>
              </div>

              <div>
                <p className={`font-mono text-[13px] font-bold ${critical ? 'text-danger' : 'text-warn'}`}>
                  {batch.dynamicHours}h
                </p>
                <p className="mt-0.5 flex items-center gap-1 font-mono text-[8px] text-muted">
                  <Clock3 className="size-2.5" /> {loss}% life lost
                </p>
              </div>

              <div className="text-right">
                <p className={`font-mono text-[10.5px] font-semibold ${salvage ? 'text-danger' : 'text-fg'}`}>{salvage ? 'Salvage' : 'Dispatch'}</p>
                <p className="mt-0.5 font-mono text-[8px] text-muted">pending</p>
              </div>
            </li>
          )
        })}
      </ul>

      <footer className="mt-3 grid h-[48px] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-line bg-night/60 px-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-md border border-warn/25 bg-warn/10">
            <AlertTriangle className="size-3.5 text-warn" strokeWidth={2} />
          </span>
          <p className="min-w-0 leading-tight">
            <span className="block font-mono text-[9px] uppercase tracking-[0.08em] text-muted">Current exposure</span>
            <span className="block truncate text-[10px] text-muted">
              <span className="font-mono font-semibold text-fg">{totalUnits} units</span> awaiting a decision
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenQueue}
          aria-label="View risk details"
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-[10px] font-semibold text-sky hover:bg-sky/10"
        >
          Details
          <ArrowRight className="size-3" strokeWidth={2.4} />
        </button>
      </footer>
    </section>
  )
}
