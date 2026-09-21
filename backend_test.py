#!/usr/bin/env python3
"""
Backend API Test Suite for ProFinance Interior - NEW Backup Endpoints
Tests per-project export, restore, stored backups, and cron endpoints.
"""
import os
import sys
import json
import zipfile
import io
import requests
from datetime import datetime

# Base URL from frontend/.env
BASE_URL = "https://interior-pro-63.preview.emergentagent.com/api"
WEBHOOK_CRON_SECRET = "pf_cron_9x2Kv7Qr4mB1nZ6sL0aWd3Ht8Yc5Ep"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def register_user():
    """Register a new user and return token."""
    email = f"test_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}@test.com"
    password = "testpass123"
    payload = {
        "email": email,
        "name": "Test Backup User",
        "password": password,
        "phone": "081234567890"
    }
    log(f"Registering user: {email}")
    r = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=30)
    log(f"  Status: {r.status_code}")
    if r.status_code != 200:
        log(f"  ERROR: {r.text}")
        return None, None
    data = r.json()
    token = data.get("token")
    log(f"  Token: {token[:20]}...")
    return token, email

def create_project(token, name="Backup Test Proyek"):
    """Create a project and return project id."""
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "name": name,
        "owner": "Klien A",
        "nominal": 100000000
    }
    log(f"Creating project: {name}")
    r = requests.post(f"{BASE_URL}/projects", json=payload, headers=headers, timeout=30)
    log(f"  Status: {r.status_code}")
    if r.status_code != 200:
        log(f"  ERROR: {r.text}")
        return None
    data = r.json()
    project_id = data.get("id")
    log(f"  Project ID: {project_id}")
    return project_id

def add_transaction(token, project_id):
    """Add a transaction to the project."""
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "type": "in",
        "amount": 5000000,
        "category": "Termin",
        "description": "DP"
    }
    log(f"Adding transaction to project {project_id}")
    r = requests.post(f"{BASE_URL}/projects/{project_id}/transactions", json=payload, headers=headers, timeout=30)
    log(f"  Status: {r.status_code}")
    if r.status_code != 200:
        log(f"  ERROR: {r.text}")
        return None
    data = r.json()
    log(f"  Transaction ID: {data.get('id')}")
    return data.get("id")

def test_per_project_export(token, project_id):
    """Test GET /api/projects/{id}/backup/export."""
    log("\n=== TEST: Per-Project Backup Export ===")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE_URL}/projects/{project_id}/backup/export", headers=headers, timeout=60)
    log(f"Status: {r.status_code}")
    log(f"Content-Type: {r.headers.get('Content-Type')}")
    log(f"Content-Length: {len(r.content)} bytes")
    
    if r.status_code != 200:
        log(f"❌ FAILED: Expected 200, got {r.status_code}")
        log(f"Response: {r.text}")
        return None
    
    if "application/zip" not in r.headers.get("Content-Type", ""):
        log(f"❌ FAILED: Expected application/zip, got {r.headers.get('Content-Type')}")
        return None
    
    if len(r.content) == 0:
        log(f"❌ FAILED: ZIP file is empty")
        return None
    
    # Verify ZIP contents
    try:
        zf = zipfile.ZipFile(io.BytesIO(r.content))
        files = zf.namelist()
        log(f"ZIP contains {len(files)} files:")
        for f in files:
            info = zf.getinfo(f)
            log(f"  - {f} ({info.file_size} bytes)")
        
        # Check required files
        required = ["data.json", "data.xlsx", "manifest.json"]
        for req in required:
            if req not in files:
                log(f"❌ FAILED: Missing required file: {req}")
                return None
        
        # Verify data.json contains exactly 1 project
        data_json = json.loads(zf.read("data.json").decode("utf-8"))
        projects = data_json.get("projects", [])
        log(f"data.json contains {len(projects)} project(s)")
        if len(projects) != 1:
            log(f"❌ FAILED: Expected 1 project, got {len(projects)}")
            return None
        
        if projects[0].get("id") != project_id:
            log(f"❌ FAILED: Project ID mismatch")
            return None
        
        log(f"✅ PASSED: Per-project export working correctly")
        return r.content
    except Exception as e:
        log(f"❌ FAILED: Error reading ZIP: {e}")
        return None

