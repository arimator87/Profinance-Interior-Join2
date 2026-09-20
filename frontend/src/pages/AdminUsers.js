import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Users, Loader2, ShieldCheck, Search, Crown, Crown as CrownOff, ChevronLeft, ChevronRight, PlayCircle } from "lucide-react";
import { toast } from "sonner";

const fmtDate = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
};

const fmtDateTime = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "-";
  }
};

function StatusBadge({ u }) {
  if (u.isDemo) return <Badge data-testid={`status-demo-${u.user_id}`} className="bg-blue-100 text-blue-700 hover:bg-blue-100 gap-1"><PlayCircle className="w-3 h-3" /> Demo</Badge>;
  if (u.status === "premium") return <Badge data-testid={`status-premium-${u.user_id}`} className="bg-amber-100 text-amber-800 hover:bg-amber-100 gap-1"><Crown className="w-3 h-3" /> Premium</Badge>;
  if (u.status === "expired") return <Badge data-testid={`status-expired-${u.user_id}`} className="bg-red-100 text-red-700 hover:bg-red-100">Kedaluwarsa</Badge>;
  return <Badge data-testid={`status-free-${u.user_id}`} className="bg-slate-100 text-slate-600 hover:bg-slate-100">Free</Badge>;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const { isAdmin, user: me } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [grantTarget, setGrantTarget] = useState(null);
  const [grantDays, setGrantDays] = useState("30");
  const [granting, setGranting] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async (pageNum = 1, query = q) => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users", { params: { q: query, page: pageNum, limit: 15 } });
      setData(data);
      setPage(data.page);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memuat daftar pengguna");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    if (isAdmin === false) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (isAdmin) load(1, "");
  }, [isAdmin, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const search = (e) => {
    e.preventDefault();
    load(1, q);
  };

  const grantPremium = async () => {
    if (!grantTarget) return;
    setGranting(true);
    try {
      await api.post(`/admin/users/${grantTarget.user_id}/premium`, { days: parseInt(grantDays, 10) });
      toast.success(
        grantDays === "0"
          ? `${grantTarget.name || grantTarget.email} kini Premium permanen`
          : `${grantTarget.name || grantTarget.email} kini Premium selama ${grantDays} hari`
      );
      setGrantTarget(null);
      load(page);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menjadikan Premium");
    } finally {
      setGranting(false);
    }
  };

  const revokePremium = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await api.post(`/admin/users/${revokeTarget.user_id}/revoke`);
      toast.success(`Akses Premium ${revokeTarget.name || revokeTarget.email} dicabut`);
      setRevokeTarget(null);
      load(page);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mencabut Premium");
    } finally {
      setRevoking(false);
    }
  };

  const items = data?.items || [];
  const pages = data?.pages || 1;

  return (
    <div className="min-h-screen bg-slate-50 pf-grain">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8" data-testid="admin-users-page">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
        </button>

        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center"><Users className="w-5 h-5 text-amber-400" /></div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Manajemen Pengguna</h1>
        </div>
        <p className="text-sm text-slate-500 mb-6 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-green-600" /> Kelola status langganan seluruh pengguna aplikasi.
        </p>

        <form onSubmit={search} className="flex gap-2 mb-5 max-w-md">
          <Input
            data-testid="user-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, email, atau telepon..."
            className="h-11 bg-white"
          />
          <Button data-testid="user-search-btn" type="submit" variant="outline" className="h-11 gap-1.5 bg-white">
            <Search className="w-4 h-4" /> Cari
          </Button>
        </form>

        <Card className="border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
          ) : items.length === 0 ? (
            <div className="py-20 text-center text-sm text-slate-400" data-testid="users-empty">Tidak ada pengguna ditemukan.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="users-table">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Pengguna</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Berlaku s/d</TableHead>
                    <TableHead className="text-center">Proyek</TableHead>
                    <TableHead className="text-center">Transaksi</TableHead>
                    <TableHead>Terakhir Login</TableHead>
                    <TableHead>Terdaftar</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((u) => (
                    <TableRow key={u.user_id} data-testid={`user-row-${u.user_id}`}>
                      <TableCell>
                        <div className="font-medium text-slate-900 text-sm">{u.name || "-"}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                        {u.phone && <div className="text-xs text-slate-400">{u.phone}</div>}
                      </TableCell>
                      <TableCell><StatusBadge u={u} /></TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {u.status === "premium" ? (
                          <>
                            {fmtDate(u.subscriptionExpiry)}
                            {u.daysLeft != null && <div className="text-[11px] text-slate-400">{u.daysLeft} hari lagi</div>}
                          </>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-center text-sm" data-testid={`projects-count-${u.user_id}`}>{u.projectCount}</TableCell>
                      <TableCell className="text-center text-sm" data-testid={`tx-count-${u.user_id}`}>{u.transactionCount}</TableCell>
                      <TableCell className="text-xs text-slate-500">{fmtDateTime(u.lastLogin)}</TableCell>
                      <TableCell className="text-xs text-slate-500">{fmtDate(u.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            data-testid={`grant-premium-${u.user_id}`}
                            size="sm"
                            variant="outline"
                            onClick={() => { setGrantTarget(u); setGrantDays("30"); }}
                            className="h-8 text-xs gap-1 text-amber-700 border-amber-200 hover:bg-amber-50"
                          >
                            <Crown className="w-3.5 h-3.5" /> Premium
                          </Button>
                          {u.status === "premium" && !u.isOwner && (
                            <Button
                              data-testid={`revoke-premium-${u.user_id}`}
                              size="sm"
                              variant="outline"
                              onClick={() => setRevokeTarget(u)}
                              className="h-8 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <CrownOff className="w-3.5 h-3.5" /> Cabut
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && data && data.total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-500" data-testid="users-total">{data.total} pengguna · Halaman {page} dari {pages}</span>
              <div className="flex gap-1.5">
                <Button data-testid="page-prev" size="sm" variant="outline" disabled={page <= 1} onClick={() => load(page - 1)} className="h-8 w-8 p-0 bg-white">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button data-testid="page-next" size="sm" variant="outline" disabled={page >= pages} onClick={() => load(page + 1)} className="h-8 w-8 p-0 bg-white">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Dialog open={!!grantTarget} onOpenChange={(o) => !o && setGrantTarget(null)}>
          <DialogContent className="bg-white sm:max-w-md" data-testid="grant-dialog">
            <DialogHeader>
              <DialogTitle className="font-display">Jadikan Premium</DialogTitle>
              <DialogDescription>
                Aktifkan akses Premium untuk <span className="font-semibold text-slate-800">{grantTarget?.name || grantTarget?.email}</span> secara manual.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Select value={grantDays} onValueChange={setGrantDays}>
                <SelectTrigger data-testid="grant-duration-select" className="h-11 bg-white">
                  <SelectValue placeholder="Pilih durasi" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem data-testid="grant-30" value="30">30 hari</SelectItem>
                  <SelectItem data-testid="grant-90" value="90">90 hari</SelectItem>
                  <SelectItem data-testid="grant-365" value="365">365 hari</SelectItem>
                  <SelectItem data-testid="grant-permanent" value="0">Permanen</SelectItem>
                </SelectContent>
              </Select>
              {grantTarget?.status === "premium" && (
                <p className="text-[11px] text-slate-400 mt-2">Durasi akan ditambahkan dari sisa masa aktif saat ini.</p>
              )}
            </div>
            <DialogFooter>
              <Button data-testid="grant-cancel" variant="outline" onClick={() => setGrantTarget(null)} className="bg-white">Batal</Button>
              <Button data-testid="grant-confirm" onClick={grantPremium} disabled={granting} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                {granting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />} Aktifkan Premium
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
          <AlertDialogContent className="bg-white" data-testid="revoke-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">Cabut Akses Premium?</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-semibold text-slate-800">{revokeTarget?.name || revokeTarget?.email}</span> akan kembali ke tier Free dan kehilangan akses fitur Premium (Progress, Portal Klien, Laporan PDF).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="revoke-cancel" className="bg-white">Batal</AlertDialogCancel>
              <AlertDialogAction data-testid="revoke-confirm" onClick={revokePremium} disabled={revoking} className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
                {revoking && <Loader2 className="w-4 h-4 animate-spin" />} Ya, Cabut Premium
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
