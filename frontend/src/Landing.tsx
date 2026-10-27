import { useEffect, useReducer, useRef, useState } from 'react'
import { Activity, ArrowRight, Check, ListOrdered, PackageCheck, Sun, Thermometer } from 'lucide-react'
import Logo from './components/Logo'
import type { Role } from './DesktopDashboard'

const motionAllowed = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Same storage key and <html> class as the dashboard's theme switch, so the choice carries over.
export function toggleTheme() {
  const light = !document.documentElement.classList.contains('theme-light')
  try {
    window.localStorage.setItem('freshops-theme', light ? 'light' : 'dark')
  } catch {}
  const apply = () => document.documentElement.classList.toggle('theme-light', light)
  if (!document.startViewTransition) return apply()
  document.startViewTransition(apply)
}

// Reveal-once on scroll for .rise blocks, plus the staggered delays from the mockup.
function useReveal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el || !motionAllowed()) return
    el.classList.add('anim')
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.2 },
    )
    el.querySelectorAll<HTMLElement>('.hero .rise').forEach((n, i) => (n.style.transitionDelay = `${0.35 + i * 0.1}s`))
    el.querySelectorAll<HTMLElement>('.cycle-strip i').forEach((n, i) => (n.style.transitionDelay = `${i * 0.05}s`))
    el.querySelectorAll<HTMLElement>('.rail .step').forEach((n, i) => (n.style.transitionDelay = `${0.15 + i * 0.18}s`))
    el.querySelectorAll('.rise, .cycle, .rail').forEach((n) => io.observe(n))
    const hero = el.querySelector('.hero')
    el.querySelectorAll<HTMLElement>('.hero h1 span').forEach((s, i) => (s.style.transitionDelay = `${0.12 + i * 0.08}s`))
    const t = window.setTimeout(() => hero?.classList.add('ready'), 60)
    return () => {
      io.disconnect()
      window.clearTimeout(t)
    }
  }, [root])
}

// The real Q10 model over 24 h in 10-minute steps. Base pattern is Herron et al. (2022): 2 h at 4 °C, 2 h at
// about 23 °C. The door button adds the visitor's own heat on top.
const SHELF = 240, TREF = 4, Q10 = 2.5, X0 = 40, X1 = 590, STEP = 10, N = (24 * 60) / STEP
const Y = (t: number) => 190 - t * (170 / 24)
const X = (h: number) => X0 + (h / 24) * (X1 - X0)
const pattern = (m: number) => (Math.floor(m / 120) % 2 ? 23 + Math.sin(m) * 0.3 : 4 + Math.sin(m * 0.7) * 0.25)
const days = (h: number) => `${(h / 24).toFixed(1)} d`
const fresh = () => ({ k: 0, age: 0, doorT: 4, t: pattern(0), path: `M${X0} ${Y(pattern(0)).toFixed(1)}`, doorAt: [] as number[] })

