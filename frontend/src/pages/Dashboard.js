import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { HealthBadge } from "@/components/HealthBadge";
import { AddProjectDialog } from "@/components/AddProjectDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  Plus, Wallet, TrendingUp, Receipt, HardHat, ArrowUpRight, Loader2, Building2, Sparkles, FolderPlus, Layers,
} from "lucide-react";
import { rupiah, rupiahShort, fmtDate } from "@/lib/format";
import { toast } from "sonner";

const FILTERS = ["Semua", "Berjalan", "Selesai", "Prospek"];

function Kpi({ icon: Icon, label, value, accent, testid, sub }) {
  return (
    <Card data-testid={testid} className="p-5 border-slate-200 bg-white hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10" style={{ background: accent }} />
      <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${accent}1a` }}>
        <Icon className="w-5 h-5" style={{ color: accent }} />
      </div>
      <div className="text-xs text-slate-500 font-medium">{label}</div>
      <div className="font-mono font-bold text-2xl text-slate-900 mt-0.5 tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isPremium } = useAuth();
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [filter, setFilter] = useState("Semua");
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    try {
      const [d, p] = await Promise.all([api.get("/dashboard"), api.get("/projects")]);
      setStats(d.data);
      setProjects(p.data);
    } catch {
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const seedDemo = async () => {
    setSeeding(true);
    try {
      await api.post("/seed-demo");
      toast.success("Data contoh berhasil dibuat");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal membuat data contoh");
    } finally {
      setSeeding(false);
    }
  };

  const filtered = projects.filter((p) => filter === "Semua" || (p.status || "Berjalan") === filter);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pf-grain">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Halo, {user?.name?.split(" ")[0] || "Kontraktor"} 👋
            </h1>
            <p className="text-slate-500 mt-1">Ringkasan finansial seluruh proyek Anda.</p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <Button data-testid="btn-create-rab" onClick={() => navigate("/rab/new")} variant="outline" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50">
              <Layers className="w-4 h-4" /> Buat RAB
            </Button>
            <Button data-testid="btn-add-project" onClick={() => setAddOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
              <Plus className="w-4 h-4" /> Proyek Baru
            </Button>
          </div>
        </div>

        {!isPremium && (
          <div data-testid="freemium-banner" className="mb-6 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center"><Sparkles className="w-5 h-5 text-amber-600" /></div>
              <div>
                <div className="font-semibold text-slate-900 text-sm">Anda menggunakan paket Free</div>
                <div className="text-xs text-slate-500">Buka Progress Pekerjaan (Kurva-S) & Export Laporan PDF dengan Premium.</div>
              </div>
            </div>
            <Button data-testid="banner-upgrade-btn" size="sm" onClick={() => navigate("/pricing")} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">Upgrade</Button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Kpi testid="dashboard-kpi-saldo-bersih" icon={Wallet} label="Total Saldo Bersih" value={rupiahShort(stats.saldoBersih)} accent="#16a34a" sub={rupiah(stats.saldoBersih)} />
          <Kpi testid="dashboard-kpi-sisa-tagihan" icon={Receipt} label="Total Sisa Tagihan" value={rupiahShort(stats.totalSisaTagihan)} accent="#2563eb" sub={rupiah(stats.totalSisaTagihan)} />
          <Kpi testid="dashboard-kpi-budget" icon={TrendingUp} label="Total Nilai Kontrak" value={rupiahShort(stats.totalBudget)} accent="#d97706" sub={`${stats.projectCount} proyek`} />
          <Kpi testid="dashboard-kpi-kasbon" icon={HardHat} label="Kasbon Tukang Aktif" value={rupiahShort(stats.totalKasbonAktif)} accent="#ea580c" sub="Belum lunas" />
        </div>

        <div className="flex items-center gap-2 mb-4 overflow-x-auto pf-scrollbar pb-1">
          {FILTERS.map((f) => (
            <button key={f} data-testid={`filter-${f.toLowerCase()}`} onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}>{f}</button>
          ))}
        </div>

        {projects.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-2 border-slate-200 bg-white/60">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <FolderPlus className="w-7 h-7 text-amber-600" />
            </div>
            <h3 className="font-display font-bold text-lg text-slate-900">Belum ada proyek</h3>
            <p className="text-slate-500 text-sm mt-1 mb-5 max-w-md mx-auto">Mulai dengan membuat proyek pertama, atau muat data contoh untuk melihat cara kerja aplikasi.</p>
            <div className="flex items-center justify-center gap-3">
              <Button data-testid="empty-add-project" onClick={() => setAddOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white gap-2"><Plus className="w-4 h-4" /> Buat Proyek</Button>
              <Button data-testid="btn-seed-demo" variant="outline" onClick={seedDemo} disabled={seeding} className="gap-2">
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Muat Data Contoh
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card data-testid={`project-card-${p.id}`} onClick={() => navigate(p.status === "Prospek" ? `/rab/${p.id}` : `/project/${p.id}`)}
                  className="overflow-hidden border-slate-200 bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group">
                  <div className="h-32 relative overflow-hidden bg-slate-100">
                    {p.thumbnail ? (
                      <img src={p.thumbnail} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Building2 className="w-10 h-10 text-slate-300" /></div>
                    )}
                    <div className="absolute top-3 left-3"><HealthBadge marginPct={p.summary.marginPct} size="sm" /></div>
                    {p.status === "Prospek" && (
                      <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wide shadow flex items-center gap-1">
                        <Layers className="w-3 h-3" /> Prospek
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-display font-bold text-slate-900 truncate">{p.name}</h3>
                        <p className="text-xs text-slate-500 truncate">{p.owner || "-"} · {p.category}</p>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 shrink-0 mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100">
                      <div>
                        <div className="text-[11px] text-slate-400">Nilai Kontrak</div>
                        <div className="font-mono font-semibold text-sm text-slate-900">{rupiahShort(p.summary.nominal)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">Saldo</div>
                        <div className="font-mono font-semibold text-sm" style={{ color: p.summary.balance >= 0 ? "#16a34a" : "#dc2626" }}>{rupiahShort(p.summary.balance)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">Sisa Tagihan</div>
                        <div className="font-mono font-semibold text-sm text-slate-900">{rupiahShort(p.summary.sisaTagihan)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">Target</div>
                        <div className="text-xs font-medium text-slate-600">{fmtDate(p.targetSelesai)}</div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <AddProjectDialog open={addOpen} onOpenChange={setAddOpen} onCreated={() => load()} />
    </div>
  );
}
