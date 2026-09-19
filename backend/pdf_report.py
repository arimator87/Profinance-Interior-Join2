import io
import logging
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, PageBreak,
)
from reportlab.graphics.shapes import Drawing, Rect, Circle, String
from reportlab.graphics.charts.piecharts import Pie

from storage import get_object

logger = logging.getLogger(__name__)

INK = colors.HexColor("#0F172A")
AMBER = colors.HexColor("#D97706")
AMBER_L = colors.HexColor("#FEF3C7")
SLATE = colors.HexColor("#64748B")
SLATE_L = colors.HexColor("#94A3B8")
LINE = colors.HexColor("#E2E8F0")
BG = colors.HexColor("#F8FAFC")
GREEN = colors.HexColor("#16A34A")
BLUE = colors.HexColor("#2563EB")
ORANGE = colors.HexColor("#EA580C")
RED = colors.HexColor("#DC2626")
WHITE = colors.white

CAT_COLORS = [AMBER, BLUE, GREEN, ORANGE, colors.HexColor("#7C3AED"),
              colors.HexColor("#0891B2"), colors.HexColor("#DB2777"), SLATE]


def rupiah(n):
    try:
        n = int(round(n))
    except Exception:
        n = 0
    neg = n < 0
    s = f"{abs(n):,}".replace(",", ".")
    return ("-Rp " if neg else "Rp ") + s


def _fmt(d):
    if not d:
        return "-"
    try:
        return datetime.fromisoformat(str(d)[:19]).strftime("%d/%m/%Y")
    except Exception:
        return str(d)[:10]


def _health(margin):
    m = margin or 0
    if m >= 20:
        return "SANGAT SEHAT", GREEN, "Margin keuntungan sangat baik, proyek berjalan optimal."
    if m >= 10:
        return "SEHAT", BLUE, "Margin keuntungan sehat, arus kas proyek terkendali."
    if m >= 0:
        return "CUKUP", AMBER, "Margin tipis, perhatikan pengeluaran agar tetap surplus."
    if m >= -10:
        return "PERHATIAN", ORANGE, "Proyek mulai defisit, tinjau ulang biaya & penagihan."
    return "KRITIS", RED, "Proyek defisit signifikan, perlu tindakan segera."


def _bar(track_w, frac, color, h=9):
    frac = max(0.0, min(1.0, frac))
    d = Drawing(track_w, h + 2)
    d.add(Rect(0, 1, track_w, h, rx=h / 2, ry=h / 2, fillColor=LINE, strokeColor=None))
    if frac > 0:
        d.add(Rect(0, 1, max(track_w * frac, h), h, rx=h / 2, ry=h / 2, fillColor=color, strokeColor=None))
    return d


def _donut(total_in, total_out):
    d = Drawing(150, 130)
    tot = (total_in or 0) + (total_out or 0)
    if tot <= 0:
        return d
    pie = Pie()
    pie.x, pie.y, pie.width, pie.height = 20, 12, 106, 106
    pie.data = [max(total_in, 0.0001), max(total_out, 0.0001)]
    pie.slices[0].fillColor = GREEN
    pie.slices[1].fillColor = ORANGE
    pie.slices.strokeColor = WHITE
    pie.slices.strokeWidth = 2
    d.add(pie)
    cx, cy = 20 + 53, 12 + 53
    d.add(Circle(cx, cy, 30, fillColor=WHITE, strokeColor=WHITE))
    pct = int(round(total_in / tot * 100))
    d.add(String(cx, cy + 2, f"{pct}%", fontName="Helvetica-Bold", fontSize=15, fillColor=INK, textAnchor="middle"))
    d.add(String(cx, cy - 12, "Masuk", fontName="Helvetica", fontSize=7, fillColor=SLATE, textAnchor="middle"))
    return d


