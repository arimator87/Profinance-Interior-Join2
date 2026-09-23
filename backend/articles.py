"""ProFinance Interior — Blog / Artikel module.

Responsibilities:
- Article data model + CRUD (MongoDB collection `articles`)
- AI article generation from a text topic/prompt (+ optional source image) via Gemini
- AI cover-image generation via Gemini (nano banana)
- Public JSON API for the React blog + article reader
- Server-rendered crawlable HTML (Open Graph / JSON-LD) for share previews & SEO
- sitemap.xml
- Autonomous scheduled generation (cron)

All routes are prefixed with /api to satisfy the Kubernetes ingress.
"""
import os
import re
import json
import uuid
import hmac
import base64
import logging
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List

import markdown as md_lib

from auth import db, get_current_user, OWNER_EMAILS
from storage import put_object, get_object, delete_object, APP_NAME

load_dotenv()

logger = logging.getLogger("articles")

router = APIRouter(prefix="/api")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET", "")

TEXT_MODEL = "gemini-3.1-pro-preview"
IMAGE_MODEL = "gemini-3.1-flash-image-preview"

CATEGORIES = {"arsitektur", "interior", "keuangan", "panduan"}
CATEGORY_LABELS = {
    "arsitektur": "Arsitektur",
    "interior": "Interior",
    "keuangan": "Keuangan Proyek",
    "panduan": "Panduan",
}

# Rotating topic pool for autonomous generation (architecture / interior / project finance)
AUTO_TOPICS = [
    ("interior", "Tren desain interior rumah minimalis modern untuk hunian di Indonesia"),
    ("interior", "Cara memilih material finishing interior yang awet dan hemat biaya"),
    ("interior", "Panduan menata pencahayaan interior agar ruangan terasa lebih luas"),
    ("arsitektur", "Prinsip desain arsitektur tropis untuk iklim Indonesia"),
    ("arsitektur", "Tahapan kerja proyek arsitektur dari konsep hingga serah terima"),
    ("arsitektur", "Cara membaca gambar kerja dan RAB untuk klien awam"),
    ("keuangan", "Cara menyusun RAB proyek interior yang akurat agar tidak rugi"),
    ("keuangan", "Mengelola cash flow proyek kontraktor interior agar tidak macet"),
    ("keuangan", "Strategi menagih pembayaran termin proyek tepat waktu"),
    ("keuangan", "Menghitung margin keuntungan proyek interior dengan benar"),
    ("interior", "Ide desain dapur dan kitchen set custom untuk apartemen kecil"),
    ("arsitektur", "Kesalahan umum saat merenovasi rumah dan cara menghindarinya"),
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(v):
    if not v:
        return None
    try:
        dt = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if (user.get("email") or "").strip().lower() not in OWNER_EMAILS:
        raise HTTPException(status_code=403, detail="Akses khusus admin")
    return user


def slugify(text: str) -> str:
    text = (text or "").lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s-]+", "-", text).strip("-")
    return text[:80] or uuid.uuid4().hex[:8]


async def _unique_slug(base: str, exclude_id: Optional[str] = None) -> str:
    slug = slugify(base)
    candidate = slug
    i = 2
    while True:
        q = {"slug": candidate}
        if exclude_id:
            q["id"] = {"$ne": exclude_id}
        exists = await db.articles.find_one(q, {"_id": 0, "id": 1})
        if not exists:
            return candidate
        candidate = f"{slug}-{i}"
        i += 1


def md_to_html(text: str) -> str:
    return md_lib.markdown(
        text or "",
        extensions=["extra", "sane_lists", "nl2br", "toc"],
    )


def cover_url(doc: dict) -> Optional[str]:
    cp = doc.get("cover_path")
    if cp:
        return f"/api/blog/media/{cp}"
    return doc.get("cover_external") or None


def _read_minutes(text: str) -> int:
    words = len(re.findall(r"\w+", text or ""))
    return max(1, round(words / 200))


