import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ruler, Loader2, TrendingUp, Wallet, HardHat } from "lucide-react";
import { toast } from "sonner";
import { rupiah } from "@/lib/format";

export default function Login() {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, name, password);
      }
      toast.success("Berhasil masuk");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal, coba lagi");
    } finally {
      setBusy(false);
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
          <p className="mt-4 text-slate-300 max-w-md">
            Catat cash flow, atur kasbon tukang, pantau kurva-S, dan cetak laporan PDF —
            khusus untuk kontraktor interior & arsitektur.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
            {[
              { icon: Wallet, label: "Saldo Bersih", val: rupiah(184000000) },
              { icon: TrendingUp, label: "Margin", val: "23.4%" },
              { icon: HardHat, label: "Tukang Aktif", val: "8 org" },
            ].map((k, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4">
                <k.icon className="w-4 h-4 text-amber-400" />
                <div className="mt-2 font-mono font-bold text-sm">{k.val}</div>
                <div className="text-[11px] text-slate-400">{k.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-500 relative z-10">© 2026 ProFinance Interior · SaaS untuk Kontraktor</div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-slate-50">
        <div className="w-full max-w-sm pf-rise">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
              <Ruler className="w-5 h-5 text-white" />
            </div>
            <div className="font-display font-extrabold text-slate-900">ProFinance Interior</div>
          </div>

          <h2 className="font-display text-2xl font-bold text-slate-900">
            {mode === "login" ? "Masuk ke akun Anda" : "Buat akun baru"}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {mode === "login" ? "Selamat datang kembali!" : "Gratis selamanya, upgrade kapan saja."}
          </p>

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
            <div>
              <Label className="text-slate-700">Password</Label>
              <Input data-testid="login-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter" required className="mt-1 h-11 bg-white" />
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
        </div>
      </div>
    </div>
  );
}
