import { Helmet } from "react-helmet-async";

const SITE = "ProFinance Interior";
const DEFAULT_IMG = "/og-cover.png";

/**
 * Dynamic per-page SEO + Open Graph tags.
 * Note: social crawlers (WhatsApp/FB) don't run JS, so for article SHARE links
 * we point users to the backend SSR endpoint /api/a/{slug}. Googlebot renders JS
 * so these tags cover organic search indexing.
 */
export default function Seo({
  title,
  description,
  image,
  url,
  type = "website",
  keywords,
  noindex = false,
}) {
  const fullTitle = title ? `${title} — ${SITE}` : `${SITE} — Aplikasi Keuangan & Proyek Kontraktor Interior`;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const canonical = url || (typeof window !== "undefined" ? window.location.href : "");
  const img = image || `${origin}${DEFAULT_IMG}`;
  const imgAbs = img.startsWith("http") ? img : `${origin}${img}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {keywords && <meta name="keywords" content={keywords} />}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE} />
      <meta property="og:locale" content="id_ID" />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={imgAbs} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={imgAbs} />
    </Helmet>
  );
}
