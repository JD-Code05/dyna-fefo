import { useCallback, useLayoutEffect, useState } from 'react'
import { flushSync } from 'react-dom'
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
import PullListCard from './components/PullListCard'
import { InventoryProvider } from './data/InventoryContext'

export type Role = 'supervisor' | 'staff'

export default function DesktopDashboard({
  role,
  onLogout,
}: {
  role: Role
  onLogout: () => void
}) {
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
  const changeTheme = useCallback((next: 'dark' | 'light') => {
    window.localStorage.setItem('freshops-theme', next)
    // Cross-fade the page instead of flipping every color in one frame; browsers without view transitions switch instantly.
    if (!document.startViewTransition) return setTheme(next)
    document.startViewTransition(() => flushSync(() => setTheme(next)))
  }, [])
  const toggleTheme = useCallback(() => changeTheme(theme === 'dark' ? 'light' : 'dark'), [changeTheme, theme])
  // The theme class lives on <html> so the page background and overscroll match too.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('theme-light', theme === 'light')
  }, [theme])

  return (
    <InventoryProvider>
      {/* Fills the window at real size so browser zoom works; below xl the page stacks and scrolls. */}
      <div
        className="dashboard-scrollbars flex min-h-dvh flex-col bg-night font-sans text-fg xl:h-dvh xl:overflow-hidden"
      >
        <h1 className="sr-only">Dynamic Perishable Inventory Management System</h1>
        <DesktopHeader
          role={role}
          active={activeTab}
          onChange={setActiveTab}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setSettingsOpen(true)}
          onLogout={onLogout}
        />
        {role === 'staff' ? (
          // Staff: read-only. What to pull next, plus the freshness and sensor evidence behind it.
          <div className="grid flex-1 grid-cols-1 gap-3 p-3 xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_340px]">
            <main className="view-in flex min-w-0 flex-col gap-3 xl:min-h-0">
              <div className="flex shrink-0 sm:h-[420px] xl:h-[46%]">
                <PullListCard />
              </div>
              <div className="sm:h-[560px] xl:h-auto xl:min-h-0 xl:flex-1">
                <ShelfLifeCard />
              </div>
            </main>
            <aside className="view-in flex min-w-0 flex-col gap-3 xl:min-h-0">
              <div className="h-[320px] xl:h-auto xl:min-h-0 xl:flex-1">
                <TelemetryMapCard />
              </div>
            </aside>
          </div>
        ) : (
          <div className="grid flex-1 grid-cols-1 gap-3 p-3 xl:min-h-0 xl:grid-cols-[250px_minmax(0,1fr)_340px]">
            <Sidebar onSelectTab={setActiveTab} onOpenQueue={openQueue} />

            {activeTab === 'overview' ? (
              <>
                {/* Hero: what needs a decision now. The shelf-life chart below is the evidence for it. */}
                <main className="view-in flex min-w-0 flex-col gap-3 xl:min-h-0">
                  <div className="flex shrink-0 sm:h-[420px] xl:h-[46%]">
                    <QueueCard />
                  </div>
                  <div className="sm:h-[560px] xl:h-auto xl:min-h-0 xl:flex-1">
                    <ShelfLifeCard />
                  </div>
                </main>

                <aside className="view-in flex min-w-0 flex-col gap-3 xl:min-h-0">
                  <ManagerDecisionsCard onOpenQueue={openQueue} />
                  <div className="h-[320px] xl:h-auto xl:min-h-0 xl:flex-1">
                    <TelemetryMapCard />
                  </div>
                </aside>
              </>
            ) : (
              // key remounts the view on every tab change so .view-in replays.
              <main key={activeTab} className="view-in min-w-0 xl:col-span-2 xl:min-h-0">
                {activeTab === 'analytics' && <AnalyticsView />}
                {activeTab === 'stock-overview' && <StockOverviewView />}
                {activeTab === 'sensors' && <SensorsView />}
                {activeTab === 'decisions' && <DecisionsView onOpenQueue={openQueue} />}
                {activeTab === 'history' && <HistoryView />}
              </main>
            )}
          </div>
        )}
        {queueOpen && <DispatchQueueModal onClose={closeQueue} />}
        {settingsOpen && (
          <SettingsModal
            onClose={() => setSettingsOpen(false)}
            theme={theme}
            onThemeChange={changeTheme}
          />
        )}
      </div>
    </InventoryProvider>
  )
}
