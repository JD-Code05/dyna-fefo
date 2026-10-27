import { useState } from 'react'
import { Clock3, PackageCheck } from 'lucide-react'
import { timeAgo, useInventory, type StockOrder, type TaskReason } from '../data/InventoryContext'
import { card, CardTitle } from './ui'

// Staff view: orders the supervisor approved, lowest remaining life first (dynamic FEFO).
// Staff confirm each one in one tap, or flag it in two.
export default function PullListCard() {
  const { orders } = useInventory()

  return (
    <section className={`${card} flex min-h-0 flex-1 flex-col p-5`}>
      <header>
        <CardTitle className="text-base">Pull list</CardTitle>
        <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-2">
          <span className="flex shrink-0 items-center gap-2 rounded-full border border-accent/25 bg-accent/10 py-1 pl-2 pr-2.5 font-mono text-xs text-accent">
            <PackageCheck className="size-3.5" strokeWidth={2} />
            {orders.length} open
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
        {orders.length === 0 && (
          <li className="grid h-full place-items-center px-4 py-10 text-center">
            <span>
              <span className="block text-xs font-semibold text-fg">Nothing to pull</span>
              <span className="mt-1 block text-xs text-muted">Orders appear here once the supervisor approves a dispatch or salvage.</span>
            </span>
          </li>
        )}
        {orders.map((order, index) => (
          <OrderRow key={order.rec.id} order={order} position={index + 1} />
        ))}
      </ol>
    </section>
  )
}

function OrderRow({ order: { rec, stock }, position }: { order: StockOrder; position: number }) {
  const { completeTask } = useInventory()
  const [choosing, setChoosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const salvage = rec.type === 'SALVAGE'
  const tone = stock.dynamicHours < 24 ? 'text-danger' : stock.dynamicHours < 48 ? 'text-warn' : 'text-fg'

  const send = async (result: 'done' | 'flagged', reason?: TaskReason) => {
    setBusy(true)
    setError('')
    try {
      await completeTask(rec.id, result, reason) // the refetch that follows drops this row
    } catch (e) {
      // API errors carry a code and a readable message; a network failure is a bare TypeError.
      const err = e as { code?: string; message?: string }
      setError(err.code && err.message ? err.message : 'Could not reach the server. Check the connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const button = 'h-8 rounded-lg px-3 text-xs font-semibold disabled:opacity-50'
  const secondary = `${button} border border-line text-fg hover:bg-white/[0.04]`

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 px-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_120px_110px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="w-4 shrink-0 font-mono text-xs text-muted">{position}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${salvage ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'}`}>
            {salvage ? 'To salvage' : 'To ship'}
          </span>
          <p className="font-mono text-xs font-semibold text-fg">{stock.id}</p>
          <span className="min-w-0 text-xs text-muted">{stock.product}</span>
        </div>
        <p className="mt-0.5 pl-6 text-xs text-muted">
          {stock.zone} · {stock.units} units
        </p>
      </div>
      <p className={`font-mono text-sm font-bold ${tone}`}>{stock.dynamicHours}h</p>
      <p className="col-span-2 flex items-center gap-1 pl-6 font-mono text-xs text-muted sm:col-span-1 sm:justify-end sm:pl-0">
        <Clock3 className="size-2.5" /> approved {rec.decided_at ? timeAgo(rec.decided_at) : ''}
      </p>

      <div className="col-span-2 flex flex-wrap items-center gap-2 pl-6 sm:col-span-3">
        {choosing ? (
          <>
            <span className="text-xs text-muted">What happened?</span>
            <button type="button" disabled={busy} onClick={() => send('flagged', 'not_found')} className={secondary}>
              Not found
            </button>
            <button type="button" disabled={busy} onClick={() => send('flagged', 'spoiled')} className={secondary}>
              Looks spoiled
            </button>
            <button type="button" disabled={busy} onClick={() => setChoosing(false)} className="h-8 px-2 text-xs text-muted underline-offset-2 hover:text-fg hover:underline">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => send('done')} className={`${button} bg-accent text-night hover:brightness-105`}>
              {salvage ? 'Salvage done' : 'Shipment done'}
            </button>
            <button type="button" disabled={busy} onClick={() => setChoosing(true)} className={secondary}>
              Can’t do it
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="w-full text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </li>
  )
}
