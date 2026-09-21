import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Settings, Loader2, ShieldCheck, Save, Tag } from "lucide-react";
import { rupiah } from "@/lib/format";
import { toast } from "sonner";

function priceHint(base, promo, promoActive) {
  const b = Number(base) || 0;
  const p = Number(promo) || 0;
  if (promoActive && p > 0 && p < b) {
    const disc = Math.round((1 - p / b) * 100);
    return `Aktif: pelanggan bayar ${rupiah(p)} (dari ${rupiah(b)}, hemat ${disc}%).`;
  }
  return `Pelanggan bayar ${rupiah(b)} (harga normal).`;
}

export default function AdminSettings() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAdmin === false) {
      navigate("/dashboard", { replace: true });
      return;
    }
    (async () => {
      try {
        const { data } = await api.get("/admin/settings");
        setForm(data);
      } catch {
        toast.error("Gagal memuat pengaturan");
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin, navigate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setNum = (k, v) => setForm((f) => ({ ...f, [k]: Math.max(0, Math.round(Number(v) || 0)) }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/admin/settings", form);
      setForm(data);
      toast.success("Pengaturan tersimpan");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pf-grain">
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8" data-testid="admin-settings-page">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
        </button>

        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center"><Settings className="w-5 h-5 text-amber-400" /></div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Pengaturan Admin</h1>
        </div>
        <p className="text-sm text-slate-500 mb-6 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-green-600" /> Halaman khusus admin untuk konfigurasi web.</p>

        {loading || !form ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
        ) : (
          <div className="space-y-5">
            <Card className="p-6 border-slate-200 bg-white space-y-4">
              <h3 className="font-display font-bold text-slate-900">Identitas & Kontak</h3>
              <div>
                <Label className="text-slate-700">Nama Aplikasi</Label>
                <Input data-testid="setting-appname" value={form.appName || ""} onChange={(e) => set("appName", e.target.value)} className="mt-1 h-11 bg-white" placeholder="ProFinance Interior" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-700">Email Dukungan</Label>
                  <Input data-testid="setting-email" type="email" value={form.supportEmail || ""} onChange={(e) => set("supportEmail", e.target.value)} className="mt-1 h-11 bg-white" placeholder="support@email.com" />
                </div>
                <div>
                  <Label className="text-slate-700">WhatsApp Dukungan</Label>
                  <Input data-testid="setting-whatsapp" inputMode="tel" value={form.supportWhatsapp || ""} onChange={(e) => set("supportWhatsapp", e.target.value)} className="mt-1 h-11 bg-white" placeholder="08xxxxxxxxxx" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-slate-200 bg-white space-y-4">
              <h3 className="font-display font-bold text-slate-900">Pengumuman & Mode</h3>
              <div>
                <Label className="text-slate-700">Banner Pengumuman</Label>
                <Textarea data-testid="setting-announcement" value={form.announcement || ""} onChange={(e) => set("announcement", e.target.value)} className="mt-1 bg-white" rows={2} placeholder="Contoh: Promo tahunan diskon 28% hingga akhir bulan!" />
                <p className="text-[11px] text-slate-400 mt-1">Tampil sebagai banner pengumuman di bagian atas semua halaman pengguna (Dashboard, Akun, Harga, dll). Kosongkan untuk menyembunyikan.</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-800">Mode Pemeliharaan</div>
                  <div className="text-[11px] text-slate-400">Nonaktifkan sementara untuk perawatan.</div>
                </div>
                <Switch data-testid="setting-maintenance" checked={!!form.maintenanceMode} onCheckedChange={(v) => set("maintenanceMode", v)} />
              </div>
            </Card>

            <Card className="p-6 border-slate-200 bg-white space-y-4">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-600" />
                <h3 className="font-display font-bold text-slate-900">Harga & Promo</h3>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-800">Aktifkan Harga Promo</div>
                  <div className="text-[11px] text-slate-500">Bila aktif, harga promo (jika lebih rendah) dipakai di halaman Harga & pembayaran.</div>
                </div>
                <Switch data-testid="setting-promo-active" checked={!!form.promoActive} onCheckedChange={(v) => set("promoActive", v)} />
              </div>

              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="text-sm font-semibold text-slate-800">Paket Bulanan (30 hari)</div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700">Harga Normal (Rp)</Label>
                    <Input data-testid="setting-monthly-price" type="number" min="0" value={form.monthlyPrice ?? 0} onChange={(e) => setNum("monthlyPrice", e.target.value)} className="mt-1 h-11 bg-white font-mono" />
                  </div>
                  <div>
                    <Label className="text-slate-700">Harga Promo (Rp)</Label>
                    <Input data-testid="setting-monthly-promo" type="number" min="0" value={form.monthlyPromo ?? 0} onChange={(e) => setNum("monthlyPromo", e.target.value)} className="mt-1 h-11 bg-white font-mono" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">{priceHint(form.monthlyPrice, form.monthlyPromo, form.promoActive)}</p>
              </div>

              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="text-sm font-semibold text-slate-800">Paket Tahunan (365 hari)</div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700">Harga Normal (Rp)</Label>
                    <Input data-testid="setting-yearly-price" type="number" min="0" value={form.yearlyPrice ?? 0} onChange={(e) => setNum("yearlyPrice", e.target.value)} className="mt-1 h-11 bg-white font-mono" />
                  </div>
                  <div>
                    <Label className="text-slate-700">Harga Promo (Rp)</Label>
                    <Input data-testid="setting-yearly-promo" type="number" min="0" value={form.yearlyPromo ?? 0} onChange={(e) => setNum("yearlyPromo", e.target.value)} className="mt-1 h-11 bg-white font-mono" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">{priceHint(form.yearlyPrice, form.yearlyPromo, form.promoActive)}</p>
              </div>
            </Card>

            <Button data-testid="setting-save-btn" onClick={save} disabled={saving} className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Pengaturan
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
