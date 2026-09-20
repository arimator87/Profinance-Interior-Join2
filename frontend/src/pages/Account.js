import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { rupiah, fmtDate } from "@/lib/format";
import {
  ArrowLeft, Crown, Sparkles, Receipt, Loader2, BellRing, Clock, CheckCircle2, XCircle,
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

  useEffect(() => {
    (async () => {
      try {
        const [o, n] = await Promise.all([api.get("/subscription/orders"), api.get("/notifications")]);
        setOrders(o.data);
        setNotifs(n.data);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

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
