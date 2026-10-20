import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import MobileApp from './MobileApp'

const SCREEN_W = 393
const SCREEN_H = 852
const BEZEL = 12
const DEVICE_W = SCREEN_W + BEZEL * 2
const DEVICE_H = SCREEN_H + BEZEL * 2

function useDeviceScale() {
  const compute = () => Math.min(1, (window.innerHeight - 48) / DEVICE_H, (window.innerWidth - 48) / DEVICE_W)
  const [scale, setScale] = useState(compute)
  useEffect(() => {
    const onResize = () => setScale(compute())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return scale
}

/** Desktop presentation of the mobile companion inside an iPhone 16 Pro frame. */
export default function MobilePreview({ onBack }: { onBack: () => void }) {
  const scale = useDeviceScale()

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0D0E10] font-sans text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(115_113_252/0.16),transparent_62%)]"
      />

      <button
        type="button"
        onClick={onBack}
        className="absolute left-6 top-6 z-10 flex h-10 items-center gap-2 rounded-full bg-white/[0.06] pl-3 pr-4 text-[13px] font-semibold text-white/80 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 hover:text-white"
      >
        <ArrowLeft className="size-4" strokeWidth={2.2} />
        Desktop dashboard
      </button>

      <div className="absolute bottom-7 left-7 z-10 hidden lg:block">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/40">
          Mobile Supervisor Companion
        </p>
        <p className="mt-1 text-[13px] text-white/60">iPhone 16 Pro · 393 × 852 pt</p>
      </div>

      <div
        className="absolute left-1/2 top-1/2"
        style={{ width: DEVICE_W, height: DEVICE_H, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {/* Hardware buttons */}
        <span aria-hidden className="absolute -left-[3px] top-[150px] h-8 w-[3px] rounded-l bg-[#2A2B30]" />
        <span aria-hidden className="absolute -left-[3px] top-[205px] h-14 w-[3px] rounded-l bg-[#2A2B30]" />
        <span aria-hidden className="absolute -left-[3px] top-[275px] h-14 w-[3px] rounded-l bg-[#2A2B30]" />
        <span aria-hidden className="absolute -right-[3px] top-[240px] h-20 w-[3px] rounded-r bg-[#2A2B30]" />

        <div className="size-full rounded-[60px] bg-[#050506] p-[12px] shadow-[0_50px_120px_-30px_rgb(0_0_0/0.9)] ring-1 ring-white/[0.14]">
          <div className="relative size-full overflow-hidden rounded-[48px] bg-canvas">
            <MobileApp framed />
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[11px] z-50 h-[37px] w-[125px] -translate-x-1/2 rounded-full bg-black"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
