#!/usr/bin/env python3
"""
Generate the PWA icons.

The mark is the app itself in miniature: a small habit grid, some cells
ticked. Production draws filled cells; preview draws outlined ones, so the
two are distinguishable at a glance on the same home screen. That difference
is load-bearing, not decorative -- both are installable, and confusing them
means a week of ticks landing in the wrong database.

Run: python3 scripts/make-icons.py
"""

from PIL import Image, ImageDraw

GROUND = (10, 10, 10)        # #0a0a0a
ACCENT = (200, 255, 0)       # #c8ff00

COLS, ROWS = 4, 3

# Which cells read as "done". Deliberately not full: an honest grid.
FILLED = {(0, 0), (1, 0), (3, 0), (0, 1), (2, 1), (1, 2), (2, 2), (3, 2)}


def draw(size: int, outlined: bool) -> Image.Image:
    img = Image.new("RGB", (size, size), GROUND)
    d = ImageDraw.Draw(img)

    # Keep the mark inside the maskable safe zone (centre ~80%).
    margin = size * 0.22
    span = size - 2 * margin

    gap = span / (COLS * 2 - 1)
    cell = gap
    step_x = span / COLS
    step_y = span / ROWS
    box = min(step_x, step_y) * 0.55
    stroke = max(1, round(size * 0.012))

    grid_w = step_x * COLS
    grid_h = step_y * ROWS
    ox = (size - grid_w) / 2 + (step_x - box) / 2
    oy = (size - grid_h) / 2 + (step_y - box) / 2

    for r in range(ROWS):
        for c in range(COLS):
            x0 = ox + c * step_x
            y0 = oy + r * step_y
            rect = [x0, y0, x0 + box, y0 + box]

            if (c, r) in FILLED:
                if outlined:
                    d.rectangle(rect, outline=ACCENT, width=stroke)
                else:
                    d.rectangle(rect, fill=ACCENT)
            else:
                # An untouched cell: a hairline dot, present but quiet.
                cx, cy = x0 + box / 2, y0 + box / 2
                rr = max(1, round(size * 0.012))
                d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                          fill=(90, 90, 90))

    return img


def main() -> None:
    for size in (192, 512):
        draw(size, outlined=False).save(f"public/icon-{size}.png")
        draw(size, outlined=True).save(f"public/icon-dev-{size}.png")
        print(f"wrote public/icon-{size}.png and public/icon-dev-{size}.png")


if __name__ == "__main__":
    main()
