import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Check, ChevronDown, ShieldCheck, TrendingUp, TriangleAlert, Undo2 } from 'lucide-react'

const INK = '#141518'

const Tag = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <h2 className={`text-[12px] font-extrabold uppercase leading-none tracking-[0.02em] ${className}`}>{children}</h2>
)

/* ------------------------------------------------------------------ Hero */

const batches = [
  { id: 'B-409', name: 'Strawberries', printed: 3, remaining: 0.6, lost: 1.1 },
  { id: 'G-218', name: 'Spinach', printed: 4, remaining: 0.9, lost: 0.5 },
  { id: 'D-104', name: 'Whole Milk', printed: 7, remaining: 1.5, lost: 0.2 },
  { id: 'S-377', name: 'Salmon', printed: 5, remaining: 1.2, lost: 0.6 },
]

export function HeroCard() {
  const [active, setActive] = useState(0)

  return (
    <section className="rounded-[24px] bg-coral p-[18px] text-ink">
      <header className="flex items-center justify-between">
        <Tag className="text-[13px]">Dynamic Shelf-Life</Tag>
        <button
          type="button"
          className="flex h-8 items-center gap-1 rounded-full bg-white/25 pl-3 pr-2 text-[12px] font-semibold active:bg-white/35"
        >
          Chiller A <ChevronDown className="size-3.5" strokeWidth={2.6} />
        </button>
      </header>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[46px] font-extrabold leading-[0.85] tracking-[-0.04em]">
            4.2 <span className="text-[24px] tracking-[-0.02em]">DAYS</span>
          </p>
          <p className="mt-2 text-[12px] font-medium text-ink/75">Avg Remaining Useful Life</p>
        </div>
        <span className="mb-0.5 flex shrink-0 items-center gap-1.5 rounded-full bg-ink py-1.5 pl-2 pr-2.5 font-mono text-[10.5px] font-medium text-white">
          <TriangleAlert className="size-3.5 text-amber" strokeWidth={2.4} />
          -38% vs Printed Date
        </span>
      </div>

      <div className="no-scrollbar -mx-[18px] mt-4 flex snap-x snap-mandatory scroll-px-[18px] gap-2.5 overflow-x-auto px-[18px]">
        {batches.map((b, i) => {
          const on = i === active
          const elapsed = b.printed - b.remaining - b.lost
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={on}
              className={`w-[146px] shrink-0 snap-start rounded-[18px] p-3 text-left transition-colors ${
                on ? 'bg-ink text-white' : 'bg-white/25 text-ink'
              }`}
            >
              <span className={`block font-mono text-[9.5px] font-semibold ${on ? 'text-white/50' : 'text-ink/55'}`}>
                #{b.id}
              </span>
              <span className="block truncate text-[13.5px] font-bold">{b.name}</span>
              <p className="mt-2 text-[20px] font-extrabold leading-none tracking-[-0.02em]">
                {b.remaining}d <span className={`text-[11px] font-semibold ${on ? 'text-white/55' : 'text-ink/60'}`}>left</span>
              </p>
              <div
                className={`mt-2.5 flex h-2.5 overflow-hidden rounded-full ${on ? 'bg-white/10' : 'bg-ink/10'}`}
                aria-label={`${b.remaining} days remaining, ${b.lost} days lost to thermal exposure, ${elapsed.toFixed(1)} days elapsed`}
              >
                <span className={`h-full ${on ? 'bg-[#FF8A78]' : 'bg-ink'}`} style={{ width: `${(b.remaining / b.printed) * 100}%` }} />
                <span
                  className={`h-full ${on ? 'hatch-coral' : 'hatch bg-white/40'}`}
                  style={{ width: `${(b.lost / b.printed) * 100}%` }}
                />
              </div>
              <p className={`mt-1.5 font-mono text-[9.5px] font-semibold ${on ? 'text-[#FF8A78]' : 'text-ink/65'}`}>
                −{b.lost}d thermal loss
              </p>
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center gap-3 font-mono text-[9.5px] font-medium text-ink/70">
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-[2px] bg-ink" /> Dynamic RUL
        </span>
        <span className="flex items-center gap-1.5">
          <i className="hatch size-2 rounded-[2px] bg-white/40" /> Thermal loss
        </span>
        <span className="ml-auto flex gap-1" aria-hidden>
          {batches.map((b, i) => (
            <i key={b.id} className={`h-1.5 rounded-full transition-all ${i === active ? 'w-4 bg-ink' : 'w-1.5 bg-ink/30'}`} />
          ))}
        </span>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- Sensors */

export function SensorsCard() {
  return (
    <section className="flex aspect-square flex-col rounded-[24px] bg-ice p-3.5 text-ink">
      <div className="flex items-center justify-between">
        <Tag className="text-[11.5px]">Facility Sensors</Tag>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <div className="rounded-[12px] bg-ink/[0.07] px-2.5 py-1.5">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-ink/55">Chiller 1</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] font-bold tabular-nums">
            <span className="size-2 rounded-full bg-[#1FA855]" />
            3.2°C | 88%
          </p>
        </div>
        <div className="rounded-[12px] bg-amber px-2.5 py-1.5 ring-1 ring-inset ring-[#B87512]/40">
          <p className="flex items-center justify-between font-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-ink/65">
            Chiller 2 <TriangleAlert className="size-3 text-ink" strokeWidth={2.6} />
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] font-bold tabular-nums">
            <span className="relative flex size-2">
              <span className="ping-soft absolute inset-0 rounded-full bg-[#E07B00]" />
              <span className="relative size-2 rounded-full bg-[#E07B00]" />
            </span>
            8.9°C | 72%
          </p>
        </div>
      </div>

      <button type="button" className="mt-auto flex items-center gap-1 self-start text-[11.5px] font-bold active:opacity-60">
        View 2D Map <ArrowRight className="size-3.5" strokeWidth={2.6} />
      </button>
    </section>
  )
}

/* ------------------------------------------------------------------ Dial */

const C = 50
const polar = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180
  return { x: C + r * Math.sin(rad), y: C - r * Math.cos(rad) }
}
const arc = (from: number, to: number, r: number) => {
  const end = to <= from ? to + 24 : to
  const a = polar(from * 15, r)
  const b = polar(end * 15, r)
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${(end - from) * 15 > 180 ? 1 : 0} 1 ${b.x} ${b.y}`
}

export function DialCard() {
  const tip = polar(16.5 * 15, 40)
  const tail = polar(16.5 * 15 + 180, 7)
  const now = polar((12 + 18 / 60) * 15, 32)

  return (
    <section className="flex aspect-square flex-col rounded-[24px] bg-sage p-3.5 text-ink">
      <Tag className="text-[11.5px]">Dispatch Dial</Tag>

      <div className="mt-2.5 flex items-center gap-2">
        <svg viewBox="0 0 100 100" className="size-[70px] shrink-0" role="img" aria-label="24-hour dial with pick cutoff at 16:30">
          <circle cx={C} cy={C} r={49} fill="#F6F8F3" />
          {Array.from({ length: 24 }, (_, i) => {
            const a = polar(i * 15, i % 6 === 0 ? 41 : 44)
            const b = polar(i * 15, 47)
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={INK} strokeOpacity={i % 6 === 0 ? 0.8 : 0.3} strokeWidth={i % 6 === 0 ? 2 : 1} />
            )
          })}
          {[
            { r: 35, from: 4.5, to: 17, c: '#2F7A55' },
            { r: 28, from: 17, to: 22, c: '#F2A93B' },
            { r: 21, from: 22, to: 3, c: '#FF6B55' },
          ].map((ring) => (
            <g key={ring.r}>
              <circle cx={C} cy={C} r={ring.r} fill="none" stroke={INK} strokeOpacity={0.07} strokeWidth={5} />
              <path d={arc(ring.from, ring.to, ring.r)} fill="none" stroke={ring.c} strokeWidth={5} strokeLinecap="round" />
            </g>
          ))}
          <line x1={C} y1={C} x2={now.x} y2={now.y} stroke="#FF6B55" strokeWidth={1.2} strokeLinecap="round" />
          <line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} stroke={INK} strokeWidth={3} strokeLinecap="round" />
          <circle cx={C} cy={C} r={5} fill={INK} />
          <circle cx={C} cy={C} r={2} fill="#F6F8F3" />
        </svg>
        <div className="min-w-0">
          <p className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.06em] text-ink/55">Pick shift</p>
          <p className="mt-0.5 text-[14px] font-extrabold leading-none">04:30 PM</p>
          <p className="mt-1 inline-block rounded-full bg-ink px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white">
            Cutoff
          </p>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 rounded-[12px] bg-ink/[0.07] px-2.5 py-1.5">
        <ShieldCheck className="size-4 shrink-0 text-[#2F7A55]" strokeWidth={2.4} />
        <p className="leading-tight">
          <span className="block text-[12.5px] font-extrabold tabular-nums">04h 12m</span>
          <span className="block font-mono text-[8.5px] font-semibold text-ink/60">to danger threshold</span>
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------- Sentiment */

const days = [
  { day: 'Mon', score: 88 },
  { day: 'Tue', score: 82 },
  { day: 'Wed', score: 91 },
  { day: 'Thu', score: 68 },
  { day: 'Fri', score: 95 },
]

export function SentimentStrip() {
  const [selected, setSelected] = useState(2)
  return (
    <section className="rounded-[20px] bg-peri p-4 text-ink">
      <Tag>
        Market Freshness Sentiment <span className="text-ink/60">(91% Positive)</span>
      </Tag>

      <div className="mt-3.5 grid grid-cols-5 gap-1.5">
        {days.map((d, i) => {
          const low = d.score < 75
          const on = i === selected
          return (
            <button
              key={d.day}
              type="button"
              onClick={() => setSelected(i)}
              aria-pressed={on}
              aria-label={`${d.day}: ${d.score}% positive${low ? ', below threshold' : ''}`}
              className={`relative flex h-[62px] flex-col items-center justify-center gap-0.5 rounded-full transition-transform active:scale-95 ${
                on ? 'bg-ink text-white' : low ? 'bg-amber' : 'bg-[#F4F3FF]'
              }`}
            >
              <span className={`font-mono text-[9.5px] font-semibold ${on ? 'text-white/55' : 'text-ink/55'}`}>{d.day}</span>
              <span className="text-[14px] font-extrabold leading-none">{d.score}%</span>
              {low && (
                <span className="absolute -right-0.5 -top-1 grid size-[18px] place-items-center rounded-full bg-ink ring-2 ring-peri">
                  <TriangleAlert className="size-2.5 text-amber" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <p className="mt-3 flex w-fit items-center gap-2 rounded-full bg-white/20 py-1.5 pl-1.5 pr-3 text-[12px] font-semibold">
        <span className="grid size-6 place-items-center rounded-full bg-ink text-ice">
          <TrendingUp className="size-3.5" strokeWidth={2.6} />
        </span>
        High berry demand in Metro retail
      </p>
    </section>
  )
}

/* ------------------------------------------------------------- Approvals */

type Approval = {
  id: string
  product: string
  rul: string
  tone: 'coral' | 'amber'
  rec: string
  primary: string
  primaryClass: string
  secondary: string
  doneLabel: string
  secondaryLabel: string
}

const approvals: Approval[] = [
  {
    id: '409',
    product: 'Strawberries',
    rul: 'RUL 14h (-42%)',
    tone: 'coral',
    rec: 'Priority FEFO Dispatch to Metro Hub',
    primary: 'Approve Dispatch',
    primaryClass: 'bg-ice',
    secondary: 'Hold',
    doneLabel: 'Dispatch approved',
    secondaryLabel: 'On hold',
  },
  {
    id: '218',
    product: 'Spinach',
    rul: 'RUL 22h',
    tone: 'amber',
    rec: 'Quality Risk Review Required',
    primary: 'Review Risk',
    primaryClass: 'bg-amber',
    secondary: 'Escalate',
    doneLabel: 'Risk reviewed',
    secondaryLabel: 'Escalated',
  },
]

const TOTAL_PENDING = 3

export function ApprovalsCard({ onPendingChange }: { onPendingChange: (n: number) => void }) {
  const [decisions, setDecisions] = useState<Record<string, 'primary' | 'secondary'>>({})
  const pending = TOTAL_PENDING - Object.keys(decisions).length

  useEffect(() => onPendingChange(pending), [pending, onPendingChange])

  const undo = (id: string) =>
    setDecisions((d) => {
      const next = { ...d }
      delete next[id]
      return next
    })

  return (
    <section className="rounded-[24px] bg-panel p-4 text-white">
      <header className="flex items-center justify-between">
        <Tag className="text-[14px]">Dispatch Approvals</Tag>
        <span className="flex items-center gap-1.5 rounded-full bg-ink py-1.5 pl-2 pr-2.5 font-mono text-[10.5px] font-semibold ring-1 ring-white/10">
          <span className="relative flex size-2">
            <span className="ping-soft absolute inset-0 rounded-full bg-amber" />
            <span className="relative size-2 rounded-full bg-amber" />
          </span>
          {pending} Pending
        </span>
      </header>

      <ul className="mt-3.5 flex flex-col gap-2.5">
        {approvals.map((a) => {
          const d = decisions[a.id]
          return (
            <li key={a.id} className="relative overflow-hidden rounded-2xl bg-[#18191E] p-3.5">
              <span
                aria-hidden
                className={`absolute inset-y-3.5 left-0 w-[3px] rounded-r-full ${a.tone === 'coral' ? 'bg-coral' : 'bg-amber'}`}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.04em] text-white/50">
                  Batch #{a.id} • {a.product}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                    a.tone === 'coral' ? 'bg-coral/15 text-[#FF8A78]' : 'bg-amber/12 text-amber'
                  }`}
                >
                  {a.rul}
                </span>
              </div>
              <p className="mt-1.5 text-[15px] font-bold leading-snug">{a.rec}</p>

              <div className="mt-3 flex gap-2">
                {d ? (
                  <>
                    <span className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white/[0.06] text-[14px] font-bold text-white/85">
                      <Check className="size-4 text-live" strokeWidth={3} />
                      {d === 'primary' ? a.doneLabel : a.secondaryLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => undo(a.id)}
                      aria-label={`Undo decision for batch ${a.id}`}
                      className="grid size-12 place-items-center rounded-full text-white/70 ring-1 ring-inset ring-white/15 active:bg-white/5"
                    >
                      <Undo2 className="size-[18px]" strokeWidth={2.2} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setDecisions((s) => ({ ...s, [a.id]: 'primary' }))}
                      className={`h-12 flex-[1.6] rounded-full text-[14px] font-bold text-ink transition active:scale-[0.98] ${a.primaryClass}`}
                    >
                      {a.primary}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecisions((s) => ({ ...s, [a.id]: 'secondary' }))}
                      className="h-12 flex-1 rounded-full text-[14px] font-semibold text-white/80 ring-1 ring-inset ring-white/15 transition active:bg-white/5"
                    >
                      {a.secondary}
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        className="mt-3 flex w-full items-center justify-between rounded-2xl bg-white/[0.04] px-3.5 py-3 text-[12.5px] active:bg-white/[0.07]"
      >
        <span className="text-white/60">
          <span className="font-semibold text-white/85">+1 more</span> · Whole Milk re-route to Vault C
        </span>
        <ArrowRight className="size-4 text-ice" strokeWidth={2.4} />
      </button>
    </section>
  )
}
