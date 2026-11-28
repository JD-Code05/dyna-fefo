import { useEffect, useRef } from 'react'
import { STOPS, layoutFit, pickFrame, spring, stepSpring, stopFor } from './motion'

// The owner's 49 frames, traced to one sprite (design/mascot/build_frames.py). One file, so every frame is
// loaded the moment the first one is.
const SPRITE = '/mascot/frames.svg'
const CANVAS_RATIO = 820 / 800 // frame height / width
// Where the drawn art sits inside the 800-wide canvas, across every frame the page uses (measured from the
// traced frames): the rest is empty margin, so the penguin is sized and placed by its art, not its canvas.
const ART_LEFT = 0.099
const ART_RIGHT = 0.895

/**
 * The big penguin in the home page hero. It stands in the free space right of the heading text, above the
 * demo card, and as the visitor scrolls the hero it walks between five stops and makes a gesture at each
 * (wave, salute, point, cheer, bow). Decorative: hidden from screen readers and never takes clicks.
 */
export default function PenguinMascot() {
  const root = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const layerA = useRef<SVGSVGElement>(null)
  const layerB = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const el = root.current, bodyEl = body.current, a = layerA.current, b = layerB.current
    const wrap = el?.parentElement
    if (!el || !bodyEl || !a || !b || !wrap) return
    const layers = [a, b]
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // ---- layout: the space right of where the text actually ends, measured in .wrap coordinates ----
    let xLeft = 0, xRight = 0, yBase = 0, range = 400, shown = true, settled = false
    const measure = () => {
      const wasHidden = el.style.display === 'none'
      el.style.width = ''
      el.style.display = ''
      // landing.css arrives with the page's lazy chunk; until it applies, .wrap isn't positioned and every
      // measurement is wrong (it once gave a 64 px penguin for ~2 s). The ResizeObserver measures again when it lands.
      if (getComputedStyle(wrap).position !== 'relative') {
        el.classList.remove('ready') // so it fades in, rather than pops in, once the styles land
        return void (el.style.display = 'none')
      }
      const preferred = el.getBoundingClientRect().width // the CSS clamp() width
      const box = wrap.getBoundingClientRect()
      const colRight = wrap.clientWidth - parseFloat(getComputedStyle(wrap).paddingRight)
      let textRight = 0
      for (const part of [wrap.querySelector('h1'), wrap.querySelector('.purpose'), wrap.querySelector('.sub'), wrap.querySelector('.hero-cta')?.lastElementChild]) {
        if (!part) continue
        const r = document.createRange() // a wrapped paragraph's box can be wider than its longest line
        r.selectNodeContents(part)
        for (const rect of r.getClientRects()) textRight = Math.max(textRight, rect.right - box.left)
      }
      // offsetTop ignores the demo card's slide-in transform. While it slides in, its .rise wrapper has a blur
      // filter, which makes the wrapper its offset parent (offsetTop 0), so add up offsets until .wrap.
      let demoTop = wrap.clientHeight
      const demo = wrap.querySelector('.frame') as HTMLElement | null
      if (demo) {
        demoTop = 0
        for (let n: HTMLElement | null = demo; n && n !== wrap; n = n.offsetParent as HTMLElement | null) demoTop += n.offsetTop
      }
      // as big as the CSS allows, but no taller than the space above the demo card, and the art (not the empty
      // canvas margin) must fit between the text and the column edge
      // it may rise into the hero's top padding (keeping 24 px clear) so its hat lines up with the big heading
      const headroom = Math.max(0, parseFloat(getComputedStyle(wrap.parentElement ?? wrap).paddingTop) - 24)
      const tallest = (demoTop - 6 + headroom) / CANVAS_RATIO
      const width = layoutFit((colRight - (textRight + 16)) / (ART_RIGHT - ART_LEFT), Math.min(preferred, tallest))
      shown = width !== null
      if (width === null) return void (el.style.display = 'none')
      el.style.width = `${width}px`
      xRight = colRight - ART_RIGHT * width // art's right edge on the column edge
      xLeft = Math.min(xRight, textRight + 16 - ART_LEFT * width) // art's left edge 16 px right of the text
      yBase = demoTop - width * CANVAS_RATIO - 6
      range = Math.max(260, demoTop * 0.75)
      // until it's shown (or when it reappears after being hidden), snap into place instead of walking there
      if (!settled || wasHidden) pos.x = pos.to = xRight
      if (settled && !el.classList.contains('ready')) requestAnimationFrame(() => el.classList.add('ready'))
      if (reduce) el.style.transform = `translate(${xRight}px, ${yBase}px)` // the still penguin follows every re-measure
    }

    // ---- frame swapping: the new frame fades in on the back layer while the old one fades out ----
    let front = 0, current = 'p02', mirrored = false
    const show = (id: string, mirror: boolean, fast: boolean) => {
      if (id === current && mirror === mirrored) return
      const next = layers[1 - front]
      el.style.setProperty('--xf', fast ? '60ms' : '100ms')
      next.firstElementChild?.setAttribute('href', `${SPRITE}#${id}`)
      next.style.transform = mirror ? 'scaleX(-1)' : ''
      next.classList.add('on')
      layers[front].classList.remove('on')
      front = 1 - front
      current = id
      mirrored = mirror
      if (!fast) squash.v -= 0.6 // a tiny squash sells the pose change
    }

    const pos = spring(0, 40, 0.9) // walking position: heavy, no overshoot
    const turn = spring(0, 90, 0.85) // 0 = facing the reader, 1 = turned to walk
    const squash = spring(0, 260, 0.45)

    // Only fade in once the fonts have loaded and the layout has had two frames to settle, so the first
    // thing a visitor sees is the final size and place (no small penguin first).
    measure()
    const reveal = () => requestAnimationFrame(() => requestAnimationFrame(() => {
      measure()
      settled = true
      if (el.style.display !== 'none') el.classList.add('ready') // else measure() fades it in once it can show
    }))
    if (document.fonts) document.fonts.ready.then(reveal)
    else reveal()

    // Measure again whenever the hero's layout changes size (the web font reflowing the text, the demo card
    // rendering): one-off load/font events can fire before the layout settles, which once left the penguin
    // measured against a demo card at the top of the hero.
    const ro = new ResizeObserver(() => measure())
    ro.observe(wrap)
    const demo = wrap.querySelector('.frame')
    if (demo) ro.observe(demo)
    window.addEventListener('resize', measure)

    if (reduce) {
      // Reduced motion: one still, friendly pose; no walking, gestures or loop.
      show('c03', false, true)
      return () => {
        ro.disconnect()
        window.removeEventListener('resize', measure)
      }
    }

    let mouseX: number | null = null
    const onPointer = (e: PointerEvent) => { mouseX = e.clientX / window.innerWidth }
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) window.addEventListener('pointermove', onPointer, { passive: true })

    let stop = 0, arrivedAt = performance.now(), travelled = 0, lastX = pos.x, last = performance.now(), raf = 0, onScreen = true
    const frame = (now: number) => {
      raf = 0
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      if (shown) {
        const want = stopFor(window.scrollY / range)
        pos.to = xRight + ((xLeft - xRight) * want) / (STOPS.length - 1)
        stepSpring(pos, dt)
        stepSpring(squash, dt)
        const moving = Math.abs(pos.to - pos.x) > 2 || Math.abs(pos.v) > 15
        turn.to = moving ? 1 : 0
        stepSpring(turn, dt)
        travelled += Math.abs(pos.x - lastX)
        lastX = pos.x
        if (moving || want !== stop) { stop = want; arrivedAt = now } // narrow screens change gesture in place
        const pick = pickFrame({ moving, turn: turn.x, velocity: pos.v, travelled, stop, sinceArrived: now - arrivedAt, mouseX })
        show(pick.id, pick.mirror, pick.fast)
        const t = now / 1000
        const hop = !moving && STOPS[stop].hop && turn.x < 0.2 ? -Math.abs(Math.sin(t * 6)) * 14 : 0
        const bob = moving ? -Math.abs(Math.sin((travelled / 26) * (Math.PI / 2))) * 4 : Math.sin(t * 2) * 1.5
        el.style.transform = `translate(${pos.x}px, ${yBase + hop + bob}px)`
        bodyEl.style.transform = `scale(${1 - squash.x * 0.02}, ${1 + squash.x * 0.03})`
      }
      if (onScreen && !document.hidden) raf = requestAnimationFrame(frame)
    }
    const resume = () => {
      if (raf || !onScreen || document.hidden) return
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }

    // Pause while the hero is off screen or the tab is hidden.
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; resume() })
    io.observe(wrap)
    document.addEventListener('visibilitychange', resume)
    document.fonts?.ready.then(measure)
    resume()

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('resize', measure)
      window.removeEventListener('pointermove', onPointer)
    }
  }, [])

  return (
    <div className="mascot" ref={root} aria-hidden="true">
      <div className="mascot-body" ref={body}>
        <svg viewBox="0 0 800 820" className="on" ref={layerA}><use href={`${SPRITE}#p02`} /></svg>
        <svg viewBox="0 0 800 820" ref={layerB}><use href={`${SPRITE}#p02`} /></svg>
      </div>
    </div>
  )
}
