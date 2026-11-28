# Home page mascot frames

`sheets/` holds the owner's five penguin pose sheets (made in ChatGPT). `build_frames.py` cuts out all 49 penguins, lines them up on one 800 × 820 canvas (same height, same ground line, centred on the feet), traces each to a vector path and writes `frontend/public/mascot/frames.svg`: one `<symbol>` per frame (`p01`–`p15`, `a01`–`a06`, `b01`–`b08`, `c01`–`c12`, `d01`–`d08`) with `fill="currentColor"`, so the page colours it with the theme. `compare.png` is the owner-approved check of traced against untraced frames (2026-11-28).

To rebuild after changing a sheet (design time only; nothing here ships to the browser or the Docker images):

```
python -m venv design/mascot/.venv
design/mascot/.venv/Scripts/pip install pillow numpy scipy potracer
design/mascot/.venv/Scripts/python design/mascot/build_frames.py
```

It prints the frame count per sheet (15, 6, 8, 12, 8) and writes a side-by-side check page to `design/mascot/out/compare.html`.
