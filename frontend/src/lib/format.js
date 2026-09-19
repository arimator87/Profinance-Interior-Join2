export function rupiah(n) {
  const val = Math.round(Number(n) || 0);
  const neg = val < 0;
  const abs = Math.abs(val)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}Rp ${abs}`;
}

export function rupiahShort(n) {
  const val = Number(n) || 0;
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(0)} jt`;
  if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(0)} rb`;
  return rupiah(val);
}

// Financial health status per business rules
export function healthStatus(marginPct) {
  const m = Number(marginPct) || 0;
  if (m >= 20) return { key: "great", label: "Sangat Sehat", color: "#16a34a", bg: "#DCFCE7", text: "#15803D" };
  if (m >= 10) return { key: "good", label: "Sehat", color: "#2563eb", bg: "#DBEAFE", text: "#1D4ED8" };
  if (m >= 0) return { key: "ok", label: "Cukup", color: "#d97706", bg: "#FEF3C7", text: "#B45309" };
  if (m >= -10) return { key: "warn", label: "Perhatian", color: "#ea580c", bg: "#FFEDD5", text: "#C2410C" };
  return { key: "crit", label: "Kritis", color: "#dc2626", bg: "#FEE2E2", text: "#B91C1C" };
}

export const INCOME_CATEGORIES = ["Downpayment", "Termin", "Pelunasan", "Lainnya"];
export const EXPENSE_CATEGORIES = ["Material", "Makan", "Toll", "Bensin", "Lainnya"];

export function fmtDate(d) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(d).slice(0, 10);
  }
}

export function todayISO() {
  return new Date().toISOString();
}
