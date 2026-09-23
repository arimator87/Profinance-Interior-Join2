#!/usr/bin/env python3
"""
Backend test suite for ProFinance Interior Blog/Artikel feature.
Tests all blog endpoints: public, admin CRUD, AI generation, SSR, sitemap, cron.
"""
import os
import sys
import time
import json
import httpx
from datetime import datetime

# Base URL for backend API
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8001/api")

# Admin credentials (owner email = auto admin + premium)
ADMIN_EMAIL = "furniture.mail@gmail.com"
ADMIN_PASSWORD = "Admin12345"

# CRON secret from backend/.env
CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET", "pf_cron_9x2Kv7Qr4mB1nZ6sL0aWd3Ht8Yc5Ep")

# Test results tracking
test_results = []
admin_token = None
test_article_id = None
test_article_slug = None
ai_article_id = None
ai_article_slug = None
ai_cover_url = None


def log_test(name, passed, details=""):
    """Log test result."""
    status = "✅ PASS" if passed else "❌ FAIL"
    test_results.append({"name": name, "passed": passed, "details": details})
    print(f"{status}: {name}")
    if details:
        print(f"  Details: {details}")


def test_a_public_blog_list():
    """(A) GET /api/blog (no auth) -> 200 with keys items,total,page,pages."""
    try:
        with httpx.Client(timeout=30) as client:
            r = client.get(f"{BACKEND_URL}/blog")
            if r.status_code != 200:
                log_test("A. Public blog list", False, f"Expected 200, got {r.status_code}")
                return False
            data = r.json()
            required_keys = ["items", "total", "page", "pages"]
            missing = [k for k in required_keys if k not in data]
            if missing:
                log_test("A. Public blog list", False, f"Missing keys: {missing}")
                return False
            log_test("A. Public blog list", True, f"Got {data['total']} articles, page {data['page']}/{data['pages']}")
            return True
    except Exception as e:
        log_test("A. Public blog list", False, f"Exception: {e}")
        return False


