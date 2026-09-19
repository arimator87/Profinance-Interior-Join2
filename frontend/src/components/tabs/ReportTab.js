import { useEffect, useState } from "react";
import { api, pdfUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { FileDown, Loader2, PieChart as PieIcon, BarChart3 } from "lucide-react";
import { rupiah, rupiahShort } from "@/lib/format";
import { HealthBadge } from "@/components/HealthBadge";
import { toast } from "sonner";

const PIE_COLORS = ["#D97706", "#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#0891b2", "#64748b"];

export function ReportTab({ project }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get(`/projects/${project.id}/report`)
      .then((r) => setData(r.data))
      .catch(() => toast.error("Gagal memuat laporan"))
      .finally(() => setLoading(false));
  }, [project.id]);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/projects/${project.id}/report/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = `Laporan-${project.name}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Laporan PDF berhasil diunduh");
    } catch { toast.error("Gagal export PDF"); } finally { setExporting(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-amber-600" /></div>;
  const s = data.summary;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-lg text-slate-900">Laporan & Analytics</h3>
        <Button data-testid="btn-export-pdf" onClick={exportPdf} disabled={exporting} className="bg-slate-900 hover:bg-slate-800 text-white gap-2">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Export PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { l: "Pemasukan", v: rupiahShort(s.totalIn), c: "#16a34a" },
          { l: "Pengeluaran", v: rupiahShort(s.totalOut), c: "#ea580c" },
          { l: "Saldo Bersih", v: rupiahShort(s.balance), c: "#2563eb" },
          { l: "Realisasi", v: `${s.realisasiPct.toFixed(1)}%`, c: "#d97706" },
        ].map((k) => (
          <Card key={k.l} className="p-4 border-slate-200 bg-white">
            <div className="text-xs text-slate-500">{k.l}</div>
            <div className="font-mono font-bold text-lg mt-0.5" style={{ color: k.c }}>{k.v}</div>
          </Card>
        ))}
      </div>

      <div className="mb-5"><HealthBadge marginPct={s.marginPct} /></div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-5 border-slate-200 bg-white">
          <div className="flex items-center gap-2 mb-4"><PieIcon className="w-4 h-4 text-amber-600" /><span className="font-semibold text-sm text-slate-900">Breakdown Pengeluaran</span></div>
          {data.expenseByCategory.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">Belum ada pengeluaran.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={55} paddingAngle={2}>
                  {data.expenseByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => rupiah(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5 border-slate-200 bg-white">
          <div className="flex items-center gap-2 mb-4"><BarChart3 className="w-4 h-4 text-amber-600" /><span className="font-semibold text-sm text-slate-900">Kontrak vs Pengeluaran vs Margin</span></div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.marginBar} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => rupiahShort(v)} tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} width={110} />
              <Tooltip formatter={(v) => rupiah(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {data.marginBar.map((d, i) => <Cell key={i} fill={d.name.includes("Margin") ? (d.value >= 0 ? "#16a34a" : "#dc2626") : ["#2563eb", "#ea580c"][i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="mt-5 p-4 border-slate-200 bg-white">
        <div className="text-xs font-semibold text-slate-500 mb-3">Kategori Pengeluaran Terbesar</div>
        <div className="space-y-2">
          {data.expenseByCategory.slice(0, 5).map((c, i) => {
            const max = data.expenseByCategory[0]?.value || 1;
            return (
              <div key={c.name} className="flex items-center gap-3">
                <span className="text-sm text-slate-700 w-40 truncate">{c.name}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(c.value / max) * 100}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} /></div>
                <span className="font-mono text-xs font-semibold text-slate-800 w-24 text-right">{rupiahShort(c.value)}</span>
              </div>
            );
          })}
          {data.expenseByCategory.length === 0 && <p className="text-sm text-slate-400">Belum ada data.</p>}
        </div>
      </Card>
    </div>
  );
}
