import { createContext, useContext, useState, type ReactNode } from 'react'
import { dispatchBatches, type DispatchBatch } from './dispatch'

export type SensorRecord = {
  key: string
  id: string
  name: string
  location: string
  temperature: number
  humidity: number
  battery: number
  signal: number
  status: string
}

export type StockState = 'moving' | 'dispatched' | 'stored' | 'hold' | 'inspection'

export type StockRecord = DispatchBatch & {
  key: string
  category: string
  detail: string
  identifier: string
  activity: { state: StockState; label: string; detail: string; updated: string }
}

const sensorSeed: SensorRecord[] = [
  { key: 'sensor-204', id: 'SNS-204', name: 'Thermal Probe 204', location: 'Chiller Bay 2', temperature: 8.9, humidity: 72, battery: 82, signal: -61, status: 'Critical' },
  { key: 'sensor-118', id: 'SNS-118', name: 'Climate Probe 118', location: 'Chiller Bay 1', temperature: 3.2, humidity: 88, battery: 91, signal: -54, status: 'Online' },
  { key: 'sensor-086', id: 'SNS-086', name: 'Climate Probe 086', location: 'Cold Vault', temperature: 3.6, humidity: 84, battery: 76, signal: -58, status: 'Online' },
  { key: 'sensor-072', id: 'SNS-072', name: 'Thermal Probe 072', location: 'Loading Dock', temperature: 4.1, humidity: 79, battery: 68, signal: -67, status: 'Warning' },
  { key: 'sensor-031', id: 'SNS-031', name: 'Climate Probe 031', location: 'Ripening Room', temperature: 2.9, humidity: 86, battery: 94, signal: -51, status: 'Online' },
  { key: 'sensor-014', id: 'SNS-014', name: 'Dock Probe 014', location: 'Receiving Bay', temperature: 5.2, humidity: 67, battery: 61, signal: -70, status: 'Warning' },
]

const stockMeta: Record<string, Omit<StockRecord, keyof DispatchBatch | 'key'>> = {
  'H-061': { category: 'Fresh herbs', detail: '12 × 125g vented packs', identifier: 'STK-HRB-0061', activity: { state: 'hold', label: 'Quality hold', detail: 'Awaiting microbial audit', updated: '2 min ago' } },
  'B-409': { category: 'Fresh berries', detail: '24 × 250g clamshells', identifier: 'STK-BRY-0409', activity: { state: 'moving', label: 'Moving out', detail: 'Transfer to outbound lane 03', updated: 'Just now' } },
  'G-218': { category: 'Leafy greens', detail: '18 × 500g sealed bags', identifier: 'STK-GRN-0218', activity: { state: 'inspection', label: 'Under inspection', detail: 'Quality review in progress', updated: '6 min ago' } },
  'S-377': { category: 'Fresh seafood', detail: '96 vacuum-packed fillets', identifier: 'STK-SEA-0377', activity: { state: 'dispatched', label: 'Dispatched', detail: 'En route to Harbor St.', updated: '18 min ago' } },
  'M-918': { category: 'Fresh produce', detail: '20 × 1kg cartons', identifier: 'STK-PRD-0918', activity: { state: 'inspection', label: 'Quality review', detail: 'Sampling 12 units', updated: '9 min ago' } },
  'D-104': { category: 'Chilled dairy', detail: '35 × 12-bottle crates', identifier: 'STK-DRY-0104', activity: { state: 'moving', label: 'Relocating', detail: 'Moving to Cold Vault C', updated: '4 min ago' } },
  'A-552': { category: 'Fresh produce', detail: '30 × 10-count trays', identifier: 'STK-PRD-0552', activity: { state: 'stored', label: 'Stored', detail: 'Ripening cycle active', updated: '1 min ago' } },
  'Y-233': { category: 'Chilled dairy', detail: '30 × 12-cup cases', identifier: 'STK-DRY-0233', activity: { state: 'stored', label: 'Staged', detail: 'Reserved for dispatch wave 4', updated: '3 min ago' } },
}

const stockSeed: StockRecord[] = dispatchBatches.map((batch) => ({
  ...batch,
  key: `stock-${batch.id}`,
  ...stockMeta[batch.id],
}))

