import { useEffect, useState, type AnimationEvent, type CSSProperties } from 'react'

// Crate path: lift by hy, carry across by dx, set down at dy (SVG units), starting at `at` seconds.
const lift = (dx: number, dy: number, hy: number, at: number) =>
  ({ '--dx': dx, '--dy': dy, '--hy': hy, '--at': `${at}s` }) as CSSProperties

const dock = (
  <>
    <line className="faint" x1="0" y1="53" x2="200" y2="53" />
    <path className="soft" d="M4 53 V40 H46 V53 M4 40 V14 H40" />
    <path className="soft" d="M9 18 l3 3 m0 -3 l-3 3 M10.5 17 v5 M8 19.5 h5" />
  </>
)

/** Line drawing for a staff "done" row: truck for shipped, bin for salvaged. Loops unless `once`. */
export default function DoneAnimation({ salvage, play, once = false }: { salvage: boolean; play: boolean; once?: boolean }) {
  const [run, setRun] = useState(0) // a new number remounts the svg, which replays it
  // older rows start on the parked-and-loaded picture; reduced motion never leaves it
  const [still, setStill] = useState(() => !play || matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [waiting, setWaiting] = useState(!play) // true = 7 s pause before the next replay
  const [leaving, setLeaving] = useState(false) // end picture fading out just before the replay
  useEffect(() => {
    if (!waiting || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const out = setTimeout(() => setLeaving(true), 6_600)
    const replay = setTimeout(() => { setLeaving(false); setWaiting(false); setStill(false); setRun((n) => n + 1) }, 7_000)
    return () => { clearTimeout(out); clearTimeout(replay) }
  }, [waiting])
  // last step done (truck out of frame / bin red): pause, then replay
  const onEnd = (e: AnimationEvent) => { if (!once && e.animationName === (salvage ? 'done-red' : 'done-drive')) setWaiting(true) }
  const cls = `done-anim ${salvage ? 'salv' : 'ship'}${still ? ' still' : ''}${leaving ? ' leaving' : ''}`

  if (salvage)
    return (
      <svg key={run} onAnimationEnd={onEnd} className={cls} viewBox="0 0 200 60" role="img" aria-label="Salvaged: crates put in the bin">
        {dock}
        <g className="fx">
          <g className="crate" style={lift(109, 23, -10, 0.3)}><rect x="16" y="20" width="10" height="10" rx="1" /><path d="M16 25 H26" /></g>
          <g className="crate" style={lift(115, 13, -20, 1)}><rect x="22" y="30" width="10" height="10" rx="1" /><path d="M22 35 H32" /></g>
          <g className="crate" style={lift(121, 3, -20, 1.7)}><rect x="10" y="30" width="10" height="10" rx="1" /><path d="M10 35 H20" /></g>
          <path className="bin ln" d="M121 27 L124 53 H148 L151 27" />
          <path className="bin soft" d="M128 33 V49 M136 33 V49 M144 33 V49" />
          <circle className="ln fill" cx="146" cy="53" r="2.5" />
          <g className="lid"><path className="bin ln" d="M119 27 H153 M151 27 V24 H121 V27" /></g>
        </g>
      </svg>
    )

  return (
    <svg key={run} onAnimationEnd={onEnd} className={cls} viewBox="0 0 200 60" role="img" aria-label="Shipped: crates loaded onto the truck">
      {dock}
      <svg x="0" y="56" width="200" height="2" overflow="hidden">
        <g className="dashes soft">
          {Array.from({ length: 14 }, (_, i) => <line key={i} x1={4 + i * 16} y1="1" x2={12 + i * 16} y2="1" />)}
        </g>
      </svg>
      <g className="fx">
        <g className="rig">
          <g className="crate" style={lift(110, 18, -7, 0.3)}><rect x="16" y="20" width="10" height="10" rx="1" /><path d="M16 25 H26" /></g>
          <g className="crate" style={lift(92, 8, -7, 1)}><rect x="22" y="30" width="10" height="10" rx="1" /><path d="M22 35 H32" /></g>
          <g className="crate" style={lift(92, 8, -7, 1.7)}><rect x="10" y="30" width="10" height="10" rx="1" /><path d="M10 35 H20" /></g>
          <path className="ln" d="M70 48 V20 H140 V48" />
          <path className="ln" d="M66 48 H170 V38 L162 30 H140" />
          <path className="soft" d="M144 33 H160 L164 37 H144 Z" />
          <line className="ramp soft" x1="70" y1="48" x2="48" y2="40" />
          <line className="door ln" x1="70" y1="20" x2="70" y2="48" />
          <circle className="ln fill" cx="86" cy="48" r="5" />
          <circle className="ln fill" cx="156" cy="48" r="5" />
          <path className="wheel soft" d="M86 45 V51 M83 48 H89" />
          <path className="wheel soft" d="M156 45 V51 M153 48 H159" />
        </g>
      </g>
    </svg>
  )
}
