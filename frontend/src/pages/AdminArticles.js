import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { coverSrc, CATEGORY_META, fmtDate } from "@/lib/blog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2, Sparkles, Plus, Pencil, Trash2, ArrowLeft, ImageIcon, Eye,
  Wand2, Newspaper, Clock, RefreshCw, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

const CATS = [
  { key: "interior", label: "Interior" },
  { key: "arsitektur", label: "Arsitektur" },
  { key: "keuangan", label: "Keuangan Proyek" },
  { key: "panduan", label: "Panduan" },
];

const STATUS_STYLE = {
  published: "bg-emerald-100 text-emerald-700",
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-blue-100 text-blue-700",
};

const emptyForm = {
  id: null, title: "", excerpt: "", content_md: "", category: "interior",
  tags: "", status: "draft", seo_title: "", seo_description: "", keywords: "", cover_external: "",
};

export default function AdminArticles() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [coverUrl, setCoverUrl] = useState(null);
  const [regenBusy, setRegenBusy] = useState(false);

  // AI generate
  const [genOpen, setGenOpen] = useState(false);
  const [gen, setGen] = useState({ topic: "", prompt: "", category: "interior", generate_cover: true, publish: true });
  const [genImage, setGenImage] = useState(null);
  const [genBusy, setGenBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/articles?limit=100");
      setItems(data.items || []);
    } catch {
      toast.error("Gagal memuat artikel");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin === false) { navigate("/dashboard", { replace: true }); return; }
    load();
    api.get("/admin/settings").then((r) => setSettings(r.data)).catch(() => {});
  }, [isAdmin, navigate, load]);

  const openNew = () => { setForm(emptyForm); setCoverUrl(null); setEditorOpen(true); };

  const openEdit = async (id) => {
    try {
      const { data } = await api.get(`/admin/articles/${id}`);
      setForm({
        id: data.id, title: data.title, excerpt: data.excerpt, content_md: data.contentMd || "",
        category: data.category, tags: (data.tags || []).join(", "), status: data.status,
        seo_title: data.seoTitle || "", seo_description: data.seoDescription || "",
        keywords: data.keywords || "", cover_external: "",
      });
      setCoverUrl(data.coverUrl || null);
      setEditorOpen(true);
    } catch {
      toast.error("Gagal memuat artikel");
    }
  };

  const save = async () => {
    if (!form.title.trim() || !form.content_md.trim()) {
      toast.error("Judul dan isi artikel wajib diisi");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      excerpt: form.excerpt.trim(),
      content_md: form.content_md,
      category: form.category,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      status: form.status,
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
      keywords: form.keywords.trim() || null,
      cover_external: form.cover_external.trim() || null,
    };
    try {
      if (form.id) {
        await api.put(`/admin/articles/${form.id}`, payload);
        toast.success("Artikel diperbarui");
      } else {
        await api.post("/admin/articles", payload);
        toast.success("Artikel dibuat");
      }
      setEditorOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyimpan artikel");
    } finally {
      setSaving(false);
    }
  };

  const regenCover = async () => {
    if (!form.id) { toast.info("Simpan artikel dulu sebelum membuat cover"); return; }
    setRegenBusy(true);
    try {
      const { data } = await api.post(`/admin/articles/${form.id}/regenerate-cover`);
      setCoverUrl(data.coverUrl || null);
      toast.success("Cover baru dibuat oleh AI");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal membuat cover");
    } finally {
      setRegenBusy(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm("Hapus artikel ini?")) return;
    try {
      await api.delete(`/admin/articles/${id}`);
      toast.success("Artikel dihapus");
      load();
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const onGenImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setGenImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const runGenerate = async () => {
    if (!gen.topic.trim() && !genImage) {
      toast.error("Isi topik atau unggah gambar sebagai sumber");
      return;
    }
    setGenBusy(true);
    try {
      const payload = {
        topic: gen.topic.trim(),
        prompt: gen.prompt.trim(),
        category: gen.category,
        generate_cover: gen.generate_cover,
        publish: gen.publish,
      };
      if (genImage) payload.image_base64 = genImage.split(",").pop();
      const { data } = await api.post("/admin/articles/generate", payload, { timeout: 180000 });
      toast.success(`Artikel AI dibuat: ${data.title}`);
      setGenOpen(false);
      setGen({ topic: "", prompt: "", category: "interior", generate_cover: true, publish: true });
      setGenImage(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal membuat artikel AI, coba lagi");
    } finally {
      setGenBusy(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const { data } = await api.put("/admin/settings", {
        blogAutoEnabled: !!settings.blogAutoEnabled,
        blogAutoIntervalHours: Math.max(1, Number(settings.blogAutoIntervalHours) || 72),
      });
      setSettings(data);
      toast.success("Pengaturan otomatis disimpan");
    } catch {
      toast.error("Gagal menyimpan pengaturan");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
        </button>

        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="font-display text-2xl font-extrabold flex items-center gap-2">
              <Newspaper className="w-6 h-6 text-amber-600" /> Kelola Blog & Artikel
            </h1>
            <p className="text-sm text-slate-500 mt-1">Tulis manual, atau buat otomatis dengan AI untuk meningkatkan SEO organik.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setGenOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
              <Wand2 className="w-4 h-4" /> Buat dengan AI
            </Button>
            <Button onClick={openNew} variant="outline" className="gap-1.5">
              <Plus className="w-4 h-4" /> Tulis Manual
            </Button>
          </div>
        </div>

        {/* Auto-generation settings */}
        {settings && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Artikel Otomatis (AI Terjadwal)</h2>
                  <p className="text-sm text-slate-500 max-w-md mt-0.5">
                    Bila aktif, sistem membuat & mempublikasikan artikel baru (Arsitektur, Interior, Keuangan Proyek) secara berkala otomatis lengkap dengan cover.
                  </p>
                  {settings.blogLastAutoAt && (
                    <p className="text-xs text-slate-400 mt-1">Terakhir dibuat otomatis: {fmtDate(settings.blogLastAutoAt)}</p>
                  )}
                </div>
              </div>
              <Switch checked={!!settings.blogAutoEnabled} onCheckedChange={(v) => setSettings((s) => ({ ...s, blogAutoEnabled: v }))} />
            </div>
            <div className="flex items-end gap-3 mt-4 flex-wrap">
              <div>
                <Label className="text-xs text-slate-500">Interval antar artikel (jam)</Label>
                <Input
                  type="number" min={1}
                  value={settings.blogAutoIntervalHours ?? 72}
                  onChange={(e) => setSettings((s) => ({ ...s, blogAutoIntervalHours: e.target.value }))}
                  className="w-36 mt-1"
                />
                <p className="text-[11px] text-slate-400 mt-1">Contoh: 72 = satu artikel tiap 3 hari</p>
              </div>
              <Button onClick={saveSettings} disabled={savingSettings} className="bg-slate-900 hover:bg-slate-800 text-white">
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Pengaturan"}
              </Button>
            </div>
          </div>
        )}

        {/* Article list */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-500 bg-white rounded-2xl border border-slate-100">
            <Newspaper className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p>Belum ada artikel. Mulai dengan "Buat dengan AI" atau "Tulis Manual".</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((a) => {
              const cover = coverSrc(a.coverUrl);
              const meta = CATEGORY_META[a.category] || { label: "Artikel", color: "bg-slate-100 text-slate-600" };
              return (
                <div key={a.id} className="flex items-center gap-4 bg-white rounded-xl border border-slate-100 p-3 hover:shadow-sm transition">
                  <div className="w-20 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                    {cover ? <img src={cover} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-6 h-6" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLE[a.status] || ""}`}>{a.status}</span>
                      {a.source === "ai" && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI</span>}
                    </div>
                    <h3 className="font-semibold truncate mt-1">{a.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span>{fmtDate(a.publishedAt || a.createdAt)}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {a.readMinutes} mnt</span>
                      <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" /> {a.views}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {a.status === "published" && (
                      <a href={`/blog/${a.slug}`} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-slate-700" title="Lihat">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button onClick={() => openEdit(a.id)} className="p-2 text-slate-400 hover:text-amber-600" title="Edit"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => del(a.id)} className="p-2 text-slate-400 hover:text-red-600" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Artikel" : "Tulis Artikel Baru"}</DialogTitle>
            <DialogDescription>Isi konten memakai Markdown (## judul, **tebal**, - daftar).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {coverUrl && (
              <div className="relative">
                <img src={coverSrc(coverUrl)} alt="" className="w-full h-40 object-cover rounded-lg" />
                {form.id && (
                  <Button onClick={regenCover} disabled={regenBusy} size="sm" variant="secondary" className="absolute bottom-2 right-2 gap-1.5">
                    {regenBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Cover AI
                  </Button>
                )}
              </div>
            )}
            <div>
              <Label>Judul</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Judul artikel" className="mt-1" />
            </div>
            <div>
              <Label>Ringkasan (excerpt)</Label>
              <Textarea value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} rows={2} placeholder="Ringkasan singkat untuk kartu & meta description" className="mt-1" />
            </div>
            <div>
              <Label>Isi Artikel (Markdown)</Label>
              <Textarea value={form.content_md} onChange={(e) => setForm((f) => ({ ...f, content_md: e.target.value }))} rows={12} placeholder="## Pendahuluan&#10;Tulis isi artikel..." className="mt-1 font-mono text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategori</Label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="mt-1 w-full h-10 rounded-md border border-slate-200 px-3 text-sm">
                  {CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Status</Label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="mt-1 w-full h-10 rounded-md border border-slate-200 px-3 text-sm">
                  <option value="draft">Draft</option>
                  <option value="published">Publish</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Tags (pisah koma)</Label>
              <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="interior, minimalis" className="mt-1" />
            </div>
            {!coverUrl && (
              <div>
                <Label>URL Gambar Cover (opsional)</Label>
                <Input value={form.cover_external} onChange={(e) => setForm((f) => ({ ...f, cover_external: e.target.value }))} placeholder="https://... (atau simpan lalu buat cover AI)" className="mt-1" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI generate dialog */}
      <Dialog open={genOpen} onOpenChange={(o) => !genBusy && setGenOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wand2 className="w-5 h-5 text-amber-600" /> Buat Artikel dengan AI</DialogTitle>
            <DialogDescription>AI menulis artikel seputar arsitektur, interior & keuangan proyek. Bisa dari topik dan/atau gambar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Topik / Judul</Label>
              <Input value={gen.topic} onChange={(e) => setGen((g) => ({ ...g, topic: e.target.value }))} placeholder="mis. Tips memilih warna cat ruang tamu" className="mt-1" disabled={genBusy} />
            </div>
            <div>
              <Label>Instruksi tambahan (opsional)</Label>
              <Textarea value={gen.prompt} onChange={(e) => setGen((g) => ({ ...g, prompt: e.target.value }))} rows={2} placeholder="Gaya, poin penting, target pembaca..." className="mt-1" disabled={genBusy} />
            </div>
            <div>
              <Label>Gambar sumber (opsional)</Label>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onGenImage} disabled={genBusy} className="mt-1 block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-amber-50 file:text-amber-700 file:font-semibold" />
              {genImage && <img src={genImage} alt="" className="mt-2 h-24 rounded-lg object-cover" />}
            </div>
            <div>
              <Label>Kategori</Label>
              <select value={gen.category} onChange={(e) => setGen((g) => ({ ...g, category: e.target.value }))} className="mt-1 w-full h-10 rounded-md border border-slate-200 px-3 text-sm" disabled={genBusy}>
                {CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-700 inline-flex items-center gap-1.5"><ImageIcon className="w-4 h-4" /> Buatkan cover AI otomatis</span>
              <Switch checked={gen.generate_cover} onCheckedChange={(v) => setGen((g) => ({ ...g, generate_cover: v }))} disabled={genBusy} />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-700">Langsung publish</span>
              <Switch checked={gen.publish} onCheckedChange={(v) => setGen((g) => ({ ...g, publish: v }))} disabled={genBusy} />
            </div>
            {genBusy && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> AI sedang menulis artikel & membuat cover... (30-90 detik)
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGenOpen(false)} disabled={genBusy}>Batal</Button>
            <Button onClick={runGenerate} disabled={genBusy} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
              {genBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Buat Artikel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
