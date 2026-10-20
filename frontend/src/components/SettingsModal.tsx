import { useState, type ReactNode } from 'react'
import {
  Check,
  MapPin,
  Monitor,
  Plus,
  Tags,
  Trash2,
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
  const [saved, setSaved] = useState(false)

  const save = () => {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-night/75 backdrop-blur-[4px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="flex h-[640px] w-[920px] overflow-hidden rounded-[18px] border border-line bg-surface shadow-[0_30px_90px_rgb(0_0_0/0.35)]"
      >
        <aside className="flex w-[210px] shrink-0 flex-col border-r border-line bg-night/40 p-4">
          <div className="px-2 py-2">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-sky">FreshOps</p>
            <h2 id="settings-title" className="mt-1 text-[17px] font-bold text-fg">Settings</h2>
          </div>
          <nav aria-label="Settings sections" className="mt-4 space-y-1">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={`flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[10.5px] font-semibold ${
                  section === id ? 'bg-pill text-fg' : 'text-muted hover:bg-white/[0.04] hover:text-fg'
                }`}
              >
                <Icon className={`size-4 ${section === id ? 'text-sky' : ''}`} strokeWidth={1.8} />
                {label}
              </button>
            ))}
          </nav>
          <p className="mt-auto px-2 font-mono text-[9.5px] leading-relaxed text-muted">
            FreshOps Console<br />Version 2.4.0
          </p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center border-b border-line px-6">
            <div>
              <h3 className="text-[15px] font-bold capitalize text-fg">
                {section === 'warehouse' ? 'Warehouse setup' : section}
              </h3>
              <p className="mt-1 text-[11px] text-muted">Manage your warehouse console preferences.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
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

          <footer className="flex h-16 shrink-0 items-center justify-end gap-2 border-t border-line px-6">
            {saved && (
              <span className="mr-auto flex items-center gap-1.5 text-[11px] font-semibold text-ok">
                <Check className="size-3.5" /> Settings saved
              </span>
            )}
            <button type="button" onClick={onClose} className="h-9 rounded-lg border border-line px-4 text-[10.5px] font-semibold text-muted hover:text-fg">
              Cancel
            </button>
            <button type="button" onClick={save} className="h-9 rounded-lg bg-sky px-4 text-[10.5px] font-bold text-night hover:brightness-105">
              Save changes
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
      <h4 className="text-[13px] font-bold text-fg">{title}</h4>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{detail}</p>
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
              theme === option ? 'border-sky/50 bg-sky/[0.05]' : 'border-line hover:border-white/20'
            }`}
          >
            <span className={`block h-24 rounded-lg border ${option === 'dark' ? 'border-[#30333C] bg-[#121318]' : 'border-[#D3D9E2] bg-white'}`}>
              <span className={`mx-3 mt-3 block h-3 w-1/2 rounded ${option === 'dark' ? 'bg-[#252730]' : 'bg-[#E5E8ED]'}`} />
              <span className={`mx-3 mt-2 block h-12 rounded ${option === 'dark' ? 'bg-[#1B1C22]' : 'bg-[#F2F4F7]'}`} />
            </span>
            <span className="mt-3 flex items-center justify-between text-[10.5px] font-semibold capitalize text-fg">
              {option} mode
              {theme === option && <Check className="size-4 text-sky" />}
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
        <span className="grid size-8 place-items-center rounded-lg bg-sky/10 text-sky">{icon}</span>
        <div>
          <p className="text-[10.5px] font-semibold text-fg">{title}</p>
          <p className="mt-0.5 text-[10px] text-muted">{detail}</p>
        </div>
      </div>
      <ul className="mt-4 max-h-[250px] space-y-1 overflow-y-auto pr-1">
        {items.map((item) => (
          <li key={item} className="flex h-8 items-center rounded-lg border border-line bg-surface px-2.5 text-[11px] text-fg">
            <span className="min-w-0 flex-1 truncate" title={item}>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