def test_b1_admin_login():
    """Login admin and get token."""
    global admin_token
    try:
        with httpx.Client(timeout=30) as client:
            r = client.post(f"{BACKEND_URL}/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            if r.status_code != 200:
                log_test("B1. Admin login", False, f"Expected 200, got {r.status_code}: {r.text[:200]}")
                return False
            data = r.json()
            admin_token = data.get("token")
            if not admin_token:
                log_test("B1. Admin login", False, "No token in response")
                return False
            log_test("B1. Admin login", True, f"Token: {admin_token[:20]}...")
            return True
    except Exception as e:
        log_test("B1. Admin login", False, f"Exception: {e}")
        return False


def test_b2_admin_create_article():
    """(B1) POST /api/admin/articles with manual content."""
    global test_article_id, test_article_slug
    if not admin_token:
        log_test("B2. Admin create article", False, "No admin token")
        return False
    try:
        with httpx.Client(timeout=30) as client:
            r = client.post(f"{BACKEND_URL}/admin/articles", json={
                "title": "Panduan Uji",
                "excerpt": "ringkas",
                "content_md": "## Judul\nIsi **tebal**\n- a\n- b",
                "category": "panduan",
                "tags": ["uji"],
                "status": "published"
            }, headers={"Authorization": f"Bearer {admin_token}"})
            
            if r.status_code != 200:
                log_test("B2. Admin create article", False, f"Expected 200, got {r.status_code}: {r.text[:200]}")
                return False
            
            data = r.json()
            test_article_id = data.get("id")
            test_article_slug = data.get("slug")
            
            # Verify response structure
            checks = []
            checks.append(("id", test_article_id is not None))
            checks.append(("slug", test_article_slug is not None))
            checks.append(("contentHtml", data.get("contentHtml") and "<h2" in data.get("contentHtml", "")))
            checks.append(("contentHtml has <strong>", "<strong>" in data.get("contentHtml", "")))
            checks.append(("status=published", data.get("status") == "published"))
            checks.append(("publishedAt not null", data.get("publishedAt") is not None))
            
            failed = [name for name, result in checks if not result]
            if failed:
                log_test("B2. Admin create article", False, f"Failed checks: {failed}")
                return False
            
            log_test("B2. Admin create article", True, f"Created article id={test_article_id}, slug={test_article_slug}")
            return True
    except Exception as e:
        log_test("B2. Admin create article", False, f"Exception: {e}")
        return False


def test_b3_admin_list_articles():
    """(B2) GET /api/admin/articles -> 200, list contains the created article."""
    if not admin_token or not test_article_id:
        log_test("B3. Admin list articles", False, "Missing admin token or test article")
        return False
    try:
        with httpx.Client(timeout=30) as client:
            r = client.get(f"{BACKEND_URL}/admin/articles", headers={"Authorization": f"Bearer {admin_token}"})
            if r.status_code != 200:
                log_test("B3. Admin list articles", False, f"Expected 200, got {r.status_code}")
                return False
            data = r.json()
            items = data.get("items", [])
            found = any(a.get("id") == test_article_id for a in items)
            if not found:
                log_test("B3. Admin list articles", False, f"Test article {test_article_id} not found in list")
                return False
            log_test("B3. Admin list articles", True, f"Found test article in list of {len(items)} articles")
            return True
    except Exception as e:
        log_test("B3. Admin list articles", False, f"Exception: {e}")
        return False


def test_b4_admin_get_article():
    """(B3) GET /api/admin/articles/{id} -> 200 full with contentMd and seoTitle."""
    if not admin_token or not test_article_id:
        log_test("B4. Admin get article", False, "Missing admin token or test article")
        return False
    try:
        with httpx.Client(timeout=30) as client:
            r = client.get(f"{BACKEND_URL}/admin/articles/{test_article_id}", 
                          headers={"Authorization": f"Bearer {admin_token}"})
            if r.status_code != 200:
                log_test("B4. Admin get article", False, f"Expected 200, got {r.status_code}")
                return False
            data = r.json()
            checks = []
            checks.append(("contentMd", data.get("contentMd") is not None))
            checks.append(("seoTitle", data.get("seoTitle") is not None))
            checks.append(("contentHtml", data.get("contentHtml") is not None))
            
            failed = [name for name, result in checks if not result]
            if failed:
                log_test("B4. Admin get article", False, f"Missing fields: {failed}")
                return False
            log_test("B4. Admin get article", True, f"Got full article with contentMd and seoTitle")
            return True
    except Exception as e:
        log_test("B4. Admin get article", False, f"Exception: {e}")
        return False


def test_b5_admin_update_article():
    """(B4) PUT /api/admin/articles/{id} changing title to 'Panduan Uji Edit', status published -> 200."""
    global test_article_slug
    if not admin_token or not test_article_id:
        log_test("B5. Admin update article", False, "Missing admin token or test article")
        return False
    try:
        with httpx.Client(timeout=30) as client:
            r = client.put(f"{BACKEND_URL}/admin/articles/{test_article_id}", json={
                "title": "Panduan Uji Edit",
                "excerpt": "ringkas",
                "content_md": "## Judul\nIsi **tebal**\n- a\n- b",
                "category": "panduan",
                "tags": ["uji"],
                "status": "published"
            }, headers={"Authorization": f"Bearer {admin_token}"})
            
            if r.status_code != 200:
                log_test("B5. Admin update article", False, f"Expected 200, got {r.status_code}: {r.text[:200]}")
                return False
            
            data = r.json()
            # Slug may change due to title change
            test_article_slug = data.get("slug")
            
            if data.get("title") != "Panduan Uji Edit":
                log_test("B5. Admin update article", False, f"Title not updated: {data.get('title')}")
                return False
            
            log_test("B5. Admin update article", True, f"Updated title, new slug={test_article_slug}")
            return True
    except Exception as e:
        log_test("B5. Admin update article", False, f"Exception: {e}")
        return False


def test_b6_public_get_article_and_views():
    """(B5) GET /api/blog/{slug} (no auth) -> 200 {article, related}, and views increments on repeat call."""
    if not test_article_slug:
        log_test("B6. Public get article + views", False, "No test article slug")
        return False
    try:
        with httpx.Client(timeout=30) as client:
            # First call
            r1 = client.get(f"{BACKEND_URL}/blog/{test_article_slug}")
            if r1.status_code != 200:
                log_test("B6. Public get article + views", False, f"Expected 200, got {r1.status_code}")
                return False
            
            data1 = r1.json()
            if "article" not in data1 or "related" not in data1:
                log_test("B6. Public get article + views", False, "Missing article or related keys")
                return False
            
            views1 = data1["article"].get("views", 0)
            
            # Second call to increment views
            time.sleep(0.5)
            r2 = client.get(f"{BACKEND_URL}/blog/{test_article_slug}")
            if r2.status_code != 200:
                log_test("B6. Public get article + views", False, f"Second call failed: {r2.status_code}")
                return False
            
            data2 = r2.json()
            views2 = data2["article"].get("views", 0)
            
            if views2 <= views1:
                log_test("B6. Public get article + views", False, f"Views did not increment: {views1} -> {views2}")
                return False
            
            log_test("B6. Public get article + views", True, f"Views incremented: {views1} -> {views2}")
            return True
    except Exception as e:
        log_test("B6. Public get article + views", False, f"Exception: {e}")
        return False


def test_b7_public_filter_by_category():
    """(B6) GET /api/blog?category=panduan -> contains the article."""
    if not test_article_id:
        log_test("B7. Public filter by category", False, "No test article")
        return False
    try:
        with httpx.Client(timeout=30) as client:
            r = client.get(f"{BACKEND_URL}/blog?category=panduan")
            if r.status_code != 200:
                log_test("B7. Public filter by category", False, f"Expected 200, got {r.status_code}")
                return False
            
            data = r.json()
            items = data.get("items", [])
            found = any(a.get("id") == test_article_id for a in items)
            
            if not found:
                log_test("B7. Public filter by category", False, f"Test article not found in category=panduan")
                return False
            
            log_test("B7. Public filter by category", True, f"Found article in category filter")
            return True
    except Exception as e:
        log_test("B7. Public filter by category", False, f"Exception: {e}")
        return False


def test_c1_ssr_html():
    """(C) SSR: GET /api/a/{slug} (no auth) -> 200 text/html containing og:title, og:image, application/ld+json, and canonical."""
    if not test_article_slug:
        log_test("C1. SSR HTML", False, "No test article slug")
        return False
    try:
        with httpx.Client(timeout=30) as client:
            r = client.get(f"{BACKEND_URL}/a/{test_article_slug}")
            if r.status_code != 200:
                log_test("C1. SSR HTML", False, f"Expected 200, got {r.status_code}")
                return False
            
            if "text/html" not in r.headers.get("content-type", ""):
                log_test("C1. SSR HTML", False, f"Expected text/html, got {r.headers.get('content-type')}")
                return False
            
            html = r.text
            checks = []
            checks.append(("og:title", "og:title" in html))
            checks.append(("og:image", "og:image" in html))
            checks.append(("application/ld+json", "application/ld+json" in html))
            checks.append(("canonical", f"/blog/{test_article_slug}" in html))
            
            failed = [name for name, result in checks if not result]
            if failed:
                log_test("C1. SSR HTML", False, f"Missing elements: {failed}")
                return False
            
            log_test("C1. SSR HTML", True, f"SSR HTML contains all required meta tags")
            return True
    except Exception as e:
        log_test("C1. SSR HTML", False, f"Exception: {e}")
        return False


def test_c2_sitemap():
    """(C) GET /api/sitemap.xml -> 200 xml containing the slug."""
    if not test_article_slug:
        log_test("C2. Sitemap", False, "No test article slug")
        return False
    try:
        with httpx.Client(timeout=30) as client:
            r = client.get(f"{BACKEND_URL}/sitemap.xml")
            if r.status_code != 200:
                log_test("C2. Sitemap", False, f"Expected 200, got {r.status_code}")
                return False
            
            if "application/xml" not in r.headers.get("content-type", ""):
                log_test("C2. Sitemap", False, f"Expected xml, got {r.headers.get('content-type')}")
                return False
            
            xml = r.text
            if test_article_slug not in xml:
                log_test("C2. Sitemap", False, f"Slug {test_article_slug} not found in sitemap")
                return False
            
            log_test("C2. Sitemap", True, f"Sitemap contains article slug")
            return True
    except Exception as e:
        log_test("C2. Sitemap", False, f"Exception: {e}")
        return False


def test_d_ai_generate():
    """(D) AI GENERATE (ONCE only): POST /api/admin/articles/generate with generous timeout."""
    global ai_article_id, ai_article_slug, ai_cover_url
    if not admin_token:
        log_test("D. AI generate article", False, "No admin token")
        return False
    
    print("\n⏳ AI generation starting (this will take 40-90 seconds)...")
    try:
        with httpx.Client(timeout=150) as client:  # 150s timeout for AI generation
            start_time = time.time()
            r = client.post(f"{BACKEND_URL}/admin/articles/generate", json={
                "topic": "Tips memilih lampu untuk ruang keluarga",
                "category": "interior",
                "generate_cover": True,
                "publish": True
            }, headers={"Authorization": f"Bearer {admin_token}"})
            
            elapsed = time.time() - start_time
            
            if r.status_code != 200:
                log_test("D. AI generate article", False, f"Expected 200, got {r.status_code}: {r.text[:300]}")
                return False
            
            data = r.json()
            ai_article_id = data.get("id")
            ai_article_slug = data.get("slug")
            ai_cover_url = data.get("coverUrl")
            
            checks = []
            checks.append(("id", ai_article_id is not None))
            checks.append(("slug", ai_article_slug is not None))
            checks.append(("contentHtml non-empty", bool(data.get("contentHtml"))))
            checks.append(("title non-empty", bool(data.get("title"))))
            checks.append(("coverUrl starts with /api/blog/media/", 
                          ai_cover_url and ai_cover_url.startswith("/api/blog/media/")))
            
            failed = [name for name, result in checks if not result]
            if failed:
                log_test("D. AI generate article", False, f"Failed checks: {failed}")
                return False
            
            log_test("D. AI generate article", True, 
                    f"Generated in {elapsed:.1f}s, id={ai_article_id}, coverUrl={ai_cover_url}")
            return True
    except httpx.TimeoutException:
        log_test("D. AI generate article", False, "Timeout after 150s")
        return False
    except Exception as e:
        log_test("D. AI generate article", False, f"Exception: {e}")
        return False


def test_d2_ai_cover_image():
    """(D) GET {backend}{coverUrl} -> 200 with image/* content-type."""
    if not ai_cover_url:
        log_test("D2. AI cover image", False, "No AI cover URL")
        return False
    try:
        # coverUrl is relative like /api/blog/media/..., need to construct full URL
        # Remove /api prefix since BACKEND_URL already has it
        cover_path = ai_cover_url.replace("/api", "", 1)
        full_url = f"{BACKEND_URL}{cover_path}"
        
        with httpx.Client(timeout=30) as client:
            r = client.get(full_url)
            if r.status_code != 200:
                log_test("D2. AI cover image", False, f"Expected 200, got {r.status_code}")
                return False
            
            content_type = r.headers.get("content-type", "")
            if not content_type.startswith("image/"):
                log_test("D2. AI cover image", False, f"Expected image/*, got {content_type}")
                return False
            
            size = len(r.content)
            log_test("D2. AI cover image", True, f"Got image ({content_type}, {size} bytes)")
            return True
    except Exception as e:
        log_test("D2. AI cover image", False, f"Exception: {e}")
        return False


def test_e_gating_free_user():
    """(E) GATING: register a NEW free user -> GET/POST /api/admin/articles with free token -> 403."""
    try:
        # Register new free user
        timestamp = int(time.time())
        free_email = f"test_blog_free_{timestamp}@test.com"
        
        with httpx.Client(timeout=30) as client:
            r = client.post(f"{BACKEND_URL}/auth/register", json={
                "email": free_email,
                "name": "Test Blog Free",
                "password": "Test123456"
            })
            
            if r.status_code != 200:
                log_test("E. Gating free user", False, f"Register failed: {r.status_code}")
                return False
            
            free_token = r.json().get("token")
            if not free_token:
                log_test("E. Gating free user", False, "No token from register")
                return False
            
            # Try GET /api/admin/articles with free token
            r_get = client.get(f"{BACKEND_URL}/admin/articles", 
                              headers={"Authorization": f"Bearer {free_token}"})
            
            # Try POST /api/admin/articles with free token
            r_post = client.post(f"{BACKEND_URL}/admin/articles", json={
                "title": "Test",
                "content_md": "Test",
                "status": "draft"
            }, headers={"Authorization": f"Bearer {free_token}"})
            
            checks = []
            checks.append(("GET returns 403", r_get.status_code == 403))
            checks.append(("POST returns 403", r_post.status_code == 403))
            
            failed = [name for name, result in checks if not result]
            if failed:
                log_test("E. Gating free user", False, 
                        f"Failed: {failed}. GET={r_get.status_code}, POST={r_post.status_code}")
                return False
            
            log_test("E. Gating free user", True, "Free user correctly blocked (403) on admin endpoints")
            return True
    except Exception as e:
        log_test("E. Gating free user", False, f"Exception: {e}")
        return False


def test_f_cron_auth_and_disabled():
    """(F) CRON: POST /api/cron/generate-article WITHOUT auth -> 401; WITH Bearer {secret} and disabled -> 200 {skipped}."""
    try:
        with httpx.Client(timeout=30) as client:
            # Test without auth
            r_no_auth = client.post(f"{BACKEND_URL}/cron/generate-article")
            
            # Test with correct auth but blogAutoEnabled=false (default)
            r_with_auth = client.post(f"{BACKEND_URL}/cron/generate-article",
                                     headers={"Authorization": f"Bearer {CRON_SECRET}"})
            
            checks = []
            checks.append(("No auth returns 401", r_no_auth.status_code == 401))
            checks.append(("With auth returns 200", r_with_auth.status_code == 200))
            
            if r_with_auth.status_code == 200:
                data = r_with_auth.json()
                checks.append(("Response has skipped='disabled'", data.get("skipped") == "disabled"))
            
            failed = [name for name, result in checks if not result]
            if failed:
                log_test("F. Cron auth and disabled", False, 
                        f"Failed: {failed}. No auth={r_no_auth.status_code}, With auth={r_with_auth.status_code}")
                return False
            
            log_test("F. Cron auth and disabled", True, 
                    "Cron auth working (401 without, 200 with secret, skipped when disabled)")
            return True
    except Exception as e:
        log_test("F. Cron auth and disabled", False, f"Exception: {e}")
        return False


def cleanup_test_article():
    """Delete the manual test article."""
    if not admin_token or not test_article_id:
        print("\n⚠️  No test article to cleanup")
        return
    
    try:
        with httpx.Client(timeout=30) as client:
            r = client.delete(f"{BACKEND_URL}/admin/articles/{test_article_id}",
                            headers={"Authorization": f"Bearer {admin_token}"})
            if r.status_code == 200:
                print(f"\n✅ Cleaned up test article {test_article_id}")
            else:
                print(f"\n⚠️  Failed to cleanup test article: {r.status_code}")
    except Exception as e:
        print(f"\n⚠️  Cleanup exception: {e}")


def print_summary():
    """Print test summary."""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for t in test_results if t["passed"])
    total = len(test_results)
    
    print(f"\nTotal: {passed}/{total} tests passed\n")
    
    for t in test_results:
        status = "✅" if t["passed"] else "❌"
        print(f"{status} {t['name']}")
        if not t["passed"] and t["details"]:
            print(f"   {t['details']}")
    
    print("\n" + "="*80)
    
    return passed == total