def test_manual_backup_run(token):
    """Test POST /api/backup/run."""
    log("\n=== TEST: Manual Stored Backup ===")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.post(f"{BASE_URL}/backup/run", headers=headers, timeout=60)
    log(f"Status: {r.status_code}")
    
    if r.status_code != 200:
        log(f"❌ FAILED: Expected 200, got {r.status_code}")
        log(f"Response: {r.text}")
        return None
    
    data = r.json()
    log(f"Response: {json.dumps(data, indent=2)}")
    
    # Verify required fields
    required_fields = ["id", "filename", "size", "counts", "createdAt", "kind"]
    for field in required_fields:
        if field not in data:
            log(f"❌ FAILED: Missing field: {field}")
            return None
    
    if data.get("kind") != "manual":
        log(f"❌ FAILED: Expected kind='manual', got {data.get('kind')}")
        return None
    
    counts = data.get("counts", {})
    required_counts = ["projects", "transactions", "photos"]
    for field in required_counts:
        if field not in counts:
            log(f"❌ FAILED: Missing counts field: {field}")
            return None
    
    log(f"✅ PASSED: Manual backup created successfully")
    return data.get("id")

def test_list_backups(token, expected_backup_id):
    """Test GET /api/backups."""
    log("\n=== TEST: List Stored Backups ===")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE_URL}/backups", headers=headers, timeout=30)
    log(f"Status: {r.status_code}")
    
    if r.status_code != 200:
        log(f"❌ FAILED: Expected 200, got {r.status_code}")
        log(f"Response: {r.text}")
        return False
    
    data = r.json()
    log(f"Found {len(data)} backup(s)")
    
    # Check if expected backup is in the list
    found = False
    for backup in data:
        if backup.get("id") == expected_backup_id:
            found = True
            log(f"Found expected backup: {backup.get('filename')}")
            break
    
    if not found:
        log(f"❌ FAILED: Expected backup {expected_backup_id} not found in list")
        return False
    
    log(f"✅ PASSED: List backups working correctly")
    return True

def test_download_backup(token, backup_id):
    """Test GET /api/backups/{id}/download."""
    log("\n=== TEST: Download Stored Backup ===")
    r = requests.get(f"{BASE_URL}/backups/{backup_id}/download?auth={token}", timeout=60)
    log(f"Status: {r.status_code}")
    log(f"Content-Type: {r.headers.get('Content-Type')}")
    log(f"Content-Length: {len(r.content)} bytes")
    
    if r.status_code != 200:
        log(f"❌ FAILED: Expected 200, got {r.status_code}")
        log(f"Response: {r.text}")
        return False
    
    if "application/zip" not in r.headers.get("Content-Type", ""):
        log(f"❌ FAILED: Expected application/zip, got {r.headers.get('Content-Type')}")
        return False
    
    if len(r.content) == 0:
        log(f"❌ FAILED: ZIP file is empty")
        return False
    
    # Verify it's a valid ZIP
    try:
        zf = zipfile.ZipFile(io.BytesIO(r.content))
        files = zf.namelist()
        log(f"ZIP contains {len(files)} files")
        log(f"✅ PASSED: Download backup working correctly")
        return True
    except Exception as e:
        log(f"❌ FAILED: Invalid ZIP file: {e}")
        return False

