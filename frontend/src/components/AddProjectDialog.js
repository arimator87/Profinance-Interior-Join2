import { useState } from "react";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const THUMBS = [
  "https://images.unsplash.com/photo-1633110187937-6e3b2f36dfca?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsdXh1cnklMjBpbnRlcmlvciUyMGFyY2hpdGVjdHVyZSUyMGxpdmluZyUyMHJvb20lMjBraXRjaGVuJTIwb2ZmaWNlfGVufDB8fHx8MTc8OTgwMjMxN3ww&ixlib=rb-4.1.0&q=85",
  "https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.unsplash.com/photo-1768321917661-d4f1a89d2185?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHwzfHxpbnRlcmlvciUyMGRlc2lnbiUyMGFyY2hpdGVjdHVyZSUyMGNvbnN0cnVjdGlvbiUyMHNpdGUlMjBmaW5pc2glMjByb29tfGVufDB8fHx8MTc4OTgwMjMxMHww&ixlib=rb-4.1.0&q=85",
];

export function AddProjectDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState({
    name: "", owner: "", nominal: "", companyName: "", alamatProyek: "",
    tanggalMulai: "", targetSelesai: "", category: "Residensial",
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });

  const submit = async () => {
    if (!form.name) return toast.error("Nama proyek wajib diisi");
    setBusy(true);
    try {
      const thumb = THUMBS[Math.floor(Math.random() * THUMBS.length)];
      const res = await api.post("/projects", {
        ...form,
        nominal: parseInt(form.nominal || 0, 10),
        tanggalMulai: form.tanggalMulai ? new Date(form.tanggalMulai).toISOString() : null,
        targetSelesai: form.targetSelesai ? new Date(form.targetSelesai).toISOString() : null,
        thumbnail: thumb,
      });
      toast.success("Proyek berhasil dibuat");
      onCreated?.(res.data);
      onOpenChange(false);
      setForm({ name: "", owner: "", nominal: "", companyName: "", alamatProyek: "", tanggalMulai: "", targetSelesai: "", category: "Residensial" });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal membuat proyek");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto pf-scrollbar">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Tambah Proyek Baru</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5 py-1">
          <div>
            <Label>Nama Proyek *</Label>
            <Input data-testid="project-name-input" value={form.name} onChange={set("name")} placeholder="Kitchen Set Villa Canggu" className="mt-1" />
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Perusahaan</Label>
              <Input data-testid="project-company-input" value={form.companyName} onChange={set("companyName")} placeholder="opsional" className="mt-1" />
            </div>
            <div>
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={set("category")}>
                <SelectTrigger data-testid="project-category-select" className="mt-1 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {["Residensial", "Komersial", "Kantor"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Proyek"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
