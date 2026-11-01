import { useEffect, useRef } from 'react'

// World: x = along the road (truck drives +x), y = across, z = up. Isometric projection.
type Pt = [number, number, number]
const C = Math.cos(Math.PI / 6)
const P = ([x, y, z]: Pt): [number, number] => [(x - y) * C, (x + y) / 2 - z]
const pts = (a: Pt[]) => a.map(P).map(([u, v]) => `${u.toFixed(2)},${v.toFixed(2)}`).join(' ')
const poly = (a: Pt[], cls: string) => `<polygon class="${cls}" points="${pts(a)}"/>`
const line = (a: Pt, b: Pt, cls: string) => poly([a, b], cls)
const lerp = (a: Pt, b: Pt, t: number) => a.map((n, i) => n + (b[i] - n) * t) as Pt

// Visible faces of an axis-aligned box: top, +x, +y.
const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, cls: string) =>
  poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], cls) +
  poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], cls) +
  poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], cls)

function wheel(cx: number, cz: number, y: number, r: number, spin: number) {
  const ring = (rad: number) =>
    Array.from({ length: 20 }, (_, i): Pt => {
      const a = (i / 20) * Math.PI * 2
      return [cx + rad * Math.cos(a), y, cz + rad * Math.sin(a)]
    })
  let s = poly(ring(r), 'plate') + poly(ring(r * 0.45), 'ln')
  for (const a of [spin, spin + Math.PI / 2]) {
    const d = [Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8]
    s += line([cx - d[0], y, cz - d[1]], [cx + d[0], y, cz + d[1]], 'ln')
  }
  return s
}

const ROAD = { x0: -40, x1: 130, far: -16, near: 38, mid: -6 }
const VIEWBOX = (() => {
  // road corners, cab roof at peak bob, farthest wind line
  const corners = ([[ROAD.x0, ROAD.far, 0], [ROAD.x1, ROAD.far, 0], [ROAD.x0, ROAD.near, 0], [ROAD.x1, ROAD.near, 0], [62, 0, 33], [-39, 8, 28]] as Pt[]).map(P)
  const us = corners.map((p) => p[0]), vs = corners.map((p) => p[1])
  const minU = Math.min(...us), minV = Math.min(...vs)
  return `${minU - 4} ${minV - 4} ${Math.max(...us) - minU + 8} ${Math.max(...vs) - minV + 8}`
})()

const SPEED = 55 // road units per second
function frame(t: number) {
  const dist = t * SPEED
  const z = Math.sin(t * 13) * 0.35
  const crateBob = Math.sin(t * 13 - 1.4) * 0.45
  let s = ''

  // road: edges and moving centre dashes, then the truck's shadow
  s += line([ROAD.x0, ROAD.far, 0], [ROAD.x1, ROAD.far, 0], 'faint')
  s += line([ROAD.x0, ROAD.near, 0], [ROAD.x1, ROAD.near, 0], 'faint')
  const off = dist % 20
  for (let x = ROAD.x0 - off; x < ROAD.x1; x += 20) {
    const a = Math.max(x, ROAD.x0), b = Math.min(x + 10, ROAD.x1)
    if (b > a) s += line([a, ROAD.mid, 0], [b, ROAD.mid, 0], 'ln')
  }
  s += poly([[2, 2, 0], [88, 2, 0], [88, 26, 0], [2, 26, 0]], 'shadow')

  // wind trailing the truck
  ;[[10, 16], [18, 22], [8, 28]].forEach(([y, wz], i) => {
    const f = (t * 1.3 + i / 3) % 1
    const x = -4 - f * 26
    s += `<g opacity="${(1 - f).toFixed(2)}">${line([x, y, wz], [x - 9, y, wz], 'ln')}</g>`
  })

  // chassis, then flatbed
  s += box(4, 82, 3, 21, 4 + z, 8 + z, 'plate')
  s += box(0, 60, 0, 24, 8 + z, 11 + z, 'plate')

  // crate: the item in transit
  const cz = 11 + z + Math.max(0, crateBob)
  s += box(12, 44, 4, 20, cz, cz + 18, 'cargo')
  s += line([12, 20, cz], [44, 20, cz + 18], 'ln-cargo')
  s += line([44, 20, cz], [12, 20, cz + 18], 'ln-cargo')
  s += line([44, 4, cz], [44, 20, cz + 18], 'ln-cargo')
  s += line([12, 12, cz + 18], [44, 12, cz + 18], 'ln-cargo')

  // cab: a side profile pushed across the truck's width
  const prof = [[62, 8], [86, 8], [86, 19], [77, 32], [62, 32]].map(([x, h]) => [x, h + z])
  const at = (p: number[], y: number): Pt => [p[0], y, p[1]]
  s += poly([at(prof[4], 0), at(prof[3], 0), at(prof[3], 24), at(prof[4], 24)], 'plate') // roof
  s += poly([at(prof[3], 0), at(prof[2], 0), at(prof[2], 24), at(prof[3], 24)], 'plate') // windscreen slope
  s += poly([at(prof[1], 0), at(prof[1], 24), at(prof[2], 24), at(prof[2], 0)], 'plate') // front
  s += poly(prof.map((p) => at(p, 24)), 'plate') // side
  s += poly([[65, 24, 20 + z], [83, 24, 20 + z], [77.6, 24, 28.5 + z], [65, 24, 28.5 + z]], 'ln') // side window
  const D = at(prof[3], 0), Cc = at(prof[2], 0)
  const ws = (t0: number, y: number): Pt => { const p = lerp(D, Cc, t0); return [p[0], y, p[2]] }
  s += poly([ws(0.15, 3), ws(0.85, 3), ws(0.85, 21), ws(0.15, 21)], 'ln') // windscreen
  s += line([86, 7, 12 + z], [86, 17, 12 + z], 'ln') // grille
  for (const y of [2.5, 18.5]) s += poly([[86, y, 13.5 + z], [86, y + 3, 13.5 + z], [86, y + 3, 16 + z], [86, y, 16 + z]], 'lamp')
  s += line([62, 24, 8 + z], [62, 24, 32 + z], 'ln') // door seam

  // wheels on the near side
  const spin = -dist / 6
  for (const x of [14, 44, 74]) s += wheel(x, 6, 24.5, 6, spin)
  return s
}

/** Full-screen loader shown while a dashboard waits for its first data: a line-art truck on a moving road. */
export default function TruckLoader() {
  const svg = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const el = svg.current
    if (!el) return
    // Draw straight into the svg each frame so React doesn't re-render 60 times a second.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.innerHTML = frame(0)
      return
    }
    let id = requestAnimationFrame(function loop(ms) {
      el.innerHTML = frame(ms / 1000)
      id = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="truck-loader" role="status">
      <svg ref={svg} viewBox={VIEWBOX} aria-hidden="true" />
      <p>Loading your dashboard…</p>
    </div>
  )
}
