import { Clock3, PackageCheck } from 'lucide-react'
import { useInventory } from '../data/InventoryContext'
import { card, CardTitle } from './ui'

// Staff view: batches the supervisor approved for dispatch, lowest remaining life first (dynamic FEFO). Read-only.
export default function PullListCard() {
  const { stocks } = useInventory()
  const toPull = stocks
    .filter((batch) => batch.activity.state === 'dispatched')
    .sort((a, b) => a.dynamicHours - b.dynamicHours)

  return (
    <section className={`${card} flex min-h-0 flex-1 flex-col p-5`}>
      <header>
        <CardTitle className="text-base">Pull list</CardTitle>
        <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-2">
          <span className="flex shrink-0 items-center gap-2 rounded-full border border-accent/25 bg-accent/10 py-1 pl-2 pr-2.5 font-mono text-xs text-accent">
            <PackageCheck className="size-3.5" strokeWidth={2} />
            {toPull.length} to pull
          </span>
          <p className="min-w-0 text-xs leading-snug text-muted">
            Approved by the supervisor. Pull from the top: least remaining life first.
          </p>
        </div>
      </header>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-line px-1 pb-2 text-xs text-muted sm:grid-cols-[minmax(0,1fr)_120px_110px]">
        <span>Batch &amp; location</span>
        <span>RUL</span>
        <span className="hidden text-right sm:block">Approved</span>
      </div>

      <ol className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain [scrollbar-color:var(--color-line)_transparent] [scrollbar-width:thin]">
        {toPull.length === 0 && (
          <li className="grid h-full place-items-center px-4 py-10 text-center">
            <span>
              <span className="block text-xs font-semibold text-fg">Nothing to pull</span>
              <span className="mt-1 block text-xs text-muted">Batches appear here once the supervisor approves a dispatch.</span>
            </span>
          </li>
        )}
        {toPull.map((batch, index) => {
          const tone = batch.dynamicHours < 24 ? 'text-danger' : batch.dynamicHours < 48 ? 'text-warn' : 'text-fg'
          return (
            <li key={batch.key} className="grid min-h-[50px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 px-1 py-2 sm:grid-cols-[minmax(0,1fr)_120px_110px]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-4 shrink-0 font-mono text-xs text-muted">{index + 1}</span>
                  <p className="font-mono text-xs font-semibold text-fg">{batch.id}</p>
                  <span className="min-w-0 text-xs text-muted">{batch.product}</span>
                </div>
                <p className="mt-0.5 pl-6 text-xs text-muted">
                  {batch.zone} · {batch.units} units
                </p>
              </div>
              <p className={`font-mono text-sm font-bold ${tone}`}>{batch.dynamicHours}h</p>
              <p className="col-span-2 flex items-center gap-1 pl-6 font-mono text-xs text-muted sm:col-span-1 sm:justify-end sm:pl-0">
                <Clock3 className="size-2.5" /> {batch.activity.updated}
              </p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
