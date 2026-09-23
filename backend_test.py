#!/usr/bin/env python3
"""
Backend Test Suite for ProFinance Interior - Article Statistics
Round 13: Test Article Statistics endpoint + daily view tracking
"""
import requests
import time
import json
from datetime import datetime

BASE_URL = "http://localhost:8001/api"

# Admin credentials (owner email = auto admin)
ADMIN_EMAIL = "furniture.mail@gmail.com"
ADMIN_PASSWORD = "Admin12345"

def log(msg):
    print(f"[TEST] {msg}")

def test_login_admin():
    """Test 1: Login admin and get token"""
    log("TEST 1: Login admin")
    url = f"{BASE_URL}/auth/login"
    payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    
    resp = requests.post(url, json=payload)
    log(f"  POST {url} -> {resp.status_code}")
    
    if resp.status_code != 200:
        log(f"  ❌ FAIL: Expected 200, got {resp.status_code}")
        log(f"  Response: {resp.text}")
        return None
    
    data = resp.json()
    token = data.get("token")
    
    if not token:
        log(f"  ❌ FAIL: No token in response")
        return None
    
    log(f"  ✅ PASS: Admin login successful, token obtained")
    return token

def test_stats_overview_structure(token):
    """Test 2: GET /api/admin/articles/stats/overview - verify structure"""
    log("TEST 2: GET /api/admin/articles/stats/overview - verify structure")
    url = f"{BASE_URL}/admin/articles/stats/overview"
    headers = {"Authorization": f"Bearer {token}"}
    
    resp = requests.get(url, headers=headers)
    log(f"  GET {url} -> {resp.status_code}")
    
    if resp.status_code != 200:
        log(f"  ❌ FAIL: Expected 200, got {resp.status_code}")
        log(f"  Response: {resp.text}")
        return None
    
    data = resp.json()
    
    # Verify required integer fields
    required_ints = ["totalArticles", "published", "drafts", "aiCount", "totalViews"]
    for field in required_ints:
        if field not in data:
            log(f"  ❌ FAIL: Missing field '{field}'")
            return None
        if not isinstance(data[field], int):
            log(f"  ❌ FAIL: Field '{field}' is not an integer, got {type(data[field])}")
            return None
    
    log(f"  ✅ Integer fields present: totalArticles={data['totalArticles']}, published={data['published']}, drafts={data['drafts']}, aiCount={data['aiCount']}, totalViews={data['totalViews']}")
    
    # Verify 'top' array
    if "top" not in data or not isinstance(data["top"], list):
        log(f"  ❌ FAIL: 'top' field missing or not an array")
        return None
    
    top = data["top"]
    log(f"  ✅ 'top' array present with {len(top)} items")
    
    if len(top) > 0:
        # Verify first item has required fields
        item = top[0]
        required_top_fields = ["id", "title", "slug", "views", "category", "categoryLabel", "status"]
        for field in required_top_fields:
            if field not in item:
                log(f"  ❌ FAIL: 'top' item missing field '{field}'")
                return None
        
        log(f"  ✅ 'top' items have correct structure: {required_top_fields}")
        
        # Verify sorted by views DESC
        views_list = [item["views"] for item in top]
        if views_list != sorted(views_list, reverse=True):
            log(f"  ❌ FAIL: 'top' array not sorted by views DESC")
            log(f"  Views: {views_list}")
            return None
        
        log(f"  ✅ 'top' array correctly sorted by views DESC: {views_list}")
    
    # Verify 'byCategory' array
    if "byCategory" not in data or not isinstance(data["byCategory"], list):
        log(f"  ❌ FAIL: 'byCategory' field missing or not an array")
        return None
    
    by_category = data["byCategory"]
    log(f"  ✅ 'byCategory' array present with {len(by_category)} items")
    
    if len(by_category) > 0:
        item = by_category[0]
        required_cat_fields = ["category", "categoryLabel", "count", "views"]
        for field in required_cat_fields:
            if field not in item:
                log(f"  ❌ FAIL: 'byCategory' item missing field '{field}'")
                return None
        
        log(f"  ✅ 'byCategory' items have correct structure: {required_cat_fields}")
    
    # Verify 'daily' array
    if "daily" not in data or not isinstance(data["daily"], list):
        log(f"  ❌ FAIL: 'daily' field missing or not an array")
        return None
    
    daily = data["daily"]
    if len(daily) != 14:
        log(f"  ❌ FAIL: 'daily' array should have 14 items, got {len(daily)}")
        return None
    
    log(f"  ✅ 'daily' array has correct length: 14")
    
    if len(daily) > 0:
        item = daily[0]
        required_daily_fields = ["date", "label", "views"]
        for field in required_daily_fields:
            if field not in item:
                log(f"  ❌ FAIL: 'daily' item missing field '{field}'")
                return None
        
        log(f"  ✅ 'daily' items have correct structure: {required_daily_fields}")
        log(f"  Sample daily entry: date={daily[0]['date']}, label={daily[0]['label']}, views={daily[0]['views']}")
        log(f"  Last daily entry (today): date={daily[-1]['date']}, label={daily[-1]['label']}, views={daily[-1]['views']}")
    
    log(f"  ✅ PASS: All structure validations passed")
    return data

