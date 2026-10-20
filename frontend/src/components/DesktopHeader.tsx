import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  Boxes,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  Gauge,
  History,
  LogOut,
  Moon,
  Settings,
  Snowflake,
  Sun,
} from 'lucide-react'
import { useInventory } from '../data/InventoryContext'

const sections = [
  { id: 'overview', label: 'Overview', icon: ChartNoAxesCombined },
  { id: 'stock-overview', label: 'Stock Overview', icon: Boxes },
  { id: 'analytics', label: 'Analytics', icon: Gauge },
  { id: 'sensors', label: 'Sensors', icon: Activity },
  { id: 'decisions', label: 'Decisions', icon: Snowflake },
  { id: 'history', label: 'Change History', icon: History },
] as const

export type WorkspaceTab = (typeof sections)[number]['id']

export default function DesktopHeader({
  active,
  onChange,
  theme,
  onToggleTheme,
  onOpenSettings,
  onLogout,
}: {
  active: WorkspaceTab
  onChange: (tab: WorkspaceTab) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onOpenSettings: () => void
  onLogout: () => void
}) {
  const { sensors, error } = useInventory()
  const online = sensors.filter((sensor) => sensor.status !== 'No data').length
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const currentDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())

  useEffect(() => {
    if (!accountOpen) return
    const closeAccountMenu = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false)
    }
    document.addEventListener('mousedown', closeAccountMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeAccountMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [accountOpen])

  return (
    <header className="shrink-0 border-b border-line bg-surface">
      <div className="flex h-14 items-center gap-5 px-4">
        <div className="flex w-[218px] shrink-0 items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-fg text-night">
            <Snowflake className="size-[18px]" strokeWidth={2.3} />
          </span>
          <span>
            <span className="block text-[15px] font-extrabold leading-none tracking-[-0.02em] text-fg">
              FreshOps
            </span>
            <span className="mt-1 block font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted">
              Cold-chain control
            </span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-pressed={theme === 'light'}
            className="flex h-9 items-center gap-2 rounded-lg border border-line bg-night/50 px-2.5 text-[9px] font-semibold text-muted transition-colors hover:text-fg"
          >
            {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <span className="mx-2 h-6 w-px bg-line" />
          <div ref={accountRef} className="relative">
            <button
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.04]"
            >
              <span className="grid size-7 place-items-center rounded-full bg-sky/15 text-[10px] font-bold text-sky">
                MO
              </span>
              <span>
                <span className="block text-[10.5px] font-semibold leading-none text-fg">Mara Okafor</span>
                <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.06em] text-muted">
                  Shift supervisor
                </span>
              </span>
              <ChevronDown className={`size-3.5 text-muted transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
            </button>

            {accountOpen && (
              <div
                role="menu"
                className="rise-in absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border border-line bg-raised p-1.5 shadow-[0_18px_45px_rgb(0_0_0/0.35)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false)
                    onLogout()
                  }}
                  className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[10px] font-semibold text-danger hover:bg-danger/10"
                >
                  <LogOut className="size-3.5" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-9 items-center border-t border-line px-3">
        <nav aria-label="Application sections" className="flex h-full items-center gap-1">
          {sections.map(({ id, label, icon: Icon }) => {
            const isActive = active === id
            return (
              <button
                key={id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onChange(id)}
                className={`relative flex h-full items-center gap-1.5 px-3 text-[10.5px] font-semibold transition-colors ${
                  isActive ? 'text-fg' : 'text-muted hover:text-fg'
                }`}
              >
                <Icon className="size-3.5" strokeWidth={1.9} />
                {label}
                {isActive && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-t-full bg-sky" />}
              </button>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 font-mono text-[8.5px] uppercase tracking-[0.08em] text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5 text-sky" />
            {currentDate}
          </span>
          <span className="h-3 w-px bg-line" />
          <span role="status" className={`flex items-center gap-1.5 ${error ? 'text-danger' : ''}`} title={error ?? undefined}>
            <span className={`size-1.5 rounded-full ${error ? 'bg-danger' : 'bg-ok'}`} />
            {error ? 'Backend offline' : `${online}/${sensors.length} sensors reporting`}
          </span>
          <span className="h-3 w-px bg-line" />
          <button type="button" onClick={onOpenSettings} className="flex items-center gap-1.5 hover:text-fg">
            <Settings className="size-3.5" />
            View settings
          </button>
        </div>
      </div>
    </header>
  )
}