function ShelfLifeDemo({ onRank }: { onRank: () => void }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const sim = useRef(fresh())
  const door = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const [, redraw] = useReducer((x: number) => x + 1, 0)
  const [doorOpen, setDoorOpen] = useState(false)
  const [done, setDone] = useState(false)

  const setDoor = (open: boolean) => {
    door.current = open
    setDoorOpen(open)
  }
  const step = () => {
    const s = sim.current
    s.k++
    s.doorT += door.current ? (23 - s.doorT) * 0.5 : (3.8 - s.doorT) * 0.35
    s.t = Math.max(pattern(s.k * STEP), s.doorT)
    s.age += Math.max(0.5, Q10 ** ((s.t - TREF) / 10)) * (STEP / 60)
    if (door.current) s.doorAt.push((s.k - 1) * (STEP / 60))
    s.path += ` L${X((s.k * STEP) / 60).toFixed(1)} ${Y(s.t).toFixed(1)}`
  }
  const reset = () => {
    window.clearTimeout(timer.current)
    sim.current = fresh()
    setDoor(false)
    setDone(false)
  }
  const finish = () => {
    setDoor(false)
    setDone(true)
    redraw()
  }
  const play = (delay: number) => {
    reset()
    redraw()
    const go = () => {
      step()
      redraw()
      if (sim.current.k < N) timer.current = window.setTimeout(go, 70)
      else finish()
    }
    timer.current = window.setTimeout(go, delay)
  }

  useEffect(() => {
    // Reduced motion: show the finished day; Replay still plays it on request.
    if (!motionAllowed()) {
      while (sim.current.k < N) step()
      finish()
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          io.disconnect()
          play(900)
        }
      },
      { threshold: 0.3 },
    )
    if (frameRef.current) io.observe(frameRef.current)
    return () => {
      io.disconnect()
      window.clearTimeout(timer.current)
    }
    // play/step/finish only touch refs and state setters, so running this once is correct.
  }, [])

  const { k, age, t, path, doorAt } = sim.current
  const h = (k * STEP) / 60
  const label = SHELF - h
  const real = Math.max(0, SHELF - age)
  const lost = (label - real) / 24
  const end = k === N

  // The reveal adds .in to the outer div by hand, so its className stays static; .done lives on the inner frame.
  return (
    <div className="rise" ref={frameRef}>
    <div className={`frame${done ? ' done' : ''}`}>
      <div className="frame-top">
        <span className="lockup">
          <span className="logo-frame"><Logo /></span>FreshOps
        </span>
        <span>Chiller A · Batch CHK-002</span>
        <span className="live">
          <span className="dot" />
          <span className="mono">
            {end ? 'Day 2 · 00:00' : `Day 1 · ${String(Math.floor(h)).padStart(2, '0')}:${String((k * STEP) % 60).padStart(2, '0')}`}
          </span>
        </span>
      </div>
      <div className="frame-body">
        <div className="panel">
          <div className="panel-title">
            <span>Chiller temperature, last 24 h</span>
            <span className="mono" style={{ color: t > 4.5 ? 'var(--danger)' : undefined }}>{t.toFixed(1)} °C</span>
          </div>
          <svg className="chart" viewBox="0 0 600 220" role="img" aria-label="Chiller temperature over one simulated day">
            <line className="grid" x1="40" x2="590" y1="20" y2="20" />
            <line className="grid" x1="40" x2="590" y1="190" y2="190" />
            <line className="thresh" x1="40" x2="590" y1="164" y2="164" />
            <text x="0" y="24">24°</text>
            <text x="0" y="168">4°</text>
            <text x="0" y="194">0°</text>
            <text x="544" y="158" style={{ fill: 'var(--danger)' }}>4 °C limit</text>
            {[2, 6, 10, 14, 18, 22].map((s) => (
              <rect key={s} className="hot" x={X(s)} y="20" width={X(2) - X0} height="170" />
            ))}
            {doorAt.map((d) => (
              <rect key={d} className="hot" x={X(d)} y="20" width={X(STEP / 60) - X0} height="170" />
            ))}
            <path className="trace" d={path} />
            <text x="40" y="214">00:00</text>
            <text x="290" y="214">12:00</text>
            <text x="548" y="214">24:00</text>
          </svg>
          <div className="door-row">
            <button type="button" className="btn door" aria-pressed={doorOpen} disabled={done} onClick={() => setDoor(!door.current)}>
              {doorOpen ? 'Close the door' : 'Open the chiller door'}
            </button>
            <p>Try it while the line is low. Watch the estimate drop.</p>
          </div>
        </div>
        <div className="panel compare">
          <div className="panel-title"><span>Days of life left</span></div>
          <div>
            <div className="row-label"><b>Printed label</b><span className="mono">{days(label)}</span></div>
            <div className="bar label"><i style={{ width: `${(label / SHELF) * 100}%` }} /></div>
          </div>
          <div>
            <div className="row-label"><b>FreshOps estimate</b><span className="mono">{days(real)}</span></div>
            <div className="bar real"><i style={{ width: `${(real / SHELF) * 100}%` }} /></div>
          </div>
          <div className="verdict" aria-live="polite">
            {lost < 0.05 ? (
              'Doors are shut. The batch ages at the normal rate.'
            ) : (
              <>
                The label still says <span className="mono">{days(label)}</span>. Warm hours have {end ? '' : 'already '}cost{' '}
                <b className="mono">{lost.toFixed(1)} days</b>.{end && ' FreshOps moves this batch up the pull list.'}
              </>
            )}
          </div>
          <div className="demo-end">
            <button type="button" className="btn solid" onClick={onRank}>
              See where it ranks <ArrowRight />
            </button>
            <button type="button" className="btn" onClick={() => play(300)}>Replay the day</button>
          </div>
          <p className="synthetic">Simulated batch: 2 h at 4 °C, 2 h at about 23 °C, repeated.</p>
        </div>
      </div>
    </div>
    </div>
  )
}

