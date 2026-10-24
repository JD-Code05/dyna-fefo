export default function ShelfLifeComparisonBar({
  printedHours,
  dynamicHours,
  maxHours,
  className = 'h-4',
}: {
  printedHours: number
  dynamicHours: number
  maxHours: number
  className?: string
}) {
  const printedWidth = Math.min(100, (printedHours / maxHours) * 100)
  const remainingWidth = Math.min(printedWidth, (dynamicHours / maxHours) * 100)
  const lostWidth = Math.max(0, printedWidth - remainingWidth)

  return (
    <span
      role="img"
      aria-label={`${dynamicHours} sensor-adjusted hours remaining from ${printedHours} printed hours`}
      className={`relative block overflow-hidden rounded bg-track/70 ring-1 ring-inset ring-white/[0.04] ${className}`}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-l bg-series transition-[width] duration-500"
        style={{ width: `${remainingWidth}%` }}
      />
      <span
        className="hatch-danger absolute inset-y-0 transition-[left,width] duration-500"
        style={{ left: `${remainingWidth}%`, width: `${lostWidth}%` }}
      />
      <span
        className="absolute inset-y-0 border-r border-fg/35 transition-[left] duration-500"
        style={{ left: `${printedWidth}%` }}
      />
    </span>
  )
}
