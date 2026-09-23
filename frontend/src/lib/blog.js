import { API } from "@/lib/api";

// Resolve an article cover URL: relative /api paths get the backend origin prepended.
export function coverSrc(coverUrl, fallback = null) {
  if (!coverUrl) return fallback;
  if (/^(https?:|data:)/i.test(coverUrl)) return coverUrl;
  if (coverUrl.startsWith("/api/")) {
    const base = API.replace(/\/api$/, "");
    return `${base}${coverUrl}`;
  }
  return coverUrl;
}

// Public share link (backend SSR page — works for WhatsApp/FB crawlers).
export function shareUrl(slug) {
  const base = API.replace(/\/api$/, "");
  return `${base}/api/a/${slug}`;
}

export const CATEGORY_META = {
  arsitektur: { label: "Arsitektur", color: "bg-blue-100 text-blue-700" },
  interior: { label: "Interior", color: "bg-amber-100 text-amber-800" },
  keuangan: { label: "Keuangan Proyek", color: "bg-emerald-100 text-emerald-700" },
  panduan: { label: "Panduan", color: "bg-purple-100 text-purple-700" },
};

export function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}
