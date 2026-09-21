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
- Menu & Halaman Pengaturan Admin (2026-06-20): OWNER_EMAILS = admin. `user_public` kirim `isAdmin`. Backend `require_admin` dependency + koleksi `settings` (singleton `app_settings`): `GET/PUT /api/admin/settings` (admin-only), `GET /api/settings/public` (whitelist: appName, announcement, maintenanceMode, supportWhatsapp, supportEmail). Field: appName, supportEmail, supportWhatsapp, announcement, maintenanceMode — mudah diperluas. Frontend: menu "Pengaturan Admin" di Header (hanya admin), halaman `/admin/settings` (AdminSettings.js, redirect non-admin), pakai Switch/Textarea shadcn. Terverifikasi: owner isAdmin=true, GET/PUT ok, public ok, demo→403, redirect non-admin.
- Halaman Login ditingkatkan (2026-06-20): ikon mata show/hide password (login & reset), link "Lupa password?", field "Nomor Telepon (opsional)" saat daftar. Backend: `register_email_user(..., phone)` + `normalize_phone` (+62/62→0xx), `user_public` kini kirim `phone`, `POST /api/auth/reset-password` (verifikasi email+phone cocok → rehash bcrypt; pesan generik anti-enumeration, min 6 char). Reset via verifikasi nomor telepon (tanpa email/SMS provider). Terverifikasi: register simpan phone ternormalisasi, reset salah→400, benar→ok, login dgn password baru berhasil & lama gagal.
- Riwayat Transaksi + Pengingat Perpanjangan (2026-06-20): Halaman Akun `/account` (Account.js, menu Header "Akun & Transaksi") menampilkan kartu status langganan (masa aktif + sisa hari) & tabel riwayat transaksi Midtrans. Backend `GET /api/subscription/orders`, `GET /api/notifications`, `POST /api/notifications/{id}/read`. Pengingat perpanjangan: banner otomatis client-side di Header saat sisa ≤7 hari (dismissable per periode via localStorage) + cron harian `renewal-reminders` (01:00 UTC) → `POST /api/cron/renewal-reminders` (Bearer WEBHOOK_CRON_SECRET, BackgroundTasks) buat notifikasi in-app untuk user premium yg expiry ≤7 hari (skip owner/demo, idempoten via expiryKey). Terverifikasi: orders list, cron buat reminder "berakhir dalam 2 hari", 401 tanpa auth.
- Hapus bypass premium (2026-06-19): endpoint mockup `/subscription/upgrade` & `/subscription/toggle` DIHAPUS (mencegah upgrade gratis setelah pembayaran Midtrans nyata), menu "Toggle Free/Premium (demo)" di Header dihapus. Akun owner dipaksa Premium permanen di `get_current_user` (auth.py, OWNER_EMAILS: furniture.mail@gmail.com & furnitrue.mail@gmail.com) — otomatis restore premium setiap request meski tier di-DB diubah.
- Pembayaran Midtrans (2026-06-19, PRODUCTION): ganti mockup dgn Midtrans Snap sekali-bayar per periode (monthly 149rb/30hari, yearly 1.29jt/365hari), metode QRIS+GoPay+bank_transfer(VA). Backend: `POST /api/subscription/checkout` (buat order pending + Snap token), `POST /api/midtrans/notification` (publik; verifikasi signature SHA512 + challenge Get Status + aktivasi premium idempoten, expiry extend dari max(now,existing)), `GET /api/subscription/order/{id}` (polling status). Keys di backend/.env (MIDTRANS_SERVER_KEY/CLIENT_KEY/IS_PRODUCTION=true), client key di frontend/.env (REACT_APP_MIDTRANS_CLIENT_KEY). Frontend Pricing.js load snap.js dinamis + window.snap.pay + polling. Demo user diblok (403). Terverifikasi: checkout hasilkan Snap token production nyata, signature invalid→401. ACTION USER: daftarkan Payment Notification URL `${BACKEND_URL}/api/midtrans/notification` di dashboard Midtrans + whitelist domain di Snap Preferences.
- Foto contoh di demo + reset otomatis (2026-06-19): seed_demo kini melampirkan foto dokumentasi (DEMO_PHOTOS, URL http eksternal) ke tiap progress entry; portal backend & ClientPortal + `fileUrl()` melewatkan URL http apa adanya (tak dibungkus /file). Cron platform `.emergent/crons.yml` (`reset-demo-data`, harian 20:00 UTC) → `POST /api/cron/reset-demo` (auth Bearer WEBHOOK_CRON_SECRET, hmac.compare_digest, ack 2xx + BackgroundTasks) menghapus & re-seed data demo via `_provision_demo_data`. Terverifikasi (401 tanpa auth, queued dgn secret, 10 foto tampil di galeri).
- Akun Demo baca-saja (2026-06-19): `POST /api/auth/demo` (publik) buat/ambil user demo@profinance.id (premium, isDemo=true), auto-seed 3 proyek + baseline showcase pada "Kitchen Set". READ-ONLY dipaksa di `get_current_user` (auth.py): semua POST/PUT/DELETE/PATCH oleh isDemo → 403. Frontend: tombol "Jelajahi Akun Demo" di Login, `loginDemo()` di AuthContext, axios response interceptor tampilkan toast saat 403 demo, banner biru "Mode Demo (baca-saja)" + badge di Header (toggle tier disembunyikan).
- Paywall progress/report diupdate (2026-06-19): daftar fitur premium diperluas (Impor Excel, Baseline vs Revisi, Portal Klien+WhatsApp, edit progress, Deviasi RAB di PDF, dll).
- Landing page fitur di tablet/HP (2026-06-19): blok "FITUR TERBARU" `lg:hidden` ditambahkan di kolom form Login agar info fitur tampil seperti versi desktop.
- Edit/Hapus Progress Lapangan (2026-06-19, premium): `PUT/DELETE /api/progress/{entry_id}` (validasi kepemilikan via workItem→project). UI di dialog log ProgressTab: ikon pensil/tempat sampah per entri riwayat, banner "Mode edit", tombol jadi "Perbarui Progress", dialog tetap terbuka & refresh setelah simpan. Untuk koreksi persentase yang salah/terlupa.
- Landing page (Login.js) dirapikan (2026-06-19): showcase panel diganti daftar "FITUR TERBARU" (Portal Klien+WhatsApp, Impor RAB Excel, Baseline vs Revisi, Kurva-S, Kasbon Tukang, Laporan PDF) menggantikan KPI dummy lama.
- Deviasi RAB di Progress PDF (2026-06-19): section "DEVIASI RAB — BASELINE VS REVISI" pada `build_progress_pdf` (pdf_report.py) — tabel per-area Baseline/Revisi/Selisih (tag BARU/DIHAPUS, warna merah=naik/hijau=turun) + baris Total RAB + kalimat ringkas total deviasi %. Muncul otomatis bila project punya rabBaseline (prog carries rabBaseline+totalItemValue). Terverifikasi via render PDF→PNG.
- Baseline vs Revisi RAB (2026-06-19, premium): `POST /api/projects/{id}/rab-baseline` snapshot RAB awal (rabTotal, totalItemValue, items[{id,name,value}]) ke project.rabBaseline; `DELETE` untuk hapus. Field `rabBaseline` disertakan di response progress-summary. UI di RAB card tab Progress: tombol "Simpan Baseline", badge deviasi (baseline→revisi Rp & %), dialog "Rincian Deviasi" (tabel per-item Baseline/Revisi/Selisih + status BARU/DIHAPUS), tombol Perbarui & Hapus baseline.
- Impor RAB Excel (2026-06-19, premium): `GET /api/rab-template` unduh template .xlsx (kolom: Item Pekerjaan / Sub Item / Harga), `POST /api/projects/{id}/workitems/import` parse openpyxl → auto-buat work_items & sub_items (item tanpa sub = nilai manual). Tombol "Unduh Template" & "Impor Excel" di RAB card tab Progress.
- Open Graph share (2026-06-19): `GET /api/public/portal/{slug}/share` serve HTML dgn meta OG (title=nama proyek, image=thumbnail, desc) + redirect RELATIF ke `/portal/{slug}` (aman thd proxy host-rewrite; og:url pakai x-forwarded-host). Dialog share & tombol WhatsApp memakai URL share ini agar preview kartu muncul di WhatsApp/Twitter.
- Reset Link Portal (2026-06-19): `POST /api/projects/{id}/portal-link/reset` buat slug baru → link lama otomatis 404. Tombol konfirmasi di dialog Portal Klien.
- Portal Klien publik (2026-06-19): link berbasis nama proyek (portalSlug = slug-nama + token hex), route publik `/portal/:slug`, tombol "Portal Klien" di tab Progress dengan salin link + share ke WhatsApp (wa.me). Portal menampilkan progress %, Kurva-S, rincian pekerjaan (TANPA rupiah), riwayat pembayaran + terbayar/sisa tagihan, dan galeri foto dokumentasi. Foto disajikan via endpoint publik ber-scope (`/api/public/portal/{slug}/file`) yang hanya melayani path foto milik proyek tsb. Link otomatis mati saat proyek dihapus.

