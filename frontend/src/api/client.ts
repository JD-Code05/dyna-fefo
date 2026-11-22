import type { components } from './schema'

export type Schemas = components['schemas']
export type ApiError = Schemas['ErrorOut']['error']

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

// The sign-in token lives in sessionStorage: a refresh keeps you signed in, closing the tab signs you out.
const TOKEN_KEY = 'freshops-token'
let token: string | null = null
try {
  token = window.sessionStorage.getItem(TOKEN_KEY)
} catch {} // no window during the server render, or storage blocked
export const hasToken = () => token !== null
export const setToken = (next: string | null) => {
  token = next
  try {
    if (next) window.sessionStorage.setItem(TOKEN_KEY, next)
    else window.sessionStorage.removeItem(TOKEN_KEY)
  } catch {}
}
// Called when the backend refuses our token (expired or revoked), so the app can go back to sign-in.
let signedOut = () => {}
export const onSignedOut = (fn: () => void) => {
  signedOut = fn
}

// Throws the backend's {error: {code, message, details}} body so screens can show `message`.
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
  })
  if (res.status === 401 && token) {
    setToken(null)
    signedOut()
  }
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => null)
  if (!res.ok) throw (body as Schemas['ErrorOut'] | null)?.error ?? { code: 'http_error', message: `Request failed (${res.status})`, details: {} }
  return body as T
}
