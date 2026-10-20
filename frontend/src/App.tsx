import { useCallback, useEffect, useState } from 'react'
import { LogIn, Snowflake } from 'lucide-react'
import DesktopDashboard from './DesktopDashboard'
import MobileApp from './mobile/MobileApp'
import MobilePreview from './mobile/MobilePreview'

const PHONE_QUERY = '(max-width: 640px)'

function useIsPhone() {
  const [isPhone, setIsPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY)
    const onChange = () => setIsPhone(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isPhone
}

function useHashView() {
  const read = () => (window.location.hash === '#mobile' ? 'mobile' : 'desktop')
  const [view, setView] = useState<'mobile' | 'desktop'>(read)
  useEffect(() => {
    const onHash = () => setView(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = useCallback((next: 'mobile' | 'desktop') => {
    window.location.hash = next === 'mobile' ? 'mobile' : ''
  }, [])
  return [view, go] as const
}

export default function App() {
  const isPhone = useIsPhone()
  const [view, go] = useHashView()
  const [loggedOut, setLoggedOut] = useState(false)

  if (isPhone) return <MobileApp />
  if (loggedOut) {
    return (
      <main className="grid min-h-screen place-items-center bg-night p-6 font-sans text-fg">
        <section className="w-full max-w-sm rounded-[18px] border border-line bg-surface p-8 text-center shadow-[0_30px_90px_rgb(0_0_0/0.35)]">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-fg text-night">
            <Snowflake className="size-6" strokeWidth={2.3} />
          </span>
          <p className="mt-5 text-[20px] font-bold">You’re logged out</p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Your FreshOps dashboard session has ended on this device.
          </p>
          <button
            type="button"
            onClick={() => setLoggedOut(false)}
            className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-sky text-[10.5px] font-bold text-night hover:brightness-105"
          >
            <LogIn className="size-4" />
            Return to dashboard
          </button>
        </section>
      </main>
    )
  }
  if (view === 'mobile') return <MobilePreview onBack={() => go('desktop')} />
  return (
    <DesktopDashboard
      onOpenMobile={() => go('mobile')}
      onLogout={() => setLoggedOut(true)}
    />
  )
}
