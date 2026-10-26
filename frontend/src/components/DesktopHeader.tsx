import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { api, type Schemas } from '../api/client'
import { useInventory } from '../data/InventoryContext'

const sections = [
  { id: 'overview', label: 'Overview', icon: ChartNoAxesCombined },
  { id: 'stock-overview', label: 'Stock overview', icon: Boxes },
  { id: 'analytics', label: 'Analytics', icon: Gauge },
  { id: 'sensors', label: 'Sensors', icon: Activity },
  { id: 'decisions', label: 'Decisions', icon: Snowflake },
  { id: 'history', label: 'Change history', icon: History },
] as const

export type WorkspaceTab = (typeof sections)[number]['id']

export default function DesktopHeader({
  role,
  active,
  onChange,
  theme,
  onToggleTheme,
  onOpenSettings,
  onLogout,
}: {
  role: 'supervisor' | 'staff'
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
  const [apiMe, setMe] = useState<Schemas['MeOut'] | null>(null)
  useEffect(() => {
    api<Schemas['MeOut']>('/me').then(setMe).catch(() => setMe(null))
  }, [])
  // Draft: login is deferred and /me always answers demo-supervisor, so the staff view labels itself.
  const me = role === 'staff' ? { username: 'demo-staff', role: 'staff' } : apiMe
  const accountRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  // One underline that slides to the active tab; null until measured so it mounts in place instead of sliding in.
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const measure = () => {
      const tab = nav.querySelector<HTMLElement>('[aria-current="page"]')
      if (tab) setIndicator({ x: tab.offsetLeft + 8, w: tab.offsetWidth - 16 })
    }
    measure()
    const ro = new ResizeObserver(measure) // web fonts and window resizes change tab widths
    ro.observe(nav)
    return () => ro.disconnect()
  }, [active])
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
        <div className="flex shrink-0 items-center gap-3 sm:w-[218px]">
          <span className="grid size-9 place-items-center rounded-lg bg-fg text-night">
            <Snowflake className="size-[18px]" strokeWidth={2.3} />
          </span>
          <span>
            <span className="block text-base font-extrabold leading-none tracking-[-0.02em] text-fg">
              FreshOps
            </span>
            <span className="mt-1 block text-xs text-muted">
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
            className="flex h-9 items-center gap-2 rounded-lg border border-line bg-night/50 px-2.5 text-xs font-semibold text-muted transition-colors hover:text-fg"
          >
            {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
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
              <span className="grid size-7 place-items-center rounded-full bg-pill text-xs font-bold text-fg">
                {(me?.username ?? '?').slice(0, 2).toUpperCase()}
              </span>
              <span className="hidden sm:block">
                <span className="block text-xs font-semibold leading-none text-fg">{me?.username ?? 'Not signed in'}</span>
                <span className="mt-1 block text-xs text-muted">
                  {me?.role ?? '—'}
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
                  className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-semibold text-danger hover:bg-danger/10"
                >
                  <LogOut className="size-3.5" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex min-h-9 flex-wrap items-center gap-x-3 border-t border-line px-3">
        <nav ref={navRef} aria-label="Application sections" hidden={role === 'staff'} className="relative flex h-9 max-w-full items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          {sections.map(({ id, label, icon: Icon }) => {
            const isActive = active === id
            return (
              <button
                key={id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onChange(id)}
                className={`relative flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold transition-colors ${
                  isActive ? 'text-fg' : 'text-muted hover:text-fg'
                }`}
              >
                <Icon className="size-3.5" strokeWidth={1.9} />
                {label}
              </button>
            )
          })}
          {indicator && (
            <span
              aria-hidden
              className="tab-indicator pointer-events-none absolute bottom-0 left-0 h-0.5 w-px bg-accent"
              style={{ transform: `translateX(${indicator.x}px) scaleX(${indicator.w})` }}
            />
          )}
        </nav>
        <div className="ml-auto flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 whitespace-nowrap text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {currentDate}
          </span>
          <span className="h-3 w-px bg-line" />
          <span role="status" className={`flex items-center gap-1.5 ${error ? 'text-danger' : ''}`} title={error ?? undefined}>
            <span className={`size-1.5 rounded-full ${error ? 'bg-danger' : 'bg-ok'}`} />
            {error ? 'Backend offline' : `${online}/${sensors.length} sensors reporting`}
          </span>
          {role === 'supervisor' && (
            <>
              <span className="h-3 w-px bg-line" />
              <button type="button" onClick={onOpenSettings} className="flex items-center gap-1.5 hover:text-fg">
                <Settings className="size-3.5" />
                View settings
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
