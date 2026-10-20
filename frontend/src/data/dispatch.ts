export type Breach = 'critical' | 'spike' | null
export type Action = 'dispatch' | 'review' | 'audit'

export type DispatchBatch = {
  id: string
  product: string
  zone: string
  units: number
  value: number
  avgTemp: number
  peakTemp: number
  /** Index (0–23) of the hourly reading where the peak occurred. */
  peakAt: number
  breach: Breach
  staticHours: number
  dynamicHours: number
  demand: number
  rec: string
  confidence: number
  saves: number
  action: Action
}

/** Sorted by dynamic RUL — first expiring, first out. */
export const dispatchBatches: DispatchBatch[] = [
  { id: 'H-061', product: 'Fresh Basil', zone: 'Chiller Bay 1', units: 150, value: 540, avgTemp: 5.4, peakTemp: 9.4, peakAt: 15, breach: 'critical', staticHours: 20, dynamicHours: 9, demand: 34, rec: 'Quality hold: visual and microbial audit', confidence: 81, saves: 210, action: 'audit' },
  { id: 'B-409', product: 'Strawberries', zone: 'Chiller Bay 2', units: 240, value: 3120, avgTemp: 4.8, peakTemp: 8.9, peakAt: 18, breach: 'critical', staticHours: 24, dynamicHours: 14, demand: 91, rec: 'Expedite priority dispatch to Metro Hub', confidence: 94, saves: 2980, action: 'dispatch' },
  { id: 'G-218', product: 'Baby Spinach', zone: 'Chiller Bay 2', units: 180, value: 1260, avgTemp: 4.1, peakTemp: 6.7, peakAt: 17, breach: 'spike', staticHours: 30.5, dynamicHours: 22, demand: 64, rec: 'Prioritize quality review across 6 stores', confidence: 88, saves: 820, action: 'review' },
  { id: 'S-377', product: 'Atlantic Salmon', zone: 'Cold Vault', units: 96, value: 4410, avgTemp: 1.4, peakTemp: 5.6, peakAt: 9, breach: 'spike', staticHours: 40, dynamicHours: 29, demand: 88, rec: 'Priority dispatch to Harbor St. store', confidence: 91, saves: 1640, action: 'dispatch' },
  { id: 'M-918', product: 'Cremini Mushroom', zone: 'Chiller Bay 2', units: 200, value: 760, avgTemp: 4.6, peakTemp: 7.8, peakAt: 19, breach: 'spike', staticHours: 52, dynamicHours: 33, demand: 49, rec: 'Inspect slow-moving inventory for quality loss', confidence: 84, saves: 390, action: 'review' },
  { id: 'D-104', product: 'Whole Milk', zone: 'Loading Dock', units: 420, value: 1890, avgTemp: 3.6, peakTemp: 4.6, peakAt: 6, breach: null, staticHours: 38, dynamicHours: 36, demand: 72, rec: 'Internal re-route to Cold Vault C', confidence: 97, saves: 260, action: 'dispatch' },
  { id: 'A-552', product: 'Hass Avocado', zone: 'Ripening Room', units: 300, value: 1080, avgTemp: 6.1, peakTemp: 7.0, peakAt: 12, breach: null, staticHours: 96, dynamicHours: 90, demand: 58, rec: 'Standard FEFO wave 3 dispatch', confidence: 95, saves: 120, action: 'dispatch' },
  { id: 'Y-233', product: 'Greek Yogurt', zone: 'Chiller Bay 1', units: 360, value: 1620, avgTemp: 3.2, peakTemp: 4.4, peakAt: 4, breach: null, staticHours: 120, dynamicHours: 114, demand: 76, rec: 'Standard FEFO wave 4 dispatch', confidence: 96, saves: 90, action: 'dispatch' },
]

export const HIGH_VALUE = 1800
export const PRIORITY_DISPATCH_HOURS = 72

export function isPriorityDispatchCandidate(
  batch: Pick<DispatchBatch, 'breach' | 'dynamicHours'>,
) {
  return Boolean(batch.breach) || batch.dynamicHours <= PRIORITY_DISPATCH_HOURS
}

/** Deterministic hourly temperature history that rises to the recorded peak. */
export function temperatureSeries(b: DispatchBatch): number[] {
  return Array.from({ length: 24 }, (_, i) => {
    const noise = Math.sin(i * 1.7 + b.units) * 0.35 + Math.cos(i * 0.9) * 0.2
    const spread = b.breach ? 2.2 : 3.5
    const bump = Math.exp(-((i - b.peakAt) ** 2) / (2 * spread ** 2))
    return b.avgTemp - 0.4 + noise * 0.6 + (b.peakTemp - b.avgTemp + 0.4) * bump
  })
}
