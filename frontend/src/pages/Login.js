import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ruler, Loader2, Check, Sparkles, PlayCircle, Eye, EyeOff, Phone, Mail, Lock, Crown, Megaphone, Timer, Quote } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login, loginDemo, register, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [resetPhone, setResetPhone] = useState("");
  const [resetNew, setResetNew] = useState("");
  const [showResetNew, setShowResetNew] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [pricing, setPricing] = useState(null);

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    let alive = true;
    api.get("/settings/public").then((r) => { if (alive) setPricing(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Effective monthly premium price (respects admin promo settings)
  const promoEnds = pricing?.promoEndsAt ? Date.parse(pricing.promoEndsAt) : null;
  const serverNow = pricing?.serverNow ? Date.parse(pricing.serverNow) : Date.now();
  const promoLive = !!pricing?.promoActive && (!promoEnds || serverNow < promoEnds);
  const mBase = pricing?.monthlyPrice ?? 149000;
  const mPromo = pricing?.monthlyPromo ?? mBase;
  const monthlyEff = promoLive && mPromo > 0 && mPromo < mBase ? mPromo : mBase;

  // Dynamic banner from admin settings (announcement and/or live promo)
  const announcement = (pricing?.announcement || "").trim();
  const annTheme = pricing?.announcementTheme || "info";
  const promoPct = promoLive && mBase > 0 && mPromo < mBase ? Math.round((1 - mPromo / mBase) * 100) : 0;
  const bannerText = announcement
    || (promoLive ? `Promo Premium: hemat ${promoPct > 0 ? promoPct + "% — " : ""}mulai ${rupiah(monthlyEff)}/bulan` : "");
  const bannerIsPromo = !announcement && promoLive ? true : annTheme === "promo";
  const bannerStyle = bannerIsPromo
    ? "border-amber-300 bg-amber-50 text-amber-800"
    : annTheme === "warning"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-blue-200 bg-blue-50 text-blue-700";
  let promoCountdown = "";
  if (promoLive && promoEnds) {
    const ms = Math.max(0, promoEnds - Date.now());
    const days = Math.floor(ms / 86400000);
    const hrs = Math.floor((ms % 86400000) / 3600000);
    promoCountdown = days > 0 ? `${days} hari ${hrs} jam lagi` : `${hrs} jam lagi`;
  }

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

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

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, name, password, phone);
      }
      toast.success("Berhasil masuk");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal, coba lagi");
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setResetBusy(true);
    try {
      const { api } = await import("@/lib/api");
      const res = await api.post("/auth/reset-password", { email, phone: resetPhone, newPassword: resetNew });
      toast.success(res.data?.message || "Password diperbarui");
      setMode("login");
      setPassword("");
      setResetNew("");
      setResetPhone("");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal memperbarui password");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Showcase */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 pf-blueprint text-white overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Ruler className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-display font-extrabold text-lg">ProFinance</div>
            <div className="text-[11px] tracking-[0.3em] text-amber-400 font-semibold -mt-1">INTERIOR</div>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight">
            Kelola keuangan &<br />progress proyek interior<br />
            <span className="text-amber-400">tanpa ribet.</span>
          </h1>
          <p className="mt-4 text-slate-300 max-w-md leading-relaxed">
            Satu aplikasi untuk cash flow, kasbon tukang, progress kurva-S,
            hingga laporan PDF — dirancang khusus kontraktor interior & arsitektur.
          </p>

          <div className="mt-8 max-w-md">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 mb-5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-semibold tracking-[0.15em] text-amber-300">FITUR TERBARU</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {[
                "RAB Builder & PDF Quotation profesional",
                "Invoice & Proforma + kirim WhatsApp",
                "Rekap Penagihan: tertagih vs terbayar vs retensi",
                "Ekspor Rekap & RAB ke Excel",
                "Portal Klien realtime + share WhatsApp",
                "Impor RAB langsung dari Excel",
                "Kurva-S cost-loaded & Time Schedule",
                "Backup data proyek (ZIP + Excel)",
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-slate-200">
                  <span className="w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-amber-400" />
                  </span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Testimoni klien */}
          <div className="mt-9 max-w-md grid gap-3">
            {[
              { q: "RAB sampai invoice & progress klien jadi satu tempat. Penagihan nggak pernah kelewat lagi.", n: "Andika P.", r: "Kontraktor Interior, Bali" },
              { q: "Kurva-S dan laporan PDF-nya bikin klien makin percaya. Terlihat jauh lebih profesional.", n: "Rina S.", r: "Studio Arsitektur, Bandung" },
              { q: "Kasbon tukang & cash flow real-time. Untung-rugi tiap proyek langsung kelihatan.", n: "Budi H.", r: "Kontraktor Furniture, Surabaya" },
            ].map((t, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 backdrop-blur px-4 py-3">
                <Quote className="w-4 h-4 text-amber-400 mb-1.5" />
                <p className="text-sm text-slate-200 leading-relaxed">{`\u201c${t.q}\u201d`}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] font-bold text-amber-300 shrink-0">
                    {t.n.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </div>
                  <div className="text-[11px] text-slate-400"><b className="text-slate-200">{t.n}</b> · {t.r}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-500 relative z-10">© 2026 ProFinance Interior · SaaS untuk Kontraktor</div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-slate-50">
        <div className="w-full max-w-sm pf-rise">
          {bannerText && (
            <div data-testid="login-dynamic-banner" className={`mb-5 rounded-xl border px-3.5 py-2.5 flex items-start gap-2.5 ${bannerStyle}`}>
              {bannerIsPromo ? <Megaphone className="w-4 h-4 mt-0.5 shrink-0" /> : <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />}
              <div className="min-w-0">
                <p className="text-[12px] font-semibold leading-snug">{bannerText}</p>
                {promoCountdown && (
                  <p className="text-[11px] mt-0.5 flex items-center gap-1 opacity-80">
                    <Timer className="w-3 h-3" /> Berakhir {promoCountdown}
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
              <Ruler className="w-5 h-5 text-white" />
            </div>
            <div className="font-display font-extrabold text-slate-900">ProFinance Interior</div>
          </div>

          <h2 className="font-display text-2xl font-bold text-slate-900">
            {mode === "login" ? "Masuk ke akun Anda" : mode === "register" ? "Buat akun baru" : "Atur ulang password"}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {mode === "login" ? "Selamat datang kembali!" : mode === "register" ? "Gratis selamanya, upgrade kapan saja." : "Verifikasi identitas Anda dengan nomor telepon yang terdaftar."}
          </p>

          {mode === "reset" ? (
            <form onSubmit={submitReset} className="mt-6 space-y-3.5" data-testid="reset-form">
              <div>
                <Label className="text-slate-700">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input data-testid="reset-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com" required className="h-11 bg-white pl-10" />
                </div>
              </div>
              <div>
                <Label className="text-slate-700">Nomor Telepon (saat daftar)</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input data-testid="reset-phone-input" inputMode="tel" value={resetPhone} onChange={(e) => setResetPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx" required className="h-11 bg-white pl-10" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Kami memakai nomor ini untuk memastikan Anda pemilik akun.</p>
              </div>
              <div>
                <Label className="text-slate-700">Password Baru</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input data-testid="reset-newpassword-input" type={showResetNew ? "text" : "password"} value={resetNew} onChange={(e) => setResetNew(e.target.value)}
                    placeholder="Minimal 6 karakter" required className="h-11 bg-white pl-10 pr-11" />
                  <button type="button" data-testid="reset-toggle-password" onClick={() => setShowResetNew((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="tampilkan password">
                    {showResetNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button data-testid="reset-submit-button" type="submit" disabled={resetBusy}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-semibold">
                {resetBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Perbarui Password"}
              </Button>
              <p className="text-sm text-slate-500 text-center">
                <button type="button" data-testid="reset-back-login" onClick={() => setMode("login")} className="text-amber-600 font-semibold hover:underline">
                  ← Kembali ke Masuk
                </button>
              </p>
            </form>
          ) : (
            <>
              <Button
                data-testid="login-google-button"
                onClick={googleLogin}
                variant="outline"
                className="w-full mt-6 gap-2 border-slate-300 bg-white hover:bg-slate-50 h-11"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
                Masuk dengan Google
              </Button>

              <div className="flex items-center gap-3 my-5">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">atau email</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <form onSubmit={submit} className="space-y-3.5">
                {mode === "register" && (
                  <div>
                    <Label className="text-slate-700">Nama Lengkap</Label>
                    <Input data-testid="register-name-input" value={name} onChange={(e) => setName(e.target.value)}
                      placeholder="Budi Kontraktor" required className="mt-1 h-11 bg-white" />
                  </div>
                )}
                <div>
                  <Label className="text-slate-700">Email</Label>
                  <Input data-testid="login-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com" required className="mt-1 h-11 bg-white" />
                </div>
                {mode === "register" && (
                  <div>
                    <Label className="text-slate-700">Nomor Telepon <span className="text-slate-400 font-normal">(opsional)</span></Label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input data-testid="register-phone-input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                        placeholder="08xxxxxxxxxx" className="h-11 bg-white pl-10" />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Membantu pemulihan akun jika Anda lupa email/password.</p>
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-700">Password</Label>
                    {mode === "login" && (
                      <button type="button" data-testid="forgot-password-link" onClick={() => setMode("reset")}
                        className="text-xs text-amber-600 font-medium hover:underline">
                        Lupa password?
                      </button>
                    )}
                  </div>
                  <div className="relative mt-1">
                    <Input data-testid="login-password-input" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 6 karakter" required className="h-11 bg-white pr-11" />
                    <button type="button" data-testid="toggle-password-visibility" onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="tampilkan password">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button data-testid="login-submit-button" type="submit" disabled={busy}
                  className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "login" ? "Masuk" : "Daftar Sekarang"}
                </Button>
              </form>

              <p className="text-sm text-slate-500 mt-5 text-center">
                {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
                <button data-testid="toggle-auth-mode" onClick={() => setMode(mode === "login" ? "register" : "login")}
                  className="text-amber-600 font-semibold hover:underline">
                  {mode === "login" ? "Daftar" : "Masuk"}
                </button>
              </p>

              <div className="flex items-center gap-3 my-5">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">atau coba dulu</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <Button
                data-testid="login-demo-button"
                onClick={tryDemo}
                disabled={demoBusy}
                variant="outline"
                className="w-full h-11 gap-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
              >
                {demoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                Jelajahi Akun Demo
              </Button>
              <p className="text-[11px] text-slate-400 mt-2 text-center">
                Rasakan semua fitur Premium dengan data contoh — <b>mode baca-saja</b>, tanpa perlu daftar.
              </p>

              {/* Premium info untuk akun Free */}
              <div className="mt-6 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4" data-testid="premium-info-card">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <Crown className="w-4 h-4 text-amber-600" />
                  </span>
                  <div className="text-sm font-bold text-slate-900">Daftar Free dulu, upgrade kapan saja</div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  <span className="font-semibold text-slate-700">Free:</span> proyek tanpa batas, cash flow, kasbon & pelunasan tukang, indikator kesehatan finansial, upload foto nota.
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1.5">
                  <span className="font-semibold text-amber-700">Premium{monthlyEff > 0 ? ` mulai ${rupiah(monthlyEff)}/bulan` : ""}:</span>{" "}
                  Invoice & Proforma (+ kirim WhatsApp), Rekap Penagihan & Ekspor Excel, Progress & Kurva-S, Portal Klien realtime, PDF Quotation & laporan profesional.
                </p>
                <p className="text-[10px] text-slate-400 mt-2">Setelah masuk: menu Akun → Paket &amp; Upgrade. Data Anda tetap aman saat upgrade.</p>
              </div>
            </>
          )}

          {/* Feature info for tablet & mobile (desktop has the showcase panel) */}
          <div className="lg:hidden mt-8 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-50 px-3 py-1 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[11px] font-semibold tracking-[0.15em] text-amber-700">FITUR TERBARU</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5">
              {[
                "RAB Builder & PDF Quotation",
                "Invoice & Proforma + WhatsApp",
                "Rekap Penagihan & retensi",
                "Ekspor Rekap & RAB ke Excel",
                "Portal Klien realtime",
                "Impor RAB langsung dari Excel",
                "Kurva-S & Time Schedule",
                "Backup data (ZIP + Excel)",
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-slate-600">
                  <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-amber-600" />
                  </span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
