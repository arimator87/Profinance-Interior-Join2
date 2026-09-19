import { useState, useRef } from "react";
import { api, fileUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, ArrowDownLeft, ArrowUpRight, Loader2, Trash2, ImageIcon, Upload, ReceiptText, Pencil } from "lucide-react";
import { rupiah, fmtDate, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/lib/format";
import { toast } from "sonner";

export function CashFlowTab({ project, transactions, onChange }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("in");
  const [form, setForm] = useState({ amount: "", category: "Downpayment", description: "", date: "" });
  const [customCat, setCustomCat] = useState("");
  const [receiptPath, setReceiptPath] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const fileRef = useRef();

  const cats = type === "in" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const resetForm = () => {
    setForm({ amount: "", category: type === "in" ? "Downpayment" : "Material", description: "", date: "" });
    setCustomCat(""); setReceiptPath(null);
  };

  const openFor = (t) => {
    setEditingId(null);
    setType(t);
    setForm({ amount: "", category: t === "in" ? "Downpayment" : "Material", description: "", date: "" });
    setCustomCat(""); setReceiptPath(null);
    setOpen(true);
  };

  const openEdit = (tx) => {
    setEditingId(tx.id);
    setType(tx.type);
    const list = tx.type === "in" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const known = list.includes(tx.category);
    setForm({
      amount: String(tx.amount),
      category: known ? tx.category : "Kustom",
      description: tx.description || "",
      date: tx.date ? tx.date.slice(0, 10) : "",
    });
    setCustomCat(known ? "" : tx.category);
    setReceiptPath(tx.receiptUrl || null);
    setOpen(true);
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setReceiptPath(res.data.path);
      toast.success("Foto nota terunggah");
    } catch {
      toast.error("Gagal upload foto");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!form.amount || parseInt(form.amount, 10) <= 0) return toast.error("Jumlah harus lebih dari 0");
    const category = form.category === "Kustom" ? (customCat || "Lainnya") : form.category;
    setBusy(true);
    try {
      const payload = {
        type, amount: parseInt(form.amount, 10), category,
        description: form.description,
        date: form.date ? new Date(form.date).toISOString() : null,
        receiptUrl: receiptPath,
      };
      if (editingId) {
        await api.put(`/transactions/${editingId}`, payload);
        toast.success("Transaksi diperbarui");
      } else {
        await api.post(`/projects/${project.id}/transactions`, payload);
        toast.success("Transaksi ditambahkan");
      }
      setOpen(false); setEditingId(null); resetForm(); onChange();
    } catch {
      toast.error("Gagal menyimpan transaksi");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try { await api.delete(`/transactions/${id}`); toast.success("Transaksi dihapus"); onChange(); }
    catch { toast.error("Gagal menghapus"); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-lg text-slate-900">Arus Kas</h3>
        <div className="flex gap-2">
          <Button data-testid="btn-add-transaction-in" size="sm" onClick={() => openFor("in")} className="bg-green-600 hover:bg-green-700 text-white gap-1.5">
            <ArrowDownLeft className="w-4 h-4" /> Masuk
          </Button>
          <Button data-testid="btn-add-transaction" size="sm" onClick={() => openFor("out")} className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5">
            <ArrowUpRight className="w-4 h-4" /> Keluar
          </Button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <Card className="p-10 text-center border-dashed border-2 bg-white/50">
          <ReceiptText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Belum ada transaksi. Tambahkan pemasukan atau pengeluaran.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <Card data-testid={`transaction-row-${t.id}`} key={t.id} className="p-3.5 border-slate-200 bg-white flex items-center gap-3 hover:shadow-sm transition-shadow">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${t.type === "in" ? "bg-green-100" : "bg-orange-100"}`}>
                {t.type === "in" ? <ArrowDownLeft className="w-5 h-5 text-green-600" /> : <ArrowUpRight className="w-5 h-5 text-orange-600" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900 text-sm truncate">{t.category}</span>
                  {t.receiptUrl && <ImageIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                </div>
                <div className="text-xs text-slate-500 truncate">{t.description || "-"} · {fmtDate(t.date)}</div>
              </div>
              {t.receiptUrl && (
                <a href={fileUrl(t.receiptUrl)} target="_blank" rel="noreferrer" className="shrink-0">
                  <img src={fileUrl(t.receiptUrl)} alt="nota" className="w-10 h-10 rounded-md object-cover border border-slate-200" />
                </a>
              )}
              <div className="text-right shrink-0">
                <div className="font-mono font-bold text-sm" style={{ color: t.type === "in" ? "#16a34a" : "#ea580c" }}>
                  {t.type === "in" ? "+" : "-"}{rupiah(t.amount)}
                </div>
              </div>
              <button data-testid={`edit-transaction-${t.id}`} onClick={() => openEdit(t)} className="text-slate-300 hover:text-amber-600 shrink-0"><Pencil className="w-4 h-4" /></button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button data-testid={`delete-transaction-${t.id}`} className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-white">
                  <AlertDialogHeader><AlertDialogTitle>Hapus transaksi ini?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => remove(t.id)} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editingId ? "Edit" : "Tambah"} Transaksi {type === "in" ? "Masuk" : "Keluar"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5">
            <div>
              <Label>Jumlah (Rp)</Label>
              <Input data-testid="transaction-amount-input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" className="mt-1 font-mono" />
            </div>
            <div>
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="transaction-category-select" className="mt-1 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="Kustom">Kustom…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.category === "Kustom" && (
              <div><Label>Nama Kategori Kustom</Label><Input data-testid="transaction-custom-category" value={customCat} onChange={(e) => setCustomCat(e.target.value)} placeholder="mis. Subkontraktor" className="mt-1" /></div>
            )}
            <div>
              <Label>Keterangan</Label>
              <Textarea data-testid="transaction-description-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="opsional" className="mt-1 resize-none" rows={2} />
            </div>
            <div>
              <Label>Tanggal</Label>
              <Input data-testid="transaction-date-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Foto Nota / Bukti Transfer</Label>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} />
              <Button data-testid="transaction-upload-btn" type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-1 w-full gap-2">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {receiptPath ? "Ganti Foto" : "Upload Foto"}
              </Button>
              {receiptPath && <img src={fileUrl(receiptPath)} alt="preview" className="mt-2 w-full h-32 object-cover rounded-lg border border-slate-200" />}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button data-testid="transaction-submit-button" onClick={submit} disabled={busy} className="bg-amber-600 hover:bg-amber-700 text-white">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
