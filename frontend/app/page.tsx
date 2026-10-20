'use client'

import dynamic from 'next/dynamic'

// The dashboard reads window/localStorage during its first render, so it renders client-side only.
const App = dynamic(() => import('../src/App'), { ssr: false })

export default function Page() {
  return <App />
}
