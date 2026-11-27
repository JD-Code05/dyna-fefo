# Penguin Mascot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A frame-animated penguin mascot, built from the owner's 49 drawn frames, that stands and gestures beside the big "FreshOps" in the home page hero as the visitor scrolls.

**Architecture:** A one-off design-time script (`design/mascot/`) cuts, aligns and traces the owner's sheets into one SVG sprite of 49 `<symbol>`s with `fill="currentColor"`. A pure TypeScript motion module decides, every animation frame, where the penguin stands and which frame it shows. A React component renders two cross-fading `<use>` layers inside the hero and drives the motion module with `requestAnimationFrame`.

**Tech Stack:** Python 3 + Pillow + NumPy + SciPy + `potracer` (design time only, in a git-ignored venv); Next.js 15 / React 19 / TypeScript; Node 24's built-in test runner (`node --test`) for the motion module.

**Spec:** `docs/superpowers/specs/2026-11-28-penguin-mascot-design.md`

## Global Constraints

- Offline: no CDN, no remote assets; fonts already bundled with `next/font`.
- No new runtime dependencies in `frontend/package.json`; the tracing tool lives only in `design/mascot/.venv` (git-ignored).
- One colour: line art is `currentColor` (off-white in dark mode, navy in light mode); white areas are transparent.
- Canvas for every frame: 800 × 820, ground line y = 800, feet centre x = 400.
- Never cover the heading, paragraphs, buttons or demo card; no horizontal scroll at 375, 768, 1024, 1280, 1440 and 2730 px.
- Size `clamp(190px, 22vw, 340px)` wide; shrinks to the free space down to 160 px, else hidden.
- Only `transform` and `opacity` animate. Cross-fade 100 ms for pose changes, 60 ms for walk steps.
- `aria-hidden="true"`, `pointer-events: none`. Reduced motion: still frame c03, no loop.
- No blinking.
- Conventional commits; no Co-Authored-By lines or AI footers.
- `cd frontend && npx tsc --noEmit -p .` stays clean.
- After frontend edits: `docker compose --profile ui build frontend && docker compose --profile ui up -d --force-recreate frontend`, then grep `.next/static` and hard-reload.

## Review Focus

1. **Text reflow after the web font loads** moves the free space: the layout must be measured again on `document.fonts.ready` and window `load` (the mockup broke on this). Test: `layoutFit` is pure; Task 3's browser check measures after fonts load.
2. **Mid-size widths (768–1024 px):** the penguin must shrink or hide, never sit on the paragraph or buttons. Test: `layoutFit` cases for free space 104 px (hidden), 200 px (shrunk to 200), 400 px (full size) in Task 2.
3. **Scrolling back up mid-walk** must reverse smoothly and mirror the walk frames. Test: `pickFrame` returns a mirrored walk frame when velocity is positive (moving right) in Task 2.
4. **Fast scroll flick to the bottom then back to the top** must not leave it stuck mid-gesture or facing the wrong way. Test: `stopFor` clamps progress outside 0–1, and `pickFrame` at rest returns the stop's gesture in Task 2.
5. **Light theme toggle** on the landing page must recolour it at once (currentColor through `<use>`). Test: Task 3 browser check switches theme and reads the computed `color` on the mascot.

---

### Task 1: Trace the sheets into an SVG sprite (approval stop 1)

