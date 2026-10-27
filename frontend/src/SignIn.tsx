import { useEffect, useState } from 'react'
import Logo from './components/Logo'
import type { Role } from './DesktopDashboard'

const NOTE: Record<Role, string> = {
  supervisor: 'Approve dispatches and salvage, see every chiller.',
  staff: 'See your pull list and confirm finished orders.',
}

// shortcut: real accounts are not wired yet (the backend runs demo users via X-Demo-User), so the
// password is not checked and Sign in only picks the dashboard. Switch to POST /auth/login when it lands.
export default function SignIn({
  initialRole,
  onSignIn,
  onHome,
}: {
  initialRole: Role
  onSignIn: (role: Role) => void
  onHome: () => void
}) {
  const [role, setRole] = useState<Role>(initialRole)
  const [temps, setTemps] = useState({ a: 3.8, b: 4.1 })
  useEffect(() => {
    // Decorative ticker on the brand panel; the numbers are illustrative, not live readings.
    const id = window.setInterval(() => setTemps({ a: 3.6 + Math.random() * 0.5, b: 3.9 + Math.random() * 0.5 }), 2500)
    return () => window.clearInterval(id)
  }, [])

  return (
    <main className="landing signin">
      <aside className="login-brand">
        <button type="button" className="lockup" onClick={onHome} style={{ background: 'none', border: 0, padding: 0 }}>
          <span className="logo-frame"><Logo /></span>FreshOps
        </button>
        <div className="big">
          <div className="hero-logo"><Logo /></div>
          <h1>Fresh&shy;Ops</h1>
          <p>Shelf life from the cold room, not the label.</p>
          <div className="ticker" aria-hidden>
            <div><small>Chiller A</small><span className="mono">{temps.a.toFixed(1)}<sup> °C</sup></span></div>
            <div><small>Chiller B</small><span className="mono">{temps.b.toFixed(1)}<sup> °C</sup></span></div>
          </div>
        </div>
      </aside>
      <section className="login-form">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSignIn(role)
          }}
        >
          <h2>Sign in</h2>
          <p className="hint">Pick your dashboard, then sign in.</p>
          <div className={`seg${role === 'staff' ? ' staff' : ''}`}>
            <span className="thumb" />
            {(['supervisor', 'staff'] as const).map((r) => (
              <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)}>
                {r === 'supervisor' ? 'Supervisor' : 'Staff'}
              </button>
            ))}
          </div>
          <p className="role-note">{NOTE[role]}</p>
          <label htmlFor="signin-user">Username</label>
          <input id="signin-user" placeholder={`demo-${role}`} autoComplete="username" />
          <label htmlFor="signin-pass">Password</label>
          <input id="signin-pass" type="password" placeholder="••••••••" autoComplete="current-password" />
          <button className="btn solid" type="submit">Sign in</button>
          <p className="demo-note">Demo build: passwords aren't checked yet.</p>
          <button type="button" className="back" onClick={onHome}>← Back to home</button>
        </form>
      </section>
    </main>
  )
}
