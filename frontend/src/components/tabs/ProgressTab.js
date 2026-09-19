import { useEffect, useState, useRef } from "react";
import { api, fileUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Plus, Loader2, Trash2, ListChecks, Camera, TrendingUp, ChevronDown, Pencil, PackagePlus,
  CalendarRange, Wallet, Save,
} from "lucide-react";
import { rupiah, rupiahShort, fmtDate } from "@/lib/format";
import { toast } from "sonner";

const toDate = (d) => (d ? String(d).slice(0, 10) : "");
const iso = (d) => (d ? new Date(d).toISOString() : null);

export function ProgressTab({ project }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState({});

  const [rabInput, setRabInput] = useState("");

  const [itemOpen, setItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState({ id: null, name: "", nilai: "", startDate: "", endDate: "" });

  const [subOpen, setSubOpen] = useState(false);
  const [subForm, setSubForm] = useState({ id: null, name: "", harga: "" });
  const [subParent, setSubParent] = useState(null);

  const [logOpen, setLogOpen] = useState(false);
  const [logTarget, setLogTarget] = useState(null); // {workItemId, subItemId, title, current}
  const [logForm, setLogForm] = useState({ progress: 0, notes: "", date: "" });
  const [photos, setPhotos] = useState([]);
  const [entries, setEntries] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const load = async () => {
    try {
      const res = await api.get(`/projects/${project.id}/progress-summary`);
      setData(res.data);
      setRabInput(res.data.rabTotal ? String(res.data.rabTotal) : "");
    } catch { toast.error("Gagal memuat progress"); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [project.id]);

  const saveRab = async () => {
    setBusy(true);
    try {
      await api.put(`/projects/${project.id}/rab-total`, { rabTotal: parseInt(rabInput || 0, 10) });
      toast.success("Total RAB disimpan");
      await load();
    } catch { toast.error("Gagal menyimpan RAB"); } finally { setBusy(false); }
  };

  // Work item add/edit
  const openAddItem = () => { setItemForm({ id: null, name: "", nilai: "", startDate: "", endDate: "" }); setItemOpen(true); };
  const openEditItem = (it) => { setItemForm({ id: it.id, name: it.name, nilai: it.hasSubs ? "" : String(it.manualNilai || ""), startDate: toDate(it.startDate), endDate: toDate(it.endDate) }); setItemOpen(true); };
  const saveItem = async () => {
    if (!itemForm.name) return toast.error("Nama item wajib diisi");
    setBusy(true);
    try {
      const payload = { name: itemForm.name, nilai: parseInt(itemForm.nilai || 0, 10), startDate: iso(itemForm.startDate), endDate: iso(itemForm.endDate) };
      if (itemForm.id) { await api.put(`/workitems/${itemForm.id}`, payload); toast.success("Item diperbarui"); }
      else { await api.post(`/projects/${project.id}/workitems`, payload); toast.success("Item ditambahkan"); }
      setItemOpen(false); await load();
    } catch { toast.error("Gagal menyimpan item"); } finally { setBusy(false); }
  };
  const removeItem = async (id) => {
    try { await api.delete(`/workitems/${id}`); toast.success("Item dihapus"); await load(); }
    catch { toast.error("Gagal menghapus"); }
  };

  // Sub item add/edit
  const openAddSub = (item) => { setSubParent(item); setSubForm({ id: null, name: "", harga: "" }); setSubOpen(true); };
  const openEditSub = (item, sub) => { setSubParent(item); setSubForm({ id: sub.id, name: sub.name, harga: String(sub.harga || "") }); setSubOpen(true); };
  const saveSub = async () => {
    if (!subForm.name) return toast.error("Nama sub item wajib diisi");
    setBusy(true);
    try {
      const payload = { name: subForm.name, harga: parseInt(subForm.harga || 0, 10) };
      if (subForm.id) { await api.put(`/subitems/${subForm.id}`, payload); toast.success("Sub item diperbarui"); }
      else { await api.post(`/workitems/${subParent.id}/subitems`, payload); toast.success("Sub item ditambahkan"); }
      setSubOpen(false); await load();
    } catch { toast.error("Gagal menyimpan sub item"); } finally { setBusy(false); }
  };
  const deleteSub = async (sub) => {
    try { await api.delete(`/subitems/${sub.id}`); toast.success("Sub item dihapus"); await load(); }
    catch { toast.error("Gagal menghapus"); }
  };

  // Progress log (photo) — target = work item (no subs) or sub item
  const openLog = async (target) => {
    setLogTarget(target);
    setLogForm({ progress: target.current || 0, notes: "", date: "" });
    setPhotos([]); setEntries([]);
    setLogOpen(true);
    try {
      const params = target.subItemId ? { subItemId: target.subItemId } : {};
      const res = await api.get(`/workitems/${target.workItemId}/progress`, { params });
      setEntries(res.data);
    } catch { setEntries([]); }
  };
  const uploadPhoto = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData(); fd.append("file", file);
        const res = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        setPhotos((p) => [...p, res.data.path]);
      }
      toast.success("Foto terunggah");
    } catch { toast.error("Gagal upload"); } finally { setUploading(false); }
  };
  const submitLog = async () => {
    setBusy(true);
    try {
      await api.post(`/workitems/${logTarget.workItemId}/progress`, {
        progress: logForm.progress, notes: logForm.notes,
        date: iso(logForm.date), photoUrls: photos, subItemId: logTarget.subItemId || null,
      });
      toast.success("Progress dicatat");
      setLogOpen(false); await load();
    } catch { toast.error("Gagal mencatat progress"); } finally { setBusy(false); }
  };

  const toggleExpand = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-amber-600" /></div>;

  const items = data?.items || [];
  const curve = data?.curve || [];
  const actual = data?.totalProgress || 0;
  const planned = data?.plannedProgress || 0;
  const deviation = +(actual - planned).toFixed(1);
  const rabUsed = data?.rab || 0;
  const rabMismatch = (data?.rabTotal || 0) > 0 && data.rabTotal !== data.totalItemValue;

  // Schedule bars range
  const schedStart = data?.start ? new Date(data.start).getTime() : 0;
  const schedEnd = data?.end ? new Date(data.end).getTime() : 0;
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
    <div>
      {/* RAB input */}
      <Card className="p-4 border-slate-200 bg-white mb-4">
        <div className="flex items-center gap-2 mb-2"><Wallet className="w-4 h-4 text-amber-600" /><span className="font-semibold text-sm text-slate-900">Total Nilai RAB Pekerjaan</span></div>
        <p className="text-xs text-slate-500 mb-3">Dipakai sebagai dasar perhitungan bobot (%). <b>Terpisah dari nilai proyek di Cash Flow</b> karena RAB sering dinegosiasi klien. Kosongkan untuk memakai total nilai item otomatis.</p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Input data-testid="rab-total-input" type="number" value={rabInput} onChange={(e) => setRabInput(e.target.value)} placeholder="mis. 250000000" className="font-mono max-w-xs" />
          <Button data-testid="rab-save-btn" onClick={saveRab} disabled={busy} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"><Save className="w-4 h-4" /> Simpan RAB</Button>
          <div className="text-xs text-slate-500 sm:ml-auto">
            Dasar bobot: <b className="font-mono text-slate-800">{rupiah(rabUsed)}</b> · Total item: <b className="font-mono text-slate-800">{rupiah(data?.totalItemValue || 0)}</b>
          </div>
        </div>
        {rabMismatch && <p className="text-[11px] text-amber-700 mt-2">⚠ Total item ({rupiahShort(data.totalItemValue)}) belum sama dengan RAB ({rupiahShort(data.rabTotal)}). Bobot total tidak akan mencapai 100%.</p>}
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4 border-slate-200 bg-white"><div className="text-xs text-slate-500">Realisasi (Aktual)</div><div className="font-mono font-bold text-2xl text-amber-700">{actual.toFixed(1)}%</div></Card>
        <Card className="p-4 border-slate-200 bg-white"><div className="text-xs text-slate-500">Rencana (s/d hari ini)</div><div className="font-mono font-bold text-2xl text-blue-600">{planned.toFixed(1)}%</div></Card>
        <Card className="p-4 border-slate-200 bg-white"><div className="text-xs text-slate-500">Deviasi</div><div className="font-mono font-bold text-2xl" style={{ color: deviation >= 0 ? "#16a34a" : "#dc2626" }}>{deviation >= 0 ? "+" : ""}{deviation}%</div></Card>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-lg text-slate-900">Item Pekerjaan (RAB)</h3>
        <Button data-testid="btn-add-workitem" size="sm" onClick={openAddItem} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"><Plus className="w-4 h-4" /> Item</Button>
      </div>

      {/* S-Curve */}
      <Card className="p-4 border-slate-200 bg-white mb-4">
        <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-amber-600" /><span className="font-semibold text-sm text-slate-900">Kurva-S (Rencana vs Realisasi)</span></div>
        {curve.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-slate-400 text-center px-4">Belum ada data. Tambah item + jadwal (Time Schedule) dan catat progress untuk membentuk kurva.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={curve} margin={{ left: -10, right: 8, top: 6 }}>
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
      </Card>

      {/* Time Schedule */}
      {items.length > 0 && (
        <Card className="p-4 border-slate-200 bg-white mb-4">
          <div className="flex items-center gap-2 mb-3"><CalendarRange className="w-4 h-4 text-amber-600" /><span className="font-semibold text-sm text-slate-900">Time Schedule</span><span className="text-[11px] text-slate-400 ml-auto">{fmtDate(data?.start)} – {fmtDate(data?.end)}</span></div>
          <div className="space-y-2">
            {items.map((it) => {
              const pos = barPos(it);
              return (
                <div key={it.id} className="flex items-center gap-3">
                  <div className="w-28 sm:w-40 shrink-0 text-xs text-slate-600 truncate">{it.name}</div>
                  <div className="flex-1 h-5 rounded bg-slate-100 relative overflow-hidden">
                    {pos ? (
                      <div className="absolute top-0 h-full rounded bg-blue-200" style={pos}>
                        <div className="h-full rounded bg-amber-500" style={{ width: `${it.lastProgress}%` }} />
                      </div>
                    ) : <span className="absolute inset-0 flex items-center pl-2 text-[10px] text-slate-400">belum dijadwalkan</span>}
                  </div>
                  <div className="w-10 text-right text-xs font-mono text-slate-600 shrink-0">{Number(it.lastProgress).toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <Card className="p-10 text-center border-dashed border-2 bg-white/50">
          <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Belum ada item pekerjaan. Tambahkan item + jadwal, lalu rincian Sub Item (RAB).</p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {items.map((it) => {
            const isOpen = !!expanded[it.id];
            const subs = it.subItems || [];
            return (
              <Card data-testid={`workitem-card-${it.id}`} key={it.id} className="border-slate-200 bg-white overflow-hidden">
                <div className="p-4 flex items-center gap-2">
                  <button data-testid={`workitem-toggle-${it.id}`} onClick={() => toggleExpand(it.id)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                      <span className="font-semibold text-slate-900 truncate">{it.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-mono shrink-0">Bobot {it.weight.toFixed(1)}%</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 pl-6">{rupiah(it.nilai)} · {it.hasSubs ? `${it.subCount} sub item` : "tanpa sub item"} {it.startDate ? `· ${fmtDate(it.startDate)}→${fmtDate(it.endDate)}` : ""}</div>
                    <div className="pl-6"><Progress value={it.lastProgress} className="h-1.5 mt-2" /></div>
                  </button>
                  <div className="text-right shrink-0 w-12"><div className="font-mono font-bold text-lg text-slate-900">{Number(it.lastProgress).toFixed(0)}%</div></div>
                  {!it.hasSubs && (
                    <button data-testid={`workitem-log-${it.id}`} onClick={() => openLog({ workItemId: it.id, subItemId: null, title: it.name, current: it.lastProgress })} title="Foto & Progress" className="text-slate-300 hover:text-amber-600 shrink-0"><Camera className="w-4 h-4" /></button>
                  )}
                  <button data-testid={`edit-workitem-${it.id}`} onClick={() => openEditItem(it)} className="text-slate-300 hover:text-amber-600 shrink-0"><Pencil className="w-4 h-4" /></button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><button data-testid={`delete-workitem-${it.id}`} className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button></AlertDialogTrigger>
                    <AlertDialogContent className="bg-white">
                      <AlertDialogHeader><AlertDialogTitle>Hapus item pekerjaan?</AlertDialogTitle><AlertDialogDescription>Seluruh sub item & log progress item ini akan dihapus.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => removeItem(it.id)} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500">Sub Item (rincian RAB)</span>
                      <Button data-testid={`btn-add-subitem-${it.id}`} size="sm" variant="outline" onClick={() => openAddSub(it)} className="h-7 gap-1 text-xs"><PackagePlus className="w-3.5 h-3.5" /> Sub Item</Button>
                    </div>
                    {subs.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">Belum ada sub item. Bila item ini tanpa sub item, catat progress & foto lewat ikon kamera. Tambah sub item untuk rincian per pekerjaan.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {subs.map((s) => (
                          <div data-testid={`subitem-row-${s.id}`} key={s.id} className="flex items-center gap-2.5 bg-white rounded-lg border border-slate-200 px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-slate-800 truncate">{s.name}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-mono shrink-0">{s.weight.toFixed(1)}%</span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">{rupiah(s.harga)}</div>
                              <Progress value={s.lastProgress} className="h-1 mt-1.5" />
                            </div>
                            <div className="font-mono font-bold text-sm text-slate-900 w-10 text-right shrink-0">{s.lastProgress}%</div>
                            <button data-testid={`subitem-log-${s.id}`} onClick={() => openLog({ workItemId: it.id, subItemId: s.id, title: `${it.name} › ${s.name}`, current: s.lastProgress })} title="Foto & Progress" className="text-slate-300 hover:text-amber-600 shrink-0"><Camera className="w-4 h-4" /></button>
                            <button data-testid={`edit-subitem-${s.id}`} onClick={() => openEditSub(it, s)} className="text-slate-300 hover:text-amber-600 shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><button data-testid={`delete-subitem-${s.id}`} className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button></AlertDialogTrigger>
                              <AlertDialogContent className="bg-white">
                                <AlertDialogHeader><AlertDialogTitle>Hapus sub item?</AlertDialogTitle><AlertDialogDescription>Log progress & foto sub item ini akan dihapus.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => deleteSub(s)} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ))}
                        <div className="text-[11px] text-slate-500 pt-1">Total RAB item: <b className="font-mono text-slate-700">{rupiah(it.subTotal)}</b> · Terpasang: <b className="font-mono text-green-600">{rupiah(it.doneValue)}</b></div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Work item dialog */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="bg-white max-w-sm">
          <DialogHeader><DialogTitle className="font-display text-lg">{itemForm.id ? "Edit Item Pekerjaan" : "Tambah Item Pekerjaan"}</DialogTitle></DialogHeader>
          <div className="space-y-3.5">
            <div><Label>Nama Item</Label><Input data-testid="workitem-name-input" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="Pekerjaan Plafon Gypsum" className="mt-1" /></div>
            <div><Label>Nilai Item (Rp) — opsional</Label><Input data-testid="workitem-nilai-input" type="number" value={itemForm.nilai} onChange={(e) => setItemForm({ ...itemForm, nilai: e.target.value })} placeholder="0" className="mt-1 font-mono" /><p className="text-[11px] text-slate-400 mt-1">Otomatis dihitung dari total Sub Item. Isi manual bila item tanpa rincian sub item.</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Mulai</Label><Input data-testid="workitem-start-input" type="date" value={itemForm.startDate} onChange={(e) => setItemForm({ ...itemForm, startDate: e.target.value })} className="mt-1" /></div>
              <div><Label>Selesai</Label><Input data-testid="workitem-end-input" type="date" value={itemForm.endDate} onChange={(e) => setItemForm({ ...itemForm, endDate: e.target.value })} className="mt-1" /></div>
            </div>
            <p className="text-[11px] text-slate-400">Jadwal dipakai untuk garis Rencana pada Kurva-S & Time Schedule.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>Batal</Button>
            <Button data-testid="workitem-submit-button" onClick={saveItem} disabled={busy} className="bg-amber-600 hover:bg-amber-700 text-white">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub item dialog */}
      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent className="bg-white max-w-sm">
          <DialogHeader><DialogTitle className="font-display text-lg">{subForm.id ? "Edit Sub Item" : "Tambah Sub Item"}</DialogTitle></DialogHeader>
          <div className="space-y-3.5">
            <div><Label>Nama Sub Item</Label><Input data-testid="subitem-name-input" value={subForm.name} onChange={(e) => setSubForm({ ...subForm, name: e.target.value })} placeholder="Rangka Hollow 4x4" className="mt-1" /></div>
            <div><Label>Harga (Rp)</Label><Input data-testid="subitem-harga-input" type="number" value={subForm.harga} onChange={(e) => setSubForm({ ...subForm, harga: e.target.value })} placeholder="12000000" className="mt-1 font-mono" /><p className="text-[11px] text-slate-400 mt-1">Bobot % dihitung otomatis dari Total RAB. Progress dicatat lewat ikon kamera.</p></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubOpen(false)}>Batal</Button>
            <Button data-testid="subitem-submit-button" onClick={saveSub} disabled={busy} className="bg-amber-600 hover:bg-amber-700 text-white">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progress/photo log dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="bg-white max-w-md max-h-[90vh] overflow-y-auto pf-scrollbar">
          <DialogHeader><DialogTitle className="font-display text-lg">{logTarget?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between"><Label>Progress</Label><span className="font-mono font-bold text-amber-700">{logForm.progress}%</span></div>
              <Slider data-testid="log-progress-slider" value={[logForm.progress]} onValueChange={(v) => setLogForm({ ...logForm, progress: v[0] })} max={100} step={5} className="mt-3" />
            </div>
            <div><Label>Tanggal</Label><Input data-testid="log-date-input" type="date" value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} className="mt-1" /></div>
            <div><Label>Catatan</Label><Textarea data-testid="log-notes-input" value={logForm.notes} onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })} placeholder="Progress lapangan hari ini…" className="mt-1 resize-none" rows={2} /></div>
            <div>
              <Label>Foto Dokumentasi</Label>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={uploadPhoto} />
              <Button data-testid="log-upload-btn" type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-1 w-full gap-2">{uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Upload Foto</Button>
              {photos.length > 0 && <div className="grid grid-cols-3 gap-2 mt-2">{photos.map((p, i) => <img key={i} src={fileUrl(p)} alt="" className="w-full h-16 object-cover rounded-md border border-slate-200" />)}</div>}
            </div>
            <Button data-testid="log-submit-button" onClick={submitLog} disabled={busy} className="w-full bg-amber-600 hover:bg-amber-700 text-white">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Progress"}</Button>

            {entries.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-500 mb-2">Riwayat Update</div>
                <div className="space-y-2">
                  {entries.slice().reverse().map((e) => (
                    <div key={e.id} className="flex gap-3 text-sm">
                      <div className="font-mono font-bold text-amber-700 w-12 shrink-0">{e.progress}%</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-slate-700">{e.notes || "-"}</div>
                        <div className="text-[11px] text-slate-400">{fmtDate(e.date)}</div>
                        {e.photoUrls?.length > 0 && <div className="flex gap-1.5 mt-1 flex-wrap">{e.photoUrls.map((p, i) => <img key={i} src={fileUrl(p)} alt="" className="w-12 h-12 object-cover rounded border border-slate-200" />)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
