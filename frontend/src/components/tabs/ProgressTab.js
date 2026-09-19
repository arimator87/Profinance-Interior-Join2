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
import { Plus, Loader2, Trash2, ListChecks, Camera, Upload, TrendingUp, ChevronRight } from "lucide-react";
import { rupiah, fmtDate } from "@/lib/format";
import { toast } from "sonner";

export function ProgressTab({ project }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState({ name: "", nilai: "" });
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const [entries, setEntries] = useState([]);
  const [logForm, setLogForm] = useState({ progress: 0, notes: "", date: "" });
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const load = async () => {
    try {
      const res = await api.get(`/projects/${project.id}/progress-summary`);
      setData(res.data);
    } catch { toast.error("Gagal memuat progress"); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [project.id]);

  const addItem = async () => {
    if (!itemForm.name) return toast.error("Nama item wajib diisi");
    setBusy(true);
    try {
      await api.post(`/projects/${project.id}/workitems`, { name: itemForm.name, nilai: parseInt(itemForm.nilai || 0, 10) });
      toast.success("Item pekerjaan ditambahkan");
      setAddItemOpen(false); setItemForm({ name: "", nilai: "" }); load();
    } catch { toast.error("Gagal menambah item"); } finally { setBusy(false); }
  };

  const openLog = async (item) => {
    setActiveItem(item);
    setLogForm({ progress: item.lastProgress || 0, notes: "", date: "" });
    setPhotos([]);
    setLogOpen(true);
    try { const res = await api.get(`/workitems/${item.id}/progress`); setEntries(res.data); } catch { setEntries([]); }
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
      await api.post(`/workitems/${activeItem.id}/progress`, {
        progress: logForm.progress, notes: logForm.notes,
        date: logForm.date ? new Date(logForm.date).toISOString() : null, photoUrls: photos,
      });
      toast.success("Progress dicatat");
      setLogOpen(false); load();
    } catch { toast.error("Gagal mencatat progress"); } finally { setBusy(false); }
  };

  const removeItem = async (id) => {
    try { await api.delete(`/workitems/${id}`); toast.success("Item dihapus"); load(); }
    catch { toast.error("Gagal menghapus"); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-amber-600" /></div>;

  const items = data?.items || [];
  const curve = data?.curve || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-lg text-slate-900">Progress Pekerjaan</h3>
          <p className="text-xs text-slate-500">Progress total proyek (berbobot): <b className="text-amber-700 font-mono">{data?.totalProgress?.toFixed(1)}%</b></p>
        </div>
        <Button data-testid="btn-add-workitem" size="sm" onClick={() => setAddItemOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"><Plus className="w-4 h-4" /> Item</Button>
      </div>

      <Card className="p-4 border-slate-200 bg-white mb-5">
        <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-amber-600" /><span className="font-semibold text-sm text-slate-900">Kurva-S (Rencana vs Realisasi)</span></div>
        {curve.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-slate-400">Belum ada data progress untuk membuat kurva.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={curve} margin={{ left: -10, right: 8, top: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d).slice(0, 6)} tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} unit="%" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="planned" name="Target Rencana (%)" stroke="#2563eb" strokeDasharray="4 4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="actual" name="Realisasi (%)" stroke="#D97706" strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      {items.length === 0 ? (
        <Card className="p-10 text-center border-dashed border-2 bg-white/50">
          <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Belum ada item pekerjaan. Tambahkan item seperti "Pekerjaan Plafon", "Finishing HPL".</p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {items.map((it) => (
            <Card data-testid={`workitem-card-${it.id}`} key={it.id} onClick={() => openLog(it)} className="p-4 border-slate-200 bg-white hover:shadow-sm transition-shadow cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 truncate">{it.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono shrink-0">Bobot {it.weight.toFixed(1)}%</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{rupiah(it.nilai)} · {it.entryCount} update</div>
                  <Progress value={it.lastProgress} className="h-1.5 mt-2" />
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-lg text-slate-900">{it.lastProgress}%</div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild><button data-testid={`delete-workitem-${it.id}`} onClick={(e) => e.stopPropagation()} className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button></AlertDialogTrigger>
                  <AlertDialogContent className="bg-white" onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader><AlertDialogTitle>Hapus item pekerjaan?</AlertDialogTitle><AlertDialogDescription>Seluruh log progress item ini akan dihapus.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => removeItem(it.id)} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="bg-white max-w-sm">
          <DialogHeader><DialogTitle className="font-display text-xl">Tambah Item Pekerjaan</DialogTitle></DialogHeader>
          <div className="space-y-3.5">
            <div><Label>Nama Item</Label><Input data-testid="workitem-name-input" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="Pekerjaan Plafon Gypsum" className="mt-1" /></div>
            <div><Label>Nilai Item (Rp)</Label><Input data-testid="workitem-nilai-input" type="number" value={itemForm.nilai} onChange={(e) => setItemForm({ ...itemForm, nilai: e.target.value })} placeholder="90000000" className="mt-1 font-mono" /><p className="text-[11px] text-slate-400 mt-1">Bobot dihitung otomatis dari nilai kontrak proyek.</p></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)}>Batal</Button>
            <Button data-testid="workitem-submit-button" onClick={addItem} disabled={busy} className="bg-amber-600 hover:bg-amber-700 text-white">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="bg-white max-w-md max-h-[90vh] overflow-y-auto pf-scrollbar">
          <DialogHeader><DialogTitle className="font-display text-lg">{activeItem?.name}</DialogTitle></DialogHeader>
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
                        {e.photoUrls?.length > 0 && <div className="flex gap-1.5 mt-1">{e.photoUrls.map((p, i) => <img key={i} src={fileUrl(p)} alt="" className="w-12 h-12 object-cover rounded border border-slate-200" />)}</div>}
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
