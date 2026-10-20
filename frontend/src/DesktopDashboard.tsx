import { useCallback, useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import ShelfLifeCard from './components/ShelfLifeCard'
import TelemetryMapCard from './components/TelemetryMapCard'
import QueueCard from './components/QueueCard'
import DispatchQueueModal from './components/DispatchQueueModal'
import DesktopHeader, { type WorkspaceTab } from './components/DesktopHeader'
import SettingsModal from './components/SettingsModal'
import {
  AnalyticsView,
  DecisionsView,
  HistoryView,
  ManagerDecisionsCard,
  SensorsView,
  StockOverviewView,
} from './components/WorkspaceViews'
import { InventoryProvider } from './data/InventoryContext'

const FRAME_W = 1440
const FRAME_H = 900

/** Uniform scale so the 1440×900 composition always fits the viewport intact. */
function useFitScale() {
  const compute = () => Math.min(window.innerWidth / FRAME_W, window.innerHeight / FRAME_H)
  const [scale, setScale] = useState(compute)
  useEffect(() => {
    const onResize = () => setScale(compute())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return scale
}

export default function DesktopDashboard({
  onLogout,
}: {
  onLogout: () => void
}) {
  const scale = useFitScale()
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = window.localStorage.getItem('freshops-theme')
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview')
  const [queueOpen, setQueueOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const openQueue = useCallback(() => setQueueOpen(true), [])
  const closeQueue = useCallback(() => setQueueOpen(false), [])
  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem('freshops-theme', next)
      return next
    })
  }, [])
  const changeTheme = useCallback((next: 'dark' | 'light') => {
    window.localStorage.setItem('freshops-theme', next)
    setTheme(next)
  }, [])

  return (
    <InventoryProvider>
      <div className={`relative h-screen w-screen overflow-hidden bg-night ${theme === 'light' ? 'theme-light' : ''}`}>
      <div
        className="dashboard-scrollbars absolute left-1/2 top-1/2 flex flex-col overflow-hidden border border-line bg-night font-sans text-fg shadow-[0_32px_90px_rgb(0_0_0/0.45)]"
        style={{
          width: FRAME_W,
          height: FRAME_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <h1 className="sr-only">Dynamic Perishable Inventory Management System</h1>
        <DesktopHeader
          active={activeTab}
          onChange={setActiveTab}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setSettingsOpen(true)}
          onLogout={onLogout}
        />
        <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_340px] gap-3 p-3">
          <Sidebar />

          {activeTab === 'overview' ? (
            <>
              <main className="flex min-h-0 min-w-0 flex-col gap-3">
                <div className="min-h-0 flex-1">
                  <ShelfLifeCard />
                </div>
                <div className="h-[260px] shrink-0">
                  <TelemetryMapCard />
                </div>
              </main>

              <aside className="grid min-h-0 min-w-0 grid-rows-[154px_minmax(0,1fr)] gap-3">
                <ManagerDecisionsCard onOpenQueue={openQueue} />
                <div className="flex min-h-0">
                  <QueueCard onOpenQueue={openQueue} />
                </div>
              </aside>
            </>
          ) : (
            <main className="col-span-2 min-h-0 min-w-0">
              {activeTab === 'analytics' && <AnalyticsView />}
              {activeTab === 'stock-overview' && <StockOverviewView />}
              {activeTab === 'sensors' && <SensorsView />}
              {activeTab === 'decisions' && <DecisionsView onOpenQueue={openQueue} />}
              {activeTab === 'history' && <HistoryView />}
            </main>
          )}
        </div>
        {queueOpen && <DispatchQueueModal onClose={closeQueue} />}
        {settingsOpen && (
          <SettingsModal
            onClose={() => setSettingsOpen(false)}
            theme={theme}
            onThemeChange={changeTheme}
          />
        )}
      </div>
      </div>
    </InventoryProvider>
  )
}