def main():
    """Run all tests."""
    print("="*80)
    print("ProFinance Interior - Blog/Artikel Backend Test Suite")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    print("="*80 + "\n")
    
    # Run tests in order
    tests = [
        ("A. Public blog list", test_a_public_blog_list),
        ("B1. Admin login", test_b1_admin_login),
        ("B2. Admin create article", test_b2_admin_create_article),
        ("B3. Admin list articles", test_b3_admin_list_articles),
        ("B4. Admin get article", test_b4_admin_get_article),
        ("B5. Admin update article", test_b5_admin_update_article),
        ("B6. Public get article + views", test_b6_public_get_article_and_views),
        ("B7. Public filter by category", test_b7_public_filter_by_category),
        ("C1. SSR HTML", test_c1_ssr_html),
        ("C2. Sitemap", test_c2_sitemap),
        ("D. AI generate article", test_d_ai_generate),
        ("D2. AI cover image", test_d2_ai_cover_image),
        ("E. Gating free user", test_e_gating_free_user),
        ("F. Cron auth and disabled", test_f_cron_auth_and_disabled),
    ]
    
    for name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            log_test(name, False, f"Unexpected exception: {e}")
        print()  # Blank line between tests
    
    # Cleanup
    cleanup_test_article()
    
    # Print summary
    all_passed = print_summary()
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
