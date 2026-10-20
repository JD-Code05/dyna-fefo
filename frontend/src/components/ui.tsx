import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUpRight, Check, ChevronDown } from 'lucide-react'

/** Shared bento surface: one neutral container for every desktop card. */
export const card = 'rounded-[14px] border border-line bg-surface'

type DropdownProps = {
  value: string
  options: string[]
  onChange: (value: string) => void
  className?: string
  label: string
}

export function Dropdown({ value, options, onChange, className = '', label }: DropdownProps) {
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
        className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white/[0.02] pl-3 pr-2 text-[12.5px] font-medium text-fg/90 transition-colors hover:border-white/15 hover:bg-white/[0.04] ${
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
          className="rise-in absolute right-0 top-full z-40 mt-1.5 min-w-full rounded-xl border border-line bg-raised p-1 text-fg shadow-[0_18px_40px_-12px_rgb(0_0_0/0.7)]"
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
                className="flex w-full items-center justify-between gap-4 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium text-fg/85 hover:bg-white/[0.05] hover:text-fg"
              >
                {option}
                {option === value && <Check className="size-3.5 text-sky" strokeWidth={2.6} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ArrowButton({
  label,
  className = '',
  onClick,
}: {
  label: string
  className?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid size-8 shrink-0 place-items-center rounded-full border border-line text-muted transition-colors hover:border-white/15 hover:bg-white/[0.04] hover:text-fg ${className}`}
    >
      <ArrowUpRight className="size-4" strokeWidth={2} />
    </button>
  )
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`font-bold uppercase leading-none tracking-[0.01em] text-fg ${className}`}>{children}</h2>
  )
}

/** Muted secondary line under a card title. */
export function CardHint({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`mt-1.5 text-[12px] leading-snug text-muted ${className}`}>{children}</p>
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
        on ? 'bg-sky text-night' : 'border border-white/20 hover:border-white/40'
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
    <div className="absolute inset-0 z-50 grid place-items-center bg-night/75 backdrop-blur-sm">
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-[400px] rounded-[18px] border border-line bg-surface p-6">
        <p id="confirm-title" className="text-[15px] font-bold text-fg">{title}</p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">{body}</p>
        {error && <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-2.5 py-2 text-[10px] font-semibold text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" autoFocus onClick={onCancel} className="h-10 rounded-lg border border-line px-4 text-[11px] font-semibold text-fg">
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
            className="h-10 rounded-lg bg-danger px-4 text-[11px] font-bold text-white disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
