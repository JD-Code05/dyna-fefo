// Run: cd frontend && node --test src/components/mascot/motion.test.ts   (Node 24 runs TypeScript directly)
import assert from 'node:assert/strict'
import test from 'node:test'

import { ALL_FRAME_IDS, layoutFit, pickFrame, spring, stepSpring, stopFor } from './motion.ts'

const rest = { moving: false, turn: 0, velocity: 0, travelled: 0, stop: 0, sinceArrived: 0, mouseX: null as number | null }

test('stopFor clamps progress outside 0-1 and rounds to one of five stops', () => {
  assert.equal(stopFor(-0.5), 0)
  assert.equal(stopFor(0.49), 2)
  assert.equal(stopFor(1.7), 4)
})

test('layoutFit keeps the preferred size, shrinks to the free space, or hides below 160 px', () => {
  assert.equal(layoutFit(104, 300), null)
  assert.equal(layoutFit(200, 300), 200)
  assert.equal(layoutFit(400, 300), 300)
})

test('walking left steps through b01-b04 by distance, unmirrored and fast', () => {
  const walking = { ...rest, moving: true, turn: 1, velocity: -50 }
  assert.deepEqual(pickFrame({ ...walking, travelled: 0 }), { id: 'b01', mirror: false, fast: true })
  assert.equal(pickFrame({ ...walking, travelled: 27 }).id, 'b02')
})

test('walking right mirrors the walk frames', () => {
  assert.equal(pickFrame({ ...rest, moving: true, turn: 1, velocity: 50 }).mirror, true)
})

test('turning shows the three-quarter frame, then the slight turn', () => {
  assert.equal(pickFrame({ ...rest, moving: true, turn: 0.6, velocity: -10 }).id, 'a02')
  assert.equal(pickFrame({ ...rest, moving: true, turn: 0.3, velocity: -10 }).id, 'a01')
})

test('at the first stop it starts the wave, then loops c03/c04', () => {
  assert.equal(pickFrame({ ...rest, stop: 0, sinceArrived: 0 }).id, 'c01')
  assert.equal(pickFrame({ ...rest, stop: 0, sinceArrived: 440 }).id, 'c03')
})

test('after a held gesture it idles and looks toward the mouse', () => {
  const idle = { ...rest, stop: 2, sinceArrived: 5000 }
  assert.deepEqual(pickFrame({ ...idle, mouseX: 0.1 }), { id: 'a01', mirror: false, fast: false })
  assert.deepEqual(pickFrame({ ...idle, mouseX: 0.9 }), { id: 'a01', mirror: true, fast: false })
  assert.equal(pickFrame({ ...idle, mouseX: null }).id, 'p02')
})

test('every frame pickFrame can return is listed in ALL_FRAME_IDS', () => {
  const seen = new Set<string>()
  for (let stop = 0; stop < 5; stop++)
    for (let t = 0; t < 8000; t += 20)
      for (const mouseX of [null, 0.1, 0.5, 0.9]) seen.add(pickFrame({ ...rest, stop, sinceArrived: t, mouseX }).id)
  for (const turn of [0.3, 0.6, 1])
    for (let travelled = 0; travelled < 200; travelled += 5) seen.add(pickFrame({ ...rest, moving: true, turn, velocity: -1, travelled }).id)
  for (const id of seen) assert.ok(ALL_FRAME_IDS.includes(id), `${id} missing from ALL_FRAME_IDS`)
})

test('stepSpring settles on its target', () => {
  const s = spring(0)
  s.to = 100
  for (let i = 0; i < 300; i++) stepSpring(s, 1 / 60)
  assert.ok(Math.abs(s.x - 100) < 0.5, `ended at ${s.x}`)
})