## Status
Verified by testing agent: backend 20/20, frontend all tested flows pass. Payment is MOCKED.

## Implemented (2026-09-20)
- Manajemen Pengguna (Admin): halaman `/admin/users` (AdminUsers.js, menu Header "Manajemen Pengguna", admin-only). Backend: `GET /api/admin/users` (pencarian nama/email/phone + pagination; per-user: status Free/Premium/Kedaluwarsa, s/d expiry + sisa hari, isDemo, isOwner, projectCount, transactionCount via project_ids, lastLogin dari user_sessions, created_at), `POST /api/admin/users/{id}/premium` {days: 0=permanen, 30/90/365; extend dari max(now, expiry)} dengan notifikasi in-app ke user, `POST /api/admin/users/{id}/revoke` (owner diblok 400, set free + notifikasi). UI: tabel badge status, dialog pilih durasi, AlertDialog konfirmasi cabut, pagination prev/next. Terverifikasi curl: list/search ok, grant 30d + extend 90d menumpuk benar, revoke ok, revoke owner→400, non-admin→403. Screenshot desktop/mobile ok.

## Implemented (2026-09-21)
- Import project dari GitHub (arimator87/profinance-interior) + reinstall semua dependencies (backend 130 pkg, frontend yarn). Semua service RUNNING & terverifikasi.
- Backup Data — Fase 1 (unduh ke perangkat): modul `backend/backup.py` + endpoint `GET /api/backup/summary` (hitung proyek/transaksi/tukang/item/progress/foto) & `GET /api/backup/export` (stream ZIP). ZIP berisi `data.json` (dump mentah semua koleksi + photoMapping, untuk restore), `data.xlsx` (openpyxl, 5 sheet: Proyek/Transaksi/Tukang/Item Pekerjaan/Progress Lapangan), `photos/` (semua foto struk+progress dari Object Storage via get_object; URL http eksternal di-skip), `manifest.json`. Assembly di threadpool + FileResponse dgn BackgroundTask cleanup temp. Demo (read-only) boleh export (GET). UI: kartu "Backup Data" di halaman Akun (Account.js) dgn ringkasan hitungan + tombol "Unduh Backup (.zip)". Terverifikasi testing agent 3/3 (unauth→401, summary counts, zip valid berisi data.json+data.xlsx+manifest.json).
- Backup Data — Fase 2 (Google Drive): DIBATALKAN atas permintaan user (2026-09-21). Cukup backup ke perangkat.
- WhatsApp renewal reminder: DIABAIKAN atas permintaan user (fokus ke backup).

