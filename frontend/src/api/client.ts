import type { components } from './schema'

export type Schemas = components['schemas']
export type ApiError = Schemas['ErrorOut']['error']

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

// Throws the backend's {error: {code, message, details}} body so screens can show `message`.
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (res.status === 204) return undefined as T
  const body = await res.json()
  if (!res.ok) throw (body as Schemas['ErrorOut']).error
  return body as T
}
