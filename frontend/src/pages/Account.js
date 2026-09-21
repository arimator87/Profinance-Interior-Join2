import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { rupiah, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import {
  ArrowLeft, Crown, Sparkles, Receipt, Loader2, BellRing, Clock, CheckCircle2, XCircle,
  DatabaseBackup, Download, Image as ImageIcon, FolderArchive,
} from "lucide-react";

const STATUS = {
  paid: { label: "Lunas", cls: "bg-green-100 text-green-700", icon: CheckCircle2 },
  pending: { label: "Menunggu", cls: "bg-amber-100 text-amber-700", icon: Clock },
  expire: { label: "Kedaluwarsa", cls: "bg-slate-100 text-slate-500", icon: XCircle },
  cancel: { label: "Dibatalkan", cls: "bg-slate-100 text-slate-500", icon: XCircle },
  deny: { label: "Ditolak", cls: "bg-red-100 text-red-600", icon: XCircle },
  create_failed: { label: "Gagal", cls: "bg-red-100 text-red-600", icon: XCircle },
};

const PLAN_LABEL = { monthly: "Premium Bulanan", yearly: "Premium Tahunan" };

export default function Account() {
  const navigate = useNavigate();
  const { user, isPremium } = useAuth();
  const [orders, setOrders] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [backing, setBacking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [o, n, s] = await Promise.all([
          api.get("/subscription/orders"),
          api.get("/notifications"),
          api.get("/backup/summary"),
        ]);
        setOrders(o.data);
        setNotifs(n.data);
        setSummary(s.data);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  const downloadBackup = async () => {
    setBacking(true);
    const tid = toast.loading("Menyiapkan backup (termasuk foto)...");
    try {
      const res = await api.get("/backup/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.download = `profinance-backup-${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Backup berhasil diunduh ke perangkat", { id: tid });
    } catch {
      toast.error("Gagal membuat backup. Coba lagi.", { id: tid });
    } finally {
      setBacking(false);
    }
  };

  const expiry = user?.subscriptionExpiry ? new Date(user.subscriptionExpiry) : null;
  const daysLeft = expiry ? Math.ceil((expiry - new Date()) / 86400000) : null;

  return (
    <div className="min-h-screen bg-slate-50 pf-grain">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8" data-testid="account-page">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
        </button>

        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-6">Akun & Transaksi</h1>

        {/* Subscription status */}
        <Card className={`p-6 mb-6 border ${isPremium ? "border-amber-300 bg-gradient-to-br from-amber-50 to-white" : "border-slate-200 bg-white"}`} data-testid="subscription-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {isPremium ? <Crown className="w-5 h-5 text-amber-600" /> : <Sparkles className="w-5 h-5 text-slate-400" />}
                <h2 className="font-display font-bold text-lg">{isPremium ? "Premium Pro" : "Paket Free"}</h2>
              </div>
              <p className="text-sm text-slate-500">{user?.name} · {user?.email}</p>
              {isPremium && expiry && (
                <p className="text-sm mt-2" data-testid="subscription-expiry">
                  Masa aktif s/d <b className="text-slate-900">{fmtDate(user.subscriptionExpiry)}</b>
                  {daysLeft != null && (
                    <span className={`ml-2 font-mono text-xs px-2 py-0.5 rounded-full ${daysLeft <= 7 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                      {daysLeft < 0 ? "berakhir" : `${daysLeft} hari lagi`}
                    </span>
                  )}
                </p>
              )}
            </div>
            {(!isPremium || (daysLeft != null && daysLeft <= 14)) && (
              <Button data-testid="account-renew-btn" onClick={() => navigate("/pricing")} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                <Crown className="w-4 h-4" /> {isPremium ? "Perpanjang" : "Upgrade Premium"}
              </Button>
            )}
          </div>
        </Card>

        {/* Backup Data */}
        <Card className="p-6 mb-6 border-slate-200 bg-white" data-testid="backup-card">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <DatabaseBackup className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-slate-900">Backup Data</h3>
              <p className="text-sm text-slate-500">
                Unduh cadangan lengkap semua proyek, transaksi, tukang, progress, dan seluruh foto
                dalam satu file ZIP. Simpan di perangkat atau Google Drive Anda.
              </p>
            </div>
          </div>

          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {[
                { label: "Proyek", value: summary.projects },
                { label: "Transaksi", value: summary.transactions },
                { label: "Tukang", value: summary.workers },
                { label: "Item RAB", value: summary.work_items },
                { label: "Log Progress", value: summary.progress_entries },
                { label: "Foto", value: summary.photos, icon: ImageIcon },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 uppercase tracking-wide">
                    {s.icon && <s.icon className="w-3 h-3" />} {s.label}
                  </div>
                  <div className="font-display font-bold text-slate-900 text-lg">{s.value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              data-testid="backup-download-btn"
              onClick={downloadBackup}
              disabled={backing}
              className="bg-slate-900 hover:bg-slate-800 text-white gap-2"
            >
              {backing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {backing ? "Menyiapkan..." : "Unduh Backup (.zip)"}
            </Button>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <FolderArchive className="w-3.5 h-3.5" />
              Berisi data.json, data.xlsx & folder foto
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Tips: setelah terunggah, Anda dapat menyimpan file ZIP ini ke Google Drive lewat aplikasi Drive di perangkat Anda.
          </p>
        </Card>

        {/* Reminders */}
        {notifs.length > 0 && (
          <Card className="p-5 mb-6 border-slate-200 bg-white" data-testid="reminders-card">
            <div className="flex items-center gap-2 mb-3"><BellRing className="w-4 h-4 text-amber-600" /><h3 className="font-display font-bold">Pengingat</h3></div>
            <div className="space-y-2">
              {notifs.map((n) => (
                <div key={n.id} className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3" data-testid={`notif-${n.id}`}>
                  <BellRing className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{n.title}</div>
                    <div className="text-xs text-slate-500">{n.body}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{fmtDate(n.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Transaction history */}
        <Card className="p-5 border-slate-200 bg-white" data-testid="transactions-card">
          <div className="flex items-center gap-2 mb-4"><Receipt className="w-4 h-4 text-amber-600" /><h3 className="font-display font-bold">Riwayat Transaksi</h3></div>
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Belum ada transaksi. Upgrade ke Premium untuk mulai.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-400 text-xs border-b border-slate-100">
                  <tr>
                    <th className="text-left font-medium py-2 pr-3">Tanggal</th>
                    <th className="text-left font-medium py-2 pr-3">Paket</th>
                    <th className="text-right font-medium py-2 pr-3">Nominal</th>
                    <th className="text-left font-medium py-2 pr-3">Status</th>
                    <th className="text-left font-medium py-2">Aktif s/d</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => {
                    const st = STATUS[o.status] || { label: o.status, cls: "bg-slate-100 text-slate-500", icon: Clock };
                    const Icon = st.icon;
                    return (
                      <tr key={o.order_id} data-testid={`order-${o.order_id}`}>
                        <td className="py-3 pr-3 text-slate-600 whitespace-nowrap">{fmtDate(o.created_at)}</td>
                        <td className="py-3 pr-3 text-slate-800">{PLAN_LABEL[o.plan] || o.plan}</td>
                        <td className="py-3 pr-3 text-right font-mono text-slate-900">{rupiah(o.gross_amount)}</td>
                        <td className="py-3 pr-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${st.cls}`}>
                            <Icon className="w-3 h-3" /> {st.label}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500 whitespace-nowrap">{o.premium_until ? fmtDate(o.premium_until) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
