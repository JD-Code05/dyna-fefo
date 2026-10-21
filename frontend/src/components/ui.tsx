import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'

/** Shared bento surface: one neutral container for every desktop card. */
export const card = 'rounded-[14px] border border-line bg-surface'

type DropdownProps = {
  value: string
  options: string[]
  onChange: (value: string) => void
  className?: string
  label: string
  /** Which trigger edge the menu lines up with; use 'left' when the trigger sits at a card's left edge. */
  align?: 'left' | 'right'
}

export function Dropdown({ value, options, onChange, className = '', label, align = 'right' }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white/[0.02] pl-3 pr-2 text-sm font-medium text-fg/90 transition-colors hover:border-white/15 hover:bg-white/[0.04] ${
          open ? 'border-white/15 bg-white/[0.04]' : ''
        } ${className}`}
      >
        {value}
        <ChevronDown
          className={`size-3.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2.2}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          className={`rise-in absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full z-40 mt-1.5 min-w-full rounded-xl border border-line bg-raised p-1 text-fg shadow-[0_18px_40px_-12px_rgb(0_0_0/0.7)]`}
        >
          {options.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === value}
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-4 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-sm font-medium text-fg/85 hover:bg-white/[0.05] hover:text-fg"
              >
                {option}
                {option === value && <Check className="size-3.5 text-accent" strokeWidth={2.6} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type Segment<K extends string> = { key: K; label: string; count?: number }

/**
 * Filter buttons whose active highlight slides to the clicked one. An identical, active-styled copy
 * sits on top and is clipped to the active button, so background and text color change in one motion.
 */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Segment<K>[]
  value: K
  onChange: (key: K) => void
  label: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const [clip, setClip] = useState<string | null>(null) // null until measured, so it mounts in place
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const btn = el.querySelector<HTMLElement>(`[data-key="${value}"]`)
      if (!btn) return
      const right = el.clientWidth - btn.offsetLeft - btn.offsetWidth
      const bottom = el.clientHeight - btn.offsetTop - btn.offsetHeight
      setClip(`inset(${btn.offsetTop}px ${right}px ${bottom}px ${btn.offsetLeft}px round 6px)`)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [value])

  const content = (o: Segment<K>, active: boolean) => (
    <>
      {o.label}
      {o.count != null && (
        <span className={`rounded px-1.5 py-0.5 font-mono text-xs ${active ? 'bg-accent/15 text-accent' : 'bg-white/[0.04]'}`}>
          {o.count}
        </span>
      )}
    </>
  )
  const item = 'flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold'

  return (
    <div ref={box} role="group" aria-label={label} className="relative flex flex-wrap rounded-lg border border-line bg-night p-1">
      {options.map((o) => (
        <button
          key={o.key}
          data-key={o.key}
          type="button"
          aria-pressed={o.key === value}
          onClick={() => onChange(o.key)}
          className={`${item} text-muted hover:text-fg`}
        >
          {content(o, false)}
        </button>
      ))}
      {clip && (
        <div aria-hidden className="segment-active pointer-events-none absolute inset-0 flex flex-wrap p-1" style={{ clipPath: clip }}>
          {options.map((o) => (
            <span key={o.key} className={`${item} bg-pill text-fg`}>
              {content(o, true)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`font-semibold leading-tight text-fg ${className}`}>{children}</h2>
  )
}

/** Muted secondary line under a card title. */
export function CardHint({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`mt-1.5 text-xs leading-snug text-muted ${className}`}>{children}</p>
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  indeterminate,
}: {
  checked: boolean
  onChange: () => void
  label: string
  disabled?: boolean
  indeterminate?: boolean
}) {
  const on = checked || indeterminate
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`grid size-[16px] shrink-0 place-items-center rounded-[5px] transition-colors disabled:opacity-30 ${
        on ? 'bg-accent text-night' : 'border border-white/20 hover:border-white/40'
      }`}
    >
      {indeterminate ? (
        <span className="h-0.5 w-2 rounded-full bg-night" />
      ) : (
        checked && <Check className="size-3" strokeWidth={3.4} />
      )}
    </button>
  )
}

/** Destructive-action confirmation. The backend soft-deletes, so the record stays in the change history. */
export function ConfirmDelete({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => Promise<void>
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-night/75 backdrop-blur-sm">
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-[400px] max-w-full rounded-[18px] border border-line bg-surface p-6">
        <p id="confirm-title" className="text-base font-bold text-fg">{title}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted">{body}</p>
        {error && <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-2.5 py-2 text-xs font-semibold text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" autoFocus onClick={onCancel} className="h-10 rounded-lg border border-line px-4 text-xs font-semibold text-fg">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
              } catch (e) {
                setError((e as { message?: string }).message ?? 'Unable to delete. Try again.')
                setBusy(false)
              }
            }}
            className="h-10 rounded-lg bg-danger px-4 text-xs font-bold text-night disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