def test_restore(token, zip_bytes, project_id):
    """Test POST /api/backup/restore - the key feature."""
    log("\n=== TEST: Restore from ZIP ===")
    
    # Step 1: Delete the project
    log("Step 1: Deleting project...")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.delete(f"{BASE_URL}/projects/{project_id}", headers=headers, timeout=30)
    log(f"  Delete status: {r.status_code}")
    if r.status_code != 200:
        log(f"❌ FAILED: Could not delete project")
        return False
    
    # Step 2: Verify project is gone
    log("Step 2: Verifying project is deleted...")
    r = requests.get(f"{BASE_URL}/projects", headers=headers, timeout=30)
    if r.status_code == 200:
        projects = r.json()
        for p in projects:
            if p.get("id") == project_id:
                log(f"❌ FAILED: Project still exists after deletion")
                return False
        log(f"  ✓ Project successfully deleted")
    
    # Step 3: Restore from ZIP
    log("Step 3: Restoring from ZIP...")
    files = {"file": ("backup.zip", zip_bytes, "application/zip")}
    r = requests.post(f"{BASE_URL}/backup/restore", files=files, headers=headers, timeout=60)
    log(f"  Restore status: {r.status_code}")
    
    if r.status_code != 200:
        log(f"❌ FAILED: Expected 200, got {r.status_code}")
        log(f"Response: {r.text}")
        return False
    
    data = r.json()
    log(f"  Response: {json.dumps(data, indent=2)}")
    
    if data.get("restored_projects", 0) < 1:
        log(f"❌ FAILED: Expected restored_projects >= 1, got {data.get('restored_projects')}")
        return False
    
    if data.get("restored_transactions", 0) < 1:
        log(f"❌ FAILED: Expected restored_transactions >= 1, got {data.get('restored_transactions')}")
        return False
    
    # Step 4: Verify project reappears
    log("Step 4: Verifying project is restored...")
    r = requests.get(f"{BASE_URL}/projects", headers=headers, timeout=30)
    if r.status_code != 200:
        log(f"❌ FAILED: Could not list projects")
        return False
    
    projects = r.json()
    found = False
    for p in projects:
        if p.get("id") == project_id and p.get("name") == "Backup Test Proyek":
            found = True
            log(f"  ✓ Project restored: {p.get('name')}")
            break
    
    if not found:
        log(f"❌ FAILED: Restored project not found in project list")
        return False
    
    # Step 5: Verify transactions are restored
    log("Step 5: Verifying transactions are restored...")
    r = requests.get(f"{BASE_URL}/projects/{project_id}/transactions", headers=headers, timeout=30)
    if r.status_code != 200:
        log(f"❌ FAILED: Could not list transactions")
        return False
    
    transactions = r.json()
    if len(transactions) < 1:
        log(f"❌ FAILED: No transactions found after restore")
        return False
    
    log(f"  ✓ Found {len(transactions)} transaction(s)")
    
    # Step 6: Test idempotency - restore again with same ZIP
    log("Step 6: Testing idempotency (restore again)...")
    files = {"file": ("backup.zip", zip_bytes, "application/zip")}
    r = requests.post(f"{BASE_URL}/backup/restore", files=files, headers=headers, timeout=60)
    log(f"  Second restore status: {r.status_code}")
    
    if r.status_code != 200:
        log(f"❌ FAILED: Second restore failed")
        return False
    
    data = r.json()
    log(f"  Response: {json.dumps(data, indent=2)}")
    
    if data.get("restored_projects", 0) != 0:
        log(f"❌ FAILED: Expected restored_projects=0 (idempotent), got {data.get('restored_projects')}")
        return False
    
    if data.get("skipped_projects", 0) < 1:
        log(f"❌ FAILED: Expected skipped_projects >= 1, got {data.get('skipped_projects')}")
        return False
    
    log(f"✅ PASSED: Restore working correctly (including idempotency)")
    return True

def test_demo_block():
    """Test that demo user gets 403 on POST /api/backup/run."""
    log("\n=== TEST: Demo User Block ===")
    r = requests.post(f"{BASE_URL}/auth/demo", timeout=30)
    if r.status_code != 200:
        log(f"❌ FAILED: Could not get demo token")
        return False
    
    demo_token = r.json().get("token")
    log(f"Got demo token: {demo_token[:20]}...")
    
    headers = {"Authorization": f"Bearer {demo_token}"}
    r = requests.post(f"{BASE_URL}/backup/run", headers=headers, timeout=30)
    log(f"Status: {r.status_code}")
    
    if r.status_code != 403:
        log(f"❌ FAILED: Expected 403, got {r.status_code}")
        log(f"Response: {r.text}")
        return False
    
    log(f"✅ PASSED: Demo user correctly blocked on POST /api/backup/run")
    return True

