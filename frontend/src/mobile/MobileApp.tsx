import { useState } from 'react'
import {
  ArrowUpRight,
  Bell,
  ChevronDown,
  CircleUser,
  LayoutGrid,
  ListChecks,
  Thermometer,
  TriangleAlert,
  Warehouse,
} from 'lucide-react'
import { formatCountdown, useCountdown } from '../hooks/useCountdown'
import { ApprovalsCard, DialCard, HeroCard, SensorsCard, SentimentStrip } from './MobileCards'

/**
 * Mobile Supervisor Companion. `framed` renders the simulated iOS status bar and
 * home indicator for the desktop device preview; on a real phone the system
 * provides those, so safe-area insets are used instead.
 */
export default function MobileApp({ framed = false }: { framed?: boolean }) {
  const [pending, setPending] = useState(3)

  return (
    <div
      className={`relative flex flex-col overflow-hidden bg-canvas font-sans text-white ${
        framed ? 'size-full' : 'h-[100dvh] w-full'
      }`}
    >
      {framed ? <StatusBar /> : <div style={{ height: 'env(safe-area-inset-top)' }} />}

      <div className="relative z-20 shrink-0 bg-canvas px-4 pb-1">
        <TopBar />
        <StickyAlert />
      </div>

      <main
        className="no-scrollbar relative flex-1 overflow-y-auto overscroll-contain px-4 pb-[124px] pt-3"
        style={{ maskImage: 'linear-gradient(to bottom, transparent 0, #000 14px)' }}
      >
        <div className="flex flex-col gap-3">
          <HeroCard />
          <div className="grid grid-cols-2 gap-3">
            <SensorsCard />
            <DialCard />
          </div>
          <SentimentStrip />
          <ApprovalsCard onPendingChange={setPending} />
        </div>
      </main>

      <TabBar pending={pending} framed={framed} />
      {framed && (
        <span
          aria-hidden
          className="absolute bottom-2 left-1/2 z-40 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-white/85"
        />
      )}
    </div>
  )
}

function StatusBar() {
  return (
    <div
      className="relative z-30 flex h-[54px] shrink-0 items-center justify-between bg-canvas pl-[46px] pr-[30px] pt-1.5 text-white"
      style={{ fontFamily: '-apple-system, "SF Pro Text", "SF Pro Display", system-ui, sans-serif' }}
    >
      <span className="text-[17px] font-semibold tracking-[-0.01em]">9:41</span>
      <div className="flex items-center gap-[7px]" aria-label="Full signal, Wi-Fi connected, battery full">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="#fff" aria-hidden>
          <rect x="0" y="7.5" width="3.2" height="4.5" rx="1" />
          <rect x="4.8" y="5.2" width="3.2" height="6.8" rx="1" />
          <rect x="9.6" y="2.7" width="3.2" height="9.3" rx="1" />
          <rect x="14.4" y="0" width="3.2" height="12" rx="1" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="#fff" aria-hidden>
          <path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.2A10.2 10.2 0 0 0 8 .5C5.2.5 2.7 1.6.8 3.4L2 4.6a8.5 8.5 0 0 1 6-2.4Z" />
          <path d="M8 5.6c1.4 0 2.6.5 3.6 1.4l1.2-1.2A6.8 6.8 0 0 0 8 3.9c-1.9 0-3.6.7-4.8 1.9L4.4 7c1-.9 2.2-1.4 3.6-1.4Z" />
          <path d="M8 9.1c.5 0 .9.2 1.2.5L8 11.5 6.8 9.6c.3-.3.7-.5 1.2-.5Z" />
          <path d="M8 7.3c1 0 1.8.4 2.4 1L8 11.5 5.6 8.3c.6-.6 1.4-1 2.4-1Z" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none" aria-hidden>
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.8" stroke="#fff" strokeOpacity="0.4" />
          <rect x="2" y="2" width="20" height="9" rx="2.4" fill="#fff" />
          <path d="M25 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2Z" fill="#fff" fillOpacity="0.45" />
        </svg>
      </div>
    </div>
  )
}

