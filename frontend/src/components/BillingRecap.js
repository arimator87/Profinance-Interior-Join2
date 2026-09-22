import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { FileCheck2, HandCoins, ShieldAlert, FileText } from "lucide-react";
import { rupiahShort, rupiah } from "@/lib/format";

function Cell({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-0.5">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="truncate">{label}</span>
      </div>
      <div className="font-mono font-bold text-base sm:text-lg truncate" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-slate-400 truncate">{sub}</div>}
    </div>
  );
}

export function BillingRecap({ projectId, refreshKey = 0 }) {
  const [recap, setRecap] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/billing-recap`);
      setRecap(data);
    } catch {
      // non-premium or error: hide recap silently
      setRecap(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading || !recap) return null;
  if (recap.invoiceCount === 0 && recap.paid === 0) return null;

  const billedPct = recap.nominal > 0 ? Math.min(100, Math.round((recap.totalBilled / recap.nominal) * 100)) : 0;
  const paidPct = recap.nominal > 0 ? Math.min(100, Math.round((recap.paid / recap.nominal) * 100)) : 0;

  return (
    <Card className="p-4 border-slate-200 bg-white" data-testid="billing-recap">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-800">Rekap Penagihan</div>
        <div className="text-[11px] text-slate-400">Nilai kontrak {rupiah(recap.nominal)}</div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Cell icon={FileText} label="Total Tertagih" value={rupiahShort(recap.totalBilled)} color="#2563eb"
          sub={`${recap.billedCount} invoice terkirim/lunas`} />
        <Cell icon={HandCoins} label="Terbayar" value={rupiahShort(recap.paid)} color="#16a34a"
          sub={`${paidPct}% dari kontrak`} />
        <Cell icon={FileCheck2} label="Piutang (Belum Dibayar)" value={rupiahShort(recap.receivable)} color="#ea580c"
          sub={recap.draftAmount > 0 ? `+ ${rupiahShort(recap.draftAmount)} draft` : "Tertagih - terbayar"} />
        <Cell icon={ShieldAlert} label="Retensi Ditahan" value={rupiahShort(recap.retentionHeld)} color="#7c3aed"
          sub="Tagih setelah masa pemeliharaan" />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
          <span>Progres penagihan terhadap kontrak</span>
          <span>{billedPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden relative">
          <div className="h-full bg-blue-500 absolute left-0 top-0 transition-all" style={{ width: `${billedPct}%` }} />
          <div className="h-full bg-emerald-500 absolute left-0 top-0 transition-all" style={{ width: `${paidPct}%` }} />
        </div>
        <div className="flex items-center gap-4 mt-1.5 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Tertagih</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Terbayar</span>
        </div>
      </div>
    </Card>
  );
}