## Implemented (2026-09-21b) — Backup lanjutan
- Backup Per-Proyek: `GET /api/projects/{id}/backup/export` (auth+ownership) → ZIP satu proyek (data.json 1 proyek + data.xlsx + photos/ proyek itu). UI: tombol ikon unduh (hijau) di header ProjectDetail.js.
- Pulihkan Data (Restore): `POST /api/backup/restore` (multipart 'file'; demo diblok POST). Parse data.json, re-upload semua foto ke Object Storage (remap path lama→baru), pulihkan HANYA proyek yang id-nya belum ada (skip yang ada → idempoten), plus transaksi/tukang/work_items/sub_items/progress. UI: kartu "Pulihkan Data" di Account.js (sembunyi utk demo), input file .zip.
- Backup Otomatis Mingguan + tersimpan di cloud: `backend/backup.py` create_stored_backup (assemble ZIP → put_object ke `{APP}/backups/{uid}/{stamp}.zip` + koleksi `backups`, retensi 8 terbaru via delete_object). `POST /api/backup/run` (manual, demo diblok), `GET /api/backups` (list metadata), `GET /api/backups/{id}/download?auth=` (stream). Cron `weekly-backup` (Minggu 18:00 UTC) → `POST /api/cron/weekly-backup` (Bearer WEBHOOK_CRON_SECRET) → run_weekly_backups untuk semua user non-demo berproyek. storage.py: tambah delete_object. UI Account.js: tombol "Simpan Backup di Cloud" + kartu "Backup Tersimpan (Otomatis Mingguan)" dgn daftar + unduh.
- Terverifikasi testing agent 7/7: per-project export, run/list/download stored, restore (termasuk idempoten pulihkan proyek terhapus + transaksi + foto), demo blocked 403 di /backup/run, cron 401 tanpa auth & 200 dgn secret. Frontend compiled & dirender (demo view + tombol per-proyek).


## Backlog / Next (P1/P2)
- P1: Batch summary via Mongo $group (avoid N+1) for many projects
- P1: Unique tukang name per project (or use worker_id in tx category) to avoid name collisions
- P2: Edit project/transaction; export CSV; multi-currency; team members per tenant
- P2: Real payment gateway (Stripe/Midtrans) replacing mockup