const STEPS: [typeof Thermometer, string, string, string][] = [
  [Thermometer, 'Sense', 'Each chiller sends temperature and humidity every few seconds.', '4.2 °C · 86 %'],
  [Activity, 'Recalculate', 'Warm minutes age a batch faster. FreshOps adds them up for every batch.', 'Q10 = 2.5'],
  [ListOrdered, 'Rank', 'Batches with the least real life left go to the top of the pull list.', 'Dynamic FEFO'],
  [Check, 'Approve', 'A supervisor approves or rejects every dispatch and salvage. Nothing runs on its own.', 'Human in the loop'],
  [PackageCheck, 'Confirm', "Staff tap once when the order is done, or flag it if they can't.", 'Logged in history'],
]

const FAQ: [string, string][] = [
  ['Does FreshOps replace our inventory system?', "No. It doesn't track stock movements, orders, or sales. It reads chiller temperatures, works out how much life each batch has left, and tells you which batch to move first."],
  ['Does it change prices or move stock by itself?', 'No. Every dispatch, markdown, and salvage waits for a supervisor to approve or reject it, and each decision is saved in the change history.'],
  ['How does it know how much life is left?', 'It adds up how warm each batch has been. Warm hours count more than cold ones: every 10 °C above 4 °C makes the meat age 2.5 times faster (a Q10 model). On a day of on-and-off warming, it loses about 2.3 days, close to the 2.25 days measured for fresh chicken.'],
  ['What if a sensor goes offline?', 'The dashboard raises a sensor-offline alert for that chiller, so someone can go and check it before trusting the numbers again.'],
  ['Does it need the internet?', 'No. Everything runs on one laptop and works fully offline.'],
  ['Is this real data?', 'Not yet. The chillers, batches, and reviews in this demo are simulated. Results come from calibrated models, not field trials.'],
]