def article_public(doc: dict, full: bool = False) -> dict:
    out = {
        "id": doc["id"],
        "slug": doc["slug"],
        "title": doc.get("title", ""),
        "excerpt": doc.get("excerpt", ""),
        "category": doc.get("category", "blog"),
        "categoryLabel": CATEGORY_LABELS.get(doc.get("category", ""), "Artikel"),
        "tags": doc.get("tags", []),
        "coverUrl": cover_url(doc),
        "coverAlt": doc.get("cover_alt", doc.get("title", "")),
        "status": doc.get("status", "draft"),
        "source": doc.get("source", "manual"),
        "publishedAt": doc.get("published_at"),
        "publishAt": doc.get("publish_at"),
        "views": int(doc.get("views", 0)),
        "readMinutes": doc.get("read_minutes") or _read_minutes(doc.get("content_md", "")),
        "createdAt": doc.get("created_at"),
        "updatedAt": doc.get("updated_at"),
    }
    if full:
        out.update({
            "contentMd": doc.get("content_md", ""),
            "contentHtml": doc.get("content_html", ""),
            "seoTitle": doc.get("seo_title") or doc.get("title", ""),
            "seoDescription": doc.get("seo_description") or doc.get("excerpt", ""),
            "keywords": doc.get("keywords", ""),
        })
    return out


# ------------------------------------------------------------------ AI core

def _llm_chat_text(session_id: str, system_message: str):
    from emergentintegrations.llm.chat import LlmChat
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model("gemini", TEXT_MODEL)


def _strip_json(raw: str) -> str:
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw).strip()
    # grab the outermost { ... }
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        raw = raw[start:end + 1]
    return raw


ARTICLE_SYSTEM = (
    "Anda adalah penulis konten ahli untuk ProFinance Interior, aplikasi manajemen keuangan & "
    "proyek untuk kontraktor interior dan arsitek di Indonesia. Anda menulis artikel blog "
    "berkualitas tinggi, ramah SEO, dan bermanfaat seputar dunia arsitektur, desain interior, "
    "serta pengelolaan keuangan proyek. Gaya bahasa profesional namun mudah dipahami, dalam "
    "Bahasa Indonesia. Selalu balas HANYA dengan JSON valid tanpa penjelasan tambahan."
)


def _article_prompt(topic: str, extra: str, category: str, with_image: bool) -> str:
    img_note = (
        "Sebuah gambar dilampirkan sebagai referensi/inspirasi. Analisis gambar tersebut dan "
        "jadikan bagian dari artikel bila relevan.\n" if with_image else ""
    )
    return (
        f"{img_note}"
        f"Tulis satu artikel blog panjang (900-1300 kata) dalam Bahasa Indonesia.\n"
        f"Kategori: {CATEGORY_LABELS.get(category, category)}.\n"
        f"Topik: {topic}\n"
        f"{('Instruksi tambahan: ' + extra) if extra else ''}\n\n"
        "Struktur konten memakai Markdown: gunakan beberapa heading (##), sub-heading (###), "
        "paragraf, bullet list, dan minimal satu bagian tips praktis. Sisipkan secara natural "
        "bagaimana aplikasi ProFinance Interior membantu (RAB, invoice, cash flow, kasbon tukang, "
        "Kurva-S, portal klien) bila relevan — jangan berlebihan.\n\n"
        "Balas HANYA JSON dengan struktur persis:\n"
        "{\n"
        '  "title": "judul menarik maksimal 70 karakter",\n'
        '  "excerpt": "ringkasan 1-2 kalimat maksimal 160 karakter",\n'
        '  "content_md": "isi artikel lengkap dalam markdown",\n'
        '  "tags": ["tag1", "tag2", "tag3"],\n'
        '  "seo_title": "judul SEO maksimal 60 karakter",\n'
        '  "seo_description": "meta description SEO maksimal 155 karakter",\n'
        '  "keywords": "kata kunci dipisah koma",\n'
        '  "cover_prompt": "deskripsi bahasa Inggris untuk membuat gambar cover fotorealistik yang relevan"\n'
        "}"
    )


