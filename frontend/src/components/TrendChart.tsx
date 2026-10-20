import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'

export type TrendPoint = { ts: string; value: number }

// A fixed sample count keeps the path's command count constant, so its `d` can transition between updates.
const SAMPLES = 32
const PAD = { left: 36, right: 16, top: 12, bottom: 24 }

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

/** Fixed-length series: bucket averages when there are more readings than samples, linear interpolation when fewer. */
function resample(values: number[], n: number) {
  if (values.length > n) {
    return Array.from({ length: n }, (_, i) => {
      const bucket = values.slice(Math.floor((i * values.length) / n), Math.floor(((i + 1) * values.length) / n))
      return bucket.reduce((s, v) => s + v, 0) / bucket.length
    })
  }
  return Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * (values.length - 1)
    const a = Math.floor(t)
    const b = Math.min(values.length - 1, a + 1)
    return values[a] + (values[b] - values[a]) * (t - a)
  })
}

/** Clean y ticks (1/2/2.5/5 × 10ⁿ) covering the data and the optional threshold. */
function niceScale(values: number[], include?: number) {
  let min = Math.min(...values, include ?? Infinity)
  let max = Math.max(...values, include ?? -Infinity)
  if (max - min < 1) {
    min -= 0.5
    max += 0.5
  }
  const raw = (max - min) / 3
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 1000; v += step) ticks.push(Number(v.toFixed(6)))
  return { lo, hi, ticks }
}

export default function TrendChart({
  points,
  color,
  unit,
  label,
  threshold,
}: {
  points: TrendPoint[]
  color: string
  unit: string
  label: string
  threshold?: { value: number; label: string }
}) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    // Layout size (not the scaled visual size), so the chart stays crisp inside the scaled dashboard frame.
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const enough = points.length >= 2 && size.w > 0
  const values = points.map((p) => p.value)
  const { lo, hi, ticks } = niceScale(values.length ? values : [0], threshold?.value)
  const plotW = Math.max(1, size.w - PAD.left - PAD.right)
  const plotH = Math.max(1, size.h - PAD.top - PAD.bottom)
  const xAt = (fraction: number) => PAD.left + fraction * plotW
  const yAt = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH
  const base = PAD.top + plotH

  const ys = enough ? resample(values, SAMPLES) : []
  const line = ys.map((v, i) => `${i ? 'L' : 'M'}${xAt(i / (SAMPLES - 1)).toFixed(1)},${yAt(v).toFixed(1)}`).join('')
  const area = `${line}L${xAt(1).toFixed(1)},${base}L${xAt(0).toFixed(1)},${base}Z`
  const last = points.at(-1)
  const at = (i: number) => ({ x: xAt(i / (points.length - 1)), y: yAt(points[i].value) })
  const end = enough ? at(points.length - 1) : { x: 0, y: 0 }
  const shown = active == null ? null : { ...at(active), point: points[active] }
  const xTicks = enough ? [0, 1, 2, 3].map((q) => Math.round((q / 3) * (points.length - 1))) : []

  const pick = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setActive(Math.round(fraction * (points.length - 1)))
  }
  const step = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const from = active ?? points.length - 1
    setActive(Math.min(points.length - 1, Math.max(0, from + (e.key === 'ArrowRight' ? 1 : -1))))
  }

  return (
    <div ref={box} className="relative h-full w-full">
      {!enough ? (
        <p className="grid h-full place-items-center text-[11px] text-muted">No readings in the last hour</p>
      ) : (
        <>
          <svg
            width={size.w}
            height={size.h}
            role="img"
            tabIndex={0}
            aria-label={`${label}: ${last!.value.toFixed(1)}${unit} now, between ${Math.min(...values).toFixed(1)} and ${Math.max(...values).toFixed(1)}${unit} over the period. Use left and right arrows to read values.`}
            onKeyDown={step}
            onFocus={() => setActive(points.length - 1)}
            onBlur={() => setActive(null)}
            className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sky/60"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={PAD.left + plotW} y1={yAt(t)} y2={yAt(t)} stroke="var(--color-line)" strokeWidth="1" />
                <text x={PAD.left - 8} y={yAt(t)} dy="0.32em" textAnchor="end" className="fill-muted font-mono text-[10px]">
                  {t}
                </text>
              </g>
            ))}
            {threshold && (
              <g>
                <line x1={PAD.left} x2={PAD.left + plotW} y1={yAt(threshold.value)} y2={yAt(threshold.value)} stroke="var(--color-danger)" strokeOpacity="0.6" strokeWidth="1" />
                <text x={PAD.left + plotW} y={yAt(threshold.value) - 5} textAnchor="end" className="fill-muted font-mono text-[9.5px]">
                  {threshold.label}
                </text>
              </g>
            )}
            <path className="chart-morph" style={{ d: `path("${area}")` } as CSSProperties} fill={color} fillOpacity="0.1" />
            <path
              className="chart-morph"
              style={{ d: `path("${line}")` } as CSSProperties}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {xTicks.map((i, k) => (
              <text
                key={k}
                x={at(i).x}
                y={base + 16}
                textAnchor={k === 0 ? 'start' : k === xTicks.length - 1 ? 'end' : 'middle'}
                className="fill-muted font-mono text-[10px]"
              >
                {fmtTime(points[i].ts)}
              </text>
            ))}
            {/* Live reading: a steady dot with a soft pulse so "now" reads at a glance. */}
            <circle className="chart-dot ping-soft" style={{ cx: end.x, cy: end.y, transformBox: 'fill-box', transformOrigin: 'center' } as CSSProperties} r="4" fill={color} />
            <circle className="chart-dot" style={{ cx: end.x, cy: end.y } as CSSProperties} r="4" fill={color} stroke="var(--color-surface)" strokeWidth="2" />
            {shown && (
              <g pointerEvents="none">
                <line x1={shown.x} x2={shown.x} y1={PAD.top} y2={base} stroke="var(--color-muted)" strokeOpacity="0.5" strokeWidth="1" />
                <circle cx={shown.x} cy={shown.y} r="4" fill={color} stroke="var(--color-surface)" strokeWidth="2" />
              </g>
            )}
            <rect
              x={PAD.left}
              y={PAD.top}
              width={plotW}
              height={plotH}
              fill="transparent"
              onPointerMove={pick}
              onPointerLeave={() => setActive(null)}
            />
          </svg>
          {shown && (
            <div
              className="pointer-events-none absolute rounded-lg border border-line bg-raised px-2.5 py-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.25)]"
              style={{
                left: Math.min(shown.x + 10, size.w - 110),
                top: Math.max(0, shown.y - 46),
              }}
            >
              <p className="font-mono text-[12px] font-bold tabular-nums text-fg">
                {shown.point.value.toFixed(1)}
                <span className="ml-0.5 text-[10px] font-medium text-muted">{unit}</span>
              </p>
              <p className="font-mono text-[10px] text-muted">{fmtTime(shown.point.ts)}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