export default function Landing({ onSignIn }: { onSignIn: (role: Role) => void }) {
  const root = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  useReveal(root)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="landing" ref={root}>
      <nav className={scrolled ? 'scrolled' : ''}>
        <div className="wrap">
          <a href="#" className="lockup"><span className="logo-frame"><Logo /></span>FreshOps</a>
          <div className="links">
            <a href="#why">Why we built it</a>
            <a href="#how">How it works</a>
            <a href="#roles">Dashboards</a>
            <a href="#faq">Questions</a>
          </div>
          <button type="button" className="icon-btn" aria-label="Switch theme" onClick={toggleTheme}><Sun strokeWidth={1.6} /></button>
          <button type="button" className="btn solid" onClick={() => onSignIn('supervisor')}>Sign in</button>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap">
          <div className="hero-lockup">
            <div className="hero-logo"><Logo /></div>
            <h1><span>Fresh</span><span>Ops</span></h1>
          </div>
          <p className="purpose rise">Shelf life from the cold room, <em>not the label.</em></p>
          <p className="sub rise">
            FreshOps watches the temperature in your chillers, recalculates how much life each batch of chicken really has left, and tells
            your team which batch to move first.
          </p>
          <div className="hero-cta rise">
            <button type="button" className="btn solid big" onClick={() => onSignIn('supervisor')}>Sign in as Supervisor <ArrowRight /></button>
            <button type="button" className="btn big" onClick={() => onSignIn('staff')}>Sign in as Staff</button>
            <a className="textlink" href="#why">Why we built it ↓</a>
          </div>
          <ShelfLifeDemo onRank={() => onSignIn('supervisor')} />
        </div>
      </header>

      <section className="block" id="why">
        <div className="wrap">
          <h2 className="rise">A printed date can't feel the heat. <span className="quiet">Chicken can.</span></h2>
          <p className="lede rise">
            Stores pick stock by the date on the label: first to expire, first out. That date assumes the meat stayed cold the whole way.
            Every open door, slow unload, or failing compressor quietly eats shelf life the label never shows.
          </p>
          <div className="why-grid">
            <div className="cycle rise">
              <div className="row-label"><b>One day of on-and-off warming</b><span className="mono">24 h</span></div>
              <div className="cycle-strip" aria-hidden>
                {Array.from({ length: 12 }, (_, i) => <i key={i} />)}
              </div>
              <div className="cycle-axis"><span>grey: 2 h at 4 °C</span><span>red: 2 h at about 23 °C</span></div>
              <div className="cycle-result"><span className="mono">−2.25 days</span><span>of shelf life lost, while the label stayed the same.</span></div>
              <p className="cite">Fresh chicken breast under cyclic temperature abuse. FreshOps' model loses about 2.3 days on the same pattern.</p>
            </div>
            <ul className="floor rise">
              <li><span className="who">On the floor</span><p>Pickers grab the pallet at the front, not the one that is closest to spoiling.</p></li>
              <li><span className="who">Supervisors</span><p>Updates travel by voice. Nobody can see what was moved, or why.</p></li>
              <li><span className="who">The result</span><p>Meat that looked fine on paper gets thrown out, or worse, gets sold.</p></li>
            </ul>
          </div>
        </div>
      </section>

      <section className="block" id="how" style={{ paddingTop: 40 }}>
        <div className="wrap">
          <h2 className="rise">From a sensor reading to a <span className="quiet">signed-off decision.</span></h2>
          <div className="rail">
            <span className="fill" />
            {STEPS.map(([Icon, title, text, tag]) => (
              <div className="step rise" key={title}>
                <span className="node"><Icon strokeWidth={1.6} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="mono">{tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="block" id="roles" style={{ paddingTop: 40 }}>
        <div className="wrap">
          <h2 className="rise">Two dashboards. <span className="quiet">One source of truth.</span></h2>
          <div className="roles">
            <article className="role rise">
              <div className="role-head"><h3>Supervisor</h3><p>See every chiller and every batch. Approve or reject what FreshOps recommends, and check who did what.</p></div>
              <ul><li>Live chiller map</li><li>Shelf-life comparison</li><li>Priority dispatch</li><li>Salvage flags</li><li>Change history</li></ul>
              <div className="mini" aria-hidden>
                <div className="mini-row"><span className="mono">CHK-004</span><span><span className="tag salvage">Salvage</span></span><span className="acts"><span>Reject</span><span className="go">Approve</span></span></div>
                <div className="mini-row"><span className="mono">CHK-002</span><span><span className="tag dispatch">Dispatch first</span></span><span className="acts"><span>Reject</span><span className="go">Approve</span></span></div>
                <div className="mini-row"><span className="mono">CHK-001</span><span className="rul"><span className="bar"><i style={{ width: '72%' }} /></span><span className="mono">7.2 d</span></span><span style={{ color: 'var(--muted)', fontSize: 12 }}>No action</span></div>
              </div>
            </article>
            <article className="role rise">
              <div className="role-head"><h3>Staff</h3><p>A short pull list of approved orders. Do the job, tap done, move on. No settings, nothing to break.</p></div>
              <ul><li>Pull list</li><li>One-tap confirm</li><li>Can't do it: not found or spoiled</li><li>Chiller readings</li></ul>
              <div className="mini" aria-hidden>
                <div className="mini-row"><span className="mono">CHK-002</span><span>Ship today · Chiller A</span><span className="acts"><span>Can't do it</span><span className="go">Shipment done</span></span></div>
                <div className="mini-row"><span className="mono">CHK-004</span><span>Salvage · Chiller B</span><span className="acts"><span>Can't do it</span><span className="go">Salvage done</span></span></div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="block" id="faq" style={{ paddingTop: 40 }}>
        <div className="wrap faq">
          <h2 className="rise">Questions <span className="quiet">we get asked.</span></h2>
          <div className="rise">
            {FAQ.map(([q, a]) => (
              <details key={q}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="close">
        <div className="wrap">
          <div className="hero-logo rise"><Logo /></div>
          <h2 className="rise">Move the right batch first.</h2>
          <div className="hero-cta rise">
            <button type="button" className="btn solid big" onClick={() => onSignIn('supervisor')}>Supervisor sign in</button>
            <button type="button" className="btn big" onClick={() => onSignIn('staff')}>Staff sign in</button>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <span>FreshOps · JAM SOFT capstone, 2026</span>
          <span>Demo data is simulated. Results come from calibrated models, not field trials.</span>
        </div>
      </footer>
    </div>
  )
}