def build_report_pdf(project, summary, transactions, workers, work_items, progress_entries):
    company = (project.get("companyName") or "ProFinance Interior").upper()
    published = datetime.now().strftime("%d/%m/%Y, %H.%M")

    def draw_page(canvas, doc):
        w, h = A4
        # header band
        canvas.setFillColor(INK)
        canvas.rect(0, h - 22 * mm, w, 22 * mm, fill=1, stroke=0)
        canvas.setFillColor(AMBER)
        canvas.setFont("Helvetica-Bold", 13)
        canvas.drawString(15 * mm, h - 12 * mm, company)
        canvas.setFillColor(colors.HexColor("#CBD5E1"))
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(15 * mm, h - 17 * mm, "LAPORAN KEUANGAN INTERNAL")
        # confidential pill
        canvas.setFillColor(colors.HexColor("#7F1D1D"))
        canvas.roundRect(w - 55 * mm, h - 15 * mm, 40 * mm, 7 * mm, 3.5 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor("#FCA5A5"))
        canvas.setFont("Helvetica-Bold", 7.5)
        canvas.drawCentredString(w - 35 * mm, h - 12.6 * mm, "RAHASIA \u2014 INTERNAL")
        # footer band
        canvas.setFillColor(INK)
        canvas.rect(0, 0, w, 12 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor("#CBD5E1"))
        canvas.setFont("Helvetica", 7)
        canvas.drawString(15 * mm, 4.6 * mm, f"{company}  \u2022  Laporan Keuangan Internal \u2014 Rahasia")
        canvas.setFont("Helvetica", 7)
        canvas.drawRightString(w - 15 * mm, 4.6 * mm, f"Diterbitkan: {published}  \u2022  Hal {canvas.getPageNumber()}")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm, topMargin=28 * mm, bottomMargin=16 * mm,
    )
    content_w = A4[0] - 30 * mm

    styles = getSampleStyleSheet()
    st_kick = ParagraphStyle("kick", parent=styles["Normal"], fontSize=9, textColor=AMBER, spaceAfter=2, fontName="Helvetica-Bold")
    st_title = ParagraphStyle("title", parent=styles["Normal"], fontSize=26, leading=30, textColor=INK, fontName="Helvetica-Bold", spaceAfter=2)
    st_sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=13, leading=16, textColor=SLATE, spaceAfter=8)
    st_small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8.5, textColor=SLATE)
    st_sec = ParagraphStyle("sec", parent=styles["Normal"], fontSize=12.5, textColor=INK, fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=8)
    st_norm = ParagraphStyle("norm", parent=styles["Normal"], fontSize=9, leading=13, textColor=INK)
    st_cell = ParagraphStyle("cell", parent=styles["Normal"], fontSize=8.5, leading=11, textColor=INK)
    story = []

    def section(title):
        t = Table([[Paragraph(title, ParagraphStyle("s", parent=st_sec, spaceBefore=0, spaceAfter=0))]], colWidths=[content_w])
        t.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LINEBELOW", (0, 0), (-1, -1), 2, AMBER),
        ]))
        return t

    # ---- values ----
    nominal = summary.get("nominal", 0)
    total_in = summary["totalIn"]
    total_out = summary["totalOut"]
    balance = summary["balance"]
    margin = summary["marginPct"]
    realisasi = summary["realisasiPct"]
    terbayar = summary["terbayar"]
    sisa = summary["sisaTagihan"]
    in_txs = [t for t in transactions if t.get("type") == "in"]
    out_txs = [t for t in transactions if t.get("type") == "out"]
    hstatus, hcolor, hdesc = _health(margin)

    # ================= COVER =================
    story.append(Spacer(1, 6))
    story.append(Paragraph("LAPORAN KEUANGAN PROYEK", st_kick))
    story.append(Paragraph(project.get("name", "-"), st_title))
    owner = project.get("owner") or "-"
    loc = project.get("alamatProyek") or "-"
    story.append(Paragraph(f"<b>Owner / Klien:</b> {owner} &nbsp;&nbsp;&bull;&nbsp;&nbsp; <b>Lokasi:</b> {loc}", st_sub))

    def metric(label, value, vcolor=INK, big=False):
        return Paragraph(
            f"<font size=7.5 color='#94A3B8'>{label}</font><br/>"
            f"<font size={'13' if big else '11'} color='{vcolor.hexval() if hasattr(vcolor,'hexval') else vcolor}'><b>{value}</b></font>",
            ParagraphStyle("m", parent=st_norm, leading=16))

    rep_date = datetime.now().strftime("%d %B %Y")
    m_rows = [
        [metric("NILAI KONTRAK", rupiah(nominal), big=True), metric("TANGGAL LAPORAN", rep_date)],
        [metric("TANGGAL MULAI", _fmt(project.get("tanggalMulai"))), metric("TARGET SELESAI", _fmt(project.get("targetSelesai")))],
        [metric("TOTAL TRANSAKSI", f"{summary.get('txCount', len(transactions))} transaksi"), metric("STATUS KEUANGAN", hstatus, hcolor, big=True)],
    ]
    mt = Table(m_rows, colWidths=[content_w / 2, content_w / 2])
    mt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG), ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (-1, -1), 14), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(Spacer(1, 10))
    story.append(mt)
    story.append(Spacer(1, 12))
    story.append(Paragraph("DOKUMEN RAHASIA \u2014 HANYA UNTUK INTERNAL", ParagraphStyle("c", parent=st_small, textColor=SLATE_L)))
    story.append(PageBreak())

    # ================= HEALTH + KPI =================
    story.append(section("STATUS KESEHATAN KEUANGAN"))
    hbox = Table([[
        Paragraph(f"<font size=22 color='{hcolor.hexval()}'><b>{hstatus}</b></font><br/>"
                  f"<font size=9 color='#64748B'>{hdesc}</font>", ParagraphStyle("h", parent=st_norm, leading=26)),
        Paragraph(f"<font size=7.5 color='#94A3B8'>MARGIN KEUNTUNGAN</font><br/>"
                  f"<font size=24 color='{hcolor.hexval()}'><b>{margin:.1f}%</b></font>",
                  ParagraphStyle("hm", parent=st_norm, leading=27, alignment=TA_RIGHT)),
    ]], colWidths=[content_w * 0.62, content_w * 0.38])
    hbox.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG), ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("LINEBEFORE", (0, 0), (0, 0), 4, hcolor),
        ("TOPPADDING", (0, 0), (-1, -1), 14), ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING", (0, 0), (-1, -1), 16), ("RIGHTPADDING", (0, 0), (-1, -1), 16),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(hbox)

    cards = [
        ("TOTAL PEMASUKAN", rupiah(total_in), f"{len(in_txs)} transaksi masuk", GREEN),
        ("TOTAL PENGELUARAN", rupiah(total_out), f"{len(out_txs)} transaksi keluar", ORANGE),
        ("SALDO / KEUNTUNGAN", rupiah(balance), "Surplus dari nilai proyek" if balance >= 0 else "Defisit proyek", BLUE),
        ("NILAI KONTRAK", rupiah(nominal), "Total nilai pekerjaan", INK),
        ("MARGIN KEUNTUNGAN", f"{margin:.2f}%", "Dari nilai kontrak", hcolor),
        ("REALISASI TAGIHAN", f"{realisasi:.1f}%", f"{rupiah(terbayar)} dari {rupiah(nominal)}", AMBER),
    ]

    def card_para(t, v, d, c):
        return Paragraph(
            f"<font size=7.5 color='#64748B'>{t}</font><br/>"
            f"<font size=14 color='{c.hexval()}'><b>{v}</b></font><br/>"
            f"<font size=7 color='#94A3B8'>{d}</font>",
            ParagraphStyle("cp", parent=st_norm, leading=17))

    cw = content_w / 2
    crows = [[card_para(*cards[0]), card_para(*cards[1])],
             [card_para(*cards[2]), card_para(*cards[3])],
             [card_para(*cards[4]), card_para(*cards[5])]]
    ct = Table(crows, colWidths=[cw, cw])
    cst = [
        ("BACKGROUND", (0, 0), (-1, -1), WHITE), ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 6, WHITE),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [BG, BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (-1, -1), 14), ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]
    idx = [(0, 0, GREEN), (1, 0, ORANGE), (0, 1, BLUE), (1, 1, INK), (0, 2, hcolor), (1, 2, AMBER)]
    for c, r, col in idx:
        cst.append(("LINEBEFORE", (c, r), (c, r), 4, col))
    ct.setStyle(TableStyle(cst))
    story.append(Spacer(1, 8))
    story.append(ct)

    # Realisasi tagihan
    story.append(section("REALISASI TAGIHAN"))
    frac = (terbayar / nominal) if nominal else 0
    rhead = Table([[
        Paragraph("Progress Penagihan Kontrak", st_small),
        Paragraph(f"<font size=15 color='{AMBER.hexval()}'><b>{realisasi:.1f}%</b></font>",
                  ParagraphStyle("r", parent=st_norm, alignment=TA_RIGHT)),
    ]], colWidths=[content_w * 0.6, content_w * 0.4 - 28])
    rhead.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                               ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    rfoot = Table([[
        Paragraph("Rp 0", st_small),
        Paragraph(f"<b>Sudah dibayar: {rupiah(terbayar)}</b> &nbsp; &bull; &nbsp; Sisa: {rupiah(sisa)}",
                  ParagraphStyle("rr", parent=st_small, alignment=TA_RIGHT)),
    ]], colWidths=[content_w * 0.3, content_w * 0.7 - 28])
    rfoot.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                               ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    rbar = Table([[rhead], [_bar(content_w - 28, frac, BLUE, h=11)], [rfoot]], colWidths=[content_w - 28])
    rbar.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG), ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 14), ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(rbar)

    # Distribusi keuangan (donut)
    story.append(section("DISTRIBUSI KEUANGAN"))
    legend = Paragraph(
        f"<font color='#16A34A'>&#9632;</font> <b>Total Pemasukan</b> &nbsp; {rupiah(total_in)}<br/>"
        f"<font color='#EA580C'>&#9632;</font> <b>Total Pengeluaran</b> &nbsp; {rupiah(total_out)}<br/><br/>"
        f"<font size=8 color='#64748B'>Saldo Akhir</font><br/>"
        f"<font size=15 color='{BLUE.hexval()}'><b>{rupiah(balance)}</b></font>",
        ParagraphStyle("lg", parent=st_norm, leading=16))
    dt = Table([[_donut(total_in, total_out), legend]], colWidths=[content_w * 0.42, content_w * 0.58])
    dt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG), ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10), ("LEFTPADDING", (0, 0), (-1, -1), 14),
    ]))
    story.append(dt)

    # Breakdown pengeluaran per kategori
    story.append(section("BREAKDOWN PENGELUARAN PER KATEGORI"))
    by_cat = {}
    for t in out_txs:
        by_cat[t.get("category", "Lainnya")] = by_cat.get(t.get("category", "Lainnya"), 0) + t.get("amount", 0)
    cat_list = sorted(by_cat.items(), key=lambda x: x[1], reverse=True)
    if not cat_list:
        story.append(Paragraph("Belum ada pengeluaran.", st_small))
    else:
        maxv = cat_list[0][1] or 1
        rows = []
        for i, (name, val) in enumerate(cat_list):
            pct = (val / total_out * 100) if total_out else 0
            col = CAT_COLORS[i % len(CAT_COLORS)]
            rows.append([
                Paragraph(f"<b>{name}</b>", st_cell),
                _bar(content_w * 0.34, val / maxv, col, h=8),
                Paragraph(f"<b>{rupiah(val)}</b>", ParagraphStyle("v", parent=st_cell, alignment=TA_RIGHT)),
                Paragraph(f"{pct:.1f}%", ParagraphStyle("p", parent=st_cell, alignment=TA_RIGHT, textColor=SLATE)),
            ])
        bt = Table(rows, colWidths=[content_w * 0.28, content_w * 0.40, content_w * 0.20, content_w * 0.12])
        bt.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, BG]),
            ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
        ]))
        story.append(bt)

    # ================= TABLES =================
    def tx_table(rows_data, total_label, total_val):
        head = ["TANGGAL", "KATEGORI", "KETERANGAN", "JUMLAH"]
        rows = [head]
        for t in rows_data:
            rows.append([_fmt(t.get("date")), t.get("category", "-"),
                         (t.get("description", "") or "")[:60], rupiah(t.get("amount", 0))])
        if len(rows) == 1:
            rows.append(["-", "-", "Belum ada transaksi", "-"])
        rows.append(["", "", total_label, rupiah(total_val)])
        tbl = Table(rows, colWidths=[content_w * 0.16, content_w * 0.24, content_w * 0.42, content_w * 0.18], repeatRows=1)
        tbl.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 8), ("BACKGROUND", (0, 0), (-1, 0), INK),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, BG]),
            ("GRID", (0, 0), (-1, -1), 0.4, LINE), ("ALIGN", (3, 0), (3, -1), "RIGHT"),
            ("BACKGROUND", (0, -1), (-1, -1), AMBER_L), ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("TEXTCOLOR", (0, -1), (-1, -1), colors.HexColor("#92400E")), ("SPAN", (0, -1), (1, -1)),
            ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))
        return tbl

    story.append(section("DETAIL PEMASUKAN"))
    story.append(Paragraph("Rincian Transaksi Masuk", st_small))
    story.append(Spacer(1, 4))
    story.append(tx_table(sorted(in_txs, key=lambda x: x.get("date", "")), "TOTAL PEMASUKAN", total_in))

    story.append(section("DETAIL PENGELUARAN"))
    story.append(Paragraph("Rincian Transaksi Keluar", st_small))
    story.append(Spacer(1, 4))
    story.append(tx_table(sorted(out_txs, key=lambda x: x.get("date", "")), "TOTAL PENGELUARAN", total_out))

    # Tukang summary
    if workers:
        story.append(section("RINGKASAN TUKANG"))
        wr = [["NAMA TUKANG", "BORONGAN", "KASBON", "PELUNASAN", "SISA HUTANG"]]
        for w in workers:
            wr.append([w.get("name", "-"), rupiah(w.get("borongan", 0)), rupiah(w.get("totalKasbon", 0)),
                       rupiah(w.get("totalPelunasan", 0)), rupiah(w.get("sisaHutang", 0))])
        wt = Table(wr, colWidths=[content_w * 0.28, content_w * 0.19, content_w * 0.18, content_w * 0.18, content_w * 0.17], repeatRows=1)
        wt.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 8), ("BACKGROUND", (0, 0), (-1, 0), INK),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, BG]), ("GRID", (0, 0), (-1, -1), 0.4, LINE),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"), ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5), ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(wt)

    # Progress documentation with photos
    if work_items:
        has_photos = any(pe.get("photoUrls") for pe in progress_entries)
        entries_by_item = {}
        for pe in progress_entries:
            entries_by_item.setdefault(pe.get("workItemId"), []).append(pe)
        if has_photos or any(entries_by_item.get(wi["id"]) for wi in work_items):
            story.append(section("DOKUMENTASI PROGRESS PEKERJAAN"))
            for wi in work_items:
                ents = entries_by_item.get(wi["id"], [])
                if not ents:
                    continue
                story.append(Paragraph(
                    f"<b>{wi.get('name','-')}</b> &nbsp;<font color='#64748B' size=8>(Bobot {wi.get('weight',0):.1f}% &bull; Progress {wi.get('lastProgress',0)}%)</font>",
                    st_norm))
                for pe in ents:
                    story.append(Paragraph(
                        f"<font color='#64748B' size=8>{_fmt(pe.get('date'))} \u2014 {pe.get('progress',0)}% \u2014 {(pe.get('notes','') or '')[:90]}</font>",
                        st_small))
                    imgs = []
                    for path in (pe.get("photoUrls") or [])[:4]:
                        try:
                            content, _ = get_object(path)
                            imgs.append(RLImage(io.BytesIO(content), width=40 * mm, height=30 * mm, kind="proportional"))
                        except Exception as e:
                            logger.warning(f"pdf image fail {path}: {e}")
                    if imgs:
                        ph = Table([imgs], colWidths=[43 * mm] * len(imgs))
                        ph.setStyle(TableStyle([("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
                        story.append(ph)
                story.append(Spacer(1, 6))

    doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
    buf.seek(0)
    return buf.read()
