import { useState, type ReactNode } from 'react'
import {
  Check,
  MapPin,
  Monitor,
  Tags,
  X,
} from 'lucide-react'
import { useInventory } from '../data/InventoryContext'

type Section = 'appearance' | 'warehouse'

const sections = [
  { id: 'appearance', label: 'Appearance', icon: Monitor },
  { id: 'warehouse', label: 'Warehouse setup', icon: MapPin },
] as const

export default function SettingsModal({
  onClose,
  theme,
  onThemeChange,
}: {
  onClose: () => void
  theme: 'dark' | 'light'
  onThemeChange: (theme: 'dark' | 'light') => void
}) {
  const [section, setSection] = useState<Section>('appearance')
  // Close plays the exit animation first; the modal unmounts when it ends (see onAnimationEnd).
  const [closing, setClosing] = useState(false)
  const close = () => {
    setClosing(true)
    window.setTimeout(onClose, 300) // fallback if animationend never fires (e.g. a throttled background tab)
  }

  return (
    <div className={`fixed inset-0 z-50 grid place-items-center p-4 bg-night/75 backdrop-blur-[4px] ${closing ? 'backdrop-out' : 'backdrop-in'}`}>
      <div
        role="dialog"
        onAnimationEnd={(e) => e.target === e.currentTarget && closing && onClose()}
        aria-modal="true"
        aria-labelledby="settings-title"
        className={`${closing ? 'modal-out' : 'modal-in'} flex h-[640px] max-h-full w-[920px] max-w-full overflow-hidden rounded-[18px] border border-line bg-surface shadow-[0_30px_90px_rgb(0_0_0/0.35)]`}
      >
        <aside className="flex w-[210px] shrink-0 flex-col border-r border-line bg-night/40 p-4">
          <div className="px-2 py-2">
            <p className="text-xs font-semibold text-muted">FreshOps</p>
            <h2 id="settings-title" className="mt-1 text-base font-bold text-fg">Settings</h2>
          </div>
          <nav aria-label="Settings sections" className="mt-4 space-y-1">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={`flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-xs font-semibold ${
                  section === id ? 'bg-pill text-fg' : 'text-muted hover:bg-white/[0.04] hover:text-fg'
                }`}
              >
                <Icon className={`size-4 ${section === id ? 'text-accent' : ''}`} strokeWidth={1.8} />
                {label}
              </button>
            ))}
          </nav>
          <p className="mt-auto px-2 font-mono text-xs leading-relaxed text-muted">
            Version 0.1.0 · demo
          </p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center border-b border-line px-6">
            <div>
              <h3 className="text-base font-bold text-fg">
                {section === 'warehouse' ? 'Warehouse setup' : 'Appearance'}
              </h3>
              <p className="mt-1 text-xs text-muted">Manage your warehouse console preferences.</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close settings"
              className="ml-auto grid size-9 place-items-center rounded-lg text-muted hover:bg-white/[0.04] hover:text-fg"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {section === 'appearance' && <AppearanceSettings theme={theme} onChange={onThemeChange} />}
            {section === 'warehouse' && <WarehouseSetupSettings />}
          </div>

          {/* Settings apply as soon as they are picked, so there is nothing to save. */}
          <footer className="flex h-16 shrink-0 items-center justify-end gap-2 border-t border-line px-6">
            <button type="button" onClick={close} className="h-9 rounded-lg border border-line px-4 text-xs font-semibold text-muted hover:text-fg">
              Close
            </button>
          </footer>
        </div>
      </div>
    </div>
  )
}

function SectionIntro({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mb-5">
      <h4 className="text-sm font-bold text-fg">{title}</h4>
      <p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p>
    </div>
  )
}

function AppearanceSettings({ theme, onChange }: { theme: 'dark' | 'light'; onChange: (theme: 'dark' | 'light') => void }) {
  return (
    <div>
      <SectionIntro title="Appearance" detail="Choose how the operations console looks on this device." />
      <div className="grid grid-cols-2 gap-3">
        {(['dark', 'light'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-xl border p-3 text-left ${
              theme === option ? 'border-accent/50 bg-accent/[0.05]' : 'border-line hover:border-white/20'
            }`}
          >
            <span className={`block h-24 rounded-lg border ${option === 'dark' ? 'border-[#30333C] bg-[#121318]' : 'border-[#D3D9E2] bg-white'}`}>
              <span className={`mx-3 mt-3 block h-3 w-1/2 rounded ${option === 'dark' ? 'bg-[#252730]' : 'bg-[#E5E8ED]'}`} />
              <span className={`mx-3 mt-2 block h-12 rounded ${option === 'dark' ? 'bg-[#1B1C22]' : 'bg-[#F2F4F7]'}`} />
            </span>
            <span className="mt-3 flex items-center justify-between text-xs font-semibold capitalize text-fg">
              {option} mode
              {theme === option && <Check className="size-4 text-accent" />}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function WarehouseSetupSettings() {
  const { locations, categories } = useInventory()

  return (
    <div>
      <SectionIntro
        title="Locations and products"
        detail="Zones and products come from the backend. Sensors and batches can only use these."
      />
      <div className="grid grid-cols-2 gap-4">
        <SetupList title="Zones" detail={`${locations.length} zones`} icon={<MapPin className="size-4" />} items={locations} />
        <SetupList title="Products" detail={`${categories.length} products`} icon={<Tags className="size-4" />} items={categories} />
      </div>
    </div>
  )
}

function SetupList({ title, detail, icon, items }: { title: string; detail: string; icon: ReactNode; items: string[] }) {
  return (
    <section className="rounded-xl border border-line bg-night/40 p-4">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-pill text-muted">{icon}</span>
        <div>
          <p className="text-xs font-semibold text-fg">{title}</p>
          <p className="mt-0.5 text-xs text-muted">{detail}</p>
        </div>
      </div>
      <ul className="mt-4 max-h-[250px] space-y-1 overflow-y-auto pr-1">
        {items.map((item) => (
          <li key={item} className="flex h-8 items-center rounded-lg border border-line bg-surface px-2.5 text-xs text-fg">
            <span className="min-w-0 flex-1 truncate" title={item}>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
