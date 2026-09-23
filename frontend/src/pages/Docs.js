import { useNavigate } from "react-router-dom";
import Seo from "@/components/Seo";
import { PublicNav, PublicFooter } from "@/components/PublicChrome";
import {
  FileText, ReceiptText, TrendingUp, Wallet, Share2, FileSpreadsheet,
  Rocket, UserPlus, FolderPlus, Send, CheckCircle2,
} from "lucide-react";

const STEPS = [
  { icon: UserPlus, title: "1. Daftar & Masuk", desc: "Buat akun gratis lewat email atau Google. Anda bisa langsung mencoba semua fitur lewat tombol 'Coba Akun Demo' tanpa mendaftar." },
  { icon: FolderPlus, title: "2. Buat Proyek", desc: "Dari Dashboard, tekan 'Proyek Baru'. Isi nama proyek, nilai kontrak, kategori (mis. Residensial), dan pemilik. Proyek menjadi wadah semua data keuangan & progres." },
  { icon: FileText, title: "3. Susun RAB / Quotation", desc: "Buka menu RAB, tambahkan seksi pekerjaan & sub-item lengkap dengan volume, harga satuan, dan material. Sistem menghitung subtotal, diskon, PPN, dan termin otomatis. Ekspor ke PDF Quotation berkop perusahaan + tanda tangan." },
  { icon: ReceiptText, title: "4. Terbitkan Invoice & Proforma", desc: "Setelah deal, terbitkan Proforma untuk DP/termin dan Invoice untuk pelunasan. Nomor Quotation otomatis tertaut. Kirim langsung ke klien via WhatsApp." },
  { icon: TrendingUp, title: "5. Pantau Rekap Penagihan", desc: "Lihat total tertagih, terbayar, retensi ditahan, dan tagihan jatuh tempo. Badge otomatis menandai invoice yang lewat jatuh tempo." },
  { icon: Wallet, title: "6. Catat Cash Flow & Kasbon Tukang", desc: "Rekam pemasukan/pengeluaran dan kelola kasbon serta pelunasan tukang. Indikator kesehatan finansial tiap proyek tampil real-time." },
  { icon: Share2, title: "7. Bagikan Portal Klien", desc: "Bagikan tautan portal ke klien untuk memantau progres & tagihan secara realtime — membangun kepercayaan tanpa bolak-balik chat." },
  { icon: FileSpreadsheet, title: "8. Ekspor Laporan", desc: "Unduh rekap penagihan, daftar invoice, dan RAB dalam format Excel & PDF profesional siap dikirim ke klien." },
];

const FAQ = [
  { q: "Apakah gratis untuk memulai?", a: "Ya. Akun Free bisa dipakai selamanya untuk proyek tanpa batas, cash flow, kasbon tukang, dan indikator finansial. Fitur Premium seperti Invoice, Kurva-S, dan Portal Klien dapat diaktifkan kapan saja." },
  { q: "Apa itu Akun Demo?", a: "Akun Demo memungkinkan Anda menjelajahi seluruh fitur Premium dengan data contoh dalam mode baca-saja, tanpa perlu mendaftar." },
  { q: "Bagaimana retensi dihitung?", a: "Retensi dihitung dari Nilai Kontrak (nominal proyek), bukan dari subtotal invoice, sesuai praktik umum proyek konstruksi & interior." },
  { q: "Apakah data saya aman?", a: "Data Anda tersimpan aman dan bisa dicadangkan kapan saja ke file ZIP, plus backup otomatis mingguan ke cloud." },
];

export default function Docs() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo
        title="Panduan Penggunaan Aplikasi"
        description="Panduan lengkap cara menggunakan ProFinance Interior: dari membuat proyek, menyusun RAB, menerbitkan invoice, memantau cash flow, hingga berbagi portal klien."
        keywords="cara menggunakan profinance interior, panduan aplikasi kontraktor, tutorial RAB invoice, dokumentasi profinance"
      />
      <PublicNav />

      <section className="bg-gradient-to-b from-slate-950 to-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 mb-4">
            <Rocket className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold tracking-[0.15em] text-amber-300">PANDUAN PENGGUNAAN</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold leading-tight">
            Cara Menggunakan ProFinance Interior
          </h1>
          <p className="mt-3 text-slate-300 max-w-2xl">
            Ikuti langkah-langkah berikut untuk mengelola keuangan dan progres proyek interior Anda dari awal hingga selesai.
          </p>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="space-y-5">
          {STEPS.map((s, i) => (
            <div key={i} className="flex gap-4 rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition">
              <div className="shrink-0 w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">{s.title}</h2>
                <p className="text-slate-600 mt-1 text-[15px] leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <h2 className="font-display text-2xl font-extrabold mt-14 mb-5">Pertanyaan Umum</h2>
        <div className="space-y-3">
          {FAQ.map((f, i) => (
            <div key={i} className="rounded-xl border border-slate-100 p-5">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold">{f.q}</h3>
                  <p className="text-slate-600 mt-1 text-[15px]">{f.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 text-white p-6 sm:p-8 text-center">
          <h3 className="font-display text-xl font-bold">Siap mencoba?</h3>
          <p className="text-slate-300 mt-2 text-sm">Mulai kelola proyek interior Anda gratis hari ini.</p>
          <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
            <button onClick={() => navigate("/login")} className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-5 py-2.5 rounded-lg">
              <Send className="w-4 h-4" /> Mulai Gratis
            </button>
            <button onClick={() => navigate("/blog")} className="inline-flex items-center gap-2 border border-white/30 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-white/10">
              Baca Blog
            </button>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
