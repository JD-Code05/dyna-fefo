"""Build the home page mascot's frames from the owner's pose sheets.

Cuts every penguin out of the five sheets in sheets/, lines them up on one 800 x 820 canvas
(same height, same ground line, centred on the feet), traces each to a vector path and writes
frontend/public/mascot/frames.svg: one <symbol> per frame, fill="currentColor", so the page tints
the line art with the theme's text colour and the white areas stay transparent.

Also writes out/<id>.png (the untraced masks) and out/compare.html (untraced vs traced, dark and
light) for checking the trace. Run from the repo root:
    design/mascot/.venv/Scripts/python design/mascot/build_frames.py
"""
import json
from pathlib import Path

import numpy as np
import potrace
from PIL import Image
from scipy import ndimage as ndi

HERE = Path(__file__).parent
OUT = HERE / 'out'
SPRITE = HERE.parent.parent / 'frontend' / 'public' / 'mascot' / 'frames.svg'
W, H, GROUND, CX, TARGET = 800, 820, 800, 400, 700   # canvas, ground line, feet centre, penguin height
SHEETS = [('p', 'sheet-0-poses.webp'), ('a', 'sheet-A-turns.png'), ('b', 'sheet-B-walk.png'),
          ('c', 'sheet-C-gestures.webp'), ('d', 'sheet-D-cheer-bow.webp')]


def load(name: str) -> np.ndarray:
    """Luminance of a sheet with any real transparency composited onto white."""
    im = Image.open(HERE / 'sheets' / name).convert('RGBA')
    bg = Image.new('RGBA', im.size, 'white')
    bg.alpha_composite(im)
    return np.asarray(bg.convert('RGB')).astype(float) @ [0.299, 0.587, 0.114]


def figures(lum: np.ndarray) -> list[list[tuple[slice, slice]]]:
    """Bounding boxes of each penguin, grouped into rows, in reading order."""
    dark = lum < 110                                     # navy only: drops white and painted checkerboards
    lab, n = ndi.label(ndi.binary_closing(dark, iterations=3))
    sizes = ndi.sum(dark, lab, range(1, n + 1))
    keep = [i + 1 for i, s in enumerate(sizes) if s > sizes.max() * 0.25]
    boxes = sorted((ndi.find_objects((lab == i).astype(np.uint8))[0] for i in keep), key=lambda b: b[0].start)
    rows: list[list[tuple[slice, slice]]] = []
    for b in boxes:
        if rows and b[0].start < rows[-1][0][0].stop - 40:
            rows[-1].append(b)
        else:
            rows.append([b])
    return [sorted(r, key=lambda b: b[1].start) for r in rows]


def aligned_masks():
    """Yield (frame id, 800 x 820 alpha mask in 0..1) for every penguin on every sheet."""
    for prefix, name in SHEETS:
        lum = load(name)
        alpha = np.clip((175 - lum) / 120, 0, 1)        # soft edges
        rows = figures(lum)
        scale = TARGET / float(np.median([b[0].stop - b[0].start for r in rows for b in r]))
        k = 0
        for row in rows:
            ground = max(b[0].stop for b in row)        # the row's ground line, so hop frames stay lifted
            for ys, xs in row:
                k += 1
                crop = alpha[ys, xs]
                feet = crop[int(crop.shape[0] * 0.88):]
                fx = np.nonzero(feet.sum(0) > 0.5)[0].mean() if feet.sum() > 5 else crop.shape[1] / 2
                img = Image.fromarray((crop * 255).astype(np.uint8), 'L')
                img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
                canvas = Image.new('L', (W, H), 0)
                x, y = round(CX - fx * scale), round(GROUND - (ground - ys.start) * scale)
                assert x >= 0 and y >= 0 and x + img.width <= W and y + img.height <= H, f'{prefix}{k:02d} clipped'
                canvas.paste(img, (x, y))
                yield f'{prefix}{k:02d}', np.asarray(canvas) / 255.0
        print(name, 'frames', k)


def path_d(mask: np.ndarray) -> str:
    """Trace a mask to an SVG path. potracer traces the 'off' pixels, so the mask is inverted."""
    curves = potrace.Bitmap(~(mask >= 0.5)).trace(turdsize=4, alphamax=1.0, opttolerance=0.2)
    f = lambda p: f'{p.x:.0f} {p.y:.0f}'           # whole units: the 800-wide canvas shows at most 340 px wide
    parts = []
    for c in curves:
        parts.append(f'M{f(c.start_point)}')
        for s in c.segments:
            parts.append(f'L{f(s.c)} L{f(s.end_point)}' if s.is_corner else f'C{f(s.c1)} {f(s.c2)} {f(s.end_point)}')
        parts.append('Z')
    return ''.join(parts)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    SPRITE.parent.mkdir(parents=True, exist_ok=True)
    symbols, ids = [], []
    for fid, mask in aligned_masks():
        Image.fromarray((mask * 255).astype(np.uint8), 'L').save(OUT / f'{fid}.png')
        symbols.append(f'<symbol id="{fid}" viewBox="0 0 {W} {H}"><path fill="currentColor" fill-rule="evenodd" d="{path_d(mask)}"/></symbol>')
        ids.append(fid)
    SPRITE.write_text('<svg xmlns="http://www.w3.org/2000/svg">\n' + '\n'.join(symbols) + '\n</svg>\n', encoding='utf-8')
    print(f'{len(symbols)} symbols, sprite {SPRITE.stat().st_size / 1024:.0f} KB')

    # Side-by-side check page: untraced mask (left, a plain image so it works from disk) vs traced symbol
    # (right), on the dark page colours, then inverted for the light page.
    sprite = SPRITE.read_text(encoding='utf-8')
    cells = ''.join(
        f'<figure><div class="pair"><img src="{fid}.png" alt=""><svg viewBox="0 0 {W} {H}"><use href="#{fid}"/></svg></div>'
        f'<figcaption>{fid}</figcaption></figure>' for fid in ids)
    (OUT / 'compare.html').write_text(f'''<!doctype html><meta charset="utf-8"><title>Mascot trace check</title>
<style>body{{margin:0;font:12px sans-serif}} .t{{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;padding:10px}}
.dark{{background:#0a0a0a;color:#f4f1ec}} .light{{background:#fff;color:#172033}} .light img{{filter:invert(1)}}
figure{{margin:0;text-align:center}} .pair{{display:grid;grid-template-columns:1fr 1fr;gap:2px}}
.pair>*{{width:100%;aspect-ratio:800/820}}</style>
<div style="display:none">{sprite}</div>
<p style="padding:10px 10px 0">Left of each pair: untraced. Right: traced vector (what the site uses).</p>
<div class="t dark">{cells}</div><div class="t light">{cells}</div>''', encoding='utf-8')
    json.dump(ids, open(OUT / 'ids.json', 'w'))


if __name__ == '__main__':
    main()
