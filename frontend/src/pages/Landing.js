import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Ruler, Check, Sparkles, PlayCircle, ArrowRight, Crown, Megaphone, Timer, Quote,
  FileSpreadsheet, ReceiptText, TrendingUp, Users, Wallet, ShieldCheck, FileText,
  LineChart, Share2, DatabaseBackup, Star, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

const FEATURES = [
  { icon: FileText, title: "RAB & Quotation Profesional", desc: "Susun Rencana Anggaran Biaya lengkap dengan material, PPN, diskon, termin — ekspor PDF Quotation berkop perusahaan & tanda tangan." },
  { icon: ReceiptText, title: "Invoice & Proforma", desc: "Terbitkan Proforma untuk DP/termin dan Invoice pelunasan. Kirim langsung ke klien via WhatsApp, lengkap No. Quotation." },
  { icon: TrendingUp, title: "Rekap Penagihan", desc: "Pantau total tertagih vs terbayar vs retensi ditahan. Badge otomatis untuk invoice yang lewat jatuh tempo." },
  { icon: LineChart, title: "Progress & Kurva-S", desc: "Lacak progres lapangan cost-loaded, Kurva-S, dan Time Schedule agar proyek selalu sesuai rencana." },
  { icon: Wallet, title: "Cash Flow & Kasbon Tukang", desc: "Catat pemasukan/pengeluaran, kelola kasbon & pelunasan tukang, dengan indikator kesehatan finansial tiap proyek." },
  { icon: Share2, title: "Portal Klien Realtime", desc: "Bagikan progres & tagihan ke klien lewat tautan portal — bangun kepercayaan tanpa bolak-balik chat." },
  { icon: FileSpreadsheet, title: "Ekspor Excel & PDF", desc: "Unduh rekap penagihan, daftar invoice, dan RAB dalam format Excel & PDF rapi siap dikirim ke klien." },
  { icon: DatabaseBackup, title: "Backup Data Aman", desc: "Cadangkan seluruh proyek, transaksi, dan foto dalam satu ZIP — plus backup otomatis mingguan ke cloud." },
];

const STEPS = [
  { n: "1", title: "Buat Proyek & RAB", desc: "Input proyek, susun RAB/quotation, dan kirim penawaran profesional ke klien." },
  { n: "2", title: "Kelola Keuangan & Progress", desc: "Catat cash flow, kasbon tukang, dan update progres Kurva-S selama proyek berjalan." },
  { n: "3", title: "Tagih & Laporkan", desc: "Terbitkan invoice, pantau rekap penagihan, dan bagikan laporan ke klien lewat portal." },
];

const TESTIMONIALS = [
  { q: "RAB sampai invoice & progress klien jadi satu tempat. Penagihan nggak pernah kelewat lagi.", n: "Andika P.", r: "Kontraktor Interior, Bali" },
  { q: "Kurva-S dan laporan PDF-nya bikin klien makin percaya. Terlihat jauh lebih profesional.", n: "Rina S.", r: "Studio Arsitektur, Bandung" },
  { q: "Kasbon tukang & cash flow real-time. Untung-rugi tiap proyek langsung kelihatan.", n: "Budi H.", r: "Kontraktor Furniture, Surabaya" },
];

const FAQ = [
  { q: "Apakah gratis untuk memulai?", a: "Ya. Akun Free bisa dipakai selamanya untuk proyek tanpa batas, cash flow, kasbon tukang, dan indikator finansial. Upgrade ke Premium kapan saja." },
  { q: "Apa saja yang termasuk Premium?", a: "Invoice & Proforma + kirim WhatsApp, Rekap Penagihan & Ekspor Excel, Progress & Kurva-S, Portal Klien realtime, serta PDF Quotation & laporan profesional." },
  { q: "Bisa coba dulu tanpa daftar?", a: "Bisa. Gunakan Akun Demo untuk menjelajahi semua fitur Premium dengan data contoh dalam mode baca-saja." },
  { q: "Apakah data saya aman?", a: "Data Anda tersimpan aman dan bisa dicadangkan kapan saja ke file ZIP, plus backup otomatis mingguan." },
];

