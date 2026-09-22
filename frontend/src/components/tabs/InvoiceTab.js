import { useState, useEffect, useCallback } from "react";
import { api, invoicePdfUrl } from "@/lib/api";
import { InvoiceDialog } from "@/components/InvoiceDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, FileText, Download, Share2, Pencil, Trash2, ReceiptText } from "lucide-react";
import { rupiah, fmtDate } from "@/lib/format";
import { toast } from "sonner";

const TYPE_META = {
  proforma: { label: "Proforma", cls: "bg-blue-100 text-blue-700" },
  final: { label: "Invoice", cls: "bg-emerald-100 text-emerald-700" },
  retention: { label: "Retensi", cls: "bg-violet-100 text-violet-700" },
};
const STATUS_META = {
  Draft: "bg-slate-100 text-slate-600",
  Terkirim: "bg-amber-100 text-amber-700",
  Lunas: "bg-emerald-100 text-emerald-700",
};
const STATUSES = ["Draft", "Terkirim", "Lunas"];

export function InvoiceTab({ project, createSignal = 0 }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${project.id}/invoices`);
      setInvoices(data);
    } catch {
      toast.error("Gagal memuat invoice");
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const openCreate = useCallback(() => { setEditing(null); setDialogOpen(true); }, []);
  const openEdit = (inv) => { setEditing(inv); setDialogOpen(true); };

  useEffect(() => {
    if (createSignal > 0) openCreate();
  }, [createSignal, openCreate]);

  const downloadPdf = (inv) => {
    window.open(invoicePdfUrl(inv.id), "_blank");
  };

  const shareWa = (inv) => {
    const c = inv.computed || {};
    const typeLabel = TYPE_META[inv.type]?.label || "Invoice";
    const msg =
      `Halo${inv.clientName ? " " + inv.clientName : ""}, berikut ${typeLabel} No. *${inv.number}* untuk proyek *${project.name}*.\n` +
      (inv.quotationNo ? `Ref. Quotation: ${inv.quotationNo}\n` : "") +
      `\nJumlah: ${rupiah(c.amountDue ?? 0)}\n` +
      (inv.dueDate ? `Jatuh tempo: ${fmtDate(inv.dueDate)}\n` : "") +
      `\nMohon konfirmasi setelah pembayaran. Terima kasih.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const changeStatus = async (inv, status) => {
    try {
      await api.put(`/invoices/${inv.id}`, {
        type: inv.type, number: inv.number, quotationNo: inv.quotationNo || "", invoiceDate: inv.invoiceDate, dueDate: inv.dueDate,
        status, clientName: inv.clientName, clientAddress: inv.clientAddress, clientPhone: inv.clientPhone,
        items: inv.items, ppnEnabled: inv.ppnEnabled, ppnPercent: inv.ppnPercent,
        retentionEnabled: inv.retentionEnabled, retentionPercent: inv.retentionPercent,
        companyName: inv.companyName, companyAddress: inv.companyAddress, companyPhone: inv.companyPhone,
        bankName: inv.bankName, bankAccount: inv.bankAccount, bankHolder: inv.bankHolder,
        signerLeft: inv.signerLeft, signerRight: inv.signerRight, signatureImage: inv.signatureImage,
        notes: inv.notes,
      });
      toast.success(`Status diubah ke ${status}`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mengubah status");
    }
  };

  const remove = async (inv) => {
    try {
      await api.delete(`/invoices/${inv.id}`);
      toast.success("Invoice dihapus");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menghapus invoice");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-amber-600" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-slate-900">Invoice & Proforma</h3>
          <p className="text-xs text-slate-500">Proforma untuk DP/termin, Invoice untuk pelunasan, Retensi untuk masa pemeliharaan.</p>
        </div>
        <Button data-testid="btn-create-invoice-tab" onClick={openCreate} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Buat Invoice
        </Button>
      </div>

      {invoices.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200 bg-white/60">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <ReceiptText className="w-7 h-7 text-amber-600" />
          </div>
          <h3 className="font-display font-bold text-lg text-slate-900">Belum ada invoice</h3>
          <p className="text-slate-500 text-sm mt-1 mb-5 max-w-md mx-auto">Buat Proforma Invoice untuk menagih uang muka / termin, atau Invoice final saat pelunasan.</p>
          <Button data-testid="empty-create-invoice" onClick={openCreate} className="bg-amber-600 hover:bg-amber-700 text-white gap-2"><Plus className="w-4 h-4" /> Buat Invoice Pertama</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const meta = TYPE_META[inv.type] || TYPE_META.final;
            const c = inv.computed || {};
            return (
              <Card key={inv.id} data-testid={`invoice-row-${inv.id}`} className="p-4 border-slate-200 bg-white hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-slate-500" /></div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 truncate">{inv.number}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {fmtDate(inv.invoiceDate)}{inv.dueDate ? ` · Jatuh tempo ${fmtDate(inv.dueDate)}` : ""}
                      </div>
                      {inv.retentionEnabled && c.retentionAmount > 0 && (
                        <div className="text-[11px] text-violet-600 mt-0.5">Retensi ditahan: {rupiah(c.retentionAmount)}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-lg text-slate-900">{rupiah(c.amountDue ?? 0)}</div>
                    <div className="mt-1">
                      <Select value={inv.status} onValueChange={(v) => changeStatus(inv, v)}>
                        <SelectTrigger data-testid={`invoice-status-${inv.id}`} className={`h-7 text-xs border-0 px-2 ${STATUS_META[inv.status] || STATUS_META.Draft}`}><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                  <Button variant="outline" size="sm" data-testid={`invoice-pdf-${inv.id}`} onClick={() => downloadPdf(inv)} className="gap-1.5 h-8 text-xs"><Download className="w-3.5 h-3.5" /> PDF</Button>
                  <Button variant="outline" size="sm" onClick={() => shareWa(inv)} className="gap-1.5 h-8 text-xs"><Share2 className="w-3.5 h-3.5" /> WhatsApp</Button>
                  <Button variant="outline" size="sm" data-testid={`invoice-edit-${inv.id}`} onClick={() => openEdit(inv)} className="gap-1.5 h-8 text-xs"><Pencil className="w-3.5 h-3.5" /> Edit</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid={`invoice-delete-${inv.id}`} className="gap-1.5 h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /> Hapus</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-white">
                      <AlertDialogHeader><AlertDialogTitle>Hapus invoice {inv.number}?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => remove(inv)} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <InvoiceDialog open={dialogOpen} onOpenChange={setDialogOpen} project={project} invoice={editing} onSaved={load} />
    </div>
  );
}
