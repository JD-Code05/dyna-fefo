# Penguin mascot in the home page hero: design

Date: 2026-11-28. Branch: `feat/penguin-mascot` (off `main` at `a80841c`).
Approved mockup: `.superpowers/brainstorm/penguin-frames/hero-frames.html` (git-ignored; open it in a browser).

## Why

The owner's Information Assurance teacher found the home page "bland and boring". The owner wants a big, friendly, animated version of the FreshOps penguin in the hero that reacts as visitors scroll. It is a demo-day and capstone-presentation piece: it should make the first screen memorable without changing anything else.

## What it is

A full-body cartoon penguin with a construction hard hat, drawn by the owner (in ChatGPT) in five sheets: 49 frames in total. It stands in the empty space to the right of the big "FreshOps" heading and, as the visitor scrolls the hero, waddles a little and makes gestures. It is decoration: it never blocks reading or clicking.

## Goals

1. Use the owner's drawings exactly (same character, same line style). Don't redraw them.
2. Stay inside the hero, in the space right of the heading text, above the demo card. Never cover text, buttons or the demo card.
3. Smooth motion everywhere: walking, turning and gestures (the owner said all three matter equally).
4. Same one-colour treatment as the header logo: the line art takes the theme's text colour (off-white in dark mode, navy in light mode), and the white areas of the drawings are see-through.
5. Works offline and on the demo laptop without slowing it down.

## Non-goals

- The header and dashboard logo stay the current penguin head (`Logo.tsx`), unchanged.
- No other part of the home page or the dashboards changes.
- No 3D, no new runtime libraries, no remote assets.

## Anti-goals (a failure even if it "works")

- It looks like a slideshow or flickers between frames.
- It jitters or lags while scrolling, or makes the laptop's fans spin up.
- It covers the headline, buttons or demo card, or causes sideways scrolling.
- It drifts into the blue "AI landing page" look the owner rejected; colours stay the existing theme tokens.

## Source art

Five sheets, all already cut and aligned by the mockup script `.superpowers/brainstorm/penguin-frames/slice.py`:

| Sheet | Contents | Frame ids |
|---|---|---|
| 0 (original) | 15 poses: front, turns, profiles, looking down/up, tilts, happy, surprised, wink | p01–p15 |
| A | head-turn in-betweens: front → three-quarter → profile, three-quarter up/down | a01–a06 |
| B | walk cycle: 4 frames three-quarter left, 4 frames profile left | b01–b08 |
| C | wave (c01–c04), salute (c05–c08), point left (c09–c12) | c01–c12 |
| D | cheer incl. a hop frame (d01–d04), bow (d05–d08) | d01–d08 |

Notes found while slicing:
- Sheets B and C have a fake checkerboard "transparent" background painted in; A, D and 0 have real transparency. Keeping only the navy pixels removes both (already handled in `slice.py`).
- Every frame sits on one 800 × 820 canvas, scaled to the same penguin height, standing on a shared ground line (y = 800) and centred on its feet (x = 400), so swapping frames never makes it jump. Hop frames keep their lift.
- Left/right: the sheets only draw left-facing turns and walks; right-facing versions are the same frames mirrored.

