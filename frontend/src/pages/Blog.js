import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import Seo from "@/components/Seo";
import { PublicNav, PublicFooter } from "@/components/PublicChrome";
import { coverSrc, CATEGORY_META, fmtDate } from "@/lib/blog";
import { Loader2, Clock, Search, Newspaper } from "lucide-react";
import { Input } from "@/components/ui/input";

const CATS = [
  { key: "", label: "Semua" },
  { key: "interior", label: "Interior" },
  { key: "arsitektur", label: "Arsitektur" },
  { key: "keuangan", label: "Keuangan Proyek" },
  { key: "panduan", label: "Panduan" },
];

export default function Blog() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "9" });
    if (cat) params.set("category", cat);
    if (q) params.set("q", q);
    api.get(`/blog?${params.toString()}`)
      .then((r) => { if (alive) setData(r.data); })
      .catch(() => { if (alive) setData({ items: [], total: 0, pages: 1 }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [cat, q, page]);

  const items = data?.items || [];
  const featured = page === 1 && !cat && !q ? items[0] : null;
  const rest = featured ? items.slice(1) : items;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo
        title="Blog & Artikel Arsitektur, Interior, dan Keuangan Proyek"
        description="Wawasan, tips, dan panduan seputar desain interior, arsitektur, serta pengelolaan keuangan proyek untuk kontraktor dan arsitek di Indonesia."
        keywords="blog interior, artikel arsitektur, tips desain interior, keuangan proyek konstruksi, manajemen proyek interior"
      />
      <PublicNav />

      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-950 to-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 mb-4">
            <Newspaper className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold tracking-[0.15em] text-amber-300">BLOG PROFINANCE INTERIOR</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold leading-tight max-w-2xl">
            Wawasan Arsitektur, Interior & Keuangan Proyek
          </h1>
          <p className="mt-3 text-slate-300 max-w-xl">
            Tips praktis dan panduan mendalam untuk membantu kontraktor & arsitek mengelola proyek lebih untung dan profesional.
          </p>
          <div className="mt-6 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => { setPage(1); setQ(e.target.value); }}
              placeholder="Cari artikel..."
              className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-slate-400"
            />
          </div>
        </div>
      </section>

      {/* Category filter */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-6 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => { setPage(1); setCat(c.key); }}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition ${cat === c.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 min-h-[40vh]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Newspaper className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p>Belum ada artikel{cat || q ? " yang cocok" : ""}. Nantikan artikel terbaru kami.</p>
          </div>
        ) : (
          <>
            {featured && <FeaturedCard a={featured} onClick={() => navigate(`/blog/${featured.slug}`)} />}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rest.map((a) => (
                <ArticleCard key={a.id} a={a} onClick={() => navigate(`/blog/${a.slug}`)} />
              ))}
            </div>
            {data.pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                {Array.from({ length: data.pages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i + 1)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium ${page === i + 1 ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

function Cover({ a, className }) {
  const src = coverSrc(a.coverUrl);
  if (src) {
    return <img src={src} alt={a.coverAlt || a.title} loading="lazy" className={className} />;
  }
  return (
    <div className={`${className} bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center`}>
      <Newspaper className="w-10 h-10 text-white/70" />
    </div>
  );
}

function CatBadge({ category }) {
  const meta = CATEGORY_META[category] || { label: "Artikel", color: "bg-slate-100 text-slate-600" };
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${meta.color}`}>{meta.label}</span>;
}

function FeaturedCard({ a, onClick }) {
  return (
    <button onClick={onClick} className="group w-full text-left mb-8 grid md:grid-cols-2 gap-6 rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition">
      <Cover a={a} className="w-full h-56 md:h-full object-cover" />
      <div className="p-6 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-3"><CatBadge category={a.category} /><span className="text-xs text-slate-400">Unggulan</span></div>
        <h2 className="font-display text-2xl font-extrabold leading-tight group-hover:text-amber-700 transition">{a.title}</h2>
        <p className="mt-2 text-slate-600 line-clamp-3">{a.excerpt}</p>
        <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
          <span>{fmtDate(a.publishedAt)}</span>
          <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {a.readMinutes} mnt baca</span>
        </div>
      </div>
    </button>
  );
}

function ArticleCard({ a, onClick }) {
  return (
    <button onClick={onClick} className="group text-left rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition flex flex-col">
      <Cover a={a} className="w-full h-44 object-cover" />
      <div className="p-5 flex flex-col flex-1">
        <div className="mb-2"><CatBadge category={a.category} /></div>
        <h3 className="font-display text-lg font-bold leading-snug group-hover:text-amber-700 transition line-clamp-2">{a.title}</h3>
        <p className="mt-2 text-sm text-slate-600 line-clamp-2 flex-1">{a.excerpt}</p>
        <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
          <span>{fmtDate(a.publishedAt)}</span>
          <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {a.readMinutes} mnt</span>
        </div>
      </div>
    </button>
  );
}
