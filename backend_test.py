#!/usr/bin/env python3
"""
Backend API Test Suite for ProFinance Interior
Testing: Demo client portal link survives daily demo reset
"""

import requests
import time
import json
import sys
from typing import Dict, Any

# Backend URL from frontend/.env
BASE_URL = "https://fintech-design-6.preview.emergentagent.com/api"
WEBHOOK_CRON_SECRET = "pf_cron_9x2Kv7Qr4mB1nZ6sL0aWd3Ht8Yc5Ep"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def log_test(name: str):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}TEST: {name}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")

def log_pass(msg: str):
    print(f"{Colors.GREEN}✓ PASS: {msg}{Colors.END}")

def log_fail(msg: str):
    print(f"{Colors.RED}✗ FAIL: {msg}{Colors.END}")

def log_info(msg: str):
    print(f"{Colors.YELLOW}ℹ INFO: {msg}{Colors.END}")

def test_demo_portal_link_survives_reset():
    """
    Test that client portal links from demo account survive the daily reset cron.
    
    Bug: Previously, POST /api/cron/reset-demo deleted all demo projects and re-seeded
    them with new IDs but WITHOUT portalSlug, causing 404 on previously shared links.
    
    Fix: (1) seed_demo assigns stable "-demo" slugs; (2) _reset_demo_job preserves
    existing slugs by name before deletion and re-applies them after re-seeding.
    """
    
    # Step 1: Get demo token
    log_test("Step 1: Get demo account token")
    try:
        resp = requests.post(f"{BASE_URL}/auth/demo", timeout=10)
        log_info(f"POST /api/auth/demo -> {resp.status_code}")
        
        if resp.status_code != 200:
            log_fail(f"Expected 200, got {resp.status_code}")
            log_info(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        demo_token = data.get("token")
        if not demo_token:
            log_fail("No token in response")
            return False
        
        log_pass(f"Got demo token (length: {len(demo_token)})")
        
    except Exception as e:
        log_fail(f"Exception during demo login: {e}")
        return False
    
    # Step 2: Get projects and their portal links
    log_test("Step 2: Get demo projects and portal links")
    headers = {"Authorization": f"Bearer {demo_token}"}
    
    try:
        resp = requests.get(f"{BASE_URL}/projects", headers=headers, timeout=10)
        log_info(f"GET /api/projects -> {resp.status_code}")
        
        if resp.status_code != 200:
            log_fail(f"Expected 200, got {resp.status_code}")
            return False
        
        projects = resp.json()
        if not projects or len(projects) == 0:
            log_fail("No projects found in demo account")
            return False
        
        log_pass(f"Found {len(projects)} demo projects")
        
        # Get portal links for all projects
        project_data = []
        for p in projects:
            pid = p.get("id")
            pname = p.get("name")
            
            resp = requests.get(f"{BASE_URL}/projects/{pid}/portal-link", headers=headers, timeout=10)
            log_info(f"GET /api/projects/{pid}/portal-link -> {resp.status_code}")
            
            if resp.status_code != 200:
                log_fail(f"Expected 200 for project {pname}, got {resp.status_code}")
                return False
            
            link_data = resp.json()
            slug = link_data.get("slug")
            
            if not slug:
                log_fail(f"No slug returned for project {pname}")
                return False
            
            project_data.append({
                "id": pid,
                "name": pname,
                "slug": slug
            })
            log_pass(f"Project '{pname}' (id: {pid[:8]}...) has slug: {slug}")
        
    except Exception as e:
        log_fail(f"Exception during project fetch: {e}")
        return False
    
    # Step 3: Test public portal access (no auth) BEFORE reset
    log_test("Step 3: Test public portal access (no auth) BEFORE reset")
    
    test_slug = project_data[0]["slug"]
    
    try:
        # Test /api/public/portal/{slug}
        resp = requests.get(f"{BASE_URL}/public/portal/{test_slug}", timeout=10)
        log_info(f"GET /api/public/portal/{test_slug} -> {resp.status_code}")
        
        if resp.status_code != 200:
            log_fail(f"Expected 200, got {resp.status_code}")
            log_info(f"Response: {resp.text}")
            return False
        
        portal_data = resp.json()
        if not portal_data.get("project"):
            log_fail("No project data in portal response")
            return False
        
        log_pass(f"Public portal returns project: {portal_data['project'].get('name')}")
        
        # Test /api/public/portal/{slug}/share
        resp = requests.get(f"{BASE_URL}/public/portal/{test_slug}/share", timeout=10)
        log_info(f"GET /api/public/portal/{test_slug}/share -> {resp.status_code}")
        
        if resp.status_code != 200:
            log_fail(f"Expected 200, got {resp.status_code}")
            return False
        
        html_content = resp.text
        if "/portal/" not in html_content:
            log_fail("Share page doesn't contain portal redirect")
            return False
        
        log_pass(f"Share page returns HTML with redirect (length: {len(html_content)} bytes)")
        
    except Exception as e:
        log_fail(f"Exception during public portal access: {e}")
        return False
    
    # Step 4: CRITICAL - Trigger the daily reset cron
    log_test("Step 4: CRITICAL - Trigger daily demo reset cron")
    
    try:
        # First test: unauthorized access should fail
        resp = requests.post(f"{BASE_URL}/cron/reset-demo", timeout=10)
        log_info(f"POST /api/cron/reset-demo (no auth) -> {resp.status_code}")
        
        if resp.status_code != 401:
            log_fail(f"Expected 401 for unauthorized, got {resp.status_code}")
            return False
        
        log_pass("Unauthorized cron access correctly returns 401")
        
        # Now trigger with correct auth
        cron_headers = {"Authorization": f"Bearer {WEBHOOK_CRON_SECRET}"}
        resp = requests.post(f"{BASE_URL}/cron/reset-demo", headers=cron_headers, timeout=10)
        log_info(f"POST /api/cron/reset-demo (with auth) -> {resp.status_code}")
        
        if resp.status_code != 200:
            log_fail(f"Expected 200, got {resp.status_code}")
            log_info(f"Response: {resp.text}")
            return False
        
        cron_result = resp.json()
        if not cron_result.get("ok") or not cron_result.get("queued"):
            log_fail(f"Unexpected cron response: {cron_result}")
            return False
        
        log_pass("Reset cron triggered successfully: {ok: true, queued: true}")
        log_info("Waiting 5 seconds for background job to complete...")
        time.sleep(5)
        
    except Exception as e:
        log_fail(f"Exception during cron trigger: {e}")
        return False
    
    # Step 5: Verify project IDs changed BUT slugs preserved
    log_test("Step 5: Verify project IDs changed BUT slugs preserved")
    
    try:
        resp = requests.get(f"{BASE_URL}/projects", headers=headers, timeout=10)
        log_info(f"GET /api/projects (after reset) -> {resp.status_code}")
        
        if resp.status_code != 200:
            log_fail(f"Expected 200, got {resp.status_code}")
            return False
        
        new_projects = resp.json()
        if len(new_projects) != len(projects):
            log_fail(f"Project count changed: {len(projects)} -> {len(new_projects)}")
            return False
        
        log_pass(f"Project count unchanged: {len(new_projects)}")
        
        # Check that IDs changed (proving reset happened)
        old_ids = {p["id"] for p in project_data}
        new_ids = {p["id"] for p in new_projects}
        
        if old_ids == new_ids:
            log_fail("Project IDs did NOT change - reset may not have happened!")
            return False
        
        log_pass(f"Project IDs changed (reset confirmed): {len(old_ids & new_ids)} common IDs")
        
        # Check that slugs are preserved
        slugs_preserved = 0
        slugs_changed = 0
        
        for old_proj in project_data:
            old_name = old_proj["name"]
            old_slug = old_proj["slug"]
            
            # Find matching project by name in new projects
            new_proj = next((p for p in new_projects if p.get("name") == old_name), None)
            if not new_proj:
                log_fail(f"Project '{old_name}' not found after reset")
                return False
            
            new_id = new_proj["id"]
            
            # Get new portal link
            resp = requests.get(f"{BASE_URL}/projects/{new_id}/portal-link", headers=headers, timeout=10)
            if resp.status_code != 200:
                log_fail(f"Failed to get portal link for '{old_name}' after reset")
                return False
            
            new_slug = resp.json().get("slug")
            
            if new_slug == old_slug:
                slugs_preserved += 1
                log_pass(f"✓ PRESERVED: '{old_name}' kept slug '{old_slug}'")
            else:
                slugs_changed += 1
                log_fail(f"✗ CHANGED: '{old_name}' slug changed from '{old_slug}' to '{new_slug}'")
        
        if slugs_changed > 0:
            log_fail(f"CRITICAL: {slugs_changed} slugs changed after reset!")
            return False
        
        log_pass(f"ALL {slugs_preserved} portal slugs preserved after reset!")
        
    except Exception as e:
        log_fail(f"Exception during post-reset verification: {e}")
        return False
    
    # Step 6: Re-check public portal access AFTER reset (the bug test!)
    log_test("Step 6: CRITICAL - Verify old links still work AFTER reset")
    
    try:
        # Test the SAME slug from before reset
        resp = requests.get(f"{BASE_URL}/public/portal/{test_slug}", timeout=10)
        log_info(f"GET /api/public/portal/{test_slug} (after reset) -> {resp.status_code}")
        
        if resp.status_code != 200:
            log_fail(f"CRITICAL BUG: Old portal link returns {resp.status_code} after reset!")
            log_info(f"Response: {resp.text}")
            return False
        
        portal_data = resp.json()
        log_pass(f"✓ Old portal link STILL WORKS: {portal_data['project'].get('name')}")
        
        # Test share page
        resp = requests.get(f"{BASE_URL}/public/portal/{test_slug}/share", timeout=10)
        log_info(f"GET /api/public/portal/{test_slug}/share (after reset) -> {resp.status_code}")
        
        if resp.status_code != 200:
            log_fail(f"CRITICAL BUG: Old share link returns {resp.status_code} after reset!")
            return False
        
        log_pass("✓ Old share link STILL WORKS after reset")
        
        # Test a few more slugs to be thorough
        for proj in project_data[1:]:
            slug = proj["slug"]
            resp = requests.get(f"{BASE_URL}/public/portal/{slug}", timeout=10)
            if resp.status_code != 200:
                log_fail(f"Portal link for '{proj['name']}' broken after reset: {resp.status_code}")
                return False
            log_pass(f"✓ Portal link for '{proj['name']}' still works")
        
    except Exception as e:
        log_fail(f"Exception during post-reset portal access: {e}")
        return False
    
    # Step 7: Regression test - portal-link/reset blocked for demo (read-only)
    log_test("Step 7: Regression test - portal-link/reset blocked for demo user")
    
    try:
        # Pick first project
        test_project = new_projects[0]
        test_id = test_project["id"]
        test_name = test_project["name"]
        
        # Get current slug
        resp = requests.get(f"{BASE_URL}/projects/{test_id}/portal-link", headers=headers, timeout=10)
        if resp.status_code != 200:
            log_fail("Failed to get current portal link")
            return False
        
        old_slug = resp.json().get("slug")
        log_info(f"Current slug for '{test_name}': {old_slug}")
        
        # Reset portal link - should be blocked for demo user (read-only)
        resp = requests.post(f"{BASE_URL}/projects/{test_id}/portal-link/reset", headers=headers, timeout=10)
        log_info(f"POST /api/projects/{test_id}/portal-link/reset -> {resp.status_code}")
        
        if resp.status_code != 403:
            log_fail(f"Expected 403 (demo read-only), got {resp.status_code}")
            return False
        
        log_pass("Demo user correctly blocked from resetting portal link (read-only mode)")
        
        # Verify the error message mentions demo mode
        if resp.status_code == 403:
            error_detail = resp.json().get("detail", "")
            if "Demo" in error_detail or "demo" in error_detail:
                log_pass(f"Error message correctly indicates demo mode: '{error_detail}'")
            else:
                log_info(f"403 error detail: {error_detail}")
        
    except Exception as e:
        log_fail(f"Exception during regression test: {e}")
        return False
    
    return True


def main():
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}ProFinance Interior - Backend API Test Suite{Colors.END}")
    print(f"{Colors.BLUE}Testing: Demo client portal link survives daily demo reset{Colors.END}")
    print(f"{Colors.BLUE}Base URL: {BASE_URL}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    try:
        success = test_demo_portal_link_survives_reset()
        
        print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
        if success:
            print(f"{Colors.GREEN}✓✓✓ ALL TESTS PASSED ✓✓✓{Colors.END}")
            print(f"{Colors.GREEN}Bug fix verified: Demo client portal links survive daily reset{Colors.END}")
            sys.exit(0)
        else:
            print(f"{Colors.RED}✗✗✗ TESTS FAILED ✗✗✗{Colors.END}")
            print(f"{Colors.RED}Bug NOT fixed: Portal links broken after reset{Colors.END}")
            sys.exit(1)
    except Exception as e:
        print(f"\n{Colors.RED}FATAL ERROR: {e}{Colors.END}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
