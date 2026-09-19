import io
import logging
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage,
)

from storage import get_object

logger = logging.getLogger(__name__)

AMBER = colors.HexColor("#D97706")
DARK = colors.HexColor("#0F172A")
SLATE = colors.HexColor("#64748B")
LIGHT = colors.HexColor("#F1F5F9")


def rupiah(n):
    try:
        n = int(round(n))
    except Exception:
        n = 0
    return "Rp " + f"{n:,}".replace(",", ".")


def _fmt_date(d):
    if not d:
        return "-"
    try:
        return datetime.fromisoformat(str(d)[:19]).strftime("%d/%m/%Y")
    except Exception:
        return str(d)[:10]


def build_report_pdf(project, summary, transactions, workers, work_items, progress_entries):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=16 * mm, rightMargin=16 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], textColor=DARK, fontSize=20, spaceAfter=2)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=AMBER, fontSize=13, spaceBefore=14, spaceAfter=6)
    small = ParagraphStyle("small", parent=styles["Normal"], textColor=SLATE, fontSize=9)
    normal = ParagraphStyle("normal", parent=styles["Normal"], fontSize=9)
    story = []

    story.append(Paragraph("ProFinance Interior", h1))
    story.append(Paragraph("Laporan Keuangan Proyek", small))
    story.append(Spacer(1, 10))

    info = [
        ["Nama Proyek", project.get("name", "-"), "Klien", project.get("owner", "-")],
        ["Perusahaan", project.get("companyName", "-") or "-", "Alamat", project.get("alamatProyek", "-") or "-"],
        ["Nilai Kontrak", rupiah(project.get("nominal", 0)), "Tanggal", f"{_fmt_date(project.get('tanggalMulai'))} - {_fmt_date(project.get('targetSelesai'))}"],
    ]
    t = Table(info, colWidths=[28 * mm, 55 * mm, 24 * mm, 55 * mm])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), SLATE),
        ("TEXTCOLOR", (2, 0), (2, -1), SLATE),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.white),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t)

    story.append(Paragraph("Ringkasan Keuangan", h2))
    kpi = [
        ["Total Pemasukan", rupiah(summary["totalIn"]), "Total Pengeluaran", rupiah(summary["totalOut"])],
        ["Saldo Bersih", rupiah(summary["balance"]), "Margin", f"{summary['marginPct']:.1f}%"],
        ["Realisasi", f"{summary['realisasiPct']:.1f}%", "Sisa Tagihan", rupiah(summary["sisaTagihan"])],
    ]
    kt = Table(kpi, colWidths=[40 * mm, 42 * mm, 40 * mm, 40 * mm])
    kt.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), SLATE),
        ("TEXTCOLOR", (2, 0), (2, -1), SLATE),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(kt)

    story.append(Paragraph("Arus Kas (Cash Flow)", h2))
    rows = [["Tanggal", "Tipe", "Kategori", "Keterangan", "Jumlah"]]
    for tx in transactions:
        rows.append([
            _fmt_date(tx.get("date")),
            "Masuk" if tx.get("type") == "in" else "Keluar",
            tx.get("category", "-"),
            (tx.get("description", "") or "")[:40],
            rupiah(tx.get("amount", 0)),
        ])
    if len(rows) == 1:
        rows.append(["-", "-", "-", "Belum ada transaksi", "-"])
    tx_table = Table(rows, colWidths=[22 * mm, 16 * mm, 32 * mm, 55 * mm, 33 * mm], repeatRows=1)
    tx_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
        ("ALIGN", (4, 0), (4, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(tx_table)

    story.append(Paragraph("Ringkasan Tukang", h2))
    wrows = [["Nama Tukang", "Nilai Borongan", "Total Kasbon", "Pelunasan", "Sisa Hutang"]]
    for w in workers:
        wrows.append([
            w.get("name", "-"),
            rupiah(w.get("borongan", 0)),
            rupiah(w.get("totalKasbon", 0)),
            rupiah(w.get("totalPelunasan", 0)),
            rupiah(w.get("sisaHutang", 0)),
        ])
    if len(wrows) == 1:
        wrows.append(["-", "-", "-", "-", "Belum ada tukang"])
    w_table = Table(wrows, colWidths=[40 * mm, 32 * mm, 30 * mm, 28 * mm, 28 * mm], repeatRows=1)
    w_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(w_table)

    # Progress documentation with embedded photos
    if work_items:
        story.append(Paragraph("Progress Pekerjaan & Dokumentasi", h2))
        item_map = {wi["id"]: wi for wi in work_items}
        for wi in work_items:
            story.append(Paragraph(
                f"<b>{wi.get('name','-')}</b> &nbsp; (Bobot {wi.get('weight',0):.1f}% &bull; Progress {wi.get('lastProgress',0)}%)",
                normal,
            ))
            entries = [p for p in progress_entries if p.get("workItemId") == wi["id"]]
            for pe in entries:
                story.append(Paragraph(
                    f"{_fmt_date(pe.get('date'))} &mdash; {pe.get('progress',0)}% &mdash; {(pe.get('notes','') or '')[:80]}",
                    small,
                ))
                photos = pe.get("photoUrls", []) or []
                imgs = []
                for path in photos[:4]:
                    try:
                        content, _ = get_object(path)
                        img = RLImage(io.BytesIO(content), width=40 * mm, height=30 * mm, kind="proportional")
                        imgs.append(img)
                    except Exception as e:
                        logger.warning(f"pdf image fail {path}: {e}")
                if imgs:
                    ph = Table([imgs], colWidths=[43 * mm] * len(imgs))
                    ph.setStyle(TableStyle([("BOTTOMPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 2)]))
                    story.append(ph)
            story.append(Spacer(1, 6))

    story.append(Spacer(1, 14))
    story.append(Paragraph(
        f"Dokumen dibuat otomatis oleh ProFinance Interior &bull; {datetime.now().strftime('%d/%m/%Y %H:%M')}",
        small,
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()
