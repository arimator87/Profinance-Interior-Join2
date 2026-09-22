// Mirror of backend compute_rab so the builder shows live totals.
// subItem.nilai = round(qty * hargaSatuan) + sum(material.nilai)

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Read an image File and return a downscaled PNG data URI (keeps payload small).
export function fileToSignature(file, maxW = 600) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file"));
    if (!/image\/(png|jpe?g)/i.test(file.type)) return reject(new Error("Hanya file JPG/PNG"));
    if (file.size > 5 * 1024 * 1024) return reject(new Error("Ukuran maksimal 5MB"));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gambar tidak valid"));
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function computeRab(rab) {
  const r = rab || {};
  let totalItems = 0;
  let idx = 0;
  const sections = (r.sections || []).map((sec) => {
    let subtotal = 0;
    const subItems = (sec.subItems || []).map((si) => {
      idx += 1;
      const qty = num(si.qty);
      const harga = Math.round(num(si.hargaSatuan));
      const base = Math.round(qty * harga);
      const mats = si.materials || [];
      const materialTotal = mats.reduce((a, m) => a + Math.round(num(m.nilai)), 0);
      const nilai = base + materialTotal;
      subtotal += nilai;
      return { ...si, no: idx, qty, hargaSatuan: harga, base, materialTotal, nilai };
    });
    totalItems += subtotal;
    return { ...sec, subItems, subtotal };
  });
  const discount = Math.round(num(r.discount));
  const afterDiscount = totalItems - discount;
  const ppnEnabled = !!r.ppnEnabled;
  const ppnPercent = num(r.ppnPercent);
  const ppnAmount = ppnEnabled ? Math.round((afterDiscount * ppnPercent) / 100) : 0;
  const grandTotal = afterDiscount + ppnAmount;
  const termins = (r.termins || []).map((t) => ({
    ...t,
    percent: num(t.percent),
    nominal: Math.round((grandTotal * num(t.percent)) / 100),
  }));
  return { sections, totalItems, discount, afterDiscount, ppnEnabled, ppnPercent, ppnAmount, grandTotal, termins };
}

export function emptyRab() {
  return {
    clientName: "",
    clientAddress: "",
    clientPhone: "",
    quotationNo: "",
    quotationDate: new Date().toISOString().slice(0, 10),
    companyName: "",
    companyAddress: "",
    companyPhone: "",
    bankName: "",
    bankAccount: "",
    bankHolder: "",
    signerLeft: "",
    signerRight: "",
    signatureImage: "",
    notes: "",
    discount: 0,
    ppnEnabled: false,
    ppnPercent: 11,
    sections: [
      {
        id: uid(),
        name: "PEKERJAAN PERSIAPAN",
        subItems: [{ id: uid(), name: "", qty: 1, unit: "Ls", hargaSatuan: 0, materials: [] }],
      },
    ],
    termins: [
      { label: "Down Payment (DP)", percent: 50 },
      { label: "Termin Progress", percent: 30 },
      { label: "Pelunasan", percent: 20 },
    ],
  };
}
