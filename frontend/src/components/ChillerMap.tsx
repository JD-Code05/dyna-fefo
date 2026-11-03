import { useMemo, type CSSProperties } from 'react'
import { useInventory, type SensorRecord, type StockRecord } from '../data/InventoryContext'

type Pt = [number, number, number]
type Tone = 'plain' | 'ok' | 'warn' | 'danger'

const ROOM_W = 62
const ROOM_D = 60
const WALL_H = 34
const ROOM_GAP = 120 // screen units between rooms: wide enough that one room's walls never cover the next
const VIEW_X = -60
const VIEW_Y = -50
const VIEW_H = 160
// Front slots first: the most urgent batch gets the place nothing can stand in front of.
const SLOTS: [number, number][] = [[38, 40], [10, 40], [38, 14], [10, 14]]

const COS = Math.cos(Math.PI / 6)
const project = ([x, y, z]: Pt): [number, number] => [(x - y) * COS, (x + y) / 2 - z]
const toPoints = (pts: Pt[]) => pts.map((p) => project(p).map((n) => n.toFixed(1)).join(',')).join(' ')
const circle = (cx: number, y: number, cz: number, r: number): Pt[] =>
  Array.from({ length: 21 }, (_, i): Pt => {
    const a = (i / 20) * Math.PI * 2
    return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)]
  })

function Plate({ pts, tone = 'plain' }: { pts: Pt[]; tone?: Tone | 'wall' | 'floor-ok' | 'floor-warn' | 'floor-danger' | 'dock' }) {
  return <polygon className={`cm-${tone}`} points={toPoints(pts)} />
}

function Line({ pts, kind = 'mid' }: { pts: Pt[]; kind?: 'edge' | 'mid' | 'faint' | 'air' }) {
  return <polyline className={`cm-${kind}`} points={toPoints(pts)} />
}

function Box({ x, y, z, dx, dy, dz, tone = 'plain' }: { x: number; y: number; z: number; dx: number; dy: number; dz: number; tone?: Tone }) {
  return (
    <>
      <Plate tone={tone} pts={[[x, y + dy, z], [x + dx, y + dy, z], [x + dx, y + dy, z + dz], [x, y + dy, z + dz]]} />
      <Plate tone={tone} pts={[[x + dx, y, z], [x + dx, y + dy, z], [x + dx, y + dy, z + dz], [x + dx, y, z + dz]]} />
      <Plate tone={tone} pts={[[x, y, z + dz], [x + dx, y, z + dz], [x + dx, y + dy, z + dz], [x, y + dy, z + dz]]} />
    </>
  )
}

function Crate({ x, y, z, tone, dx = 7.5, dy = 5 }: { x: number; y: number; z: number; tone: Tone; dx?: number; dy?: number }) {
  const dz = 5
  return (
    <>
      <Box x={x} y={y} z={z} dx={dx} dy={dy} dz={dz} tone={tone} />
      <Line pts={[[x, y + dy, z + dz / 2], [x + dx, y + dy, z + dz / 2]]} />
      <Line pts={[[x + dx, y, z + dz / 2], [x + dx, y + dy, z + dz / 2]]} />
    </>
  )
}

function Rack() {
  const x = 10
  const y = 1
  const len = 20
  return (
    <>
      {[1, 9, 17].map((z) => (
        <g key={z}>
          <Box x={x} y={y} z={z} dx={len} dy={7} dz={0.7} />
          {[0, 1].map((i) => (i * 7 + z) % 5 !== 0 && <Crate key={i} x={x + 1 + i * 9} y={y + 1} z={z + 0.7} tone="plain" />)}
        </g>
      ))}
      {[x, x + len].map((ux) => (
        <g key={ux}>
          <Line kind="edge" pts={[[ux, y + 7, 0], [ux, y + 7, 24]]} />
          <Line pts={[[ux, y, 0], [ux, y, 24]]} />
        </g>
      ))}
    </>
  )
}

function Cooler() {
  const x = 32
  return (
    <>
      <Box x={x} y={0} z={25} dx={24} dy={6} dz={7} />
      {[x + 6.5, x + 17.5].map((cx) => (
        <g key={cx}>
          <Line kind="edge" pts={circle(cx, 6, 28.5, 2.9)} />
          <Line pts={[[cx - 2.9, 6, 28.5], [cx + 2.9, 6, 28.5]]} />
          <Line pts={[[cx, 6, 25.6], [cx, 6, 31.4]]} />
          <Line kind="air" pts={[[cx, 8, 24], [cx, 11, 12]]} />
        </g>
      ))}
    </>
  )
}