async def generate_article_ai(
    topic: str,
    extra: str = "",
    category: str = "interior",
    image_base64: Optional[str] = None,
) -> dict:
    """Call Gemini to produce the article JSON. Raises on hard failure."""
    from emergentintegrations.llm.chat import UserMessage, ImageContent

    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY belum dikonfigurasi")

    chat = _llm_chat_text(f"article-{uuid.uuid4().hex[:8]}", ARTICLE_SYSTEM)
    prompt = _article_prompt(topic, extra, category, with_image=bool(image_base64))

    kwargs = {"text": prompt}
    if image_base64:
        kwargs["file_contents"] = [ImageContent(image_base64)]
    raw = await chat.send_message(UserMessage(**kwargs))

    try:
        data = json.loads(_strip_json(raw))
    except Exception as e:
        logger.error(f"Article JSON parse failed: {e}; head={raw[:120]!r}")
        raise HTTPException(status_code=502, detail="AI mengembalikan format tidak valid, coba lagi")

    if not data.get("title") or not data.get("content_md"):
        raise HTTPException(status_code=502, detail="AI tidak menghasilkan konten lengkap, coba lagi")
    return data


async def generate_cover_image(prompt: str) -> Optional[str]:
    """Generate a cover image via Gemini, store it, return the storage path. Best-effort."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    if not EMERGENT_LLM_KEY:
        return None
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"cover-{uuid.uuid4().hex[:8]}",
            system_message="You are a professional cover-image generator.",
        ).with_model("gemini", IMAGE_MODEL).with_params(modalities=["image", "text"])
        full_prompt = (
            "Create a high-quality, photorealistic 16:9 blog cover image. "
            "Professional, clean, editorial style, no text overlay. Subject: " + (prompt or "modern interior design")
        )
        _text, images = await chat.send_message_multimodal_response(UserMessage(text=full_prompt))
        if not images:
            return None
        img = images[0]
        data = base64.b64decode(img["data"])
        mime = img.get("mime_type", "image/png")
        ext = "png" if "png" in mime else ("jpg" if "jpe" in mime else "png")
        path = f"{APP_NAME}/blog/{uuid.uuid4().hex}.{ext}"
        result = put_object(path, data, mime)
        return result.get("path", path)
    except Exception as e:
        logger.warning(f"Cover image generation failed: {e}")
        return None


async def _persist_article(data: dict, category: str, status: str, source: str,
                           cover_path: Optional[str], publish_at: Optional[str] = None) -> dict:
    title = data["title"].strip()
    content_md = data["content_md"]
    doc = {
        "id": str(uuid.uuid4()),
        "slug": await _unique_slug(title),
        "title": title,
        "excerpt": (data.get("excerpt") or "").strip()[:200],
        "content_md": content_md,
        "content_html": md_to_html(content_md),
        "category": category if category in CATEGORIES else "interior",
        "tags": [str(t).strip() for t in (data.get("tags") or []) if str(t).strip()][:8],
        "cover_path": cover_path,
        "cover_external": data.get("cover_external"),
        "cover_alt": (data.get("cover_alt") or title)[:140],
        "seo_title": (data.get("seo_title") or title)[:70],
        "seo_description": (data.get("seo_description") or data.get("excerpt") or "")[:160],
        "keywords": (data.get("keywords") or "").strip(),
        "status": status,
        "source": source,
        "read_minutes": _read_minutes(content_md),
        "views": 0,
        "publish_at": publish_at,
        "published_at": now_iso() if status == "published" else None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.articles.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


# ------------------------------------------------------------------ Public API

@router.get("/blog")
async def list_blog(page: int = 1, limit: int = 9, category: str = "", q: str = ""):
    page = max(1, page)
    limit = min(50, max(1, limit))
    query = {"status": "published"}
    if category and category in CATEGORIES:
        query["category"] = category
    if q:
        query["$or"] = [
            {"title": {"$regex": re.escape(q), "$options": "i"}},
            {"excerpt": {"$regex": re.escape(q), "$options": "i"}},
        ]
    total = await db.articles.count_documents(query)
    docs = await db.articles.find(query, {"_id": 0}).sort("published_at", -1) \
        .skip((page - 1) * limit).limit(limit).to_list(limit)
    return {
        "items": [article_public(d) for d in docs],
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
    }


@router.get("/blog/media/{path:path}")
async def blog_media(path: str):
    try:
        data, content_type = get_object(path)
    except Exception:
        raise HTTPException(status_code=404, detail="Gambar tidak ditemukan")
    return Response(content=data, media_type=content_type,
                    headers={"Cache-Control": "public, max-age=86400"})


@router.get("/blog/{slug}")
async def get_blog(slug: str):
    doc = await db.articles.find_one({"slug": slug, "status": "published"}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Artikel tidak ditemukan")
    await db.articles.update_one({"id": doc["id"]}, {"$inc": {"views": 1}})
    # related: same category, exclude self
    rel = await db.articles.find(
        {"status": "published", "category": doc.get("category"), "id": {"$ne": doc["id"]}},
        {"_id": 0},
    ).sort("published_at", -1).limit(3).to_list(3)
    return {"article": article_public(doc, full=True), "related": [article_public(r) for r in rel]}


# ------------------------------------------------------------------ SSR HTML (crawlable share + SEO)

def _abs_base(request: Request) -> str:
    proto = request.headers.get("x-forwarded-proto", "https")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.hostname
    return f"{proto}://{host}"


def _esc(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


@router.get("/a/{slug}")
async def article_share_html(slug: str, request: Request):
    """Server-rendered HTML page for social crawlers (WhatsApp/FB) and search engines.
    Human browsers are redirected to the React reader after paint."""
    doc = await db.articles.find_one({"slug": slug, "status": "published"}, {"_id": 0})
    if not doc:
        return Response(content="<h1>Artikel tidak ditemukan</h1>", media_type="text/html", status_code=404)
    base = _abs_base(request)
    reader_url = f"{base}/blog/{slug}"
    img = cover_url(doc)
    img_abs = (base + img) if img and img.startswith("/") else (img or f"{base}/og-cover.png")
    title = _esc(doc.get("seo_title") or doc.get("title"))
    desc = _esc(doc.get("seo_description") or doc.get("excerpt"))
    published = doc.get("published_at") or doc.get("created_at")
    body_html = doc.get("content_html", "")
    ld = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": doc.get("title"),
        "description": doc.get("seo_description") or doc.get("excerpt"),
        "image": [img_abs],
        "datePublished": published,
        "dateModified": doc.get("updated_at") or published,
        "author": {"@type": "Organization", "name": "ProFinance Interior"},
        "publisher": {"@type": "Organization", "name": "ProFinance Interior",
                      "logo": {"@type": "ImageObject", "url": f"{base}/icon-512.png"}},
        "mainEntityOfPage": {"@type": "WebPage", "@id": reader_url},
        "keywords": doc.get("keywords", ""),
    }
    html = f"""<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{title} — ProFinance Interior</title>
