import { useState, type FormEvent } from 'react'
import { Boxes, Check, ChevronRight, Plus, Radio, Smartphone, X } from 'lucide-react'
import { useInventory } from '../data/InventoryContext'

const reminders = [
  { count: 3, label: 'Thermal irregularities', tone: 'bg-danger' },
  { count: 5, label: 'Batches under 48h RUL', tone: 'bg-warn' },
  { count: 7, label: 'Dispatch reviews pending', tone: 'bg-sky' },
]

type AddType = 'sensor' | 'stock'

const addOptions = [
  { id: 'sensor', label: 'New sensor', icon: Radio },
  { id: 'stock', label: 'New stock', icon: Boxes },
] as const

export default function Sidebar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { addSensor, addStock, locations, categories } = useInventory()
  const [adding, setAdding] = useState<AddType | null>(null)
  const [added, setAdded] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!adding) return
    const data = new FormData(event.currentTarget)
    const primary = String(data.get('primary') ?? '').trim()
    const secondary = String(data.get('secondary') ?? '').trim()
    if (adding === 'sensor') addSensor(primary, secondary)
    if (adding === 'stock') {
      addStock({
        product: primary,
        category: String(data.get('category') ?? '').trim(),
        detail: String(data.get('detail') ?? '').trim(),
        identifier: String(data.get('identifier') ?? '').trim(),
        zone: String(data.get('location') ?? '').trim(),
        units: Number.parseInt(secondary, 10) || 0,
        value: Number.parseFloat(String(data.get('value') ?? '0')) || 0,
        printedExpiration: String(data.get('printedExpiration') ?? ''),
      })
    }
    const label = addOptions.find((option) => option.id === adding)?.label ?? 'Item'
    setAdded(`${label} added`)
    setAdding(null)
    window.setTimeout(() => setAdded(''), 2200)
  }

  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:var(--color-line)_transparent] [scrollbar-width:thin]">
      <section className="rounded-[14px] border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-fg">Reminders</p>
          <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-muted">Live</span>
        </div>
        <div className="mt-3 divide-y divide-line">
          {reminders.map((reminder) => (
            <button
              type="button"
              key={reminder.label}
              className="flex w-full items-center gap-2.5 py-2 text-left hover:text-fg"
            >
              <span className={`h-6 w-0.5 shrink-0 rounded-full ${reminder.tone}`} />
              <span className="font-mono text-[13px] font-semibold text-fg">{reminder.count}</span>
              <span className="min-w-0 flex-1 truncate text-[10.5px] text-muted">{reminder.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[14px] border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-fg">Quick Add</p>
            <p className="mt-1 text-[9px] text-muted">Create warehouse records</p>
          </div>
          <span className="grid size-7 place-items-center rounded-lg bg-sky/10 text-sky">
            <Plus className="size-3.5" strokeWidth={2.4} />
          </span>
        </div>

        {adding ? (
          <form onSubmit={submit} className="mt-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-fg">
                {addOptions.find((option) => option.id === adding)?.label}
              </p>
              <button
                type="button"
                onClick={() => setAdding(null)}
                aria-label="Cancel quick add"
                className="grid size-6 place-items-center rounded-md text-muted hover:bg-white/[0.04] hover:text-fg"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <input
              required
              autoFocus
              name="primary"
              aria-label={adding === 'sensor' ? 'Sensor name' : adding === 'stock' ? 'Product name' : 'Batch name'}
              placeholder={adding === 'sensor' ? 'Sensor name' : adding === 'stock' ? 'Product name' : 'Batch ID'}
              className="mt-2 h-9 w-full rounded-lg border border-line bg-night px-2.5 text-[10px] text-fg outline-none placeholder:text-muted focus:border-sky/50"
            />
            {adding === 'stock' ? (
              <>
                <select
                  required
                  name="category"
                  aria-label="Stock category"
                  defaultValue=""
                  className="mt-1.5 h-8 w-full rounded-lg border border-line bg-night px-2.5 text-[9px] text-fg outline-none focus:border-sky/50"
                >
                  <option value="" disabled>Choose category</option>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <input required name="detail" aria-label="Stock packaging details" placeholder="Details · 12 × 125g packs" className="mt-1.5 h-8 w-full rounded-lg border border-line bg-night px-2.5 text-[9px] text-fg outline-none placeholder:text-muted focus:border-sky/50" />
                <input required name="identifier" aria-label="Stock identification number" placeholder="Identification number" className="mt-1.5 h-8 w-full rounded-lg border border-line bg-night px-2.5 text-[9px] text-fg outline-none placeholder:text-muted focus:border-sky/50" />
                <select required name="location" aria-label="Stock location" defaultValue="" className="mt-1.5 h-8 w-full rounded-lg border border-line bg-night px-2.5 text-[9px] text-fg outline-none focus:border-sky/50">
                  <option value="" disabled>Choose warehouse location</option>
                  {locations.map((location) => <option key={location} value={location}>{location}</option>)}
                </select>
                <label className="mt-1.5 block font-mono text-[7.5px] uppercase tracking-[0.06em] text-muted">
                  Printed expiration
                  <input
                    required
                    name="printedExpiration"
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    className="mt-1 h-8 w-full rounded-lg border border-line bg-night px-2.5 font-sans text-[9px] normal-case tracking-normal text-fg outline-none focus:border-sky/50"
                  />
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <input required name="secondary" type="number" min="1" aria-label="Stock quantity" placeholder="Quantity" className="h-8 min-w-0 rounded-lg border border-line bg-night px-2.5 text-[9px] text-fg outline-none placeholder:text-muted focus:border-sky/50" />
                  <input required name="value" type="number" min="0" step="0.01" aria-label="Stock value" placeholder="Value $" className="h-8 min-w-0 rounded-lg border border-line bg-night px-2.5 text-[9px] text-fg outline-none placeholder:text-muted focus:border-sky/50" />
                </div>
              </>
            ) : (
              <select
                required
                name="secondary"
                aria-label="Warehouse location"
                defaultValue=""
                className="mt-2 h-9 w-full rounded-lg border border-line bg-night px-2.5 text-[10px] text-fg outline-none placeholder:text-muted focus:border-sky/50"
              >
                <option value="" disabled>Choose warehouse location</option>
                {locations.map((location) => <option key={location} value={location}>{location}</option>)}
              </select>
            )}
            <button
              type="submit"
              className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-sky text-[10px] font-bold text-night hover:brightness-105"
            >
              <Plus className="size-3.5" />
              Add record
            </button>
          </form>
        ) : (
          <div className="mt-3 grid gap-1.5">
            {addOptions.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setAdding(id)}
                className="flex h-9 items-center gap-2 rounded-lg border border-line bg-night/50 px-2.5 text-left text-[9.5px] font-medium text-fg transition-colors hover:border-sky/30 hover:bg-sky/[0.05]"
              >
                <Icon className="size-3.5 text-muted" strokeWidth={1.8} />
                <span className="flex-1">{label}</span>
                <Plus className="size-3 text-sky" />
              </button>
            ))}
          </div>
        )}

        {added && !adding && (
          <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-ok/10 px-2 py-1.5 text-[8.5px] font-semibold text-ok">
            <Check className="size-3" strokeWidth={2.5} />
            {added}
          </p>
        )}
      </section>

      <button
        type="button"
        onClick={onOpenMobile}
        className="mt-auto flex w-full items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3 py-3 text-left text-[10.5px] text-muted transition-colors hover:text-fg"
      >
        <Smartphone className="size-4 text-sky" strokeWidth={1.8} />
        <span>
          <span className="block font-semibold text-fg">Mobile companion</span>
          <span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[0.06em]">Open supervisor view</span>
        </span>
        <ChevronRight className="ml-auto size-3.5" />
      </button>
    </aside>
  )
}
