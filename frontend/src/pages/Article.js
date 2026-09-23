import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import Seo from "@/components/Seo";
import { PublicNav, PublicFooter } from "@/components/PublicChrome";
import { coverSrc, shareUrl, CATEGORY_META, fmtDate } from "@/lib/blog";
import { Loader2, Clock, ArrowLeft, Share2, Check, Newspaper } from "lucide-react";
import { toast } from "sonner";

export default function Article() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setNotFound(false);
    window.scrollTo(0, 0);
    api.get(`/blog/${slug}`)
      .then((r) => { if (alive) setData(r.data); })
      .catch(() => { if (alive) setNotFound(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  const a = data?.article;
  const related = data?.related || [];

  const doShare = async () => {
    const url = shareUrl(slug);
    try {
      if (navigator.share) {
        await navigator.share({ title: a.title, text: a.excerpt, url });
        return;
      }
    } catch { /* fall through to copy */ }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Tautan artikel disalin");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin tautan");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <PublicNav />
        <div className="flex items-center justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>
      </div>
    );
  }
  if (notFound || !a) {
    return (
      <div className="min-h-screen bg-white">
        <Seo title="Artikel tidak ditemukan" noindex />
        <PublicNav />
        <div className="max-w-3xl mx-auto px-4 py-32 text-center text-slate-500">
          <Newspaper className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Artikel tidak ditemukan</h1>
          <p className="mb-6">Artikel yang Anda cari mungkin telah dihapus atau dipindahkan.</p>
          <button onClick={() => navigate("/blog")} className="text-amber-700 font-semibold hover:underline">← Kembali ke Blog</button>
        </div>
      </div>
    );
  }

  const meta = CATEGORY_META[a.category] || { label: "Artikel", color: "bg-slate-100 text-slate-600" };
  const cover = coverSrc(a.coverUrl);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo
        title={a.seoTitle || a.title}
        description={a.seoDescription || a.excerpt}
        keywords={a.keywords}
        image={cover}
        type="article"
      />
      <PublicNav />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <button onClick={() => navigate("/blog")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4" /> Semua Artikel
        </button>

        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${meta.color}`}>{meta.label}</span>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold leading-tight mt-3">{a.title}</h1>
        <div className="mt-4 flex items-center gap-4 text-sm text-slate-400 flex-wrap">
          <span>{fmtDate(a.publishedAt)}</span>
          <span className="inline-flex items-center gap-1"><Clock className="w-4 h-4" /> {a.readMinutes} menit baca</span>
          <button onClick={doShare} className="inline-flex items-center gap-1.5 text-amber-700 font-semibold hover:underline ml-auto">
            {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />} {copied ? "Tersalin" : "Bagikan"}
          </button>
        </div>

        {cover && (
          <img src={cover} alt={a.coverAlt || a.title} className="w-full rounded-2xl mt-6 shadow-sm" />
        )}

        <div
          className="article-body mt-8"
          dangerouslySetInnerHTML={{ __html: a.contentHtml }}
        />

        {a.tags?.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {a.tags.map((t) => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs">#{t}</span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 text-white p-6 sm:p-8">
          <h3 className="font-display text-xl font-bold">Kelola proyek interior Anda tanpa ribet</h3>
          <p className="text-slate-300 mt-2 text-sm">RAB, invoice, cash flow, hingga Kurva-S — semua dalam satu aplikasi ProFinance Interior.</p>
          <button onClick={() => navigate("/login")} className="mt-4 inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-5 py-2.5 rounded-lg">
            Mulai Gratis Sekarang
          </button>
        </div>
      </article>

      {related.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-4">
          <h2 className="font-display text-xl font-bold mb-5">Artikel Terkait</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {related.map((r) => {
              const rc = coverSrc(r.coverUrl);
              return (
                <button key={r.id} onClick={() => navigate(`/blog/${r.slug}`)} className="group text-left rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition">
                  {rc ? <img src={rc} alt={r.title} loading="lazy" className="w-full h-36 object-cover" />
                      : <div className="w-full h-36 bg-gradient-to-br from-amber-500 to-amber-700" />}
                  <div className="p-4">
                    <h3 className="font-semibold leading-snug group-hover:text-amber-700 line-clamp-2">{r.title}</h3>
                    <p className="text-xs text-slate-400 mt-2">{fmtDate(r.publishedAt)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <PublicFooter />
    </div>
  );
}