const HERO_IMG = "https://images.unsplash.com/photo-1628744876497-eb30460be9f6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHw0fHxtb2Rlcm4lMjBpbnRlcmlvcnxlbnwwfHx8fDE3OTAxNDgxNzF8MA&ixlib=rb-4.1.0&q=85";
const IMG_BLUEPRINT = "https://images.pexels.com/photos/8470045/pexels-photo-8470045.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";
const IMG_BUDGET = "https://images.unsplash.com/photo-1664575602276-acd073f104c1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTJ8MHwxfHNlYXJjaHwzfHxidWRnZXQlMjBwbGFubmluZ3xlbnwwfHx8fDE3OTAxNDgxNzF8MA&ixlib=rb-4.1.0&q=85";
const GALLERY = [
  "https://images.unsplash.com/photo-1600210492493-0946911123ea?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwzfHxtb2Rlcm4lMjBpbnRlcmlvcnxlbnwwfHx8fDE3OTAxNDgxNzF8MA&ixlib=rb-4.1.0&q=85",
  "https://images.unsplash.com/photo-1593696140826-c58b021acf8b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwxfHxpbnRlcmlvciUyMGNvbnRyYWN0b3J8ZW58MHx8fHwxNzkwMTQ4MTcxfDA&ixlib=rb-4.1.0&q=85",
  "https://images.pexels.com/photos/8470035/pexels-photo-8470035.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
];