def test_daily_tracking(token, initial_stats):
    """Test 3: Daily tracking - call GET /api/blog/{slug} 3 times and verify views increment"""
    log("TEST 3: Daily tracking - verify views increment")
    
    # First, get a published article slug
    url = f"{BASE_URL}/blog"
    resp = requests.get(url)
    log(f"  GET {url} -> {resp.status_code}")
    
    if resp.status_code != 200:
        log(f"  ❌ FAIL: Could not get blog list, status {resp.status_code}")
        return False
    
    data = resp.json()
    items = data.get("items", [])
    
    if len(items) == 0:
        log(f"  ⚠️  SKIP: No published articles found to test daily tracking")
        return True  # Not a failure, just no data
    
    # Pick the first published article
    slug = items[0].get("slug")
    log(f"  Selected article slug: {slug}")
    
    # Call GET /api/blog/{slug} 3 times (no auth)
    article_url = f"{BASE_URL}/blog/{slug}"
    for i in range(3):
        resp = requests.get(article_url)
        log(f"  GET {article_url} (call {i+1}/3) -> {resp.status_code}")
        if resp.status_code != 200:
            log(f"  ❌ FAIL: Article GET failed with status {resp.status_code}")
            return False
        time.sleep(0.2)  # Small delay between calls
    
    log(f"  ✅ Called GET /api/blog/{slug} 3 times successfully")
    
    # Now get stats again
    stats_url = f"{BASE_URL}/admin/articles/stats/overview"
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(stats_url, headers=headers)
    log(f"  GET {stats_url} -> {resp.status_code}")
    
    if resp.status_code != 200:
        log(f"  ❌ FAIL: Could not get stats after tracking, status {resp.status_code}")
        return False
    
    new_stats = resp.json()
    
    # Verify totalViews increased by ~3
    initial_total = initial_stats["totalViews"]
    new_total = new_stats["totalViews"]
    diff_total = new_total - initial_total
    
    log(f"  Initial totalViews: {initial_total}")
    log(f"  New totalViews: {new_total}")
    log(f"  Difference: {diff_total}")
    
    if diff_total < 3:
        log(f"  ❌ FAIL: totalViews should have increased by at least 3, got {diff_total}")
        return False
    
    log(f"  ✅ totalViews increased by {diff_total} (expected ~3)")
    
    # Verify the LAST entry of daily[] (today) increased by ~3
    initial_daily_today = initial_stats["daily"][-1]["views"]
    new_daily_today = new_stats["daily"][-1]["views"]
    diff_daily = new_daily_today - initial_daily_today
    
    log(f"  Initial daily[last] (today) views: {initial_daily_today}")
    log(f"  New daily[last] (today) views: {new_daily_today}")
    log(f"  Difference: {diff_daily}")
    
    if diff_daily < 3:
        log(f"  ❌ FAIL: daily[last] views should have increased by at least 3, got {diff_daily}")
        return False
    
    log(f"  ✅ daily[last] (today) views increased by {diff_daily} (expected ~3)")
    log(f"  ✅ PASS: Daily tracking working correctly")
    return True