**Originals to trace from** (owner's downloads in `Downloads\freshops-penguin-codex\frames\`, matched to the sheets by image comparison): sheet A = `Construction Penguin Pose Sheet.png` (lossless), sheet B = `Penguin Construction Worker Walk Cycle.png` (lossless), sheet C = `Construction Penguin Mascot Pose Sheet.webp`, sheet D = `Chibi Penguin Worker Pose Sheet.webp`. Sheet 0 exists only as the chat copy (`2.webp`, 1536 × 1024). All are 1536 × 1024 except C (1182 × 1330).

The sheets themselves must be committed so the frames can be regenerated: my call is `design/mascot/sheets/` with the slicing/tracing script next to them in `design/mascot/` (not shipped to the browser).

## The frames the page uses (from the mockup)

- Standing front: p02. Look to the side: a01 (mirrored for the right). No blinking (owner's decision: the sheets have no both-eyes-closed frame).
- Turn from front to walking: a01 → a02. Walk: b01–b04 (three-quarter), mirrored when walking right.
- Stop gestures, right to left: wave c01–c04 then loop c03/c04 · salute c05–c07, hold c07 · point c09–c11, hold c11 · cheer d01–d03 then loop d03/d04 with a small hop · bow d05–d07, hold, then d08 → p02.

## Behaviour (as built in the mockup)

- **Place:** absolutely positioned inside the hero's content column (`.hero .wrap`). Walk range: from 16 px right of where the heading/paragraph/button text actually ends, to the right edge of the column. Feet about 6 px above the demo card. Size `clamp(190px, 22vw, 340px)` wide. It scrolls away with the hero (not fixed).
- **Measure after fonts load.** The web font reflows the text after first paint; the layout must be measured again on `document.fonts.ready` and on window `load` (the mockup put the penguin over the demo card before this fix).
- **Scroll mapping:** progress = scrollY ÷ (75 % of the demo card's top offset), clamped 0–1, mapped to five stops. The penguin walks to the stop the scroll position points at; scrolling back up walks it back (mirrored) and replays that stop's gesture.
- **When there isn't room beside the text:** the rule is measured, not a breakpoint: if the space between the end of the text (+16 px) and the column edge is narrower than the penguin, it must not sit beside the text (it would cover the paragraph or buttons, which happens from about 768 to 950 px wide, so tablets, small laptops and a 1024 × 768 projector). What it does instead (my call; the owner left it to me): it **shrinks to fit the free space**, down to a minimum of 160 px wide, and if even that doesn't fit it is **hidden** (`display: none`, no layout shift). In practice that keeps it at a 1024 px projector (about 350 px free beside the buttons) and hides it on phones and narrow tablets. Re-checked on resize. Test widths: 375, 768, 1024, 1280, 1440 and 2730 px.
- **Idle:** after a held gesture ends (about 2.6 s), it looks toward the mouse (left third of the screen → a01, right third → a01 mirrored, middle → p02). Mouse-follow only on devices with a fine pointer (`(hover: hover) and (pointer: fine)`). No blinking.

## Smoothness (how the motion is built)

From the owner's `emil-design-eng` and `animate` skills, applied in the mockup:
- Two stacked frame layers **cross-fade**: 100 ms for pose changes, 60 ms for walk steps. Pose changes also get a tiny spring squash (scale ~2–3 %) so the swap reads as motion.
- **Springs** for position (stiff, no overshoot), turning, and squash, so motion eases and can reverse mid-walk.
- **Walk steps tied to distance travelled** (one frame every ~26 px), so it never moonwalks.
- A small breathing bob when standing, a step bob when walking, and a hop on the cheer loop.
- Only `transform` and `opacity` animate; transforms are set on the element directly.
- **Reduced motion** (`prefers-reduced-motion: reduce`): one still waving pose (c03), no walking, gestures or loop.
- **Performance:** preload every frame before first use; pause the animation loop when the hero is off screen (IntersectionObserver) and when the tab is hidden.

## Order of work and approval stops

The owner reviews one design step at a time. Two stops:
1. **After tracing:** show all 49 traced frames side by side with the PNG originals (dark and light). The owner approves before any React work starts.
2. **After the component is built:** preview the real home page at the test widths; the owner approves before commit and PR.

## Built differently from the mockup (my calls)

- **Vector frames instead of PNGs.** The mockup uses 49 off-white PNGs (4.1 MB). The real build traces each frame to an SVG path with `fill="currentColor"`, so it is sharp at any size, much smaller, and navy in light mode automatically. Tracing is a one-off script in `design/mascot/`, run by hand; its tool (for example the pure-Python `potracer`) is a design-time dependency only, never installed in the app or Docker images. If traced quality is visibly worse than the PNGs at 340 px, fall back to WebP alpha masks drawn with CSS `mask-image` + `background: currentColor`; the owner decides this at approval stop 1. Trace from the originals listed under Source art.
- **Ship as one sprite** (`frontend/public/mascot/frames.svg` with one `<symbol>` per frame, or one SVG file per frame if the sprite approach blocks the colour inheritance); the component swaps which frame each layer shows.
- **Component:** `frontend/src/components/PenguinMascot.tsx`, rendered once inside the hero `.wrap` in `frontend/src/Landing.tsx`; styles added to `frontend/src/landing.css` under `.landing`. No changes to `index.css` tokens.
- **Accessibility:** `aria-hidden="true"`, `pointer-events: none`.

## Constraints

- Offline: no CDN, fonts already bundled with `next/font`.
- No new runtime dependencies. TypeScript stays clean: `cd frontend && npx tsc --noEmit -p .`
- No horizontal scroll at 375 px, 1440 px and 2730 × 1575 (the owner browses at 70 % zoom).
- Works in dark and light themes (the landing page has its own theme toggle).
- The frontend runs as a built Docker image: rebuild with `docker compose --profile ui build frontend && docker compose --profile ui up -d --force-recreate frontend`, then grep `.next/static` for the new code and hard-reload.
- Commits: conventional commits, no Co-Authored-By lines or AI footers (owner rule).

## Left to the builder

- Exact tracing settings and how to verify trace quality (compare against the PNG at 2×).
- Internal structure of the component (hooks, refs, how the loop is organised).

## Decisions log

- Blinking: left out (owner, 2026-11-28).
- No room beside the text: shrink to fit down to 160 px, else hide (my call; owner left it to me).
- Originals: the owner's downloads, mapped above (owner supplied them, 2026-11-28).
- Approval stops after tracing and after the build (my call, following the owner's one-step-at-a-time review habit).
- Vector tracing with a mask fallback, sprite location, component and file names (my calls).
