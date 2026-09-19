import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Check, Crown, Sparkles, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const FREE = ["Proyek tanpa batas", "Cash Flow (transaksi masuk/keluar)", "Manajemen Kasbon & Pelunasan Tukang", "Indikator kesehatan finansial", "Upload foto nota"];
const PREMIUM = ["Semua fitur Free", "Progress Pekerjaan & Kurva-S", "Impor RAB dari Excel", "Portal Klien realtime + WhatsApp", "Baseline vs Revisi RAB", "Export Laporan PDF profesional", "Prioritas dukungan"];

function loadSnap(clientKey, production) {
  return new Promise((resolve, reject) => {
    if (window.snap) return resolve();
    const existing = document.getElementById("midtrans-snap");
    if (existing) existing.remove();
    const sc = document.createElement("script");
    sc.id = "midtrans-snap";
    sc.src = production ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";
    sc.async = true;
    sc.setAttribute("data-client-key", clientKey);
    sc.onload = () => resolve();
    sc.onerror = () => reject(new Error("snap load failed"));
    document.head.appendChild(sc);
  });
}

export default function Pricing() {
  const navigate = useNavigate();
  const { isPremium, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);

  const pollOrder = async (orderId) => {
    for (let i = 0; i < 12; i++) {
      try {
        const { data } = await api.get(`/subscription/order/${orderId}`);
        if (data.status === "paid") return true;
        if (["deny", "cancel", "expire", "create_failed"].includes(data.status)) return false;
      } catch { /* keep polling */ }
      await new Promise((r) => setTimeout(r, 2500));
    }
    return null;
  };

  const onPaid = async () => {
    await refreshUser();
    toast.success("Pembayaran berhasil! Premium aktif 🎉");
    setTimeout(() => navigate("/dashboard"), 900);
  };

  const settle = async (orderId) => {
    const ok = await pollOrder(orderId);
    if (ok) { await onPaid(); }
    else {
      toast.info("Menunggu konfirmasi pembayaran. Premium aktif otomatis setelah dikonfirmasi.");
      setBusy(false);
    }
  };

  const upgrade = async (plan) => {
    setBusy(true);
    try {
      const { data } = await api.post("/subscription/checkout", { plan });
      await loadSnap(data.client_key, data.production);
      if (!window.snap) {
        if (data.redirect_url) window.location.assign(data.redirect_url);
        return;
      }
      window.snap.pay(data.token, {
        onSuccess: () => settle(data.order_id),
        onPending: () => {
          toast.info("Pembayaran diproses. Selesaikan pembayaran QRIS/GoPay/VA Anda.");
          settle(data.order_id);
        },
        onError: () => { toast.error("Pembayaran gagal"); setBusy(false); },
        onClose: () => { setBusy(false); },
      });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memproses pembayaran");
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
                  <Button data-testid="btn-upgrade-premium" onClick={() => upgrade("monthly")} disabled={busy} className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />} Bayar Bulanan · Rp 149.000
                  </Button>
                  <Button data-testid="btn-upgrade-yearly" variant="outline" onClick={() => upgrade("yearly")} disabled={busy} className="w-full border-amber-300 text-amber-700 hover:bg-amber-50">
                    Bayar Tahunan · Rp 1.290.000 (Hemat)
                  </Button>
                  <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Pembayaran aman via Midtrans — QRIS, GoPay & VA Bank
                  </p>
                </div>
              )}
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
