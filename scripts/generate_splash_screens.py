#!/usr/bin/env python3
"""Generate branded apple-touch-startup-image splash screens (portrait).

Design: dark navy background (#0f172a), centered amber gradient logo
(same motif as favicon/og-cover), "ProFinance" + "INTERIOR" wordmark.
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = "/app/frontend/public/splash"
DARK = (15, 23, 42)        # slate-900
AMBER_500 = (245, 158, 11)
AMBER_700 = (180, 83, 9)
AMBER_TEXT = (251, 191, 36)  # amber-400
WHITE = (255, 255, 255)

# (css_w, css_h, dpr) — modern iPhones, portrait
DEVICES = [
    (375, 667, 2),   # iPhone SE 2/3, 8
    (414, 736, 3),   # iPhone 8 Plus
    (375, 812, 3),   # iPhone X/XS/11 Pro/12 mini/13 mini
    (414, 896, 2),   # iPhone XR/11
    (414, 896, 3),   # iPhone XS Max/11 Pro Max
    (390, 844, 3),   # iPhone 12/13/14
    (428, 926, 3),   # iPhone 12/13 Pro Max, 14 Plus
    (393, 852, 3),   # iPhone 14 Pro/15/15 Pro/16
    (430, 932, 3),   # iPhone 14 Pro Max/15 Plus/15 Pro Max/16 Plus
    (402, 874, 3),   # iPhone 16 Pro
    (440, 956, 3),   # iPhone 16 Pro Max
]

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
]


def find_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient_square(size):
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = lerp(AMBER_500, AMBER_700, t)
    return img


def make_logo(size):
    """Rounded amber square with white lines (same as favicon motif)."""
    base = gradient_square(size).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.28), fill=255)
    base.putalpha(mask)
    d = ImageDraw.Draw(base)
    line_h = int(size * 0.085)
    gap = (size - 4 * line_h) / 5.0
    for i, frac in enumerate([0.46, 0.32, 0.46, 0.22]):
        top = gap + i * (line_h + gap)
        left = size * 0.22
        right = left + size * frac
        d.rounded_rectangle([left, top, right, top + line_h], radius=line_h / 2, fill=WHITE)
    return base


def draw_tracked_text(draw, center_x, top, text, font, fill, tracking):
    """Draw text with letter spacing, horizontally centered."""
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = center_x - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, top), ch, font=font, fill=fill)
        x += w + tracking
    bbox = font.getbbox("Ag")
    return top + (bbox[3] - bbox[1])


def make_splash(w, h):
    img = Image.new("RGB", (w, h), DARK)
    logo_size = int(min(w, h) * 0.30)
    logo = make_logo(logo_size)

    # Layout: logo + wordmark block centered around 42% of height
    f_big = find_font(int(w * 0.105))
    f_small = find_font(int(w * 0.045))
    tmp = ImageDraw.Draw(img)
    big_h = f_big.getbbox("Ag")[3]
    small_h = f_small.getbbox("Ag")[3]
    block = logo_size + int(h * 0.035) + big_h + int(h * 0.018) + small_h
    top = int(h * 0.46 - block / 2)

    img.paste(logo, (int((w - logo_size) / 2), top), logo)
    y = top + logo_size + int(h * 0.035)

    # "ProFinance" centered
    tw = tmp.textlength("ProFinance", font=f_big)
    tmp.text(((w - tw) / 2, y), "ProFinance", font=f_big, fill=WHITE)
    y += big_h + int(h * 0.018)

    # "INTERIOR" with tracking, amber
    draw_tracked_text(tmp, w / 2, y, "INTERIOR", f_small, AMBER_TEXT, w * 0.028)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    for cw, ch, dpr in DEVICES:
        w, h = cw * dpr, ch * dpr
        name = f"splash-{w}x{h}.png"
        make_splash(w, h).save(os.path.join(OUT, name), optimize=True)
        print(f"  {name}")
    print(f"Done: {len(DEVICES)} splash screens in {OUT}")


if __name__ == "__main__":
    main()