<meta name="description" content="{desc}"/>
<meta name="keywords" content="{_esc(doc.get('keywords',''))}"/>
<meta name="robots" content="index, follow"/>
<link rel="canonical" href="{reader_url}"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="ProFinance Interior"/>
<meta property="og:locale" content="id_ID"/>
<meta property="og:url" content="{reader_url}"/>
<meta property="og:title" content="{title}"/>
<meta property="og:description" content="{desc}"/>
<meta property="og:image" content="{img_abs}"/>
<meta property="og:image:secure_url" content="{img_abs}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="article:published_time" content="{published}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="{title}"/>
<meta name="twitter:description" content="{desc}"/>
<meta name="twitter:image" content="{img_abs}"/>
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<style>
body{{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:760px;margin:0 auto;padding:24px;color:#0f172a;line-height:1.7}}
img{{max-width:100%;height:auto;border-radius:12px}}
h1{{font-size:1.9rem;line-height:1.2}}
a{{color:#b45309}}
.cover{{width:100%;border-radius:16px;margin:16px 0}}
.muted{{color:#64748b;font-size:.9rem}}
</style>
<script>
// Send human visitors to the rich React reader; crawlers ignore JS and read the meta above.
setTimeout(function(){{ try {{ if (!/bot|crawl|facebookexternalhit|whatsapp|slurp|preview|embed/i.test(navigator.userAgent)) {{ window.location.replace("{reader_url}"); }} }} catch(e) {{}} }}, 60);
</script>
</head>
<body>
<article>
<p class="muted">{_esc(CATEGORY_LABELS.get(doc.get('category',''),'Artikel'))} · ProFinance Interior</p>
<h1>{_esc(doc.get('title'))}</h1>
<p class="muted">{_esc(doc.get('excerpt'))}</p>
{'<img class="cover" src="' + img_abs + '" alt="' + _esc(doc.get('cover_alt','')) + '"/>' if img_abs else ''}
{body_html}
<p><a href="{reader_url}">Baca di ProFinance Interior →</a></p>
</article>
</body>
</html>"""
    return Response(content=html, media_type="text/html; charset=utf-8")


@router.get("/sitemap.xml")
async def sitemap(request: Request):
    base = _abs_base(request)
    docs = await db.articles.find({"status": "published"}, {"_id": 0, "slug": 1, "updated_at": 1}) \
        .sort("published_at", -1).limit(1000).to_list(1000)
    urls = [
        f"<url><loc>{base}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>",
        f"<url><loc>{base}/blog</loc><changefreq>daily</changefreq><priority>0.9</priority></url>",
        f"<url><loc>{base}/panduan</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>",
    ]
    for d in docs:
        lm = d.get("updated_at") or ""
        urls.append(f"<url><loc>{base}/blog/{d['slug']}</loc><lastmod>{lm}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>")
    xml = ('<?xml version="1.0" encoding="UTF-8"?>'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(urls) + "</urlset>")
    return Response(content=xml, media_type="application/xml")


# ------------------------------------------------------------------ Admin API

class ArticleIn(BaseModel):
    title: str
    excerpt: Optional[str] = ""
    content_md: str
    category: str = "interior"
    tags: Optional[List[str]] = None
    status: str = "draft"           # draft | scheduled | published
    publish_at: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    keywords: Optional[str] = None
    cover_external: Optional[str] = None


class GenerateIn(BaseModel):
    topic: Optional[str] = ""
    prompt: Optional[str] = ""      # extra instructions
    category: str = "interior"
    image_base64: Optional[str] = None
    generate_cover: bool = True
    publish: bool = True


@router.get("/admin/articles")
async def admin_list_articles(status: str = "", q: str = "", page: int = 1, limit: int = 20,
                              user: dict = Depends(require_admin)):
    page = max(1, page)
    limit = min(100, max(1, limit))
    query = {}
    if status:
        query["status"] = status
    if q:
        query["title"] = {"$regex": re.escape(q), "$options": "i"}
    total = await db.articles.count_documents(query)
    docs = await db.articles.find(query, {"_id": 0}).sort("created_at", -1) \
        .skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"items": [article_public(d, full=False) for d in docs], "total": total,
            "page": page, "pages": max(1, (total + limit - 1) // limit)}


@router.get("/admin/articles/{article_id}")
async def admin_get_article(article_id: str, user: dict = Depends(require_admin)):
    doc = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Artikel tidak ditemukan")
    return article_public(doc, full=True)


@router.post("/admin/articles")
async def admin_create_article(body: ArticleIn, user: dict = Depends(require_admin)):
    status = body.status if body.status in ("draft", "scheduled", "published") else "draft"
    doc = {
        "id": str(uuid.uuid4()),
        "slug": await _unique_slug(body.title),
        "title": body.title.strip(),
        "excerpt": (body.excerpt or "").strip()[:200],
        "content_md": body.content_md,
        "content_html": md_to_html(body.content_md),
        "category": body.category if body.category in CATEGORIES else "interior",
        "tags": [t.strip() for t in (body.tags or []) if t.strip()][:8],
        "cover_path": None,
        "cover_external": (body.cover_external or "").strip() or None,
        "cover_alt": body.title.strip()[:140],
        "seo_title": (body.seo_title or body.title).strip()[:70],
        "seo_description": (body.seo_description or body.excerpt or "").strip()[:160],
        "keywords": (body.keywords or "").strip(),
        "status": status,
        "source": "manual",
        "read_minutes": _read_minutes(body.content_md),
        "views": 0,
        "publish_at": body.publish_at,
        "published_at": now_iso() if status == "published" else None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.articles.insert_one(dict(doc))
    doc.pop("_id", None)
    return article_public(doc, full=True)


@router.put("/admin/articles/{article_id}")
async def admin_update_article(article_id: str, body: ArticleIn, user: dict = Depends(require_admin)):
    doc = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Artikel tidak ditemukan")
    status = body.status if body.status in ("draft", "scheduled", "published") else doc.get("status", "draft")
    updates = {
        "title": body.title.strip(),
        "excerpt": (body.excerpt or "").strip()[:200],
        "content_md": body.content_md,
        "content_html": md_to_html(body.content_md),
        "category": body.category if body.category in CATEGORIES else doc.get("category", "interior"),
        "tags": [t.strip() for t in (body.tags or []) if t.strip()][:8],
        "seo_title": (body.seo_title or body.title).strip()[:70],
        "seo_description": (body.seo_description or body.excerpt or "").strip()[:160],
        "keywords": (body.keywords or "").strip(),
        "status": status,
        "read_minutes": _read_minutes(body.content_md),
        "publish_at": body.publish_at,
        "updated_at": now_iso(),
    }
    if body.cover_external is not None:
        updates["cover_external"] = body.cover_external.strip() or None
    if status == "published" and not doc.get("published_at"):
        updates["published_at"] = now_iso()
    if body.title.strip() != doc.get("title"):
        updates["slug"] = await _unique_slug(body.title, exclude_id=article_id)
    await db.articles.update_one({"id": article_id}, {"$set": updates})
    fresh = await db.articles.find_one({"id": article_id}, {"_id": 0})
    return article_public(fresh, full=True)


@router.delete("/admin/articles/{article_id}")
async def admin_delete_article(article_id: str, user: dict = Depends(require_admin)):
    doc = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Artikel tidak ditemukan")
    if doc.get("cover_path"):
        delete_object(doc["cover_path"])
    await db.articles.delete_one({"id": article_id})
    return {"ok": True}


@router.post("/admin/articles/generate")
async def admin_generate_article(body: GenerateIn, user: dict = Depends(require_admin)):
    category = body.category if body.category in CATEGORIES else "interior"
    topic = (body.topic or "").strip()
    if not topic:
        # fall back to a rotating topic in the chosen category
        pool = [t for c, t in AUTO_TOPICS if c == category] or [t for _, t in AUTO_TOPICS]
        topic = pool[datetime.now().minute % len(pool)]
    data = await generate_article_ai(topic, body.prompt or "", category, body.image_base64)
    cover_path = None
    if body.generate_cover:
        cover_path = await generate_cover_image(data.get("cover_prompt") or topic)
    status = "published" if body.publish else "draft"
    doc = await _persist_article(data, category, status, "ai", cover_path)
    return article_public(doc, full=True)


@router.post("/admin/articles/{article_id}/regenerate-cover")
async def admin_regen_cover(article_id: str, user: dict = Depends(require_admin)):
    doc = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Artikel tidak ditemukan")
    prompt = doc.get("title", "")
    new_path = await generate_cover_image(prompt)
    if not new_path:
        raise HTTPException(status_code=502, detail="Gagal membuat gambar cover, coba lagi")
    if doc.get("cover_path"):
        delete_object(doc["cover_path"])
    await db.articles.update_one({"id": article_id},
                                 {"$set": {"cover_path": new_path, "cover_external": None, "updated_at": now_iso()}})
    fresh = await db.articles.find_one({"id": article_id}, {"_id": 0})
    return article_public(fresh, full=True)


# ------------------------------------------------------------------ Autonomous cron

async def _auto_generate_job():
    """Pick the next rotating topic, generate an article + cover, publish it."""
    try:
        settings = await db.settings.find_one({"id": "app_settings"}, {"_id": 0}) or {}
        idx = int(settings.get("blogAutoIndex", 0)) % len(AUTO_TOPICS)
        category, topic = AUTO_TOPICS[idx]
        data = await generate_article_ai(topic, "", category, None)
        cover_path = await generate_cover_image(data.get("cover_prompt") or topic)
        await _persist_article(data, category, "published", "ai", cover_path)
        await db.settings.update_one(
            {"id": "app_settings"},
            {"$set": {"blogLastAutoAt": now_iso(), "blogAutoIndex": (idx + 1) % len(AUTO_TOPICS)}},
            upsert=True,
        )
        logger.info(f"Autonomous article generated: {topic}")
    except Exception as e:
        logger.error(f"Autonomous article generation failed: {e}")


@router.post("/cron/generate-article")
async def cron_generate_article(request: Request, background: BackgroundTasks, force: bool = False):
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else ""
    if not CRON_SECRET or not hmac.compare_digest(token, CRON_SECRET):
        raise HTTPException(status_code=401, detail="Unauthorized")
    settings = await db.settings.find_one({"id": "app_settings"}, {"_id": 0}) or {}
    if not force:
        if not settings.get("blogAutoEnabled"):
            return {"ok": True, "skipped": "disabled"}
        interval_h = int(settings.get("blogAutoIntervalHours", 72) or 72)
        last = _parse_iso(settings.get("blogLastAutoAt"))
        if last and datetime.now(timezone.utc) - last < timedelta(hours=interval_h):
            return {"ok": True, "skipped": "interval_not_elapsed",
                    "nextInHours": round(interval_h - (datetime.now(timezone.utc) - last).total_seconds() / 3600, 1)}
    background.add_task(_auto_generate_job)
    return {"ok": True, "queued": True}


async def ensure_indexes():
    try:
        await db.articles.create_index("slug", unique=True)
        await db.articles.create_index([("status", 1), ("published_at", -1)])
        await db.articles.create_index("category")
    except Exception as e:
        logger.error(f"Article index init failed: {e}")


async def _scheduler_loop():
    """In-process scheduler: hourly check whether an autonomous article is due.
    Self-contained so it does not depend on any external cron daemon."""
    import asyncio
    await asyncio.sleep(60)  # let the app settle after startup
    while True:
        try:
            settings = await db.settings.find_one({"id": "app_settings"}, {"_id": 0}) or {}
            if settings.get("blogAutoEnabled"):
                interval_h = int(settings.get("blogAutoIntervalHours", 72) or 72)
                last = _parse_iso(settings.get("blogLastAutoAt"))
                due = (not last) or (datetime.now(timezone.utc) - last >= timedelta(hours=interval_h))
                if due:
                    logger.info("Scheduler: autonomous article generation due, running...")
                    await _auto_generate_job()
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
        import asyncio as _a
        await _a.sleep(3600)  # re-check every hour


def start_scheduler():
    import asyncio
    try:
        asyncio.create_task(_scheduler_loop())
        logger.info("Blog auto-generation scheduler started")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")
