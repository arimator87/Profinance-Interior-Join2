"""Backup / export module for ProFinance Interior.

Builds a full ZIP archive of a user's data:
  - data.json      : raw dump of all collections (restore-friendly)
  - data.xlsx      : human-readable spreadsheet (per-sheet)
  - photos/        : every referenced receipt & progress photo
  - manifest.json  : summary + photo path -> filename mapping

Photos stored on Emergent Object Storage are fetched via storage.get_object.
External http(s) photos (e.g. demo seed) are referenced by URL only.
"""
import os
import json
import zipfile
import tempfile
import logging
from datetime import datetime, timezone

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

from auth import db
from storage import get_object

logger = logging.getLogger(__name__)


def _now_stamp():
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


async def gather_user_data(user: dict) -> dict:
    """Collect all documents belonging to the user."""
    uid = user["user_id"]
    projects = await db.projects.find({"user_id": uid}, {"_id": 0}).to_list(2000)
    pids = [p["id"] for p in projects]
    transactions = await db.transactions.find({"project_id": {"$in": pids}}, {"_id": 0}).to_list(50000)
    workers = await db.workers.find({"project_id": {"$in": pids}}, {"_id": 0}).to_list(10000)
    work_items = await db.work_items.find({"project_id": {"$in": pids}}, {"_id": 0}).to_list(20000)
    wiids = [w["id"] for w in work_items]
    sub_items = await db.sub_items.find({"project_id": {"$in": pids}}, {"_id": 0}).to_list(50000)
    progress = await db.progress_entries.find({"workItemId": {"$in": wiids}}, {"_id": 0}).to_list(50000)
    files = await db.files.find({"user_id": uid}, {"_id": 0}).to_list(50000)
    orders = await db.orders.find({"user_id": uid}, {"_id": 0, "snap_token": 0, "redirect_url": 0}).to_list(2000)
    return {
        "projects": projects,
        "transactions": transactions,
        "workers": workers,
        "work_items": work_items,
        "sub_items": sub_items,
        "progress_entries": progress,
        "files": files,
        "orders": orders,
    }


def _collect_photo_paths(data: dict) -> list:
    """Return unique object-storage paths (skip external http URLs)."""
    paths = set()

    def add(u):
        if u and isinstance(u, str) and not u.startswith("http"):
            paths.add(u.lstrip("/"))

    for tx in data["transactions"]:
        add(tx.get("receiptUrl"))
    for e in data["progress_entries"]:
        for u in (e.get("photoUrls") or []):
            add(u)
    for f in data["files"]:
        if not f.get("is_deleted"):
            add(f.get("storage_path"))
    return sorted(paths)


