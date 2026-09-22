"""One-off: give work categories without an image a default 2D block-text image.

Stores a self-contained SVG (block text centered) as a data URI directly in
work_categories.imageUrl. Idempotent: only fills categories where imageUrl is empty.
Run: python /app/scripts/set_default_cat_images.py
"""
import os
from urllib.parse import quote

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")

PALETTE = [
    ("#d97706", "#b45309"),  # amber
    ("#2563eb", "#1d4ed8"),  # blue
    ("#0d9488", "#0f766e"),  # teal
    ("#7c3aed", "#6d28d9"),  # violet
    ("#dc2626", "#b91c1c"),  # red
    ("#0891b2", "#0e7490"),  # cyan
]


def _hash(s: str) -> int:
    h = 0
    for ch in s:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return h


def default_cat_image(name: str) -> str:
    label = (name or "Proyek").upper()
    c1, c2 = PALETTE[_hash(label) % len(PALETTE)]
    font_size = 56 if len(label) > 12 else 68 if len(label) > 8 else 84
    block_w = min(680, max(320, int(len(label) * (font_size * 0.62) + 80)))
    block_x = (800 - block_w) / 2
    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'>"
        f"<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>"
        f"<stop offset='0' stop-color='{c1}'/><stop offset='1' stop-color='{c2}'/></linearGradient></defs>"
        "<rect width='800' height='600' fill='url(#g)'/>"
        "<rect x='40' y='40' width='720' height='520' rx='24' fill='none' stroke='#ffffff' stroke-opacity='0.18' stroke-width='4'/>"
        f"<rect x='{block_x}' y='230' width='{block_w}' height='140' rx='16' fill='rgba(0,0,0,0.28)'/>"
        f"<text x='400' y='300' font-family='Arial, Helvetica, sans-serif' font-size='{font_size}' "
        f"font-weight='800' fill='#ffffff' text-anchor='middle' dominant-baseline='middle' letter-spacing='2'>{label}</text>"
        "</svg>"
    )
    return "data:image/svg+xml;utf8," + quote(svg)


def main():
    client = MongoClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    updated = []
    for cat in db.work_categories.find({}):
        if not cat.get("imageUrl"):
            img = default_cat_image(cat.get("name", ""))
            db.work_categories.update_one({"id": cat["id"]}, {"$set": {"imageUrl": img}})
            updated.append(cat.get("name"))
    print("Updated categories:", updated or "(none — all already have images)")
    for cat in db.work_categories.find({}, {"_id": 0, "name": 1, "imageUrl": 1}):
        kind = "data-uri" if (cat.get("imageUrl") or "").startswith("data:") else ("upload" if cat.get("imageUrl") else "NONE")
        print(f"  - {cat['name']}: {kind}")


if __name__ == "__main__":
    main()
