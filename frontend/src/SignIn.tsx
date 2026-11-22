import { useEffect, useState } from 'react'
import Logo from './components/Logo'
import type { Role } from './DesktopDashboard'
import { api, setToken } from './api/client'

const NOTE: Record<Role, string> = {
  supervisor: 'Approve dispatches and salvage, see every chiller.',
  staff: 'See your pull list and confirm finished orders.',
}

type LoginOut = { access_token: string; username: string; role: Role }

// The Supervisor/Staff switch only fills in the demo username; the account decides which dashboard opens.
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
  const [username, setUsername] = useState(`demo-${initialRole}`)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pick = (r: Role) => {
    setRole(r)
    setUsername(`demo-${r}`)
  }
  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const out = await api<LoginOut>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      setToken(out.access_token)
      onSignIn(out.role)
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Sign-in failed')
      setPassword('')
    } finally {
      setBusy(false)
    }
  }
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
            void submit()
          }}
        >
          <h2>Sign in</h2>
          <p className="hint">Pick your dashboard, then sign in.</p>
          <div className={`seg${role === 'staff' ? ' staff' : ''}`}>
            <span className="thumb" />
            {(['supervisor', 'staff'] as const).map((r) => (
              <button key={r} type="button" aria-pressed={role === r} onClick={() => pick(r)}>
                {r === 'supervisor' ? 'Supervisor' : 'Staff'}
              </button>
            ))}
          </div>
          <p className="role-note">{NOTE[role]}</p>
          <label htmlFor="signin-user">Username</label>
          <input id="signin-user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          <label htmlFor="signin-pass">Password</label>
          <input id="signin-pass" type="password" placeholder="••••••••" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn solid" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          {error && <p className="demo-note" role="alert">{error}</p>}
          <button type="button" className="back" onClick={onHome}>← Back to home</button>
        </form>
      </section>
    </main>
  )
}