function Room({ tone }: { tone: 'ok' | 'warn' | 'danger' }) {
  return (
    <>
      <Plate tone={`floor-${tone}`} pts={[[0, 0, 0], [ROOM_W, 0, 0], [ROOM_W, ROOM_D, 0], [0, ROOM_D, 0]]} />
      <Plate tone="wall" pts={[[0, 0, 0], [ROOM_W, 0, 0], [ROOM_W, 0, WALL_H], [0, 0, WALL_H]]} />
      <Plate tone="wall" pts={[[0, 0, 0], [0, ROOM_D, 0], [0, ROOM_D, WALL_H], [0, 0, WALL_H]]} />
      {[10, 20, 30, 40, 50, 60].map((x) => <Line key={x} kind="faint" pts={[[x, 0, 0], [x, 0, WALL_H]]} />)}
      {[10, 20, 30, 40, 50].map((y) => <Line key={y} kind="faint" pts={[[0, y, 0], [0, y, WALL_H]]} />)}
      <Plate pts={[[0, 41, 0], [0, 55, 0], [0, 55, 25], [0, 41, 25]]} />
      {[43, 45, 47, 49, 51, 53].map((y) => <Line key={y} pts={[[0, y, 1], [0, y, 25]]} />)}
      <Cooler />
    </>
  )
}

function Sensor({ status }: { status: SensorRecord['status'] | null }) {
  if (!status) return null
  const [u, v] = project([0.5, 8, 20])
  const color = status === 'Critical' ? 'danger' : 'ok'
  return (
    <>
      <Box x={0.5} y={6.5} z={17} dx={1} dy={3} dz={4} />
      {status === 'No data' ? (
        <>
          <circle className="cm-lost" cx={u} cy={v} r={6} />
          <circle className="cm-dot-off" cx={u} cy={v} r={1.8} />
        </>
      ) : (
        <>
          <circle className={`cm-ring cm-ring-${color}`} cx={u} cy={v} r={8} />
          <circle className={`cm-ring cm-ring-${color} cm-ring-late`} cx={u} cy={v} r={8} />
          <circle className={`cm-dot-${color}`} cx={u} cy={v} r={1.8} />
        </>
      )}
    </>
  )
}

const layersFor = (units: number) => Math.min(4, Math.max(1, Math.ceil(units / 10)))

function Pallet({ x, y, units, tone }: { x: number; y: number; units: number; tone: Tone }) {
  return (
    <>
      {/* Pulse a floor tile, not the stack: fading the crates would turn them see-through. */}
      {tone === 'danger' && <polygon className="cm-alarm" points={toPoints([[x - 3, y - 3, 0], [x + 19, y - 3, 0], [x + 19, y + 19, 0], [x - 3, y + 19, 0]])} />}
      <Box x={x} y={y} z={0} dx={16} dy={16} dz={1.4} />
      {Array.from({ length: layersFor(units) }, (_, layer) =>
        ([[0, 0], [1, 0], [0, 1], [1, 1]] as const).map(([i, j]) => (
          <Crate key={`${layer}-${i}-${j}`} x={x + 0.5 + i * 7.6} y={y + 0.5 + j * 7.6} z={1.4 + layer * 5} dx={7.2} dy={7.2} tone={tone} />
        )),
      )}
    </>
  )
}

// Scenery only: the data has no dock, so it never changes.
function Dock() {
  const wheels: [number, number][] = [[36, 23], [47, 23], [58, 21]]
  return (
    <>
      <Plate tone="dock" pts={[[0, 0, 0], [70, 0, 0], [70, 40, 0], [0, 40, 0]]} />
      {/* Wheels first: the body's plates hide their top half, so they read as under the truck. */}
      {wheels.map(([cx, y]) => <Plate key={cx} pts={circle(cx, y, 2.4, 2.4)} />)}
      <Box x={30} y={8} z={3} dx={24} dy={15} dz={13} />
      <Line pts={[[30, 23, 9], [54, 23, 9]]} />
      <Box x={54} y={10} z={3} dx={9} dy={11} dz={9} />
    </>
  )
}

function Pin({ at, offsetX, offsetY = 0, tone, width, height, children }: {
  at: Pt
  offsetX: number
  offsetY?: number
  tone: 'room' | 'quiet' | 'batch-ok' | 'batch-warn' | 'batch-danger' | 'more'
  width: number
  height: number
  children: string
}) {
  const [u, v] = project(at)
  const left = `${((u + offsetX - VIEW_X) / width) * 100}%`
  const top = `${((v + offsetY - VIEW_Y) / height) * 100}%`
  return <span className={`cm-pin cm-pin-${tone}`} style={{ left, top }}>{children}</span>
}

