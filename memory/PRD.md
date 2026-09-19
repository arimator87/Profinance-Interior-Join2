# ProFinance Interior — PRD

## Original Problem Statement
Cloud-First Multi-Tenant SaaS (Freemium) untuk kontraktor interior & arsitektur di Indonesia. Catatan keuangan + manajemen proyek. FREE: proyek, cash flow, kasbon/pelunasan tukang. PREMIUM: Progress Pekerjaan (item + S-Curve) & Export Laporan PDF. Bahasa Indonesia, Rupiah.

## User Choices
- Auth: Google (Emergent-managed) + Email/Password (JWT-style session token)
- Payment: MOCKUP only (no real gateway)
- File storage: Emergent Object Storage
- Language: Bahasa Indonesia · Currency: Rupiah

## Architecture
- Backend: FastAPI (server.py, auth.py, storage.py, pdf_report.py) + MongoDB (motor). All routes /api-prefixed.
- Frontend: React 19 + React Router 7, Tailwind + shadcn/ui, Recharts, framer-motion. Fonts: Outfit / Plus Jakarta Sans / JetBrains Mono.
- Auth: session tokens in `user_sessions`; accepted via httpOnly cookie or Bearer. Frontend keeps `pf_token` in localStorage + cookie.
- Object storage for receipt & progress photos. PDF via reportlab (embeds photos).

## Data Models (Mongo collections)
users, user_sessions, projects, transactions, workers, work_items, progress_entries, files.

## Business Logic (implemented & verified exact)
- totalIn/totalOut/balance; marginPct=(balance/nominal)*100 (0 if nominal 0); realisasiPct=(totalIn/nominal)*100
- sisaTagihan = nominal - terbayar; terbayar counts only 'in' with category Downpayment/Termin/Pelunasan
- Worker sisaHutang = borongan - Kasbon - Pelunasan (from 'out' tx category 'Kasbon Tukang {Nama}' / 'Pelunasan Tukang {Nama}')
- Health color coding: >=20 #16a34a, 10-19 #2563eb, 0-9 #d97706, -10..-1 #ea580c, <-10 #dc2626
- Work item weight=(nilai/nominal)*100; total progress = Σ(weight*lastProgress/100)/ΣweightΣ*100

## Implemented (2026-06)
- Email + Google auth, session management, /auth/me
- Dashboard aggregation (saldo bersih, sisa tagihan, budget, kasbon aktif) + project cards + filters
- Project CRUD; Project Detail 4 tabs (Cash Flow, Tukang, Progress[premium], Report[premium])
- Cash Flow transactions with receipt photo upload; categories (income/expense + Kustom)
- Tukang management + Bayar Kasbon / Pelunasan (auto-creates categorized out transaction)
- Premium gating (403) + Paywall banners; header demo tier toggle
- Progress work items + daily progress logs + photo docs + S-Curve (planned vs actual)
- Report: Pie (expense by category), horizontal Bar (kontrak/pengeluaran/margin), Export PDF (reportlab, embeds photos)
- Pricing page + mockup payment modal (QRIS/Bank/E-wallet) -> upgrade premium
- Demo seed endpoint (3 Indonesian interior projects)
- Deviasi RAB di Progress PDF (2026-06-19): section "DEVIASI RAB — BASELINE VS REVISI" pada `build_progress_pdf` (pdf_report.py) — tabel per-area Baseline/Revisi/Selisih (tag BARU/DIHAPUS, warna merah=naik/hijau=turun) + baris Total RAB + kalimat ringkas total deviasi %. Muncul otomatis bila project punya rabBaseline (prog carries rabBaseline+totalItemValue). Terverifikasi via render PDF→PNG.
- Baseline vs Revisi RAB (2026-06-19, premium): `POST /api/projects/{id}/rab-baseline` snapshot RAB awal (rabTotal, totalItemValue, items[{id,name,value}]) ke project.rabBaseline; `DELETE` untuk hapus. Field `rabBaseline` disertakan di response progress-summary. UI di RAB card tab Progress: tombol "Simpan Baseline", badge deviasi (baseline→revisi Rp & %), dialog "Rincian Deviasi" (tabel per-item Baseline/Revisi/Selisih + status BARU/DIHAPUS), tombol Perbarui & Hapus baseline.
- Impor RAB Excel (2026-06-19, premium): `GET /api/rab-template` unduh template .xlsx (kolom: Item Pekerjaan / Sub Item / Harga), `POST /api/projects/{id}/workitems/import` parse openpyxl → auto-buat work_items & sub_items (item tanpa sub = nilai manual). Tombol "Unduh Template" & "Impor Excel" di RAB card tab Progress.
- Open Graph share (2026-06-19): `GET /api/public/portal/{slug}/share` serve HTML dgn meta OG (title=nama proyek, image=thumbnail, desc) + redirect RELATIF ke `/portal/{slug}` (aman thd proxy host-rewrite; og:url pakai x-forwarded-host). Dialog share & tombol WhatsApp memakai URL share ini agar preview kartu muncul di WhatsApp/Twitter.
- Reset Link Portal (2026-06-19): `POST /api/projects/{id}/portal-link/reset` buat slug baru → link lama otomatis 404. Tombol konfirmasi di dialog Portal Klien.
- Portal Klien publik (2026-06-19): link berbasis nama proyek (portalSlug = slug-nama + token hex), route publik `/portal/:slug`, tombol "Portal Klien" di tab Progress dengan salin link + share ke WhatsApp (wa.me). Portal menampilkan progress %, Kurva-S, rincian pekerjaan (TANPA rupiah), riwayat pembayaran + terbayar/sisa tagihan, dan galeri foto dokumentasi. Foto disajikan via endpoint publik ber-scope (`/api/public/portal/{slug}/file`) yang hanya melayani path foto milik proyek tsb. Link otomatis mati saat proyek dihapus.

## Status
Verified by testing agent: backend 20/20, frontend all tested flows pass. Payment is MOCKED.

## Backlog / Next (P1/P2)
- P1: Batch summary via Mongo $group (avoid N+1) for many projects
- P1: Unique tukang name per project (or use worker_id in tx category) to avoid name collisions
- P2: Edit project/transaction; export CSV; multi-currency; team members per tenant
- P2: Real payment gateway (Stripe/Midtrans) replacing mockup