def test_gating_free_user():
    """Test 4: Gating - free user should get 403"""
    log("TEST 4: Gating - free user should get 403")
    
    # Register a new free user with unique email
    timestamp = int(time.time())
    email = f"test_article_stats_free_{timestamp}@test.com"
    password = "TestPass123"
    
    register_url = f"{BASE_URL}/auth/register"
    payload = {"email": email, "password": password, "name": "Test User"}
    
    resp = requests.post(register_url, json=payload)
    log(f"  POST {register_url} -> {resp.status_code}")
    
    if resp.status_code != 200:
        log(f"  ❌ FAIL: Could not register free user, status {resp.status_code}")
        log(f"  Response: {resp.text}")
        return False
    
    data = resp.json()
    free_token = data.get("token")
    
    if not free_token:
        log(f"  ❌ FAIL: No token in registration response")
        return False
    
    log(f"  ✅ Registered free user: {email}")
    
    # Try to access stats with free token
    stats_url = f"{BASE_URL}/admin/articles/stats/overview"
    headers = {"Authorization": f"Bearer {free_token}"}
    
    resp = requests.get(stats_url, headers=headers)
    log(f"  GET {stats_url} with free token -> {resp.status_code}")
    
    if resp.status_code != 403:
        log(f"  ❌ FAIL: Expected 403, got {resp.status_code}")
        log(f"  Response: {resp.text}")
        return False
    
    log(f"  ✅ PASS: Free user correctly blocked with 403")
    return True

def test_gating_no_auth():
    """Test 5: Gating - no auth should get 401"""
    log("TEST 5: Gating - no auth should get 401")
    
    stats_url = f"{BASE_URL}/admin/articles/stats/overview"
    
    resp = requests.get(stats_url)
    log(f"  GET {stats_url} (no auth) -> {resp.status_code}")
    
    if resp.status_code != 401:
        log(f"  ❌ FAIL: Expected 401, got {resp.status_code}")
        log(f"  Response: {resp.text}")
        return False
    
    log(f"  ✅ PASS: No auth correctly blocked with 401")
    return True

def main():
    log("=" * 80)
    log("ProFinance Interior - Article Statistics Backend Test Suite")
    log("Round 13: Test Article Statistics endpoint + daily view tracking")
    log("=" * 80)
    
    results = []
    
    # Test 1: Login admin
    token = test_login_admin()
    results.append(("Login admin", token is not None))
    
    if not token:
        log("\n❌ Cannot proceed without admin token")
        return
    
    log("")
    
    # Test 2: Stats overview structure
    initial_stats = test_stats_overview_structure(token)
    results.append(("Stats overview structure", initial_stats is not None))
    
    if not initial_stats:
        log("\n❌ Cannot proceed without valid stats structure")
        return
    
    log("")
    
    # Test 3: Daily tracking
    tracking_result = test_daily_tracking(token, initial_stats)
    results.append(("Daily tracking", tracking_result))
    
    log("")
    
    # Test 4: Gating - free user
    free_result = test_gating_free_user()
    results.append(("Gating - free user 403", free_result))
    
    log("")
    
    # Test 5: Gating - no auth
    no_auth_result = test_gating_no_auth()
    results.append(("Gating - no auth 401", no_auth_result))
    
    log("")
    log("=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        log(f"{status}: {test_name}")
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    log("")
    log(f"TOTAL: {passed_count}/{total_count} tests passed")
    
    if passed_count == total_count:
        log("✅ ALL TESTS PASSED")
    else:
        log("❌ SOME TESTS FAILED")

if __name__ == "__main__":
    main()