const roomName = (zone: string) => zone.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function roomTone(sensors: SensorRecord[]): 'ok' | 'warn' | 'danger' {
  if (sensors.some((s) => s.status === 'Critical')) return 'danger'
  return sensors.length && sensors.every((s) => s.status === 'Online') ? 'ok' : 'warn'
}

function worstStatus(sensors: SensorRecord[]): SensorRecord['status'] | null {
  if (!sensors.length) return null
  if (sensors.some((s) => s.status === 'Critical')) return 'Critical'
  return sensors.some((s) => s.status === 'No data') ? 'No data' : 'Online'
}

export default function ChillerMap() {
  const { locations, sensors, stocks, orders } = useInventory()

  const rooms = useMemo(() => {
    const ordered = new Map(orders.map((o) => [o.stock.key, o.rec.type]))
    const batchTone = (s: StockRecord): 'ok' | 'warn' | 'danger' => {
      const type = s.recommendation?.type ?? ordered.get(s.key)
      if (type === 'SALVAGE') return 'danger'
      return type || s.rec.startsWith('Flagged') ? 'warn' : 'ok'
    }
    return locations.map((zone) => {
      const stored = stocks
        .filter((s) => s.zone === zone && s.activity.state === 'stored')
        .sort((a, b) => a.dynamicHours - b.dynamicHours)
      const placed = stored.slice(0, SLOTS.length).map((stock, i) => ({ stock, tone: batchTone(stock), slot: SLOTS[i] }))
      return { zone, sensors: sensors.filter((s) => s.location === zone), placed, hidden: stored.length - placed.length, count: stored.length }
    })
  }, [locations, sensors, stocks, orders])

  if (!rooms.length) {
    return <div className="grid min-h-[240px] flex-1 place-items-center text-xs text-muted">No zones to draw yet.</div>
  }

  const width = (rooms.length - 1) * ROOM_GAP + 125
  const dockX = ((rooms.length - 1) * ROOM_GAP) / 2 - 12
  const label = rooms
    .map((r) => `${roomName(r.zone)}: ${worstStatus(r.sensors) ?? 'no sensor'}, ${r.count} ${r.count === 1 ? 'batch' : 'batches'} in storage`)
    .join('. ')
  const pin = { width, height: VIEW_H }

  return (
    <div className="chiller-map" style={{ '--cm-w': width, '--cm-h': VIEW_H } as CSSProperties}>
      <div className="cm-stage" role="img" aria-label={`Chiller map, placement is illustrative. ${label}.`}>
        <svg viewBox={`${VIEW_X} ${VIEW_Y} ${width} ${VIEW_H}`} aria-hidden="true">
          {rooms.map((room, i) => (
            <g key={room.zone} transform={`translate(${i * ROOM_GAP},0)`}>
              <Room tone={roomTone(room.sensors)} />
              <Sensor status={worstStatus(room.sensors)} />
              <Rack />
              {/* Painter's order: farthest pallet first, so nearer stacks cover it. */}
              {[...room.placed].sort((a, b) => a.slot[0] + a.slot[1] - (b.slot[0] + b.slot[1])).map(({ stock, tone, slot }) => (
                <Pallet key={stock.key} x={slot[0]} y={slot[1]} units={stock.units} tone={tone} />
              ))}
            </g>
          ))}
          <g transform={`translate(${dockX},50)`}><Dock /></g>
        </svg>
        {rooms.map((room, i) => (
          <span key={room.zone}>
            <Pin {...pin} at={[0, 0, WALL_H + 3]} offsetX={i * ROOM_GAP} tone="room">{roomName(room.zone)}</Pin>
            {room.placed.map(({ stock, tone, slot }) => (
              <Pin {...pin} key={stock.key} at={[slot[0] + 8, slot[1] + 8, 1.4 + layersFor(stock.units) * 5 + 2]} offsetX={i * ROOM_GAP} tone={`batch-${tone}`}>{stock.id}</Pin>
            ))}
            {room.hidden > 0 && <Pin {...pin} at={[59, 38, 0]} offsetX={i * ROOM_GAP} tone="more">{`+${room.hidden} more`}</Pin>}
          </span>
        ))}
        <Pin {...pin} at={[20, 30, 0]} offsetX={dockX} offsetY={50} tone="quiet">Loading dock</Pin>
      </div>
    </div>
  )
}
