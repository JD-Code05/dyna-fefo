import type { Metadata } from 'next'
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import '../src/index.css'

// next/font downloads the fonts at build time and serves them locally, so the demo works offline.
const sans = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-jakarta' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-jetbrains' })

export const metadata: Metadata = {
  title: 'FreshOps · Perishable Inventory Control',
  description: 'Sensor-based shelf-life tracking and dispatch decision support.',
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
}

// Applies the saved theme before first paint, so light mode doesn't flash dark while the app loads.
const themeScript = `try{var t=localStorage.getItem('freshops-theme');if(t==='light'||(!t&&matchMedia('(prefers-color-scheme: light)').matches))document.documentElement.classList.add('theme-light')}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
