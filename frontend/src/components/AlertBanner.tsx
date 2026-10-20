import { ArrowUpRight, TriangleAlert } from 'lucide-react'
import { formatCountdown, useCountdown } from '../hooks/useCountdown'

export default function AlertBanner() {
  const remaining = useCountdown()

  return (
    <section
      role="alert"
      className="relative flex h-[104px] shrink-0 items-center gap-4 overflow-hidden rounded-[14px] border border-warn/70 bg-[rgba(245,166,35,0.12)] py-5 pl-5 pr-4"
    >
      <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-warn/35 bg-warn/15 text-warn">
        <TriangleAlert className="size-6" strokeWidth={2} />
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-bold uppercase leading-[1.15] text-fg">
          Critical Thermal Breach: Chiller Bay 2
        </h2>
        <p className="mt-1 text-[12px] leading-snug text-muted">
          Batch #409 (Berries) degrading 3x faster. RUL down to 14 hrs.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          className="rounded-full border border-line bg-night px-3 py-2 font-mono text-[12.5px] font-medium tabular-nums text-warn"
          aria-label={`${formatCountdown(remaining)} hours until batch expires`}
        >
          {formatCountdown(remaining)} <span className="text-muted">hrs</span>
        </span>
        <button
          type="button"
          aria-label="Open breach incident"
          title="Open breach incident"
          className="grid size-11 place-items-center rounded-full bg-warn text-night transition hover:brightness-110 active:scale-95"
        >
          <ArrowUpRight className="size-[18px]" strokeWidth={2.4} />
        </button>
      </div>
    </section>
  )
}
