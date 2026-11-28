import type { Metadata } from 'next'
import localFont from 'next/font/local'
import '../src/index.css'

// The fonts live in the repo (Latin variable fonts from Google Fonts, SIL Open Font License), so building needs no
// internet: next/font/google started failing when Google began serving JetBrains Mono without a file extension.
const sans = localFont({ src: '../src/fonts/PlusJakartaSans-latin.woff2', weight: '400 800', variable: '--font-jakarta', display: 'swap' })
const mono = localFont({ src: '../src/fonts/JetBrainsMono-latin.woff2', weight: '400 700', variable: '--font-jetbrains', display: 'swap' })

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
