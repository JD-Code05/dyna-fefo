import { useState } from 'react'
import DesktopDashboard, { type Role } from './DesktopDashboard'
import Landing from './Landing'
import SignIn from './SignIn'
import { setDemoUser } from './api/client'

type Screen = { name: 'home' } | { name: 'signin' | 'dashboard'; role: Role }

// Remembers the open dashboard for this tab only, so a refresh stays signed in but a new visit starts at home.
const KEY = 'freshops-role'
function savedScreen(): Screen {
  try {
    const role = window.sessionStorage.getItem(KEY)
    if (role === 'supervisor' || role === 'staff') {
      setDemoUser(role === 'staff' ? 'demo-staff' : null)
      return { name: 'dashboard', role }
    }
  } catch {}
  return { name: 'home' }
}

export default function App() {
  const [screen, setScreenState] = useState<Screen>(savedScreen)
  const go = (next: Screen) => {
    // The staff dashboard tells the backend who it is via X-Demo-User.
    setDemoUser(next.name === 'dashboard' && next.role === 'staff' ? 'demo-staff' : null)
    try {
      if (next.name === 'dashboard') window.sessionStorage.setItem(KEY, next.role)
      else window.sessionStorage.removeItem(KEY)
    } catch {}
    window.scrollTo(0, 0)
    setScreenState(next)
  }

  if (screen.name === 'home') return <Landing onSignIn={(role) => go({ name: 'signin', role })} />
  if (screen.name === 'signin')
    return <SignIn initialRole={screen.role} onSignIn={(role) => go({ name: 'dashboard', role })} onHome={() => go({ name: 'home' })} />
  return <DesktopDashboard role={screen.role} onLogout={() => go({ name: 'signin', role: screen.role })} />
}