def _build_xlsx_bytes(data: dict, user: dict) -> bytes:
    wb = Workbook()
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="EA580C")

    def style_header(ws):
        for cell in ws[1]:
            cell.font = header_font
            cell.fill = header_fill

    proj_name = {p["id"]: p.get("name", "") for p in data["projects"]}
    wi_name = {w["id"]: w.get("name", "") for w in data["work_items"]}
    wi_project = {w["id"]: w.get("project_id") for w in data["work_items"]}

    # Sheet: Proyek
    ws = wb.active
    ws.title = "Proyek"
    ws.append(["Nama Proyek", "Klien", "Perusahaan", "Nilai Kontrak (Rp)", "Kategori",
               "Status", "Alamat", "Tanggal Mulai", "Target Selesai", "Dibuat"])
    for p in data["projects"]:
        ws.append([
            p.get("name", ""), p.get("owner", ""), p.get("companyName", ""),
            p.get("nominal", 0), p.get("category", ""), p.get("status", ""),
            p.get("alamatProyek", ""), p.get("tanggalMulai", ""),
            p.get("targetSelesai", ""), p.get("createdAt", ""),
        ])
    style_header(ws)

    # Sheet: Transaksi
    ws = wb.create_sheet("Transaksi")
    ws.append(["Proyek", "Tipe", "Kategori", "Deskripsi", "Nominal (Rp)", "Tanggal", "Struk"])
    for tx in data["transactions"]:
        rec = tx.get("receiptUrl")
        struk = "Foto tersimpan" if rec and not str(rec).startswith("http") else ("URL" if rec else "-")
        ws.append([
            proj_name.get(tx.get("project_id"), ""),
            "Masuk" if tx.get("type") == "in" else "Keluar",
            tx.get("category", ""), tx.get("description", ""),
            tx.get("amount", 0), tx.get("date", ""), struk,
        ])
    style_header(ws)

    # Sheet: Tukang
    ws = wb.create_sheet("Tukang")
    ws.append(["Proyek", "Nama Tukang", "Borongan (Rp)"])
    for w in data["workers"]:
        ws.append([proj_name.get(w.get("project_id"), ""), w.get("name", ""), w.get("borongan", 0)])
    style_header(ws)

    # Sheet: Item Pekerjaan (RAB)
    ws = wb.create_sheet("Item Pekerjaan")
    ws.append(["Proyek", "Item Pekerjaan", "Nilai (Rp)", "Sub Item", "Harga Sub (Rp)", "Selesai"])
    subs_by_wi = {}
    for s in data["sub_items"]:
        subs_by_wi.setdefault(s.get("work_item_id"), []).append(s)
    for w in data["work_items"]:
        subs = subs_by_wi.get(w["id"], [])
        if subs:
            for s in subs:
                ws.append([proj_name.get(w.get("project_id"), ""), w.get("name", ""),
                           w.get("nilai", 0), s.get("name", ""), s.get("harga", 0),
                           "Ya" if s.get("status") else "Tidak"])
        else:
            ws.append([proj_name.get(w.get("project_id"), ""), w.get("name", ""),
                       w.get("nilai", 0), "-", "", ""])
    style_header(ws)

    # Sheet: Progress
    ws = wb.create_sheet("Progress Lapangan")
    ws.append(["Proyek", "Item Pekerjaan", "Tanggal", "Progress (%)", "Catatan", "Jumlah Foto"])
    for e in data["progress_entries"]:
        wi = e.get("workItemId")
        ws.append([
            proj_name.get(wi_project.get(wi), ""), wi_name.get(wi, ""),
            e.get("date", ""), e.get("progress", 0), e.get("notes", ""),
            len(e.get("photoUrls") or []),
        ])
    style_header(ws)

    # Auto width (approx)
    for sheet in wb.worksheets:
        for col in sheet.columns:
            length = max((len(str(c.value)) if c.value is not None else 0) for c in col)
            sheet.column_dimensions[col[0].column_letter].width = min(max(length + 2, 10), 45)

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
    wb.save(tmp.name)
    tmp.close()
    with open(tmp.name, "rb") as fh:
        content = fh.read()
    os.unlink(tmp.name)
    return content


def _assemble_zip(data: dict, user: dict, photo_paths: list) -> tuple:
    """Synchronous: build xlsx, fetch photos, write zip to temp file. Returns (path, stats)."""
    files_map = {f.get("storage_path"): f for f in data["files"]}
    stamp = _now_stamp()
    tmp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    tmp_zip.close()

    photo_ok, photo_fail = 0, 0
    manifest_photos = {}
    used_names = set()

    with zipfile.ZipFile(tmp_zip.name, "w", zipfile.ZIP_DEFLATED) as zf:
        # data.xlsx
        try:
            zf.writestr("data.xlsx", _build_xlsx_bytes(data, user))
        except Exception as e:
            logger.error(f"xlsx build failed: {e}")

        # photos
        for path in photo_paths:
            meta = files_map.get(path, {})
            base = meta.get("original_filename") or path.split("/")[-1]
            base = base.replace("/", "_").replace("\\", "_")
            name = base
            i = 1
            while name in used_names:
                stem, dot, ext = base.rpartition(".")
                name = f"{stem}_{i}.{ext}" if dot else f"{base}_{i}"
                i += 1
            used_names.add(name)
            try:
                content, _ct = get_object(path)
                zf.writestr(f"photos/{name}", content)
                manifest_photos[path] = f"photos/{name}"
                photo_ok += 1
            except Exception as e:
                logger.warning(f"backup photo fetch failed {path}: {e}")
                manifest_photos[path] = None
                photo_fail += 1

        # data.json (raw + photo mapping)
        dump = {
            "exportedAt": datetime.now(timezone.utc).isoformat(),
            "user": {
                "user_id": user.get("user_id"),
                "email": user.get("email"),
                "name": user.get("name"),
            },
            **data,
            "photoMapping": manifest_photos,
        }
        zf.writestr("data.json", json.dumps(dump, ensure_ascii=False, indent=2, default=str))

        # manifest.json (quick summary)
        manifest = {
            "app": "ProFinance Interior",
            "exportedAt": dump["exportedAt"],
            "counts": {
                "projects": len(data["projects"]),
                "transactions": len(data["transactions"]),
                "workers": len(data["workers"]),
                "work_items": len(data["work_items"]),
                "progress_entries": len(data["progress_entries"]),
                "photos_included": photo_ok,
                "photos_failed": photo_fail,
            },
            "notes": "Foto disimpan di folder photos/. data.json berisi data mentah untuk pemulihan.",
        }
        zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

    stats = {"photos_included": photo_ok, "photos_failed": photo_fail,
             "projects": len(data["projects"]), "stamp": stamp}
    return tmp_zip.name, stats
