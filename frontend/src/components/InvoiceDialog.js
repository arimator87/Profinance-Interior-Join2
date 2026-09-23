import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Info } from "lucide-react";
import { rupiah } from "@/lib/format";
import { toast } from "sonner";

const TYPES = [
  { v: "proforma", label: "Proforma Invoice", hint: "Permintaan pembayaran DP / termin (sebelum serah terima). Bukan faktur pajak." },
  { v: "final", label: "Invoice (Final)", hint: "Tagihan resmi saat pelunasan / serah terima pekerjaan." },
  { v: "retention", label: "Invoice Retensi", hint: "Menagih retensi yang ditahan, setelah masa pemeliharaan selesai." },
];
const STATUSES = ["Draft", "Terkirim", "Lunas"];

const blankItem = () => ({ description: "", qty: 1, unitPrice: 0 });

export function InvoiceDialog({ open, onOpenChange, project, invoice = null, onSaved }) {
  const isEdit = !!invoice;
  const [busy, setBusy] = useState(false);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [ctx, setCtx] = useState(null);
  const [form, setForm] = useState(null);

  const buildFromInvoice = (inv) => ({
    type: inv.type || "proforma",
    number: inv.number || "",
    quotationNo: inv.quotationNo || "",
    invoiceDate: inv.invoiceDate ? inv.invoiceDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : "",
    status: inv.status || "Draft",
    clientName: inv.clientName || "",
    clientAddress: inv.clientAddress || "",
    clientPhone: inv.clientPhone || "",
    items: (inv.items && inv.items.length ? inv.items.map((i) => ({ description: i.description || "", qty: i.qty ?? 1, unitPrice: i.unitPrice ?? 0 })) : [blankItem()]),
    ppnEnabled: !!inv.ppnEnabled,
    ppnPercent: inv.ppnPercent ?? 11,
    retentionEnabled: !!inv.retentionEnabled,
    retentionPercent: inv.retentionPercent ?? 5,
    companyName: inv.companyName || "", companyAddress: inv.companyAddress || "", companyPhone: inv.companyPhone || "",
    bankName: inv.bankName || "", bankAccount: inv.bankAccount || "", bankHolder: inv.bankHolder || "",
    signerLeft: inv.signerLeft || "", signerRight: inv.signerRight || "", signatureImage: inv.signatureImage || "",
    notes: inv.notes || "",
  });

  const loadContext = useCallback(async () => {
    setLoadingCtx(true);
    try {
      const { data } = await api.get(`/projects/${project.id}/invoice-context`);
      setCtx(data);
      const sug = data.suggestion || {};
      const seq = String((data.existingCount || 0) + 1).padStart(3, "0");
      setForm({
        type: sug.type || "proforma",
        number: "",
        quotationNo: data.rabRef?.quotationNo || "",
        invoiceDate: new Date().toISOString().slice(0, 10),
        dueDate: "",
        status: "Draft",
        clientName: data.client?.clientName || "",
        clientAddress: data.client?.clientAddress || "",
        clientPhone: data.client?.clientPhone || "",
        items: [{ description: sug.description || "Pembayaran", qty: 1, unitPrice: sug.amount || 0 }],
        ppnEnabled: !!data.ppn?.ppnEnabled,
        ppnPercent: data.ppn?.ppnPercent ?? 11,
        retentionEnabled: false,
        retentionPercent: 5,
        companyName: data.company?.companyName || "", companyAddress: data.company?.companyAddress || "", companyPhone: data.company?.companyPhone || "",
        bankName: data.company?.bankName || "", bankAccount: data.company?.bankAccount || "", bankHolder: data.company?.bankHolder || "",
        signerLeft: data.company?.signerLeft || "", signerRight: data.company?.signerRight || "", signatureImage: data.company?.signatureImage || "",
        notes: "",
        _seq: seq,
      });
    } catch {
      toast.error("Gagal memuat data invoice");
      setForm({ ...buildFromInvoice({}), items: [blankItem()] });
    } finally {
      setLoadingCtx(false);
    }
  }, [project?.id]);

  useEffect(() => {
    if (!open) return;
    if (invoice) {
      setForm(buildFromInvoice(invoice));
      setCtx(null);
    } else {
      loadContext();
    }
  }, [open, invoice, loadContext]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (idx, k, v) => setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, [k]: v } : it)) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, blankItem()] }));
  const removeItem = (idx) => setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, i) => i !== idx) : f.items }));

  // live preview
  const preview = (() => {
    if (!form) return null;
    const subtotal = form.items.reduce((s, it) => s + Math.round((Number(it.qty) || 0) * (Number(it.unitPrice) || 0)), 0);
    const ppn = form.ppnEnabled ? Math.round((subtotal * (Number(form.ppnPercent) || 0)) / 100) : 0;
    const gross = subtotal + ppn;
    // Retention is held back on the TOTAL CONTRACT VALUE (nilai kontrak), not the invoice subtotal.
    const contractValue = Number(ctx?.project?.nominal) || 0;
    const retBase = contractValue || subtotal;
    const ret = form.retentionEnabled ? Math.round((retBase * (Number(form.retentionPercent) || 0)) / 100) : 0;
    return { subtotal, ppn, gross, ret, due: gross - ret, contractValue };
  })();

  const submit = async () => {
    if (!form.number.trim()) return toast.error("Nomor invoice wajib diisi");
    if (!form.items.length || form.items.every((i) => !(Number(i.unitPrice) > 0))) {
      return toast.error("Isi minimal satu item dengan nominal");
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        number: form.number.trim(),
        ppnPercent: Number(form.ppnPercent) || 0,
        retentionPercent: Number(form.retentionPercent) || 0,
        items: form.items.map((i) => ({ description: i.description, qty: Number(i.qty) || 0, unitPrice: Number(i.unitPrice) || 0 })),
        invoiceDate: form.invoiceDate ? new Date(form.invoiceDate).toISOString() : null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      };
      delete payload._seq;
      if (isEdit) {
        await api.put(`/invoices/${invoice.id}`, payload);
        toast.success("Invoice diperbarui");
      } else {
        await api.post(`/projects/${project.id}/invoices`, payload);
        toast.success("Invoice dibuat");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyimpan invoice");
    } finally {
      setBusy(false);
    }
  };

  const typeHint = TYPES.find((t) => t.v === form?.type)?.hint;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-2xl max-h-[92vh] overflow-y-auto pf-scrollbar">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{isEdit ? "Edit Invoice" : "Buat Invoice"}</DialogTitle>
        </DialogHeader>

        {(!form || loadingCtx) ? (
          <div className="py-12 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-600" /></div>
        ) : (
          <div className="space-y-4 py-1">
            {/* Type + number */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Jenis Dokumen</Label>
                <Select value={form.type} onValueChange={(v) => set("type", v)}>
                  <SelectTrigger data-testid="invoice-type-select" className="mt-1 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>No. Invoice *</Label>
                <Input data-testid="invoice-number-input" value={form.number} onChange={(e) => set("number", e.target.value)}
                  placeholder={form.type === "proforma" ? `PRO/2025/07/${form._seq || "001"}` : `INV/2025/07/${form._seq || "001"}`} className="mt-1" />
              </div>
            </div>
            {typeHint && (
              <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" /> <span>{typeHint}</span>
              </div>
            )}

            <div>
              <Label>No. Quotation (Ref)</Label>
              <Input data-testid="invoice-quotation-input" value={form.quotationNo} onChange={(e) => set("quotationNo", e.target.value)}
                placeholder="15/FT-QUOT/IX/26" className="mt-1" />
              <p className="text-[11px] text-slate-400 mt-1">Otomatis dari RAB proyek bila ada — jadi keterangan pembayaran untuk klien.</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Tanggal</Label>
                <Input type="date" value={form.invoiceDate} onChange={(e) => set("invoiceDate", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Jatuh Tempo</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger data-testid="invoice-status-select" className="mt-1 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Client */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Nama Klien</Label>
                <Input value={form.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Bpk. Andika" className="mt-1" />
              </div>
              <div>
                <Label>Telp Klien</Label>
                <Input value={form.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} placeholder="0812..." className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Alamat Klien</Label>
              <Textarea value={form.clientAddress} onChange={(e) => set("clientAddress", e.target.value)} rows={2} className="mt-1 resize-none" />
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Rincian Tagihan</Label>
                <Button type="button" variant="outline" size="sm" data-testid="invoice-add-item" onClick={addItem} className="gap-1 h-7 text-xs"><Plus className="w-3.5 h-3.5" /> Tambah Item</Button>
              </div>
              <div className="space-y-2">
                {form.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-start bg-slate-50 rounded-lg p-2">
                    <div className="col-span-12 sm:col-span-6">
                      <Input data-testid={`invoice-item-desc-${idx}`} value={it.description} onChange={(e) => setItem(idx, "description", e.target.value)} placeholder="Uraian (mis. Uang Muka 50%)" className="bg-white" />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <Input type="number" value={it.qty} onChange={(e) => setItem(idx, "qty", e.target.value)} placeholder="Qty" className="bg-white" />
                    </div>
                    <div className="col-span-7 sm:col-span-3">
                      <Input type="number" data-testid={`invoice-item-price-${idx}`} value={it.unitPrice} onChange={(e) => setItem(idx, "unitPrice", e.target.value)} placeholder="Harga" className="bg-white font-mono" />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex justify-end">
                      <button type="button" onClick={() => removeItem(idx)} className="w-8 h-8 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PPN + Retention */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <Label className="cursor-pointer">PPN</Label>
                  <Switch data-testid="invoice-ppn-switch" checked={form.ppnEnabled} onCheckedChange={(v) => set("ppnEnabled", v)} />
                </div>
                {form.ppnEnabled && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input type="number" value={form.ppnPercent} onChange={(e) => set("ppnPercent", e.target.value)} className="w-24 font-mono" />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <Label className="cursor-pointer">Retensi (ditahan)</Label>
                  <Switch data-testid="invoice-retention-switch" checked={form.retentionEnabled} onCheckedChange={(v) => set("retentionEnabled", v)} />
                </div>
                {form.retentionEnabled && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <Input type="number" value={form.retentionPercent} onChange={(e) => set("retentionPercent", e.target.value)} className="w-24 font-mono" />
                      <span className="text-sm text-slate-500">% dari Nilai Kontrak</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Nilai Kontrak {rupiah(preview?.contractValue || 0)} · Retensi ditahan {rupiah(preview?.ret || 0)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label>Catatan</Label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="mt-1 resize-none" placeholder="Catatan tambahan (opsional)" />
            </div>

            {/* Live summary */}
            {preview && (
              <div className="rounded-xl bg-slate-900 text-white p-4 space-y-1.5" data-testid="invoice-summary">
                <Row label="Sub Total" value={rupiah(preview.subtotal)} />
                {form.ppnEnabled && <Row label={`PPN ${Number(form.ppnPercent) || 0}%`} value={rupiah(preview.ppn)} />}
                {form.retentionEnabled && preview.ret > 0 && (
                  <>
                    <Row label="Total" value={rupiah(preview.gross)} />
                    <Row label={`Retensi ${Number(form.retentionPercent) || 0}% dari Nilai Kontrak (ditahan)`} value={`- ${rupiah(preview.ret)}`} muted />
                  </>
                )}
                <div className="border-t border-white/15 pt-1.5 mt-1.5">
                  <Row label={form.retentionEnabled && preview.ret > 0 ? "Dibayar Sekarang" : "Total Tagihan"} value={rupiah(preview.due)} big />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button data-testid="invoice-submit-button" onClick={submit} disabled={busy || !form} className="bg-amber-600 hover:bg-amber-700 text-white">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEdit ? "Simpan Perubahan" : "Simpan Invoice")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, big, muted }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`${big ? "font-semibold" : ""} ${muted ? "text-white/60" : "text-white/85"} text-sm`}>{label}</span>
      <span className={`font-mono ${big ? "text-lg font-bold text-amber-300" : "text-sm"} ${muted ? "text-white/60" : ""}`}>{value}</span>
    </div>
  );
}