const fade = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export default function Landing() {
  const navigate = useNavigate();
  const { user, loginDemo } = useAuth();
  const [pricing, setPricing] = useState(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    let alive = true;
    api.get("/settings/public").then((r) => { if (alive) setPricing(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const promoEnds = pricing?.promoEndsAt ? Date.parse(pricing.promoEndsAt) : null;
  const serverNow = pricing?.serverNow ? Date.parse(pricing.serverNow) : Date.now();
  const promoLive = !!pricing?.promoActive && (!promoEnds || serverNow < promoEnds);
  const mBase = pricing?.monthlyPrice ?? 149000;
  const mPromo = pricing?.monthlyPromo ?? mBase;
  const monthlyEff = promoLive && mPromo > 0 && mPromo < mBase ? mPromo : mBase;
  const yBase = pricing?.yearlyPrice ?? 1290000;
  const yPromo = pricing?.yearlyPromo ?? yBase;
  const yearlyEff = promoLive && yPromo > 0 && yPromo < yBase ? yPromo : yBase;
  const promoPct = promoLive && mBase > 0 && mPromo < mBase ? Math.round((1 - mPromo / mBase) * 100) : 0;

  const announcement = (pricing?.announcement || "").trim();
  const annTheme = pricing?.announcementTheme || "info";
  const bannerText = announcement
    || (promoLive ? `Promo Premium: hemat ${promoPct > 0 ? promoPct + "% — " : ""}mulai ${rupiah(monthlyEff)}/bulan` : "");
  const bannerIsPromo = !announcement && promoLive ? true : annTheme === "promo";
  let promoCountdown = "";
  if (promoLive && promoEnds) {
    const ms = Math.max(0, promoEnds - Date.now());
    const days = Math.floor(ms / 86400000);
    const hrs = Math.floor((ms % 86400000) / 3600000);
    promoCountdown = days > 0 ? `${days} hari ${hrs} jam lagi` : `${hrs} jam lagi`;
  }

  const goRegister = () => navigate("/login");
  const tryDemo = async () => {
    setDemoBusy(true);
    try {
      await loginDemo();
      toast.success("Masuk sebagai Akun Demo");
      navigate("/dashboard", { replace: true });
    } catch {
      toast.error("Gagal masuk mode demo");
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Announcement / promo bar */}
      {bannerText && (
        <div data-testid="landing-banner" className={`w-full text-center text-[13px] font-semibold px-4 py-2 ${bannerIsPromo ? "bg-amber-600 text-white" : annTheme === "warning" ? "bg-red-600 text-white" : "bg-blue-600 text-white"}`}>
          <span className="inline-flex items-center gap-2 flex-wrap justify-center">
            {bannerIsPromo ? <Megaphone className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {bannerText}
            {promoCountdown && <span className="inline-flex items-center gap-1 opacity-90"><Timer className="w-3.5 h-3.5" /> Berakhir {promoCountdown}</span>}
          </span>
        </div>
      )}

      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-md shadow-amber-500/20">
              <Ruler className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display font-extrabold leading-none">ProFinance</div>
              <div className="text-[10px] tracking-[0.3em] text-amber-600 font-semibold">INTERIOR</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm text-slate-600">
            <a href="#fitur" className="hover:text-slate-900">Fitur</a>
            <a href="#cara" className="hover:text-slate-900">Cara Kerja</a>
            <a href="#harga" className="hover:text-slate-900">Harga</a>
            <a href="#faq" className="hover:text-slate-900">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Button data-testid="nav-dashboard-btn" onClick={() => navigate("/dashboard")} className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5 h-9">
                Buka Dashboard <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate("/login")} className="hidden sm:inline-flex h-9 text-slate-700">Masuk</Button>
                <Button data-testid="nav-register-btn" onClick={goRegister} className="bg-amber-600 hover:bg-amber-700 text-white h-9">Daftar Gratis</Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pf-blueprint text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-slate-900/40 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-2 gap-10 items-center">
          <motion.div initial="hidden" animate="show" variants={fade}>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 mb-5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-semibold tracking-[0.15em] text-amber-300">APLIKASI KONTRAKTOR INTERIOR</span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold leading-[1.1] tracking-tight">
              Kelola keuangan & progres proyek interior{" "}
              <span className="text-amber-400">tanpa ribet.</span>
            </h1>
            <p className="mt-5 text-slate-300 text-lg leading-relaxed max-w-xl">
              Dari RAB, invoice, kasbon tukang, hingga Kurva-S dan portal klien — satu aplikasi
              untuk kontraktor interior & arsitektur agar proyek selalu untung dan penagihan tak pernah kelewat.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button data-testid="hero-register-btn" onClick={goRegister} className="bg-amber-600 hover:bg-amber-700 text-white h-12 px-6 text-base gap-2">
                Mulai Gratis Sekarang <ArrowRight className="w-4.5 h-4.5" />
              </Button>
              <Button data-testid="hero-demo-btn" onClick={tryDemo} disabled={demoBusy} variant="outline" className="h-12 px-6 text-base gap-2 border-white/30 bg-white/5 text-white hover:bg-white hover:text-slate-900">
                <PlayCircle className="w-5 h-5" /> {demoBusy ? "Membuka..." : "Coba Akun Demo"}
              </Button>
            </div>
            <div className="mt-6 flex items-center gap-4 text-sm text-slate-400 flex-wrap">
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-amber-400" /> Gratis selamanya</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-amber-400" /> Tanpa kartu kredit</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-amber-400" /> Proyek tanpa batas</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="relative">
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/10">
              <img src={HERO_IMG} alt="Interior modern" className="w-full h-[340px] sm:h-[420px] object-cover" />
            </div>
            <div className="absolute -bottom-5 -left-4 sm:left-6 bg-white text-slate-900 rounded-xl shadow-xl p-4 w-56">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1"><TrendingUp className="w-4 h-4 text-emerald-600" /> Rekap Penagihan</div>
              <div className="font-mono font-extrabold text-2xl">{rupiah(32300000)}</div>
              <div className="text-[11px] text-emerald-600 font-medium">Tertagih · 2 invoice terkirim</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust band */}
      <section className="border-b border-slate-100 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { v: "8+", l: "Modul terintegrasi" },
            { v: "RAB → Invoice", l: "Alur kerja lengkap" },
            { v: "Kurva-S", l: "Progres cost-loaded" },
            { v: "PDF & Excel", l: "Laporan profesional" },
          ].map((s, i) => (
            <div key={i}>
              <div className="font-display font-extrabold text-xl sm:text-2xl text-slate-900">{s.v}</div>
              <div className="text-xs text-slate-500 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="fitur" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-[11px] font-bold tracking-[0.2em] text-amber-600">FITUR UNGGULAN</span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-2 tracking-tight">Semua yang kontraktor interior butuhkan</h2>
          <p className="text-slate-500 mt-3">Berhenti pakai banyak spreadsheet. Kelola seluruh proyek dari satu tempat.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {FEATURES.map((f, i) => (
            <motion.div key={i} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} variants={fade}
              className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-amber-700" />
              </div>
              <h3 className="font-display font-bold text-slate-900">{f.title}</h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Highlight: RAB + Finance split */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fade}>
            <img src={IMG_BLUEPRINT} alt="Kontraktor membahas rencana" className="rounded-2xl shadow-xl w-full h-[320px] object-cover" />
          </motion.div>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fade}>
            <span className="text-[11px] font-bold tracking-[0.2em] text-amber-600">RAB & PENAGIHAN</span>
            <h2 className="font-display text-3xl font-extrabold mt-2 tracking-tight">Dari penawaran hingga pelunasan, tercatat rapi</h2>
            <ul className="mt-6 space-y-3">
              {[
                "Susun RAB dengan material, PPN, diskon, dan termin pembayaran",
                "Ekspor Quotation & Invoice PDF berkop + tanda tangan",
                "Retensi otomatis dihitung dari nilai kontrak",
                "Rekap penagihan real-time dengan pengingat jatuh tempo",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5"><Check className="w-3 h-3 text-amber-700" /></span>
                  <span className="text-slate-700">{t}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="cara" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-[11px] font-bold tracking-[0.2em] text-amber-600">CARA KERJA</span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-2 tracking-tight">Mulai dalam 3 langkah</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {STEPS.map((s, i) => (
            <div key={i} className="relative rounded-2xl border border-slate-200 bg-white p-6">
              <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-display font-bold flex items-center justify-center">{s.n}</div>
              <h3 className="font-display font-bold text-lg mt-4">{s.title}</h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{s.desc}</p>
              {i < STEPS.length - 1 && <ChevronRight className="hidden md:block absolute top-1/2 -right-4 w-6 h-6 text-slate-300" />}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 mt-10">
          {GALLERY.map((g, i) => (
            <img key={i} src={g} alt="Interior" className="rounded-xl h-28 sm:h-44 w-full object-cover" />
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="harga" className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-[11px] font-bold tracking-[0.2em] text-amber-600">HARGA</span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-2 tracking-tight">Mulai gratis, upgrade saat siap</h2>
            <p className="text-slate-500 mt-3">Tanpa biaya tersembunyi. Batalkan kapan saja.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mt-12">
            {/* Free */}
            <div className="rounded-2xl border border-slate-200 bg-white p-7">
              <div className="flex items-center gap-2 mb-1"><Sparkles className="w-5 h-5 text-slate-400" /><h3 className="font-display font-bold text-xl">Free</h3></div>
              <div className="mt-4 mb-5"><span className="font-mono font-extrabold text-4xl">Rp 0</span><span className="text-slate-500">/selamanya</span></div>
              <ul className="space-y-2.5 text-sm">
                {["Proyek tanpa batas", "Cash Flow (masuk/keluar)", "Kasbon & Pelunasan Tukang", "Indikator kesehatan finansial", "Upload foto nota"].map((f, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-slate-600"><Check className="w-4 h-4 text-slate-400 shrink-0" /> {f}</li>
                ))}
              </ul>
              <Button onClick={goRegister} variant="outline" className="w-full mt-6 h-11">Daftar Gratis</Button>
            </div>
            {/* Premium */}
            <div className="relative rounded-2xl border-2 border-amber-400 bg-white p-7 shadow-xl shadow-amber-500/10">
              <div className="absolute -top-3 left-7 bg-amber-600 text-white text-[11px] font-bold px-3 py-1 rounded-full">PALING POPULER</div>
              <div className="flex items-center gap-2 mb-1"><Crown className="w-5 h-5 text-amber-600" /><h3 className="font-display font-bold text-xl">Premium Pro</h3></div>
              <div className="mt-4 mb-5">
                {monthlyEff < mBase && <span className="font-mono text-lg text-slate-400 line-through mr-2">{rupiah(mBase)}</span>}
                <span className="font-mono font-extrabold text-4xl">{rupiah(monthlyEff)}</span>
                <span className="text-slate-500">/bulan</span>
                <div className="text-xs text-slate-500 mt-1">atau {rupiah(yearlyEff)} / tahun</div>
              </div>
              <ul className="space-y-2.5 text-sm">
                {["Semua fitur Free", "RAB & PDF Quotation", "Invoice & Proforma + WhatsApp", "Rekap Penagihan & Ekspor Excel", "Progress & Kurva-S", "Portal Klien realtime", "Laporan PDF profesional"].map((f, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-slate-700"><Check className="w-4 h-4 text-amber-600 shrink-0" /> {f}</li>
                ))}
              </ul>
              <Button data-testid="pricing-register-btn" onClick={goRegister} className="w-full mt-6 h-11 bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                <Crown className="w-4 h-4" /> Mulai & Upgrade
              </Button>
              <p className="text-[11px] text-slate-400 text-center mt-2">Daftar Free dulu, upgrade dari menu Akun kapan saja.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-1 mb-2">
            {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Dipercaya para kontraktor</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6">
              <Quote className="w-6 h-6 text-amber-400 mb-3" />
              <p className="text-slate-700 leading-relaxed">{`\u201c${t.q}\u201d`}</p>
              <div className="mt-4 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">
                  {t.n.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                </div>
                <div className="text-sm"><b>{t.n}</b><div className="text-xs text-slate-500">{t.r}</div></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-center">Pertanyaan umum</h2>
          <div className="mt-10 space-y-3">
            {FAQ.map((item, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button data-testid={`faq-${i}`} onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
                  <span className="font-semibold text-slate-800">{item.q}</span>
                  <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === i ? "rotate-90" : ""}`} />
                </button>
                {openFaq === i && <div className="px-5 pb-4 text-sm text-slate-500 leading-relaxed">{item.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden pf-blueprint text-white">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 to-slate-900/40" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <img src={IMG_BUDGET} alt="" className="hidden" />
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Siap bikin proyek interior Anda lebih untung?</h2>
          <p className="text-slate-300 mt-3 max-w-xl mx-auto">Gabung sekarang dan kelola keuangan, RAB, invoice, hingga progres proyek dalam satu aplikasi.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button data-testid="cta-register-btn" onClick={goRegister} className="bg-amber-600 hover:bg-amber-700 text-white h-12 px-7 text-base gap-2">
              Daftar Gratis <ArrowRight className="w-5 h-5" />
            </Button>
            <Button data-testid="cta-demo-btn" onClick={tryDemo} disabled={demoBusy} variant="outline" className="h-12 px-7 text-base gap-2 border-white/30 bg-white/5 text-white hover:bg-white hover:text-slate-900">
              <PlayCircle className="w-5 h-5" /> Coba Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
              <Ruler className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="text-white font-display font-bold">ProFinance Interior</div>
          </div>
          <div className="text-xs">© 2026 ProFinance Interior · SaaS untuk Kontraktor Interior & Arsitektur</div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs">Data aman & bisa dibackup</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
