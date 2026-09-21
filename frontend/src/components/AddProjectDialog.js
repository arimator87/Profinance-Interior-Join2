import { useState, useEffect } from "react";
import { api, fileUrl } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_CATS = [
  { id: "d1", name: "Residensial", imageUrl: null },
  { id: "d2", name: "Komersial", imageUrl: null },
  { id: "d3", name: "Kantor", imageUrl: null },
];

const THUMBS = [
  "https://images.unsplash.com/photo-1633110187937-6e3b2f36dfca?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsdXh1cnklMjBpbnRlcmlvciUyMGFyY2hpdGVjdHVyZSUyMGxpdmluZyUyMHJvb20lMjBraXRjaGVuJTIwb2ZmaWNlfGVufDB8fHx8MTc8OTgwMjMxN3ww&ixlib=rb-4.1.0&q=85",
  "https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.unsplash.com/photo-1768321917661-d4f1a89d2185?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHwzfHxpbnRlcmlvciUyMGRlc2lnbiUyMGFyY2hpdGVjdHVyZSUyMGNvbnN0cnVjdGlvbiUyMHNpdGUlMjBmaW5pc2glMjByb29tfGVufDB8fHx8MTc4OTgwMjMxMHww&ixlib=rb-4.1.0&q=85",
];

export function AddProjectDialog({ open, onOpenChange, onCreated, project = null }) {
  const isEdit = !!project;
  const [form, setForm] = useState({
    name: "", owner: "", nominal: "", companyName: "", alamatProyek: "",
    tanggalMulai: "", targetSelesai: "", category: "Residensial",
  });
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState(DEFAULT_CATS);
  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });

  useEffect(() => {
    api.get("/work-categories")
      .then((r) => {
        if (Array.isArray(r.data) && r.data.length) setCategories(r.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    if (project) {
      setForm({
        name: project.name || "", owner: project.owner || "", nominal: project.nominal || "",
        companyName: project.companyName || "", alamatProyek: project.alamatProyek || "",
        tanggalMulai: project.tanggalMulai ? project.tanggalMulai.slice(0, 10) : "",
        targetSelesai: project.targetSelesai ? project.targetSelesai.slice(0, 10) : "",
        category: project.category || "Residensial",
      });
    } else {
      setForm({ name: "", owner: "", nominal: "", companyName: "", alamatProyek: "", tanggalMulai: "", targetSelesai: "", category: "Residensial" });
    }
  }, [open, project]);

  const submit = async () => {
    if (!form.name) return toast.error("Nama proyek wajib diisi");
    setBusy(true);
    try {
      const payload = {
        ...form,
        nominal: parseInt(form.nominal || 0, 10),
        tanggalMulai: form.tanggalMulai ? new Date(form.tanggalMulai).toISOString() : null,
        targetSelesai: form.targetSelesai ? new Date(form.targetSelesai).toISOString() : null,
      };
      let res;
      if (isEdit) {
        res = await api.put(`/projects/${project.id}`, { ...payload, thumbnail: project.thumbnail, status: project.status || "Berjalan" });
        toast.success("Proyek berhasil diperbarui");
      } else {
        const thumb = THUMBS[Math.floor(Math.random() * THUMBS.length)];
        res = await api.post("/projects", { ...payload, thumbnail: thumb });
        toast.success("Proyek berhasil dibuat");
      }
      onCreated?.(res.data);
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyimpan proyek");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto pf-scrollbar">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{isEdit ? "Edit Proyek" : "Tambah Proyek Baru"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5 py-1">
          <div>
            <Label>Nama Proyek *</Label>
            <Input data-testid="project-name-input" value={form.name} onChange={set("name")} placeholder="Kitchen Set Villa Canggu" className="mt-1" />
          </div>
          <div>
            <Label>Nama Perusahaan / Kontraktor</Label>
            <Input data-testid="project-company-input" value={form.companyName} onChange={set("companyName")} placeholder="mis. CV Karya Interior" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nama Klien / Owner</Label>
              <Input data-testid="project-owner-input" value={form.owner} onChange={set("owner")} placeholder="Bpk. Andika" className="mt-1" />
            </div>
            <div>
              <Label>Nilai Kontrak (Rp)</Label>
              <Input data-testid="project-nominal-input" type="number" value={form.nominal} onChange={set("nominal")} placeholder="285000000" className="mt-1 font-mono" />
            </div>
          </div>
          <div>
            <Label>Kategori</Label>
            <Select value={form.category} onValueChange={set("category")}>
              <SelectTrigger data-testid="project-category-select" className="mt-1 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    <span className="flex items-center gap-2">
                      {c.imageUrl && (
                        <img src={fileUrl(c.imageUrl)} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                      )}
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Alamat Proyek</Label>
            <Textarea data-testid="project-address-input" value={form.alamatProyek} onChange={set("alamatProyek")} placeholder="Canggu, Bali" className="mt-1 resize-none" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tanggal Mulai</Label>
              <Input data-testid="project-start-input" type="date" value={form.tanggalMulai} onChange={set("tanggalMulai")} className="mt-1" />
            </div>
            <div>
              <Label>Target Selesai</Label>
              <Input data-testid="project-target-input" type="date" value={form.targetSelesai} onChange={set("targetSelesai")} className="mt-1" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button data-testid="project-submit-button" onClick={submit} disabled={busy} className="bg-amber-600 hover:bg-amber-700 text-white">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEdit ? "Simpan Perubahan" : "Simpan Proyek")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
