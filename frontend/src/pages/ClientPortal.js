import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Loader2, Building2, MapPin, Calendar, TrendingUp, ListChecks, Images,
  Wallet, ChevronDown, CheckCircle2, Clock, Maximize2, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { rupiah, fmtDate } from "@/lib/format";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function Ring({ value }) {
  const r = 52, c = 2 * Math.PI * r;
  const off = c - (Math.min(100, value) / 100) * c;
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#F59E0B" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-extrabold text-3xl text-white">{value.toFixed(0)}%</span>
        <span className="text-[10px] uppercase tracking-widest text-white/60">Realisasi</span>
      </div>
    </div>
  );
}

export default function ClientPortal() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [expanded, setExpanded] = useState({});
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/public/portal/${slug}`);
        setData(res.data);
        setState("ok");
      } catch {
        setState("error");
      }
    })();
  }, [slug]);

  if (state === "loading")
    return <div className="min-h-screen flex items-center justify-center bg-slate-950"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>;

  if (state === "error")
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-center px-6">
        <Building2 className="w-14 h-14 text-slate-700 mb-4" />
        <h1 className="text-xl font-bold text-white">Portal tidak ditemukan</h1>
        <p className="text-slate-400 text-sm mt-2 max-w-sm">Link ini tidak valid atau proyek sudah selesai dan diarsipkan. Silakan hubungi kontraktor Anda.</p>
      </div>
    );

  const p = data.project;
  const actual = data.totalProgress || 0;
  const planned = data.plannedProgress || 0;
  const deviation = +(actual - planned).toFixed(1);
  const curve = data.curve || [];
  const items = data.items || [];
  const gallery = data.gallery || [];
  const payments = data.payments || [];
  const totalPhotos = gallery.reduce((a, g) => a + g.photos.length, 0);

  const schedStart = data.start ? new Date(data.start).getTime() : 0;
  const schedEnd = data.end ? new Date(data.end).getTime() : 0;
  const schedSpan = Math.max(schedEnd - schedStart, 1);
  const barPos = (it) => {
    if (!it.startDate || !it.endDate || !schedStart) return null;
    const s = new Date(it.startDate).getTime();
    const e = new Date(it.endDate).getTime();
    const left = Math.max(0, ((s - schedStart) / schedSpan) * 100);
    const width = Math.max(2, ((e - s) / schedSpan) * 100);
    return { left: `${left}%`, width: `${Math.min(100 - left, width)}%` };
  };

  return (
    <div className="min-h-screen bg-slate-50" data-testid="client-portal">
      {/* Header */}
      <header className="relative bg-slate-950 overflow-hidden">
        {p.thumbnail && <img src={p.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-amber-950/40" />
        <div className="relative max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase tracking-[0.2em] text-amber-400 font-semibold">Portal Progress Klien</span>
            {p.status && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/10">{p.status}</span>}
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-white tracking-tight" data-testid="portal-project-name">{p.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/70 text-xs sm:text-sm mt-2">
            {p.companyName && p.companyName !== "-" && <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {p.companyName}</span>}
            {p.alamatProyek && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {p.alamatProyek}</span>}
            {p.targetSelesai && <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Target {fmtDate(p.targetSelesai)}</span>}
          </div>

          <div className="mt-7 flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
            <Ring value={actual} />
            <div className="grid grid-cols-2 gap-3 sm:gap-4 flex-1 w-full">
              <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[11px] text-white/50 uppercase tracking-wide">Rencana s/d Hari Ini</div>
                <div className="font-mono font-bold text-2xl text-blue-300">{planned.toFixed(1)}%</div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[11px] text-white/50 uppercase tracking-wide">Deviasi</div>
                <div className="font-mono font-bold text-2xl" style={{ color: deviation >= 0 ? "#4ade80" : "#f87171" }}>{deviation >= 0 ? "+" : ""}{deviation}%</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        {/* S-Curve */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-4 h-4 text-amber-600" /><h2 className="font-display font-bold text-slate-900">Kurva-S · Rencana vs Realisasi</h2></div>
          {curve.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-slate-400">Belum ada data progress.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={curve} margin={{ left: -12, right: 8, top: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d).slice(0, 6)} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="planned" name="Rencana (%)" stroke="#2563eb" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="actual" name="Realisasi (%)" stroke="#D97706" strokeWidth={3} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* Work items */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4"><ListChecks className="w-4 h-4 text-amber-600" /><h2 className="font-display font-bold text-slate-900">Rincian Pekerjaan</h2></div>
          {items.length === 0 ? <p className="text-sm text-slate-400 py-4">Belum ada item pekerjaan.</p> : (
            <div className="space-y-3">
              {items.map((it) => {
                const pos = barPos(it);
                const isOpen = !!expanded[it.id];
                const done = it.lastProgress >= 100;
                return (
                  <div key={it.id} className="rounded-xl border border-slate-200 overflow-hidden" data-testid={`portal-item-${it.id}`}>
                    <button onClick={() => it.hasSubs && setExpanded((e) => ({ ...e, [it.id]: !e[it.id] }))} className="w-full text-left p-4">
                      <div className="flex items-center gap-2">
                        {done ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> : <Clock className="w-4 h-4 text-amber-500 shrink-0" />}
                        <span className="font-semibold text-slate-900 flex-1 truncate">{it.name}</span>
                        {it.hasSubs && <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "" : "-rotate-90"}`} />}
                        <span className="font-mono font-bold text-slate-900 w-11 text-right">{Number(it.lastProgress).toFixed(0)}%</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600" style={{ width: `${Math.min(100, it.lastProgress)}%`, transition: "width .8s ease" }} />
                      </div>
                      {it.startDate && it.endDate && (
                        <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(it.startDate)} – {fmtDate(it.endDate)}</div>
                      )}
                    </button>
                    {it.hasSubs && isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 space-y-2.5">
                        {it.subItems.map((s) => (
                          <div key={s.id} className="flex items-center gap-3">
                            <span className="text-sm text-slate-600 flex-1 truncate">{s.name}</span>
                            <div className="w-24 h-1.5 rounded-full bg-slate-200 overflow-hidden shrink-0"><div className="h-full bg-amber-500" style={{ width: `${s.lastProgress}%` }} /></div>
                            <span className="font-mono text-xs text-slate-500 w-9 text-right">{s.lastProgress}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Payment history */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4"><Wallet className="w-4 h-4 text-amber-600" /><h2 className="font-display font-bold text-slate-900">Riwayat Pembayaran</h2></div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3">
              <div className="text-[11px] text-green-700 uppercase tracking-wide">Total Terbayar</div>
              <div className="font-mono font-bold text-lg sm:text-xl text-green-700">{rupiah(data.terbayar)}</div>
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
              <div className="text-[11px] text-blue-700 uppercase tracking-wide">Sisa Tagihan</div>
              <div className="font-mono font-bold text-lg sm:text-xl text-blue-700">{rupiah(data.sisaTagihan)}</div>
            </div>
          </div>
          {payments.length === 0 ? <p className="text-sm text-slate-400">Belum ada pembayaran tercatat.</p> : (
            <div className="divide-y divide-slate-100">
              {payments.map((pay, i) => (
                <div key={i} className="flex items-center justify-between py-2.5" data-testid={`portal-payment-${i}`}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800">{pay.category}</div>
                    <div className="text-[11px] text-slate-400">{fmtDate(pay.date)}{pay.description ? ` · ${pay.description}` : ""}</div>
                  </div>
                  <span className="font-mono font-semibold text-green-600 shrink-0 ml-3">{rupiah(pay.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Photo documentation */}
        {gallery.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Images className="w-4 h-4 text-amber-600" />
              <h2 className="font-display font-bold text-slate-900">Dokumentasi Lapangan</h2>
              <span className="ml-auto text-xs text-slate-400 font-mono">{totalPhotos} foto</span>
            </div>
            <div className="space-y-6">
              {gallery.map((g, i) => (
                <div key={i} data-testid={`portal-gallery-${i}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-800 truncate">{g.label}</div>
                      <div className="text-[11px] text-slate-400">{fmtDate(g.date)}{g.notes ? ` · ${g.notes}` : ""}</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-mono shrink-0">{g.progress}%</span>
                  </div>
                  <div className="columns-2 sm:columns-3 lg:columns-4 gap-2.5">
                    {g.photos.map((ph, j) => (
                      <button
                        key={j}
                        onClick={() => setLightbox({ photos: g.photos, index: j, label: g.label })}
                        data-testid={`portal-photo-${i}-${j}`}
                        className="mb-2.5 block w-full break-inside-avoid group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                      >
                        <img src={`${BACKEND_URL}${ph}`} alt="" loading="lazy" className="w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/25 transition-colors flex items-center justify-center">
                          <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="text-center py-6">
          <p className="text-xs text-slate-400">Progress diperbarui secara realtime oleh kontraktor · Powered by <span className="font-semibold text-amber-600">ProFinance Interior</span></p>
        </footer>
      </main>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 flex items-center justify-center backdrop-blur-sm" onClick={() => setLightbox(null)} data-testid="portal-lightbox">
          <button className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors" onClick={() => setLightbox(null)} data-testid="lightbox-close"><X className="w-7 h-7" /></button>
          <div className="absolute top-4 left-4 text-white/70 text-sm max-w-[65%] truncate">{lightbox.label} · {lightbox.index + 1}/{lightbox.photos.length}</div>
          {lightbox.photos.length > 1 && (
            <button data-testid="lightbox-prev" className="absolute left-2 sm:left-6 text-white/60 hover:text-white transition-colors p-2" onClick={(e) => { e.stopPropagation(); setLightbox((l) => ({ ...l, index: (l.index - 1 + l.photos.length) % l.photos.length })); }}><ChevronLeft className="w-8 h-8" /></button>
          )}
          <img src={`${BACKEND_URL}${lightbox.photos[lightbox.index]}`} alt="" className="max-h-[85vh] max-w-[88vw] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          {lightbox.photos.length > 1 && (
            <button data-testid="lightbox-next" className="absolute right-2 sm:right-6 text-white/60 hover:text-white transition-colors p-2" onClick={(e) => { e.stopPropagation(); setLightbox((l) => ({ ...l, index: (l.index + 1) % l.photos.length })); }}><ChevronRight className="w-8 h-8" /></button>
          )}
        </div>
      )}
    </div>
  );
}
