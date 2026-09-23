#!/usr/bin/env python3
"""Generate branded favicon + PWA icons for ProFinance Interior.

Brand mark: rounded square with amber gradient (amber-500 -> amber-700)
and white horizontal lines (same motif as og-cover.png + lucide Ruler logo).
"""
import os
from PIL import Image, ImageDraw

OUT = "/app/frontend/public"
AMBER_500 = (245, 158, 11)   # #f59e0b
AMBER_700 = (180, 83, 9)     # #b45309
DARK_BG = (15, 23, 42)       # slate-900, matches landing dark navy
WHITE = (255, 255, 255)

MASTER = 1024  # render large, downscale for crisp results


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def diagonal_gradient(size, c1, c2):
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = lerp(c1, c2, t)
    return img


def draw_marks(draw, size, box):
    """White horizontal ruler/text lines inside the icon box (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = box
    w = x1 - x0
    h = y1 - y0
    line_h = int(h * 0.085)
    gap = (h - 4 * line_h) / 5.0
    lengths = [0.46, 0.32, 0.46, 0.22]  # motif from og-cover.png logo
    left = x0 + w * 0.22
    for i, frac in enumerate(lengths):
        top = y0 + gap + i * (line_h + gap)
        right = left + w * frac
        r = line_h / 2
        draw.rounded_rectangle(
            [left, top, right, top + line_h], radius=r, fill=WHITE
        )


def rounded_icon(size, corner_ratio=0.28, full_bleed=False, pad_ratio=0.0):
    """Rounded-square gradient icon with white marks. RGBA."""
    s = MASTER
    base = diagonal_gradient(s, AMBER_500, AMBER_700).convert("RGBA")

    if full_bleed:
        # No rounded corners, no transparency (apple-touch / maskable)
        inner = (int(s * pad_ratio), int(s * pad_ratio),
                 int(s * (1 - pad_ratio)), int(s * (1 - pad_ratio)))
        d = ImageDraw.Draw(base)
        draw_marks(d, s, inner)
        return base.resize((size, size), Image.LANCZOS)

    radius = int(s * corner_ratio)
    mask = Image.new("L", (s, s), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=255)
    base.putalpha(mask)

    d = ImageDraw.Draw(base)
    draw_marks(d, s, (0, 0, s, s))
    return base.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)

    # 1. favicon.ico — multi-size (16, 32, 48)
    ico = rounded_icon(48)
    ico.save(
        os.path.join(OUT, "favicon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )

    # 2. PNG favicon 32x32
    rounded_icon(32).save(os.path.join(OUT, "favicon-32x32.png"))

    # 3. Apple touch icon 180x180 — full-bleed (iOS rounds corners itself)
    rounded_icon(180, full_bleed=True, pad_ratio=0.10).save(
        os.path.join(OUT, "apple-touch-icon.png")
    )

    # 4. PWA icons 192 & 512
    rounded_icon(192).save(os.path.join(OUT, "icon-192.png"))
    rounded_icon(512).save(os.path.join(OUT, "icon-512.png"))

    # 5. Maskable 512 — full-bleed with safe-zone padding (~20%)
    rounded_icon(512, full_bleed=True, pad_ratio=0.20).save(
        os.path.join(OUT, "icon-512-maskable.png")
    )

    print("Generated:")
    for f in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, f)
        print(f"  {f}  ({os.path.getsize(p)} bytes)")


if __name__ == "__main__":
    main()
