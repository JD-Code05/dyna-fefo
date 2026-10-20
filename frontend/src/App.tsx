import { useState } from 'react'
import { LogIn, Snowflake } from 'lucide-react'
import DesktopDashboard from './DesktopDashboard'

export default function App() {
  const [loggedOut, setLoggedOut] = useState(false)

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
  return (
    <DesktopDashboard onLogout={() => setLoggedOut(true)} />
  )
}