**Files:**
- Create: `design/mascot/sheets/sheet-0-poses.webp`, `sheet-A-turns.png`, `sheet-B-walk.png`, `sheet-C-gestures.webp`, `sheet-D-cheer-bow.webp` (copies of the originals listed in the spec's Source art)
- Create: `design/mascot/build_frames.py` (port of `.superpowers/brainstorm/penguin-frames/slice.py`, plus tracing)
- Create: `design/mascot/README.md` (one paragraph: what the script does, how to rerun it)
- Create: `frontend/public/mascot/frames.svg` (generated)
- Create: `design/mascot/compare.png` (generated; traced vs PNG, dark and light)
- Modify: `.gitignore` (add `design/mascot/.venv/` and `design/mascot/out/`)

**Interfaces:**
- Produces: `frontend/public/mascot/frames.svg`, one `<svg>` with 49 `<symbol id="pNN|aNN|bNN|cNN|dNN" viewBox="0 0 800 820">`, each a single `<path fill="currentColor" fill-rule="evenodd">`. Ids and their order exactly as `slice.py` assigns them (reading order per sheet: p01–p15, a01–a06, b01–b08, c01–c12, d01–d08).

- [ ] **Step 1:** Copy the originals into `design/mascot/sheets/` under the names above (sheet 0 from the chat copy `.superpowers/brainstorm/penguin-frames/sheets/sheet-0-poses.webp`).
- [ ] **Step 2:** Create the venv and install the design-time tools: `python -m venv design/mascot/.venv` then `design/mascot/.venv/Scripts/pip install pillow numpy scipy potracer`.
- [ ] **Step 3:** Write `build_frames.py`: keep `slice.py`'s loading (alpha composite on white), figure detection (navy `lum < 110`, `binary_closing(iterations=3)`, components ≥ 25 % of the largest), reading order, scaling to `TARGET = 700`, ground/feet alignment. Instead of saving PNGs, threshold each aligned 800 × 820 alpha mask at 0.5, trace it with `potrace` (`turdsize=4`, `alphamax=1.0`, `opttolerance=0.2`), and write one `<symbol>` per frame into `frontend/public/mascot/frames.svg`. Also write `out/<id>.png` (the untraced masks) and `compare.png`: for every frame, the traced SVG rendered next to its PNG, on #0a0a0a in #f4f1ec and on white in #172033.
- [ ] **Step 4:** Run `design/mascot/.venv/Scripts/python design/mascot/build_frames.py`. Expected output: per-sheet counts `15, 6, 8, 12, 8`, `49 symbols`, and the sprite size (expected well under 1 MB).
- [ ] **Step 5:** Verify: `grep -c "<symbol" frontend/public/mascot/frames.svg` prints `49`; open `compare.png` and check no frame lost its eyes, beak, hat stripes or flipper tips.
- [ ] **Step 6: STOP for owner approval.** Show `compare.png`. If the owner prefers the PNG look, switch to the spec's fallback (WebP alpha masks + CSS `mask-image`) before Task 3, and note it in the PR.
- [ ] **Step 7:** Commit: `git add design/mascot frontend/public/mascot .gitignore && git commit -m "feat: penguin mascot frames traced from the owner's pose sheets"`

### Task 2: Motion module (pure logic, tested)

**Files:**
- Create: `frontend/src/components/mascot/motion.ts`
- Create: `frontend/src/components/mascot/motion.test.ts`
- Modify: `frontend/tsconfig.json` (add `"allowImportingTsExtensions": true`, allowed because `noEmit` is already true, so the test can import `./motion.ts` under Node)

**Interfaces:**
- Produces (all exported from `motion.ts`):
  - `type Spring = { x: number; v: number; to: number; k: number; c: number }`
  - `spring(x: number, stiffness = 170, damping = 0.6): Spring`: `c = 2 * sqrt(stiffness) * damping`
  - `stepSpring(s: Spring, dt: number): number`: semi-implicit Euler, returns new `x`
  - `const STOPS: Gesture[]`: the five gestures from the spec, in order wave, salute, point, cheer, bow, with frames, `loop`/`hold`/`then`, step times (wave 110/260 ms, salute 120, point 120, cheer 110/220 with `hop: true`, bow 140 then `['d08','p02']` after 900 ms)
  - `stopFor(progress: number): number`: `round(clamp(progress, 0, 1) * 4)`
  - `pickFrame(s: { moving: boolean; turn: number; velocity: number; travelled: number; stop: number; sinceArrived: number; mouseX: number | null }): { id: string; mirror: boolean; fast: boolean }`
    - moving and `turn > 0.85` → walk `b01..b04` by `floor(travelled / 26) % 4`, `fast: true`
    - `turn > 0.55` → `a02`; `turn > 0.2` → `a01`
    - else the stop's gesture at `sinceArrived` ms; after a held gesture + 2600 ms, idle: `mouseX < 0.38` → `a01`, `> 0.62` → `a01` mirrored, else `p02` (null mouse → `p02`)
    - `mirror` is true when walking/turning with `velocity > 0` (moving right)
  - `layoutFit(free: number, preferred: number): number | null`: `free >= preferred` → `preferred`; `free >= 160` → `free`; else `null` (hidden)
  - `ALL_FRAME_IDS: string[]`: every id `pickFrame` can return (for preloading)

- [ ] **Step 1: Write the failing tests** in `motion.test.ts` with `node:test` and `node:assert/strict`:
  - `stopFor(-0.5) === 0`, `stopFor(0.49) === 2`, `stopFor(1.7) === 4`
  - `layoutFit(104, 300) === null`, `layoutFit(200, 300) === 200`, `layoutFit(400, 300) === 300`
  - walking left: `pickFrame({ moving: true, turn: 1, velocity: -50, travelled: 0, ... })` → `{ id: 'b01', mirror: false, fast: true }`; `travelled: 27` → `b02`
  - walking right: same with `velocity: 50` → `mirror: true`
  - turning: `turn: 0.6` → `a02`; `turn: 0.3` → `a01`
  - at rest on stop 0 at `sinceArrived: 0` → `c01`; at `440` → loop frame `c03`
  - at rest on stop 2 at `sinceArrived: 5000` with `mouseX: 0.1` → `a01`, `mirror: false`; with `mouseX: 0.9` → `a01`, `mirror: true`; with `mouseX: null` → `p02`
  - every id `pickFrame` can return is in `ALL_FRAME_IDS`
  - `stepSpring` settles: a spring from 0 to 100 stepped 300 times at `dt = 1/60` ends within 0.5 of 100
- [ ] **Step 2:** Run `cd frontend && node --test src/components/mascot/motion.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `motion.ts` with the exports above. No DOM access in this file.
- [ ] **Step 4:** Run the tests again. Expected: all pass. Then `npx tsc --noEmit -p .`. Expected: no errors.
- [ ] **Step 5:** Commit: `git commit -m "feat: penguin mascot motion logic with tests"` (motion.ts, motion.test.ts, tsconfig.json).

### Task 3: Component in the hero (approval stop 2)

**Files:**
- Create: `frontend/src/components/mascot/PenguinMascot.tsx`
- Modify: `frontend/src/Landing.tsx` (render `<PenguinMascot />` once, as the first child of the hero's `.wrap`, line ~260)
- Modify: `frontend/src/landing.css` (`.mascot` rules under `.landing`)

**Interfaces:**
- Consumes: everything from Task 2; the sprite from Task 1 at `/mascot/frames.svg#<id>`.
- Produces: `export default function PenguinMascot(): JSX.Element`, no props.

- [ ] **Step 1:** Build the component:
  - Markup: `<div className="mascot" aria-hidden="true">` > `<div className="mascot-body">` > two `<svg viewBox="0 0 800 820"><use href="/mascot/frames.svg#p02" /></svg>` layers. Swap a layer's `href` and toggle `.on` for the cross-fade; mirror with `transform: scaleX(-1)` on the layer.
  - Layout, measured in `.wrap` coordinates, on mount, `resize`, `document.fonts.ready` and `load`: free space = column right edge − (rightmost text end + 16), where text end is measured with a `Range` over the `h1`, `.purpose`, `.sub` and the last `.hero-cta` child; width = `layoutFit(free, preferred)`, where preferred is the CSS clamp width; `null` → `display: none`. Feet 6 px above the demo card's top. Scroll range = `max(260, 0.75 × demo card offsetTop)`.
  - Loop: one `requestAnimationFrame` loop using `spring`/`stepSpring` for position (stiffness 40, damping 0.9), turn (90, 0.85) and squash (260, 0.45; kick `v -= 0.6` on non-fast frame changes; scale `1 − 0.02·x`, `1 + 0.03·x`); bob ±1.5 px standing, step bob 4 px walking, hop 14 px on cheer. Pause it via IntersectionObserver when the hero is off screen and on `visibilitychange`.
  - Preload: append one hidden `<svg><use>` per id in `ALL_FRAME_IDS` once, so the sprite is fetched up front.
  - Reduced motion: render `c03` once, no loop. Mouse-follow only when `(hover: hover) and (pointer: fine)`.
- [ ] **Step 2:** Add the CSS: `.landing .mascot { position: absolute; z-index: 3; pointer-events: none; width: clamp(190px, 22vw, 340px); aspect-ratio: 800 / 820; color: var(--fg); opacity: 0; transition: opacity 400ms cubic-bezier(0.23, 1, 0.32, 1) }`, `.ready` → opacity 1; layers absolute, `opacity` transition `var(--xf, 100ms) linear`.
- [ ] **Step 3:** `npx tsc --noEmit -p .` is clean; `node --test src/components/mascot/motion.test.ts` still passes.
- [ ] **Step 4:** Rebuild the frontend container (Global Constraints) and confirm `grep -rl "mascot-body" .next/static` finds the new chunk inside the container.
- [ ] **Step 5: Browser checks** with JS measurements at 375, 768, 1024, 1280, 1440 and 2730 × 1575, dark and light theme:
  - `scrollWidth === clientWidth` (no sideways scroll)
  - the mascot box never intersects the text `Range` rects or the CTA buttons; at 375 and 768 it is hidden
  - feet 0–10 px above the demo card after fonts load
  - scrolling 0 → bottom of hero walks through all five stops (record the frame ids); scrolling back walks back mirrored and ends on the wave loop
  - after switching to light theme, the mascot's computed `color` equals the light `--fg`
  - reduced motion (emulated): frame `c03`, no movement after 2 s
  - no console errors
- [ ] **Step 6: STOP for owner approval** on the real home page (http://localhost:3000).
- [ ] **Step 7:** Commit: `git commit -m "feat: penguin mascot beside the hero heading"` (component, Landing.tsx, landing.css). Then push and open the PR on the owner's go-ahead (no co-author lines, no AI footer).
