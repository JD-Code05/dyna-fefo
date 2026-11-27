// The mascot's motion decisions, kept free of the DOM so they can be tested with `node --test`.
// Frame ids refer to the symbols in /mascot/frames.svg (built by design/mascot/build_frames.py).

export type Spring = { x: number; v: number; to: number; k: number; c: number }

/** A spring toward `to`; damping 1 = no overshoot, below 1 = a light bounce. */
export function spring(x: number, stiffness = 170, damping = 0.6): Spring {
  return { x, v: 0, to: x, k: stiffness, c: 2 * Math.sqrt(stiffness) * damping }
}

/** Advance one step (semi-implicit Euler) and return the new position. */
export function stepSpring(s: Spring, dt: number): number {
  s.v += (s.k * (s.to - s.x) - s.c * s.v) * dt
  s.x += s.v * dt
  return s.x
}

export type Gesture = {
  frames: string[]
  step: number // ms per frame of the opening sequence
  loop?: string[]
  loopStep?: number
  hold?: string
  then?: string[] // played after `thenAfter` ms of holding
  thenAfter?: number
  hop?: boolean
}

/** One gesture per stop, right to left: wave, salute, point, cheer, bow. */
export const STOPS: Gesture[] = [
  { frames: ['c01', 'c02', 'c03', 'c04'], step: 110, loop: ['c03', 'c04'], loopStep: 260 },
  { frames: ['c05', 'c06', 'c07'], step: 120, hold: 'c07' },
  { frames: ['c09', 'c10', 'c11'], step: 120, hold: 'c11' },
  { frames: ['d01', 'd02', 'd03'], step: 110, loop: ['d03', 'd04'], loopStep: 220, hop: true },
  { frames: ['d05', 'd06', 'd07'], step: 140, hold: 'd07', then: ['d08', 'p02'], thenAfter: 900 },
]

const WALK = ['b01', 'b02', 'b03', 'b04']
const STEP_PX = 26 // one walk frame per this much travel, so the feet never slide
const IDLE_AFTER_MS = 2600 // after a held gesture, start looking around
const FRONT = 'p02'
const LOOK = 'a01'

export const ALL_FRAME_IDS: string[] = [
  ...new Set([FRONT, LOOK, 'a02', ...WALK, ...STOPS.flatMap(g => [...g.frames, ...(g.loop ?? []), ...(g.hold ? [g.hold] : []), ...(g.then ?? [])])]),
]

/** Which of the five stops a scroll progress points at. */
export function stopFor(progress: number): number {
  return Math.round(Math.min(Math.max(progress, 0), 1) * (STOPS.length - 1))
}

export type FrameState = {
  moving: boolean
  turn: number // 0 = facing the reader, 1 = turned to walk
  velocity: number // px/s, negative = walking left
  travelled: number // total px walked, drives the step frames
  stop: number
  sinceArrived: number // ms since it stopped at `stop`
  mouseX: number | null // 0..1 across the window, null = no fine pointer
}

export type FramePick = { id: string; mirror: boolean; fast: boolean }

function gestureFrame(g: Gesture, since: number): string {
  const seqEnd = g.frames.length * g.step
  if (since < seqEnd) return g.frames[Math.floor(since / g.step)]
  if (g.loop) return g.loop[Math.floor((since - seqEnd) / (g.loopStep ?? g.step)) % g.loop.length]
  const thenAt = seqEnd + (g.thenAfter ?? Infinity)
  if (g.then && since >= thenAt) return g.then[Math.min(g.then.length - 1, Math.floor((since - thenAt) / 140))]
  return g.hold ?? g.frames[g.frames.length - 1]
}

/** The frame to show now. Walk and turn frames face left; `mirror` flips them when moving right. */
export function pickFrame(s: FrameState): FramePick {
  const right = s.velocity > 0
  if (s.moving && s.turn > 0.85) return { id: WALK[Math.floor(s.travelled / STEP_PX) % WALK.length], mirror: right, fast: true }
  if (s.turn > 0.55) return { id: 'a02', mirror: right, fast: false }
  if (s.turn > 0.2) return { id: LOOK, mirror: right, fast: false }

  const g = STOPS[s.stop]
  const idle = !g.loop && s.sinceArrived > g.frames.length * g.step + IDLE_AFTER_MS
  if (!idle) return { id: gestureFrame(g, s.sinceArrived), mirror: false, fast: false }
  if (s.mouseX !== null && s.mouseX < 0.38) return { id: LOOK, mirror: false, fast: false }
  if (s.mouseX !== null && s.mouseX > 0.62) return { id: LOOK, mirror: true, fast: false }
  return { id: FRONT, mirror: false, fast: false }
}

/** Width to draw at: the preferred size if it fits, else the free space down to 160 px, else hidden. */
export function layoutFit(free: number, preferred: number): number | null {
  if (free >= preferred) return preferred
  return free >= 160 ? free : null
}
