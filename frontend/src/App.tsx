import { useState } from 'react'
import { LogIn, Snowflake } from 'lucide-react'
import DesktopDashboard, { type Role } from './DesktopDashboard'
import { setDemoUser } from './api/client'

export default function App() {
  // null = logged out. The choice lives only in this page; the staff dashboard tells the backend via X-Demo-User.
  const [role, setRoleState] = useState<Role | null>('supervisor')
  const setRole = (next: Role | null) => {
    setDemoUser(next === 'staff' ? 'demo-staff' : null)
    setRoleState(next)
  }

  if (!role) {
    return (
      <main className="grid min-h-screen place-items-center bg-night p-6 font-sans text-fg">
        <section className="w-full max-w-sm rounded-[18px] border border-line bg-surface p-8 text-center shadow-[0_30px_90px_rgb(0_0_0/0.35)]">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-fg text-night">
            <Snowflake className="size-6" strokeWidth={2.3} />
          </span>
          <p className="mt-5 text-2xl font-bold">You’re logged out</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Your FreshOps dashboard session has ended on this device. Choose a dashboard to continue.
          </p>
          <button
            type="button"
            onClick={() => setRole('supervisor')}
            className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-xs font-bold text-night hover:brightness-105"
          >
            <LogIn className="size-4" />
            Supervisor dashboard
          </button>
          <button
            type="button"
            onClick={() => setRole('staff')}
            className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line text-xs font-bold text-fg hover:bg-white/[0.04]"
          >
            <LogIn className="size-4" />
            Staff dashboard
          </button>
        </section>
      </main>
    )
  }
  return <DesktopDashboard role={role} onLogout={() => setRole(null)} />
}
