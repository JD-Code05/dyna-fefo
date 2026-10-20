import { useState } from 'react'
import { ChevronDown, Clock3, Droplets, Thermometer } from 'lucide-react'
import { useInventory, type SensorRecord } from '../data/InventoryContext'
import { card, CardHint, CardTitle } from './ui'

const TARGET_C = 4
const rank: Record<SensorRecord['status'], number> = { Critical: 0, 'No data': 1, Online: 2 }

function describe(sensor: SensorRecord) {
  if (sensor.status === 'No data') return { status: 'No readings yet', detail: 'Sensor has not reported to its zone' }
  const over = (sensor.temperature ?? 0) - TARGET_C
  return sensor.status === 'Critical'
    ? { status: 'Above chilled limit', detail: `+${over.toFixed(1)}°C above ${TARGET_C}°C · batches in ${sensor.location} age faster` }
    : { status: 'Within range', detail: `${Math.abs(over).toFixed(1)}°C below the ${TARGET_C}°C limit` }
}

export default function TelemetryMapCard() {
  const { sensors: allSensors } = useInventory()
  const sensors = [...allSensors].sort((a, b) => rank[a.status] - rank[b.status])
  const alerts = sensors.filter((s) => s.status !== 'Online').length
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <section className={`${card} flex h-full min-h-0 flex-col overflow-hidden p-[22px]`}>
      <header>
        <CardTitle className="text-[15px]">Sensor Readings</CardTitle>
        <CardHint>{alerts ? `${alerts} need attention` : 'All sensors within range'} · live from each zone</CardHint>
      </header>

      <div className="mt-4 grid grid-cols-[1fr_56px_50px_18px] items-center gap-2 border-b border-line px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
        <span>Sensor</span>
        <span>Temp</span>
        <span>RH</span>
        <span />
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain pr-1 [scrollbar-color:var(--color-line)_transparent] [scrollbar-width:thin]">
        {sensors.map((sensor) => {
          const isExpanded = expanded === sensor.key
          const warning = sensor.status !== 'Online'
          const info = describe(sensor)

          return (
            <li key={sensor.key}>
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setExpanded(isExpanded ? null : sensor.key)}
                className="grid w-full grid-cols-[1fr_56px_50px_18px] items-center gap-2 px-2 py-2.5 text-left transition-colors hover:bg-white/[0.025]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`size-1.5 shrink-0 rounded-full ${warning ? 'bg-warn' : 'bg-ok'}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-[11.5px] font-semibold text-fg" title={`${sensor.location} · ${sensor.name}`}>
                      {sensor.location} · {sensor.name}
                    </span>
                    <span className="block font-mono text-[10px] text-muted">{sensor.id}</span>
                  </span>
                </span>
                <span className={`font-mono text-[11.5px] font-semibold ${warning ? 'text-warn' : 'text-fg'}`}>
                  {sensor.temperature == null ? '—' : `${sensor.temperature.toFixed(1)}°C`}
                </span>
                <span className="font-mono text-[11.5px] text-fg">{sensor.humidity == null ? '—' : `${Math.round(sensor.humidity)}%`}</span>
                <ChevronDown className={`size-3.5 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} strokeWidth={2} />
              </button>

              {isExpanded && (
                <div className="mx-2 mb-2.5 rounded-xl border border-line bg-night/60 p-2.5">
                  <div className="flex items-start gap-2">
                    <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${warning ? 'bg-warn/10 text-warn' : 'bg-ok/10 text-ok'}`}>
                      <Thermometer className="size-3.5" strokeWidth={2.2} />
                    </span>
                    <p className="min-w-0">
                      <span className={`block text-[10.5px] font-semibold ${warning ? 'text-warn' : 'text-ok'}`}>{info.status}</span>
                      <span className="block text-[10.5px] text-muted">{info.detail}</span>
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <span className="flex items-center gap-1 rounded-lg border border-line px-1.5 py-1 font-mono text-[10px] text-muted">
                      <Droplets className="size-3 text-sky" /> {sensor.humidity == null ? '—' : `${Math.round(sensor.humidity)}% RH`}
                    </span>
                    <span className="flex items-center gap-1 rounded-lg border border-line px-1.5 py-1 font-mono text-[10px] text-muted">
                      <Clock3 className="size-3" /> {sensor.updated ?? 'never'}
                    </span>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
