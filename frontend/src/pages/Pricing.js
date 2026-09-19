import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Check, Crown, Sparkles, ArrowLeft, Loader2, QrCode, Building, Wallet } from "lucide-react";
import { toast } from "sonner";

const FREE = ["Proyek tanpa batas", "Cash Flow (transaksi masuk/keluar)", "Manajemen Kasbon & Pelunasan Tukang", "Indikator kesehatan finansial", "Upload foto nota"];
const PREMIUM = ["Semua fitur Free", "Progress Pekerjaan & Kurva-S", "Upload dokumentasi foto harian", "Laporan visual (Pie & Bar Chart)", "Export Laporan PDF profesional", "Prioritas dukungan"];

export default function Pricing() {
  const navigate = useNavigate();
  const { isPremium, refreshUser } = useAuth();
  const [payOpen, setPayOpen] = useState(false);
  const [plan, setPlan] = useState("monthly");
  const [method, setMethod] = useState("qris");
  const [busy, setBusy] = useState(false);

  const openPay = (p) => { setPlan(p); setPayOpen(true); };

  const pay = async () => {
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      await api.post("/subscription/upgrade", { plan });
      await refreshUser();
      toast.success("Pembayaran berhasil! Premium aktif 🎉");
      setPayOpen(false);
      setTimeout(() => navigate("/dashboard"), 600);
    } catch {
      toast.error("Gagal memproses pembayaran");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pf-grain">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
        </button>

        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold mb-3">
            <Crown className="w-3.5 h-3.5" /> Upgrade
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Pilih paket yang tepat</h1>
          <p className="text-slate-500 mt-2 max-w-lg mx-auto">Mulai gratis, upgrade ke Premium untuk membuka tracking progress & laporan PDF profesional.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <Card className="p-7 border-slate-200 bg-white">
            <div className="flex items-center gap-2 mb-1"><Sparkles className="w-5 h-5 text-slate-400" /><h3 className="font-display font-bold text-xl">Free</h3></div>
            <p className="text-slate-500 text-sm">Untuk memulai mengelola proyek.</p>
            <div className="mt-5 mb-6"><span className="font-mono font-extrabold text-4xl text-slate-900">Rp 0</span><span className="text-slate-500">/selamanya</span></div>
            <ul className="space-y-3 mb-6">
              {FREE.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700"><Check className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />{f}</li>
              ))}
            </ul>
            <Button variant="outline" className="w-full" disabled>{isPremium ? "Paket dasar" : "Paket Anda saat ini"}</Button>
          </Card>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-7 border-2 border-amber-500 bg-white relative shadow-lg shadow-amber-500/10 overflow-hidden">
              <div className="absolute top-0 right-0 bg-amber-500 text-white text-[11px] font-bold px-3 py-1 rounded-bl-lg">POPULER</div>
              <div className="flex items-center gap-2 mb-1"><Crown className="w-5 h-5 text-amber-600" /><h3 className="font-display font-bold text-xl">Premium Pro</h3></div>
              <p className="text-slate-500 text-sm">Kontrol penuh proyek & laporan.</p>
              <div className="mt-5 mb-1"><span className="font-mono font-extrabold text-4xl text-slate-900">Rp 149.000</span><span className="text-slate-500">/bulan</span></div>
              <p className="text-xs text-slate-400 mb-5">atau Rp 1.290.000 / tahun (hemat 28%)</p>
              <ul className="space-y-3 mb-6">
                {PREMIUM.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700"><Check className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />{f}</li>
                ))}
              </ul>
              {isPremium ? (
                <Button className="w-full bg-green-600 hover:bg-green-600 text-white gap-2" disabled><Crown className="w-4 h-4" /> Premium Aktif</Button>
              ) : (
                <div className="space-y-2">
                  <Button data-testid="btn-upgrade-premium" onClick={() => openPay("monthly")} className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2"><Crown className="w-4 h-4" /> Upgrade Bulanan</Button>
                  <Button data-testid="btn-upgrade-yearly" variant="outline" onClick={() => openPay("yearly")} className="w-full border-amber-300 text-amber-700 hover:bg-amber-50">Upgrade Tahunan (Hemat)</Button>
                </div>
              )}
            </Card>
          </motion.div>
        </div>
      </main>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader><DialogTitle className="font-display text-xl">Pembayaran (Simulasi)</DialogTitle></DialogHeader>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center justify-between">
            <span className="text-sm text-slate-600">{plan === "yearly" ? "Premium Tahunan" : "Premium Bulanan"}</span>
            <span className="font-mono font-bold text-lg">{plan === "yearly" ? "Rp 1.290.000" : "Rp 149.000"}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[{ k: "qris", l: "QRIS", i: QrCode }, { k: "bank", l: "Transfer", i: Building }, { k: "ewallet", l: "E-Wallet", i: Wallet }].map((m) => (
              <button key={m.k} data-testid={`pay-method-${m.k}`} onClick={() => setMethod(m.k)}
                className={`p-3 rounded-lg border text-center transition-colors ${method === m.k ? "border-amber-500 bg-amber-50" : "border-slate-200 hover:border-slate-300"}`}>
                <m.i className={`w-5 h-5 mx-auto mb-1 ${method === m.k ? "text-amber-600" : "text-slate-400"}`} />
                <span className="text-xs font-medium text-slate-700">{m.l}</span>
              </button>
            ))}
          </div>
          {method === "qris" && (
            <div className="flex flex-col items-center py-3">
              <div className="w-40 h-40 bg-white border-2 border-slate-200 rounded-xl flex items-center justify-center"><QrCode className="w-24 h-24 text-slate-800" /></div>
              <p className="text-xs text-slate-400 mt-2">Scan untuk membayar (demo)</p>
            </div>
          )}
          {method === "bank" && <p className="text-sm text-slate-600 py-3 text-center">Transfer ke <b>BCA 1234567890</b> a.n. ProFinance Interior</p>}
          {method === "ewallet" && <p className="text-sm text-slate-600 py-3 text-center">Bayar via OVO / GoPay ke <b>0812-3456-7890</b></p>}
          <Button data-testid="btn-confirm-payment" onClick={pay} disabled={busy} className="w-full bg-amber-600 hover:bg-amber-700 text-white">
            {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Memproses…</> : "Konfirmasi Pembayaran"}
          </Button>
          <p className="text-[11px] text-slate-400 text-center">*Ini simulasi pembayaran (mockup). Tidak ada transaksi nyata.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
