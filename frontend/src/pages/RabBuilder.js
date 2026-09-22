import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Plus, Trash2, FileDown, Share2, CheckCircle2, ArrowLeft, Layers,
  Package, GripVertical, ChevronDown, ChevronRight, Building2, Save, Sparkles,
} from "lucide-react";
import { rupiah } from "@/lib/format";
import { computeRab, emptyRab, uid, num } from "@/lib/rab";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const UNITS = ["Unit", "Ls", "m", "m2", "m3", "bh", "titik", "set", "pkt"];
const CATEGORIES = ["Residensial", "Kantor", "Komersial", "F&B", "Lainnya"];

function Money({ value, className = "" }) {
  return <span className={`font-mono ${className}`}>{rupiah(value)}</span>;
}

export default function RabBuilder() {
  const { projectId: routeId } = useParams();
  const navigate = useNavigate();
  const { isPremium } = useAuth();

  const [projectId, setProjectId] = useState(routeId || null);
  const [status, setStatus] = useState("Prospek");
  const [rabSlug, setRabSlug] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [category, setCategory] = useState("Residensial");
  const [rab, setRab] = useState(emptyRab());
  const [loading, setLoading] = useState(!!routeId);
  const [saving, setSaving] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [showCompany, setShowCompany] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  const computed = useMemo(() => computeRab(rab), [rab]);

  useEffect(() => {
    if (!routeId) return;
    (async () => {
      try {
        const res = await api.get(`/projects/${routeId}/rab`);
        const d = res.data;
        setProjectName(d.projectName || "");
        setCategory(d.category || "Residensial");
        setStatus(d.status || "Prospek");
        setRabSlug(d.rabSlug || null);
        const loaded = d.rab && Object.keys(d.rab).length ? d.rab : emptyRab();
        // ensure ids for react keys
        loaded.sections = (loaded.sections || []).map((s) => ({
          ...s, id: s.id || uid(),
          subItems: (s.subItems || []).map((si) => ({
            ...si, id: si.id || uid(),
            materials: (si.materials || []).map((m) => ({ ...m, id: m.id || uid() })),
          })),
        }));
        setRab(loaded);
        setProjectId(routeId);
      } catch (e) {
        toast.error(e?.response?.data?.detail || "Gagal memuat RAB");
      } finally {
        setLoading(false);
      }
    })();
  }, [routeId]);

  // ---- mutation helpers ----
  const patchRab = (patch) => setRab((r) => ({ ...r, ...patch }));
  const updateSection = (si, patch) =>
    setRab((r) => ({ ...r, sections: r.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)) }));
  const updateSub = (si, sj, patch) =>
    setRab((r) => ({
      ...r,
      sections: r.sections.map((s, i) =>
        i === si ? { ...s, subItems: s.subItems.map((x, j) => (j === sj ? { ...x, ...patch } : x)) } : s
      ),
    }));
  const updateMat = (si, sj, mk, patch) =>
    setRab((r) => ({
      ...r,
      sections: r.sections.map((s, i) =>
        i === si
          ? {
              ...s,
              subItems: s.subItems.map((x, j) =>
                j === sj ? { ...x, materials: x.materials.map((m, k) => (k === mk ? { ...m, ...patch } : m)) } : x
              ),
            }
          : s
      ),
    }));

  const addSection = () =>
    setRab((r) => ({ ...r, sections: [...r.sections, { id: uid(), name: "", subItems: [{ id: uid(), name: "", qty: 1, unit: "Unit", hargaSatuan: 0, materials: [] }] }] }));
  const removeSection = (si) => setRab((r) => ({ ...r, sections: r.sections.filter((_, i) => i !== si) }));
  const addSub = (si) => updateSection(si, { subItems: [...rab.sections[si].subItems, { id: uid(), name: "", qty: 1, unit: "Unit", hargaSatuan: 0, materials: [] }] });
  const removeSub = (si, sj) => updateSection(si, { subItems: rab.sections[si].subItems.filter((_, j) => j !== sj) });
  const addMat = (si, sj) => {
    const cur = rab.sections[si].subItems[sj].materials || [];
    updateSub(si, sj, { materials: [...cur, { id: uid(), name: "", nilai: 0 }] });
  };
  const removeMat = (si, sj, mk) =>
    updateSub(si, sj, { materials: rab.sections[si].subItems[sj].materials.filter((_, k) => k !== mk) });

  const addTermin = () => patchRab({ termins: [...(rab.termins || []), { label: "", percent: 0 }] });
  const updateTermin = (i, patch) => patchRab({ termins: rab.termins.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const removeTermin = (i) => patchRab({ termins: rab.termins.filter((_, j) => j !== i) });

  const toggleCollapse = (id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  // ---- persistence ----
  const save = async () => {
    if (!projectName.trim()) {
      toast.error("Isi nama proyek terlebih dahulu");
      return null;
    }
    setSaving(true);
    try {
      const payload = { projectName: projectName.trim(), category, rab };
      if (projectId) {
        await api.put(`/projects/${projectId}/rab`, payload);
        toast.success("RAB tersimpan");
        return projectId;
      }
      const res = await api.post(`/rab`, payload);
      const id = res.data.id;
      setProjectId(id);
      setStatus(res.data.status || "Prospek");
      toast.success("RAB dibuat & masuk ke menu Prospek");
      window.history.replaceState(null, "", `/rab/${id}`);
      return id;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyimpan RAB");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    const id = projectId || (await save());
    if (!id) return;
    const token = localStorage.getItem("pf_token");
    window.open(`${API}/projects/${id}/rab/pdf?auth=${encodeURIComponent(token || "")}`, "_blank");
  };

  const shareWa = async () => {
    const id = projectId || (await save());
    if (!id) return;
    try {
      const res = await api.get(`/projects/${id}/rab/share-link`);
      const slug = res.data.slug;
      setRabSlug(slug);
      const link = `${BACKEND_URL}/api/public/rab/${slug}/pdf`;
      const msg =
        `Halo${rab.clientName ? " " + rab.clientName : ""}, berikut Surat Penawaran (RAB) untuk *${projectName}*.\n\n` +
        `Grand Total: ${rupiah(computed.grandTotal)}\n\nDokumen PDF: ${link}\n\nTerima kasih.`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    } catch {
      toast.error("Gagal membuat link berbagi");
    }
  };

  const dealProject = async () => {
    const id = projectId || (await save());
    if (!id) return;
    setDealing(true);
    try {
      await api.post(`/projects/${id}/deal`);
      toast.success("Project di-DEAL! Semua item RAB masuk ke Progress.");
      navigate(`/project/${id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal deal project");
    } finally {
      setDealing(false);
    }
  };

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7 text-amber-600" />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">Pembuat RAB (Premium)</h1>
          <p className="text-slate-500 mt-2 mb-6">Buat Surat Penawaran profesional dengan item, sub-item, material, export PDF & share WhatsApp.</p>
          <Button onClick={() => navigate("/pricing")} className="bg-amber-600 hover:bg-amber-700 text-white">Upgrade ke Premium</Button>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pf-grain pb-28">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <button onClick={() => navigate("/dashboard")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-amber-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-amber-600 flex items-center justify-center shadow-sm">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-slate-900 tracking-tight">
              {projectId ? "Edit RAB" : "Buat RAB"} — Surat Penawaran
            </h1>
            <p className="text-sm text-slate-500">
              Status: <span className={`font-semibold ${status === "Prospek" ? "text-amber-600" : "text-green-600"}`}>{status}</span>
              {" · "}Item pekerjaan, sub-item & material dengan harga.
            </p>
          </div>
        </div>

        {/* Info Proyek & Klien */}
        <Card className="p-5 mb-5 border-slate-200">
          <h2 className="font-display font-bold text-slate-900 mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-amber-600" /> Info Proyek & Klien</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nama Proyek *">
              <Input data-testid="rab-project-name" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="mis. Interior Apartemen Puri Imperium" />
            </Field>
            <Field label="Kategori">
              <select data-testid="rab-category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Nama Klien"><Input value={rab.clientName} onChange={(e) => patchRab({ clientName: e.target.value })} placeholder="mis. Mba Grace" /></Field>
            <Field label="Telepon Klien"><Input value={rab.clientPhone} onChange={(e) => patchRab({ clientPhone: e.target.value })} placeholder="08xxxx" /></Field>
            <Field label="Alamat Klien" full><Input value={rab.clientAddress} onChange={(e) => patchRab({ clientAddress: e.target.value })} placeholder="Alamat proyek/klien" /></Field>
            <Field label="No. Penawaran"><Input value={rab.quotationNo} onChange={(e) => patchRab({ quotationNo: e.target.value })} placeholder="15/FT-QUOT/IX/26" /></Field>
            <Field label="Tanggal"><Input type="date" value={(rab.quotationDate || "").slice(0, 10)} onChange={(e) => patchRab({ quotationDate: e.target.value })} /></Field>
          </div>

          {/* Company profile collapsible */}
          <button onClick={() => setShowCompany((v) => !v)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800">
            {showCompany ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} Header Perusahaan (untuk PDF)
          </button>
          {showCompany && (
            <div className="grid sm:grid-cols-2 gap-4 mt-3 p-4 rounded-lg bg-slate-50 border border-slate-100">
              <Field label="Nama Perusahaan"><Input value={rab.companyName} onChange={(e) => patchRab({ companyName: e.target.value })} /></Field>
              <Field label="Telepon Perusahaan"><Input value={rab.companyPhone} onChange={(e) => patchRab({ companyPhone: e.target.value })} /></Field>
              <Field label="Alamat Perusahaan" full><Input value={rab.companyAddress} onChange={(e) => patchRab({ companyAddress: e.target.value })} /></Field>
              <Field label="Bank"><Input value={rab.bankName} onChange={(e) => patchRab({ bankName: e.target.value })} placeholder="BCA" /></Field>
              <Field label="No. Rekening"><Input value={rab.bankAccount} onChange={(e) => patchRab({ bankAccount: e.target.value })} /></Field>
              <Field label="Atas Nama"><Input value={rab.bankHolder} onChange={(e) => patchRab({ bankHolder: e.target.value })} /></Field>
              <Field label="Penanda Tangan (Kami)"><Input value={rab.signerLeft} onChange={(e) => patchRab({ signerLeft: e.target.value })} /></Field>
              <Field label="Penanda Tangan (Klien)"><Input value={rab.signerRight} onChange={(e) => patchRab({ signerRight: e.target.value })} /></Field>
            </div>
          )}
        </Card>

        {/* Item Pekerjaan builder */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-slate-900 flex items-center gap-2"><Package className="w-4 h-4 text-amber-600" /> Item Pekerjaan</h2>
          <Button data-testid="rab-add-section" size="sm" variant="outline" onClick={addSection} className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"><Plus className="w-4 h-4" /> Item Pekerjaan</Button>
        </div>

        {rab.sections.map((sec, si) => {
          const secComp = computed.sections[si] || { subtotal: 0, subItems: [] };
          const isCol = collapsed[sec.id];
          return (
            <Card key={sec.id} data-testid={`rab-section-${si}`} className="mb-4 border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 p-3 bg-slate-900 text-white">
                <button onClick={() => toggleCollapse(sec.id)} className="text-white/70 hover:text-white">
                  {isCol ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <GripVertical className="w-4 h-4 text-white/40" />
                <Input
                  data-testid={`rab-section-name-${si}`}
                  value={sec.name}
                  onChange={(e) => updateSection(si, { name: e.target.value })}
                  placeholder="Nama Item Pekerjaan (mis. BEDROOM)"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-9 font-semibold flex-1"
                />
                <span className="font-mono font-bold text-amber-300 text-sm whitespace-nowrap px-2">{rupiah(secComp.subtotal)}</span>
                <button data-testid={`rab-remove-section-${si}`} onClick={() => removeSection(si)} className="text-white/60 hover:text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
              </div>

              {!isCol && (
                <div className="p-3 space-y-3">
                  {sec.subItems.map((sub, sj) => {
                    const subComp = (secComp.subItems && secComp.subItems[sj]) || { nilai: 0, no: "" };
                    return (
                      <div key={sub.id} data-testid={`rab-sub-${si}-${sj}`} className="rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                          <div className="w-7 shrink-0 text-center pt-6 hidden sm:block">
                            <span className="text-xs font-bold text-slate-400">{subComp.no}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <Label className="text-[11px] text-slate-500">Keterangan Sub-item</Label>
                            <Input value={sub.name} onChange={(e) => updateSub(si, sj, { name: e.target.value })} placeholder="mis. Lemari Pakaian 249x60x125" className="h-9" />
                          </div>
                          <div className="w-20">
                            <Label className="text-[11px] text-slate-500">Qty</Label>
                            <Input type="number" step="0.01" value={sub.qty} onChange={(e) => updateSub(si, sj, { qty: e.target.value })} className="h-9 font-mono" />
                          </div>
                          <div className="w-24">
                            <Label className="text-[11px] text-slate-500">Satuan</Label>
                            <select value={sub.unit} onChange={(e) => updateSub(si, sj, { unit: e.target.value })} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm">
                              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </div>
                          <div className="w-36">
                            <Label className="text-[11px] text-slate-500">Harga Satuan</Label>
                            <Input type="number" value={sub.hargaSatuan} onChange={(e) => updateSub(si, sj, { hargaSatuan: e.target.value })} className="h-9 font-mono" />
                          </div>
                          <button onClick={() => removeSub(si, sj)} className="text-slate-400 hover:text-red-500 p-2 self-center sm:self-end"><Trash2 className="w-4 h-4" /></button>
                        </div>

                        {/* materials */}
                        {(sub.materials || []).length > 0 && (
                          <div className="mt-2 pl-2 sm:pl-9 space-y-1.5">
                            {sub.materials.map((m, mk) => (
                              <div key={m.id} className="flex items-center gap-2">
                                <span className="text-slate-300">•</span>
                                <Input value={m.name} onChange={(e) => updateMat(si, sj, mk, { name: e.target.value })} placeholder="Nama material / finishing" className="h-8 text-sm flex-1" />
                                <Input type="number" value={m.nilai} onChange={(e) => updateMat(si, sj, mk, { nilai: e.target.value })} placeholder="Nilai (opsional)" className="h-8 text-sm w-32 font-mono" />
                                <button onClick={() => removeMat(si, sj, mk)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-2 pl-2 sm:pl-9">
                          <button data-testid={`rab-add-material-${si}-${sj}`} onClick={() => addMat(si, sj)} className="text-xs text-amber-700 hover:text-amber-800 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Material</button>
                          <div className="text-xs text-slate-500">Nilai sub-item: <Money value={subComp.nilai} className="font-semibold text-slate-800" /></div>
                        </div>
                      </div>
                    );
                  })}
                  <Button data-testid={`rab-add-sub-${si}`} size="sm" variant="ghost" onClick={() => addSub(si)} className="text-amber-700 hover:bg-amber-50 gap-1.5"><Plus className="w-4 h-4" /> Sub-item</Button>
                </div>
              )}
            </Card>
          );
        })}

        {/* Ringkasan Keuangan */}
        <Card className="p-5 mt-6 border-slate-200">
          <h2 className="font-display font-bold text-slate-900 mb-4">Ringkasan Keuangan</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Field label="Discount (Rp)"><Input type="number" value={rab.discount} onChange={(e) => patchRab({ discount: e.target.value })} className="font-mono" /></Field>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div>
                  <div className="text-sm font-medium text-slate-800">PPN</div>
                  <div className="text-xs text-slate-500">Aktifkan pajak pertambahan nilai</div>
                </div>
                <div className="flex items-center gap-3">
                  {rab.ppnEnabled && (
                    <Input type="number" value={rab.ppnPercent} onChange={(e) => patchRab({ ppnPercent: e.target.value })} className="w-20 h-9 font-mono" />
                  )}
                  <Switch data-testid="rab-ppn-toggle" checked={rab.ppnEnabled} onCheckedChange={(v) => patchRab({ ppnEnabled: v })} />
                </div>
              </div>

              <div className="pt-1">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium text-slate-700">Termin Pembayaran</Label>
                  <button onClick={addTermin} className="text-xs text-amber-700 hover:text-amber-800 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Termin</button>
                </div>
                <div className="space-y-2">
                  {(rab.termins || []).map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={t.label} onChange={(e) => updateTermin(i, { label: e.target.value })} placeholder="mis. Down Payment" className="h-9 text-sm flex-1" />
                      <div className="relative w-20">
                        <Input type="number" value={t.percent} onChange={(e) => updateTermin(i, { percent: e.target.value })} className="h-9 font-mono pr-6" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                      </div>
                      <span className="w-28 text-right font-mono text-xs text-slate-600">{rupiah((computed.termins[i] && computed.termins[i].nominal) || 0)}</span>
                      <button onClick={() => removeTermin(i)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <Field label="Catatan / Syarat"><Textarea value={rab.notes} onChange={(e) => patchRab({ notes: e.target.value })} rows={2} placeholder="mis. Harga sudah termasuk pemasangan." /></Field>
            </div>

            {/* totals */}
            <div className="rounded-xl bg-slate-900 text-white p-5 self-start">
              <Row label="Sub Total" value={computed.totalItems} />
              {computed.discount > 0 && <Row label="Discount" value={-computed.discount} />}
              {computed.ppnEnabled && <Row label={`PPN ${num(rab.ppnPercent)}%`} value={computed.ppnAmount} />}
              <div className="h-px bg-white/15 my-3" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">GRAND TOTAL</span>
                <span data-testid="rab-grand-total" className="font-mono font-extrabold text-2xl text-amber-400">{rupiah(computed.grandTotal)}</span>
              </div>
              <p className="text-[11px] text-white/50 mt-2">Nilai ini otomatis jadi Nilai Kontrak saat proyek di-Deal.</p>
            </div>
          </div>
        </Card>
      </main>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-200 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500 hidden sm:block">
            Grand Total: <Money value={computed.grandTotal} className="font-bold text-slate-900" />
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <Button data-testid="rab-save" variant="outline" onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
            </Button>
            <Button data-testid="rab-export-pdf" variant="outline" onClick={exportPdf} className="gap-1.5"><FileDown className="w-4 h-4" /> PDF</Button>
            <Button data-testid="rab-share-wa" variant="outline" onClick={shareWa} className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"><Share2 className="w-4 h-4" /> Share WA</Button>
            {status === "Prospek" ? (
              <Button data-testid="rab-deal" onClick={dealProject} disabled={dealing} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                {dealing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Deal Project
              </Button>
            ) : (
              <Button data-testid="rab-open-project" onClick={() => navigate(`/project/${projectId}`)} className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
                Buka Proyek
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <Label className="text-[11px] text-slate-500 mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-white/70">{label}</span>
      <span className="font-mono text-sm">{rupiah(value)}</span>
    </div>
  );
}
