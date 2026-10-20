import { Clock3 } from 'lucide-react'
import { ArrowButton, card, CardHint, CardTitle } from './ui'

const SIZE = 264
const C = SIZE / 2

/** Angle in degrees, clockwise from 00:00 at the top of a 24h dial. */
const hourToDeg = (h: number) => (h / 24) * 360

function polar(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180
  return { x: C + r * Math.sin(rad), y: C - r * Math.cos(rad) }
}

function arc(startH: number, endH: number, r: number) {
  const end = endH <= startH ? endH + 24 : endH
  const a = polar(hourToDeg(startH), r)
  const b = polar(hourToDeg(end), r)
  const large = (end - startH) * 15 > 180 ? 1 : 0
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`
}

function sector(startH: number, endH: number, r: number) {
  return `M ${C} ${C} L ${arc(startH, endH, r).slice(2)} Z`
}

const rings = [
  { label: 'Optimal Quality', color: '#10B981', r: 90, from: 4.5, to: 17 },
  { label: 'Quality At Risk', color: '#F5A623', r: 76, from: 17, to: 22 },
  { label: 'Microbial Danger', color: '#FF5C5C', r: 62, from: 22, to: 3 },
]

const NOW = 14 + 16 / 60
const CUTOFF = 16.5
const FG = '#F4F5F7'

export default function FefoDialCard({ onOpenQueue }: { onOpenQueue: () => void }) {
  const needle = polar(hourToDeg(CUTOFF), 108)
  const tail = polar(hourToDeg(CUTOFF) + 180, 16)
  const nowHand = polar(hourToDeg(NOW), 84)

  return (
    <section className={`${card} relative flex h-full min-h-0 flex-col overflow-hidden p-[22px]`}>
      <header className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <CardTitle className="text-[15px]">Shelf-Life Risk Window</CardTitle>
          <CardHint>24h product risk zones · shift B</CardHint>
        </div>
        <ArrowButton label="Open at-risk product register" onClick={onOpenQueue} />
      </header>

      <div className="relative z-10 mt-6 w-fit">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">Pick deadline</p>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-night py-1.5 pl-2.5 pr-3 text-[12.5px] font-medium text-fg">
          <Clock3 className="size-3.5 text-warn" strokeWidth={2.2} />
          04:30 PM Cutoff
        </span>
        <p className="mt-2.5 font-mono text-[10.5px] text-muted">
          T-minus <span className="font-semibold text-fg">02h 14m</span>
        </p>
      </div>

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        className="absolute -right-[64px] top-1/2 mt-7 -translate-y-1/2"
        role="img"
        aria-label="24-hour product risk dial. Optimal quality until 17:00, quality at risk from 17:00 to 22:00, microbial danger after 22:00. Pick cutoff at 16:30."
      >
        <defs>
          <radialGradient id="dial-face" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1F2128" />
            <stop offset="100%" stopColor="#131418" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={128} fill="url(#dial-face)" stroke="#262830" />

        {Array.from({ length: 96 }, (_, i) => {
          const deg = i * 3.75
          const major = i % 4 === 0
          const a = polar(deg, major ? 113 : 118)
          const b = polar(deg, 123)
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={FG}
              strokeOpacity={major ? 0.45 : 0.12}
              strokeWidth={major ? 1.2 : 0.8}
            />
          )
        })}

        {[0, 6, 12, 18].map((h) => {
          const p = polar(hourToDeg(h), 103)
          return (
            <text
              key={h}
              x={p.x}
              y={p.y + 3.5}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="500"
              fill="#8E929E"
              className="font-mono"
            >
              {String(h).padStart(2, '0')}
            </text>
          )
        })}

        <path d={sector(NOW, CUTOFF, 96)} fill="#38BDF8" fillOpacity={0.08} />

        {rings.map((ring) => (
          <g key={ring.label}>
            <circle cx={C} cy={C} r={ring.r} fill="none" stroke="#22242B" strokeWidth={4} />
            <path d={arc(ring.from, ring.to, ring.r)} fill="none" stroke={ring.color} strokeWidth={3} strokeLinecap="round" />
          </g>
        ))}

        <line x1={C} y1={C} x2={nowHand.x} y2={nowHand.y} stroke="#38BDF8" strokeWidth={1.4} strokeLinecap="round" />
        <line x1={tail.x} y1={tail.y} x2={needle.x} y2={needle.y} stroke={FG} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={needle.x} cy={needle.y} r={3.5} fill={FG} />
        <circle cx={C} cy={C} r={7} fill={FG} />
        <circle cx={C} cy={C} r={2.5} fill="#18191E" />
      </svg>

      <ul className="relative z-10 mt-auto flex w-fit flex-col gap-1.5">
        {rings.map((ring) => (
          <li
            key={ring.label}
            className="flex items-center gap-2 rounded-full border border-line bg-night/90 py-1 pl-2 pr-3 font-mono text-[10.5px] text-muted backdrop-blur-sm"
          >
            <span className="size-2 rounded-full" style={{ background: ring.color, boxShadow: `0 0 8px ${ring.color}` }} />
            {ring.label}
          </li>
        ))}
      </ul>
    </section>
  )
}