type InventoryContextValue = {
  sensors: SensorRecord[]
  stocks: StockRecord[]
  locations: string[]
  categories: string[]
  updateSensor: (key: string, updates: Pick<SensorRecord, 'name' | 'id' | 'location'>) => void
  addSensor: (name: string, location: string) => void
  deleteSensor: (key: string) => void
  addLocation: (location: string) => void
  addCategory: (category: string) => void
  deleteLocation: (location: string) => void
  deleteCategory: (category: string) => void
  updateStock: (
    key: string,
    updates: Pick<StockRecord, 'product' | 'zone' | 'detail' | 'identifier' | 'units' | 'value'>,
  ) => void
  deleteStock: (key: string) => void
  addStock: (input: {
    product: string
    zone: string
    units: number
    value?: number
    batchId?: string
    category?: string
    detail?: string
    identifier?: string
    printedExpiration?: string
  }) => void
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [sensors, setSensors] = useState(sensorSeed)
  const [stocks, setStocks] = useState(stockSeed)
  const [locations, setLocations] = useState([
    'Chiller Bay 1',
    'Chiller Bay 2',
    'Cold Vault',
    'Loading Dock',
    'Ripening Room',
    'Receiving Bay',
  ])
  const [categories, setCategories] = useState(['Produce', 'Frozen goods', 'Fresh Meats', 'Dairy'])

  const updateSensor: InventoryContextValue['updateSensor'] = (key, updates) =>
    setSensors((records) => records.map((record) => (record.key === key ? { ...record, ...updates } : record)))

  const addSensor: InventoryContextValue['addSensor'] = (name, location) =>
    setSensors((records) => {
      const sequence = records.length + 1
      return [
        ...records,
        {
          key: `sensor-new-${Date.now()}`,
          id: `SNS-${String(300 + sequence).padStart(3, '0')}`,
          name,
          location,
          temperature: 3.5,
          humidity: 80,
          battery: 100,
          signal: -55,
          status: 'Online',
        },
      ]
    })

  const deleteSensor: InventoryContextValue['deleteSensor'] = (key) =>
    setSensors((records) => records.filter((record) => record.key !== key))

  const addLocation: InventoryContextValue['addLocation'] = (location) =>
    setLocations((records) =>
      records.some((record) => record.toLowerCase() === location.trim().toLowerCase())
        ? records
        : [...records, location.trim()],
    )

  const addCategory: InventoryContextValue['addCategory'] = (category) =>
    setCategories((records) =>
      records.some((record) => record.toLowerCase() === category.trim().toLowerCase())
        ? records
        : [...records, category.trim()],
    )

  const deleteLocation: InventoryContextValue['deleteLocation'] = (location) =>
    setLocations((records) => records.filter((record) => record !== location))

  const deleteCategory: InventoryContextValue['deleteCategory'] = (category) =>
    setCategories((records) => records.filter((record) => record !== category))

  const updateStock: InventoryContextValue['updateStock'] = (key, updates) =>
    setStocks((records) => records.map((record) => (record.key === key ? { ...record, ...updates } : record)))

  const deleteStock: InventoryContextValue['deleteStock'] = (key) =>
    setStocks((records) => records.filter((record) => record.key !== key))

  const addStock: InventoryContextValue['addStock'] = ({
    product,
    zone,
    units,
    value = 0,
    batchId,
    category,
    detail,
    identifier,
    printedExpiration,
  }) =>
    setStocks((records) => {
      const sequence = records.length + 1
      const id = batchId || `N-${String(sequence).padStart(3, '0')}`
      const expirationTime = printedExpiration
        ? new Date(`${printedExpiration}T23:59:59`).getTime()
        : Date.now() + 72 * 60 * 60 * 1000
      const printedHours = Math.max(1, Math.ceil((expirationTime - Date.now()) / (60 * 60 * 1000)))
      return [
        ...records,
        {
          key: `stock-new-${Date.now()}`,
          id,
          product,
          zone,
          units,
          value,
          avgTemp: 3.5,
          peakTemp: 3.8,
          peakAt: 0,
          breach: null,
          staticHours: printedHours,
          dynamicHours: printedHours,
          demand: 50,
          rec: 'New stock received · awaiting warehouse review',
          confidence: 100,
          saves: 0,
          action: 'review',
          category: category || 'New inventory',
          detail: detail || 'Newly created stock record',
          identifier: identifier || `STK-NEW-${String(sequence).padStart(4, '0')}`,
          activity: {
            state: 'stored',
            label: 'Received',
            detail: 'Awaiting put-away confirmation',
            updated: 'Just now',
          },
        },
      ]
    })

  return (
    <InventoryContext.Provider
      value={{
        sensors,
        stocks,
        locations,
        categories,
        updateSensor,
        addSensor,
        deleteSensor,
        addLocation,
        addCategory,
        deleteLocation,
        deleteCategory,
        updateStock,
        deleteStock,
        addStock,
      }}
    >
      {children}
    </InventoryContext.Provider>
  )
}

export function useInventory() {
  const value = useContext(InventoryContext)
  if (!value) throw new Error('useInventory must be used within InventoryProvider')
  return value
}
