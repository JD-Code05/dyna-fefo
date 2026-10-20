import { useState, type ReactNode } from 'react'
import { Clock3, Thermometer, TriangleAlert } from 'lucide-react'
import { useInventory, type StockRecord } from '../data/InventoryContext'
import ShelfLifeComparisonBar from './ShelfLifeComparisonBar'
import { card, CardHint, CardTitle, Dropdown } from './ui'

const Label = ({ children }: { children: ReactNode }) => (
  <p className="font-mono text-[8px] font-medium uppercase tracking-[0.08em] text-muted">{children}</p>
)

export default function ShelfLifeCard() {
  const { stocks } = useInventory()
  const zones = ['All zones', ...Array.from(new Set(stocks.map((batch) => batch.zone)))]
  const [zone, setZone] = useState('All zones')
  const visible = stocks
    .filter((batch) => zone === 'All zones' || batch.zone === zone)
    .sort((a, b) => a.dynamicHours - b.dynamicHours)
    .slice(0, 7)
  const [activeKey, setActiveKey] = useState(stocks[0]?.key ?? '')
  const selected = visible.find((batch) => batch.key === activeKey) ?? visible[0]
  const maxHours = Math.max(24, ...visible.map((batch) => batch.staticHours))
  const atRisk = visible.filter((batch) => batch.dynamicHours < 48).length
  const avgRul = visible.length
    ? Math.round(visible.reduce((sum, batch) => sum + batch.dynamicHours, 0) / visible.length)
    : 0
  const avgLoss = visible.length
    ? Math.round(
        visible.reduce(
          (sum, batch) => sum + ((batch.staticHours - batch.dynamicHours) / batch.staticHours) * 100,
          0,
        ) / visible.length,
      )
    : 0

  return (
    <section className={`${card} flex h-full min-h-0 flex-col overflow-hidden p-5`}>
      <header className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-pill text-muted">
          <Thermometer className="size-[18px]" strokeWidth={1.9} />
        </div>
        <div className="min-w-0">
          <CardTitle className="text-[18px]">Dynamic Shelf-Life Decay</CardTitle>
          <CardHint>Sensor-adjusted remaining life per batch vs printed expiry</CardHint>
        </div>
        <div className="ml-auto">
          <Dropdown label="Select storage zone" value={zone} options={zones} onChange={setZone} />
        </div>
      </header>

      <div className="mt-4 flex min-h-0 flex-1 gap-4">
        <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-line bg-night/35 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 font-mono text-[8.5px] text-muted">
              <span className="flex items-center gap-1.5">
                <i className="size-2 rounded-sm bg-sky" /> Sensor-adjusted RUL
              </span>
              <span className="flex items-center gap-1.5">
                <i className="hatch-danger size-2 rounded-sm" /> Life lost
              </span>
              <span className="flex items-center gap-1.5">
                <i className="size-2 rounded-sm bg-track ring-1 ring-inset ring-white/10" /> Printed life
              </span>
            </div>
            <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-muted">
              Hours remaining
            </span>
          </div>

          <div className="mt-3 grid grid-cols-[112px_minmax(0,1fr)_42px] items-end gap-3 border-b border-line pb-2">
            <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-muted">Batch</span>
            <div className="flex justify-between font-mono text-[7.5px] text-muted">
              {[0, 0.25, 0.5, 0.75, 1].map((step) => (
                <span key={step}>{Math.round(maxHours * step)}h</span>
              ))}
            </div>
            <span className="text-right font-mono text-[8px] uppercase tracking-[0.08em] text-muted">RUL</span>
          </div>

          <div className="relative min-h-0 flex-1 divide-y divide-line/70 overflow-y-auto overscroll-contain [scrollbar-color:var(--color-line)_transparent] [scrollbar-width:thin]">
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[124px] right-[54px] flex justify-between">
              {[0, 1, 2, 3, 4].map((line) => (
                <span key={line} className="h-full w-px bg-line/55" />
              ))}
            </div>
            {visible.length ? (
              visible.map((batch) => (
                <ShelfLifeBar
                  key={batch.key}
                  batch={batch}
                  maxHours={maxHours}
                  active={selected?.key === batch.key}
                  onSelect={() => setActiveKey(batch.key)}
                />
              ))
            ) : (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <Clock3 className="mx-auto size-6 text-muted" />
                  <p className="mt-2 text-[10px] font-semibold text-fg">No stock in this zone</p>
                  <p className="mt-1 text-[8.5px] text-muted">Choose another warehouse zone.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="flex w-[220px] shrink-0 flex-col gap-3">
          <div className="rounded-xl border border-line bg-night/35 p-4">
            <div className="flex items-center justify-between">
              <Label>Portfolio health</Label>
              <span className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[8.5px] font-semibold ${
                avgLoss >= 20
                  ? 'border-danger/30 bg-danger/10 text-danger'
                  : 'border-ok/30 bg-ok/10 text-ok'
              }`}>
                <TriangleAlert className="size-3" strokeWidth={2.4} />
                {avgLoss}% loss
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric label="Avg RUL" value={`${avgRul}h`} tone="text-sky" />
              <Metric label="At risk" value={`${atRisk}/${visible.length}`} tone={atRisk ? 'text-danger' : 'text-ok'} />
            </div>
          </div>

          {selected ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-xl border border-line bg-night/35 p-4 [scrollbar-color:var(--color-line)_transparent] [scrollbar-width:thin]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Label>Selected batch</Label>
                  <p className="mt-1.5 truncate text-[12px] font-semibold text-fg">{selected.product}</p>
                  <p className="mt-0.5 font-mono text-[8px] text-muted">
                    #{selected.id} · {selected.zone}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 font-mono text-[8px] font-semibold ${
                  selected.dynamicHours < 24
                    ? 'border-danger/25 bg-danger/10 text-danger'
                    : selected.dynamicHours < 48
                      ? 'border-warn/25 bg-warn/10 text-warn'
                      : 'border-ok/25 bg-ok/10 text-ok'
                }`}>
                  {selected.dynamicHours < 24 ? 'Critical' : selected.dynamicHours < 48 ? 'At risk' : 'Stable'}
                </span>
              </div>

              <div className="mt-4">
                <p className="font-mono text-[8px] uppercase tracking-[0.08em] text-muted">Remaining useful life</p>
                <p className={`mt-1 text-[30px] font-bold leading-none ${
                  selected.dynamicHours < 24
                    ? 'text-danger'
                    : selected.dynamicHours < 48
                      ? 'text-warn'
                      : 'text-sky'
                }`}>
                  {selected.dynamicHours}<span className="ml-1 text-[13px] font-medium text-muted">HOURS</span>
                </p>
              </div>

              <div className="mt-auto space-y-2.5 pt-4 font-mono text-[8.5px]">
                <DetailRow label="Printed life" value={`${selected.staticHours}h`} />
                <DetailRow
                  label="Life lost"
                  value={`${Math.max(0, selected.staticHours - selected.dynamicHours)}h`}
                  tone="text-danger"
                />
                <DetailRow label="Average temp" value={`${selected.avgTemp}°C`} />
                <DetailRow
                  label="Peak exposure"
                  value={`${selected.peakTemp}°C`}
                  tone={selected.breach ? 'text-danger' : 'text-fg'}
                />
              </div>
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 place-items-center rounded-xl border border-line bg-night/35 p-4 text-center">
              <p className="text-[9px] text-muted">No batch selected</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

function ShelfLifeBar({
  batch,
  maxHours,
  active,
  onSelect,
}: {
  batch: StockRecord
  maxHours: number
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`${batch.product}, ${batch.dynamicHours} hours remaining from ${batch.staticHours} printed hours`}
      className={`relative grid h-[46px] w-full grid-cols-[112px_minmax(0,1fr)_42px] items-center gap-3 text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-sky/60 ${
        active ? 'bg-sky/[0.055]' : 'hover:bg-white/[0.02]'
      }`}
    >
      <span className="min-w-0 pl-1">
        <strong className={`block truncate text-[9.5px] ${active ? 'text-fg' : 'text-fg/80'}`}>
          {batch.product}
        </strong>
        <small className="mt-0.5 block font-mono text-[7.5px] text-muted">#{batch.id}</small>
      </span>

      <ShelfLifeComparisonBar
        printedHours={batch.staticHours}
        dynamicHours={batch.dynamicHours}
        maxHours={maxHours}
      />

      <span className={`text-right font-mono text-[10px] font-bold ${
        batch.dynamicHours < 24
          ? 'text-danger'
          : batch.dynamicHours < 48
            ? 'text-warn'
            : 'text-fg'
      }`}>
        {batch.dynamicHours}h
      </span>
    </button>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface/60 p-2.5">
      <p className="font-mono text-[7px] uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className={`mt-1 text-[17px] font-bold leading-none ${tone}`}>{value}</p>
    </div>
  )
}

function DetailRow({
  label,
  value,
  tone = 'text-fg',
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className="flex items-center justify-between border-b border-line/70 pb-2 last:border-0 last:pb-0">
      <span className="text-muted">{label}</span>
      <span className={`font-semibold ${tone}`}>{value}</span>
    </div>
  )
}
