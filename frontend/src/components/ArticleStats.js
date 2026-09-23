import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { Newspaper, Eye, CheckCircle2, Sparkles, TrendingUp, Trophy, Loader2 } from "lucide-react";

const CAT_COLORS = {
  interior: "#f59e0b",
  arsitektur: "#3b82f6",
  keuangan: "#10b981",
  panduan: "#8b5cf6",
};

function StatCard({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold font-display leading-none">{value}</div>
        <div className="text-xs text-slate-500 mt-1 truncate">{label}</div>
        {sub && <div className="text-[11px] text-slate-400 truncate">{sub}</div>}
      </div>
    </div>
  );
}

export default function ArticleStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.get("/admin/articles/stats/overview")
      .then((r) => { if (alive) setStats(r.data); })
      .catch(() => { if (alive) setStats(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
      </div>
    );
  }
  if (!stats) return null;

  const top = (stats.top || []).map((t) => ({ ...t, short: t.title.length > 38 ? t.title.slice(0, 38) + "…" : t.title }));
  const trend = stats.daily || [];

  return (
    <div className="mb-6 space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Newspaper} label="Total Artikel" value={stats.totalArticles} tone="bg-amber-100 text-amber-700" />
        <StatCard icon={Eye} label="Total Dibaca" value={stats.totalViews} sub="seluruh artikel" tone="bg-blue-100 text-blue-700" />
        <StatCard icon={CheckCircle2} label="Terpublikasi" value={stats.published} sub={`${stats.drafts} draft`} tone="bg-emerald-100 text-emerald-700" />
        <StatCard icon={Sparkles} label="Dibuat AI" value={stats.aiCount} tone="bg-purple-100 text-purple-700" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Trend 14 hari */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold">Tren Pembaca — 14 Hari Terakhir</h3>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={trend} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={1} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ stroke: "#f59e0b", strokeWidth: 1 }}
                contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                formatter={(v) => [v, "dibaca"]}
              />
              <Area type="monotone" dataKey="views" stroke="#f59e0b" strokeWidth={2.5} fill="url(#viewsGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top most-read */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold">Artikel Paling Banyak Dibaca</h3>
          </div>
          {top.length === 0 || top.every((t) => t.views === 0) ? (
            <div className="h-[210px] flex items-center justify-center text-sm text-slate-400 text-center px-6">
              Belum ada data pembaca. Grafik akan muncul setelah artikel mulai dibaca pengunjung.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={top} layout="vertical" margin={{ top: 0, right: 34, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="short" width={150} tick={{ fontSize: 11, fill: "#475569" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v, name, p) => [v + " pembaca", p.payload.categoryLabel]}
                  labelFormatter={(l, payload) => payload?.[0]?.payload?.title || l}
                />
                <Bar dataKey="views" radius={[0, 6, 6, 0]} barSize={18}>
                  {top.map((t, i) => (
                    <Cell key={t.id} fill={CAT_COLORS[t.category] || "#f59e0b"} />
                  ))}
                  <LabelList dataKey="views" position="right" style={{ fontSize: 11, fill: "#64748b", fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* category legend */}
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-50">
            {(stats.byCategory || []).map((c) => (
              <span key={c.category} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: CAT_COLORS[c.category] || "#f59e0b" }} />
                {c.categoryLabel} · {c.count} artikel · {c.views} dibaca
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
