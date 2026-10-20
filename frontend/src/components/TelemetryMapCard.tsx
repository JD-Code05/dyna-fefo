import { useState } from 'react'
import { BatteryMedium, ChevronDown, Droplets, Radio, Thermometer } from 'lucide-react'
import { useInventory } from '../data/InventoryContext'
import { card, CardHint, CardTitle } from './ui'

const anomalyMeta = {
  'sensor-204': {
    status: 'Critical thermal breach',
    detail: '+4.7°C above target · Batch B-409 degrading 3× faster',
    updated: '12 sec ago',
    warning: true,
  },
  'sensor-072': {
    status: 'Rapid temperature rise',
    detail: '+0.4°C in 15 min · approaching the configured limit',
    updated: '24 sec ago',
    warning: true,
  },
  'sensor-014': {
    status: 'Low signal and temperature drift',
    detail: 'Signal below -68 dBm · temperature 1.2°C above target',
    updated: '31 sec ago',
    warning: true,
  },
} as const

export default function TelemetryMapCard() {
  const { sensors: allSensors } = useInventory()
  const sensors = allSensors
    .filter((sensor) => sensor.key in anomalyMeta)
    .map((sensor) => ({ ...sensor, ...anomalyMeta[sensor.key as keyof typeof anomalyMeta] }))
  const [expanded, setExpanded] = useState<string | null>('sensor-204')

  return (
    <section className={`${card} flex h-full min-h-0 flex-col overflow-hidden p-[22px]`}>
      <header>
        <CardTitle className="text-[15px]">Unusual Sensor Readings</CardTitle>
        <CardHint>{sensors.length} anomalies require attention · ranked by operational risk</CardHint>
      </header>

      <div className="mt-4 grid grid-cols-[1fr_56px_50px_18px] items-center gap-2 border-b border-line px-2 pb-2 font-mono text-[8.5px] uppercase tracking-[0.08em] text-muted">
        <span>Sensor</span>
        <span>Temp</span>
        <span>RH</span>
        <span />
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain pr-1 [scrollbar-color:var(--color-line)_transparent] [scrollbar-width:thin]">
        {sensors.map((sensor) => {
          const isExpanded = expanded === sensor.key

          return (
            <li key={sensor.key}>
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setExpanded(isExpanded ? null : sensor.key)}
                className="grid w-full grid-cols-[1fr_56px_50px_18px] items-center gap-2 px-2 py-2.5 text-left transition-colors hover:bg-white/[0.025]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`size-1.5 shrink-0 rounded-full ${sensor.warning ? 'bg-warn' : 'bg-ok'}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-[11.5px] font-semibold text-fg">{sensor.location} · {sensor.name}</span>
                    <span className="block font-mono text-[8.5px] text-muted">{sensor.id}</span>
                  </span>
                </span>
                <span className={`font-mono text-[11.5px] font-semibold ${sensor.warning ? 'text-warn' : 'text-fg'}`}>
                  {sensor.temperature.toFixed(1)}°C
                </span>
                <span className="font-mono text-[11.5px] text-fg">{sensor.humidity}%</span>
                <ChevronDown
                  className={`size-3.5 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  strokeWidth={2}
                />
              </button>

              {isExpanded && (
                <div className="mx-2 mb-2.5 rounded-xl border border-line bg-night/60 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-lg ${
                          sensor.warning ? 'bg-warn/10 text-warn' : 'bg-ok/10 text-ok'
                        }`}
                      >
                        <Thermometer className="size-3.5" strokeWidth={2.2} />
                      </span>
                      <p className="min-w-0">
                        <span className={`block text-[10.5px] font-semibold ${sensor.warning ? 'text-warn' : 'text-ok'}`}>
                          {sensor.status}
                        </span>
                        <span className="block truncate text-[9px] text-muted">{sensor.detail}</span>
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[8.5px] text-muted">{sensor.updated}</span>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <span className="flex items-center gap-1 rounded-lg border border-line px-1.5 py-1 font-mono text-[8.5px] text-muted">
                      <Droplets className="size-3 text-sky" /> {sensor.humidity}% RH
                    </span>
                    <span className="flex items-center gap-1 rounded-lg border border-line px-1.5 py-1 font-mono text-[8.5px] text-muted">
                      <Radio className="size-3" /> {sensor.signal} dBm
                    </span>
                    <span className="flex items-center gap-1 rounded-lg border border-line px-1.5 py-1 font-mono text-[8.5px] text-muted">
                      <BatteryMedium className="size-3" /> {sensor.battery}%
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
