import { AlertTriangle, Clock3 } from 'lucide-react'
import { useInventory } from '../data/InventoryContext'
import { card, CardTitle } from './ui'

export default function QueueCard() {
  const { stocks } = useInventory()
  const atRiskProducts = stocks
    .filter((batch) => batch.recommendation)
    .sort((a, b) => a.dynamicHours - b.dynamicHours)
    .slice(0, 5)
  const totalUnits = atRiskProducts.reduce((sum, batch) => sum + batch.units, 0)

  return (
    <section className={`${card} flex min-h-0 flex-1 flex-col p-5`}>
      <header>
        <CardTitle className="text-base">Priority dispatch</CardTitle>
        <div className="mt-2.5 flex min-w-0 items-center gap-2">
          <span className="flex shrink-0 items-center gap-2 rounded-full border border-danger/25 bg-danger/10 py-1 pl-2 pr-2.5 font-mono text-xs text-danger">
            <span className="relative flex size-2">
              <span className="ping-soft absolute inset-0 rounded-full bg-danger" />
              <span className="relative size-2 rounded-full bg-danger" />
            </span>
            {atRiskProducts.length} require attention
          </span>
          <p className="line-clamp-2 min-w-0 text-xs leading-snug text-muted">
            Batches with a pending dispatch or salvage recommendation, ranked by remaining life.
          </p>
        </div>
      </header>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_120px_96px] gap-2 border-b border-line px-1 pb-2 text-xs text-muted">
        <span>Product &amp; exposure</span>
        <span>RUL</span>
        <span className="text-right">Action</span>
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain [scrollbar-color:var(--color-line)_transparent] [scrollbar-width:thin]">
        {atRiskProducts.length === 0 && (
          <li className="grid h-full place-items-center px-4 py-10 text-center">
            <span>
              <span className="block text-xs font-semibold text-fg">No batches need a decision</span>
              <span className="mt-1 block text-xs text-muted">Batches appear here when their shelf life drops below the dispatch threshold.</span>
            </span>
          </li>
        )}
        {atRiskProducts.map((batch) => {
          const salvage = batch.recommendation?.type === 'SALVAGE'
          const critical = salvage || batch.breach === 'critical'
          const loss = Math.max(0, Math.round(((batch.staticHours - batch.dynamicHours) / Math.max(1, batch.staticHours)) * 100))

          return (
            <li key={batch.id} className="grid h-[50px] grid-cols-[minmax(0,1fr)_120px_96px] items-center gap-2 px-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`size-2 shrink-0 rounded-full ${critical ? 'bg-danger' : 'bg-warn'}`} />
                  <p className="truncate text-xs font-semibold text-fg">{batch.product}</p>
                  <span className="shrink-0 font-mono text-xs text-muted">#{batch.id}</span>
                </div>
                <p className="mt-0.5 truncate pl-4 text-xs text-muted">
                  {batch.zone} · {batch.units} units
                </p>
              </div>

              <div>
                <p className={`font-mono text-sm font-bold ${critical ? 'text-danger' : 'text-warn'}`}>
                  {batch.dynamicHours}h
                </p>
                <p className="mt-0.5 flex items-center gap-1 font-mono text-xs text-muted">
                  <Clock3 className="size-2.5" /> {loss}% life lost
                </p>
              </div>

              <div className="text-right">
                <p className={`font-mono text-xs font-semibold ${salvage ? 'text-danger' : 'text-fg'}`}>{salvage ? 'Salvage' : 'Dispatch'}</p>
                <p className="mt-0.5 font-mono text-xs text-muted">pending</p>
              </div>
            </li>
          )
        })}
      </ul>

      <footer className="mt-3 flex h-[48px] shrink-0 items-center rounded-xl border border-line bg-night/60 px-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-md border border-warn/25 bg-warn/10">
            <AlertTriangle className="size-3.5 text-warn" strokeWidth={2} />
          </span>
          <p className="min-w-0 leading-tight">
            <span className="block text-xs text-muted">Current exposure</span>
            <span className="block truncate text-xs text-muted">
              <span className="font-mono font-semibold text-fg">{totalUnits} units</span> awaiting a decision
            </span>
          </p>
        </div>
      </footer>
    </section>
  )
}