def test_cron_auth():
    """Test POST /api/cron/weekly-backup authentication."""
    log("\n=== TEST: Cron Endpoint Authentication ===")
    
    # Test without auth
    log("Testing without auth...")
    r = requests.post(f"{BASE_URL}/cron/weekly-backup", timeout=30)
    log(f"  Status: {r.status_code}")
    if r.status_code != 401:
        log(f"❌ FAILED: Expected 401, got {r.status_code}")
        return False
    log(f"  ✓ Correctly returns 401 without auth")
    
    # Test with correct auth
    log("Testing with correct auth...")
    headers = {"Authorization": f"Bearer {WEBHOOK_CRON_SECRET}"}
    r = requests.post(f"{BASE_URL}/cron/weekly-backup", headers=headers, timeout=30)
    log(f"  Status: {r.status_code}")
    if r.status_code != 200:
        log(f"❌ FAILED: Expected 200, got {r.status_code}")
        log(f"Response: {r.text}")
        return False
    
    data = r.json()
    log(f"  Response: {json.dumps(data, indent=2)}")
    
    if not data.get("ok") or not data.get("queued"):
        log(f"❌ FAILED: Expected ok=true and queued=true")
        return False
    
    log(f"✅ PASSED: Cron authentication working correctly")
    return True

def main():
    log("=" * 80)
    log("ProFinance Interior - NEW Backup Endpoints Test Suite")
    log("=" * 80)
    
    results = {
        "passed": [],
        "failed": []
    }
    
    # Step 1: Register user
    token, email = register_user()
    if not token:
        log("❌ CRITICAL: Could not register user")
        sys.exit(1)
    
    # Step 2: Create project
    project_id = create_project(token)
    if not project_id:
        log("❌ CRITICAL: Could not create project")
        sys.exit(1)
    
    # Step 3: Add transaction
    tx_id = add_transaction(token, project_id)
    if not tx_id:
        log("❌ CRITICAL: Could not add transaction")
        sys.exit(1)
    
    # Test 1: Per-project export
    zip_bytes = test_per_project_export(token, project_id)
    if zip_bytes:
        results["passed"].append("Per-project backup export")
    else:
        results["failed"].append("Per-project backup export")
    
    # Test 2: Manual backup run
    backup_id = test_manual_backup_run(token)
    if backup_id:
        results["passed"].append("Manual stored backup")
    else:
        results["failed"].append("Manual stored backup")
    
    # Test 3: List backups
    if backup_id and test_list_backups(token, backup_id):
        results["passed"].append("List stored backups")
    else:
        results["failed"].append("List stored backups")
    
    # Test 4: Download backup
    if backup_id and test_download_backup(token, backup_id):
        results["passed"].append("Download stored backup")
    else:
        results["failed"].append("Download stored backup")
    
    # Test 5: Restore (the key feature)
    if zip_bytes and test_restore(token, zip_bytes, project_id):
        results["passed"].append("Restore from ZIP")
    else:
        results["failed"].append("Restore from ZIP")
    
    # Test 6: Demo block
    if test_demo_block():
        results["passed"].append("Demo user block")
    else:
        results["failed"].append("Demo user block")
    
    # Test 7: Cron auth
    if test_cron_auth():
        results["passed"].append("Cron authentication")
    else:
        results["failed"].append("Cron authentication")
    
    # Summary
    log("\n" + "=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    log(f"✅ PASSED: {len(results['passed'])} tests")
    for test in results["passed"]:
        log(f"  ✓ {test}")
    
    if results["failed"]:
        log(f"\n❌ FAILED: {len(results['failed'])} tests")
        for test in results["failed"]:
            log(f"  ✗ {test}")
        sys.exit(1)
    else:
        log("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)

if __name__ == "__main__":
    main()
