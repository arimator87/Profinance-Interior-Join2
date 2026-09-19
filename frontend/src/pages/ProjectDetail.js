import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { HealthBadge } from "@/components/HealthBadge";
import { Paywall } from "@/components/Paywall";
import { AddProjectDialog } from "@/components/AddProjectDialog";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CashFlowTab } from "@/components/tabs/CashFlowTab";
import { TukangTab } from "@/components/tabs/TukangTab";
import { ProgressTab } from "@/components/tabs/ProgressTab";
import { ReportTab } from "@/components/tabs/ReportTab";
import {
  ArrowLeft, Loader2, Wallet, TrendingUp, Receipt, Building2, Trash2, Lock,
  Wallet2, ListChecks, FileBarChart, Crown, MapPin, Calendar, Pencil, Briefcase,
} from "lucide-react";
import { rupiah, rupiahShort, fmtDate } from "@/lib/format";
import { toast } from "sonner";

function Stat({ label, value, color, sub }) {
  return (
    <Card className="p-4 border-slate-200 bg-white">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-mono font-bold text-lg sm:text-xl mt-0.5" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </Card>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isPremium } = useAuth();
  const [project, setProject] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("cashflow");
  const [editOpen, setEditOpen] = useState(false);

  const loadProject = useCallback(async () => {
    try {
      const [p, t, w] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/projects/${id}/transactions`),
        api.get(`/projects/${id}/workers`),
      ]);
      setProject(p.data); setTransactions(t.data); setWorkers(w.data);
    } catch { toast.error("Proyek tidak ditemukan"); navigate("/dashboard"); }
    finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { loadProject(); }, [loadProject]);

  const refreshFinance = async () => {
    const [p, t, w] = await Promise.all([
      api.get(`/projects/${id}`),
      api.get(`/projects/${id}/transactions`),
      api.get(`/projects/${id}/workers`),
    ]);
    setProject(p.data); setTransactions(t.data); setWorkers(w.data);
  };

  const deleteProject = async () => {
    try { await api.delete(`/projects/${id}`); toast.success("Proyek dihapus"); navigate("/dashboard"); }
    catch { toast.error("Gagal menghapus proyek"); }
  };

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-slate-50"><Header />
        <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>
      </div>
    );
  }

  const s = project.summary;

  const TabTrigger = ({ value, icon: Icon, label, premium, testid }) => (
    <TabsTrigger value={value} data-testid={testid} className="gap-1.5 data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm relative">
      <Icon className="w-4 h-4" /> <span className="hidden sm:inline">{label}</span>
      {premium && !isPremium && <Lock className="w-3 h-3 text-amber-500 ml-0.5" />}
    </TabsTrigger>
  );

  return (
    <div className="min-h-screen bg-slate-50 pf-grain">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Semua Proyek
        </button>

        <Card className="overflow-hidden border-slate-200 bg-white mb-5">
          <div className="h-36 sm:h-44 relative bg-slate-100">
            {project.thumbnail ? <img src={project.thumbnail} alt={project.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Building2 className="w-12 h-12 text-slate-300" /></div>}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1.5"><HealthBadge marginPct={s.marginPct} size="sm" /></div>
                <h1 className="font-display text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate">{project.name}</h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/80 text-xs mt-1">
                  <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {project.owner || "-"}</span>
                  {project.companyName && project.companyName !== "-" && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {project.companyName}</span>}
                  {project.alamatProyek && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {project.alamatProyek}</span>}
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(project.targetSelesai)}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button data-testid="btn-edit-project" onClick={() => setEditOpen(true)} className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur hover:bg-amber-500 flex items-center justify-center text-white transition-colors"><Pencil className="w-4 h-4" /></button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><button data-testid="btn-delete-project" className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur hover:bg-red-500 flex items-center justify-center text-white transition-colors"><Trash2 className="w-4 h-4" /></button></AlertDialogTrigger>
                  <AlertDialogContent className="bg-white">
                    <AlertDialogHeader><AlertDialogTitle>Hapus proyek "{project.name}"?</AlertDialogTitle><AlertDialogDescription>Semua transaksi, tukang, dan progress akan dihapus permanen.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={deleteProject} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4">
            <Stat label="Nilai Kontrak" value={rupiahShort(s.nominal)} color="#0f172a" sub={rupiah(s.nominal)} />
            <Stat label="Saldo Bersih" value={rupiahShort(s.balance)} color={s.balance >= 0 ? "#16a34a" : "#dc2626"} sub={`Realisasi ${s.realisasiPct.toFixed(0)}%`} />
            <Stat label="Sisa Tagihan" value={rupiahShort(s.sisaTagihan)} color="#2563eb" sub={`Terbayar ${rupiahShort(s.terbayar)}`} />
            <Stat label="Total Keluar" value={rupiahShort(s.totalOut)} color="#ea580c" sub={`${s.txCount} transaksi`} />
          </div>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 w-full bg-slate-100 p-1 h-auto">
            <TabTrigger value="cashflow" icon={Wallet2} label="Cash Flow" testid="tab-cashflow" />
            <TabTrigger value="tukang" icon={Wallet} label="Tukang" testid="tab-tukang" />
            <TabTrigger value="progress" icon={ListChecks} label="Progress" premium testid="tab-progress" />
            <TabTrigger value="report" icon={FileBarChart} label="Report" premium testid="tab-report" />
          </TabsList>

          <TabsContent value="cashflow" className="mt-5">
            <CashFlowTab project={project} transactions={transactions} onChange={refreshFinance} />
          </TabsContent>
          <TabsContent value="tukang" className="mt-5">
            <TukangTab project={project} workers={workers} onChange={refreshFinance} />
          </TabsContent>
          <TabsContent value="progress" className="mt-5">
            {isPremium ? <ProgressTab project={project} /> : (
              <Paywall testid="paywall-banner-progress" title="Progress Pekerjaan (Premium)"
                features={[
                  "Item & sub-item pekerjaan berbobot (cost-loaded)",
                  "Catat & EDIT progress harian 0-100%",
                  "Impor RAB langsung dari Excel (.xlsx)",
                  "Kurva-S: Rencana vs Realisasi + Time Schedule",
                  "Baseline vs Revisi RAB (lacak deviasi negosiasi)",
                  "Portal Klien realtime + share ke WhatsApp",
                  "Upload foto dokumentasi (maks 10/entri)",
                ]} />
            )}
          </TabsContent>
          <TabsContent value="report" className="mt-5">
            {isPremium ? <ReportTab project={project} /> : (
              <Paywall testid="paywall-banner-report" title="Laporan & Export PDF (Premium)"
                features={[
                  "Dashboard analitik: pie & bar chart pengeluaran",
                  "Laporan Internal PDF profesional",
                  "Laporan Progress PDF + grafik Kurva-S",
                  "Tabel Deviasi RAB (Baseline vs Revisi) di PDF",
                  "Dokumentasi foto lapangan di laporan",
                ]} />
            )}
          </TabsContent>
        </Tabs>
      </main>

      <AddProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} onCreated={(p) => setProject(p)} />
    </div>
  );
}