function TopBar() {
  return (
    <div className="flex items-center gap-2 pt-1.5">
      <button
        type="button"
        aria-label="Switch warehouse, current: Central Cold Vault A"
        className="flex h-11 min-w-0 items-center gap-2 rounded-full bg-panel pl-1.5 pr-3 ring-1 ring-inset ring-white/[0.06] active:scale-[0.98]"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sage text-ink">
          <Warehouse className="size-4" strokeWidth={2.2} />
        </span>
        <span className="truncate text-[13.5px] font-semibold">Central Cold Vault A</span>
        <ChevronDown className="size-4 shrink-0 text-white/60" strokeWidth={2.4} />
      </button>

      <span className="ml-auto flex h-8 items-center gap-1.5 rounded-full bg-live/10 px-2.5 font-mono text-[11px] font-semibold text-live">
        <span className="relative flex size-2">
          <span className="ping-soft absolute inset-0 rounded-full bg-live" />
          <span className="relative size-2 rounded-full bg-live" />
        </span>
        Live
      </span>

      <button
        type="button"
        aria-label="Notifications, 3 unread"
        className="relative grid size-11 shrink-0 place-items-center rounded-full bg-panel ring-1 ring-inset ring-white/[0.06] active:scale-95"
      >
        <Bell className="size-5" strokeWidth={2} />
        <span className="absolute -right-0.5 -top-0.5 grid size-[18px] place-items-center rounded-full bg-coral font-mono text-[10px] font-bold text-ink ring-2 ring-canvas">
          3
        </span>
      </button>
    </div>
  )
}

function StickyAlert() {
  const remaining = useCountdown()
  return (
    <section role="alert" className="mt-3 flex items-center gap-3 rounded-[18px] bg-amber p-3 text-ink">
      <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-ink">
        <TriangleAlert className="size-5 text-amber" strokeWidth={2.4} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-extrabold uppercase leading-[1.2]">
          Thermal Spike in Chiller 2{' '}
          <span className="ml-0.5 inline-block rounded-full bg-ink/10 px-1.5 font-mono text-[10px] font-bold normal-case text-[#B23A26]">
            +3.8°C
          </span>
        </p>
        <p className="mt-0.5 text-[11px] font-medium leading-snug text-ink/75">
          Batch #409 (Berries) RUL dropped to 14h.
        </p>
      </div>
      <span
        className="shrink-0 rounded-full bg-ink px-2.5 py-1.5 font-mono text-[11px] font-semibold tabular-nums text-amber"
        aria-label={`${formatCountdown(remaining)} until batch expires`}
      >
        {formatCountdown(remaining)}
      </span>
      <button
        type="button"
        aria-label="Open thermal spike incident"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-white active:scale-95"
      >
        <ArrowUpRight className="size-[18px]" strokeWidth={2.2} />
      </button>
    </section>
  )
}

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'sensors', label: 'Sensors', icon: Thermometer },
  { id: 'queue', label: 'Queue', icon: ListChecks },
  { id: 'profile', label: 'Profile', icon: CircleUser },
]

function TabBar({ pending, framed }: { pending: number; framed: boolean }) {
  const [active, setActive] = useState('dashboard')
  return (
    <nav
      aria-label="Primary"
      className="absolute inset-x-4 z-30 grid h-[66px] grid-cols-4 items-center rounded-full bg-[#1E1F24]/75 px-1.5 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.8)] ring-1 ring-inset ring-white/10 backdrop-blur-xl backdrop-saturate-150"
      style={{ bottom: framed ? 26 : 'calc(env(safe-area-inset-bottom) + 10px)' }}
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const on = id === active
        return (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            aria-current={on ? 'page' : undefined}
            className={`relative mx-0.5 flex h-[54px] flex-col items-center justify-center gap-1 rounded-full transition-colors ${
              on ? 'bg-ice/[0.12] text-ice' : 'text-white/55 active:text-white'
            }`}
          >
            <span className="relative">
              <Icon className="size-[22px]" strokeWidth={on ? 2.3 : 1.9} />
              {id === 'queue' && pending > 0 && (
                <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 font-mono text-[9.5px] font-bold text-ink ring-2 ring-[#1E1F24]">
                  {pending}
                </span>
              )}
            </span>
            <span className="text-[10px] font-semibold">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
