import { useEffect, useState } from 'react'

/** Batch #409 spoilage countdown shared by desktop and mobile alerts (14:22:05). */
export const BREACH_COUNTDOWN_START = 14 * 3600 + 22 * 60 + 5

export function useCountdown(start = BREACH_COUNTDOWN_START) {
  const [remaining, setRemaining] = useState(start)
  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    return () => clearInterval(id)
  }, [])
  return remaining
}

export function formatCountdown(total: number) {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}
