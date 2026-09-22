#!/usr/bin/env python3
"""
Backend test for RAB Builder (Surat Penawaran) feature.
Tests all RAB endpoints, math computation, premium gating, and deal-to-progress flow.
"""
import requests
import json
import sys

# Internal backend URL
BASE_URL = "http://localhost:8001/api"

# Test credentials
PREMIUM_EMAIL = "premium@test.com"
PREMIUM_PASSWORD = "Premium123"

def log(msg):
    print(f"[TEST] {msg}")

def test_login_premium():
    """Login with premium account and return token."""
    log("1. Login with premium@test.com")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": PREMIUM_EMAIL,
        "password": PREMIUM_PASSWORD
    })
    if resp.status_code != 200:
        log(f"❌ Login failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    data = resp.json()
    token = data.get("token")
    log(f"✅ Login successful, token: {token[:20]}...")
    return token

def test_create_rab(token):
    """Create RAB with materials and verify math."""
    log("2. POST /api/rab - Create RAB with materials")
    
    # RAB body with materials as specified in review request
    body = {
        "projectName": "RAB Test Penawaran",
        "category": "Residensial",
        "rab": {
            "clientName": "Mba Grace",
            "clientAddress": "Puri Imperium",
            "clientPhone": "0812",
            "quotationNo": "15/IX/26",
            "quotationDate": "2026-09-17",
            "companyName": "Furniture Interior",
            "discount": 2417500,
            "ppnEnabled": False,
            "ppnPercent": 11,
            "sections": [
                {
                    "name": "PEKERJAAN PERSIAPAN",
                    "subItems": [
                        {
                            "name": "Mobilisasi",
                            "qty": 1,
                            "unit": "Ls",
                            "hargaSatuan": 3500000,
                            "materials": []
                        }
                    ]
                },
                {
                    "name": "BEDROOM",
                    "subItems": [
                        {
                            "name": "Lemari Pakaian",
                            "qty": 3.11,
                            "unit": "m2",
                            "hargaSatuan": 2950000,
                            "materials": [
                                {"name": "Rail Slowmotion", "nilai": 250000},
                                {"name": "Engsel", "nilai": 150000}
                            ]
                        }
                    ]
                }
            ],
            "termins": [
                {"label": "DP", "percent": 50},
                {"label": "Termin", "percent": 30},
                {"label": "Pelunasan", "percent": 20}
            ]
        }
    }
    
    resp = requests.post(f"{BASE_URL}/rab", json=body, headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ Create RAB failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    data = resp.json()
    log(f"✅ RAB created, status: {data.get('status')}, project_id: {data.get('id')}")
    
    # Verify math
    computed = data.get("computed", {})
    log("\n=== MATH VERIFICATION ===")
    
    # Expected: Lemari sub-item nilai = round(3.11 * 2950000) + (250000 + 150000)
    # = 9174500 + 400000 = 9574500
    lemari_section = computed.get("sections", [])[1] if len(computed.get("sections", [])) > 1 else {}
    lemari_subitem = lemari_section.get("subItems", [])[0] if lemari_section.get("subItems") else {}
    lemari_nilai = lemari_subitem.get("nilai", 0)
    expected_lemari = 9574500
    log(f"Lemari Pakaian nilai: {lemari_nilai} (expected: {expected_lemari})")
    if lemari_nilai != expected_lemari:
        log(f"❌ MATH ERROR: Lemari nilai mismatch! Got {lemari_nilai}, expected {expected_lemari}")
        sys.exit(1)
    
    # BEDROOM subtotal should be 9574500
    bedroom_subtotal = lemari_section.get("subtotal", 0)
    log(f"BEDROOM subtotal: {bedroom_subtotal} (expected: 9574500)")
    if bedroom_subtotal != 9574500:
        log(f"❌ MATH ERROR: BEDROOM subtotal mismatch!")
        sys.exit(1)
    
    # PEKERJAAN PERSIAPAN subtotal should be 3500000
    prep_section = computed.get("sections", [])[0] if computed.get("sections") else {}
    prep_subtotal = prep_section.get("subtotal", 0)
    log(f"PEKERJAAN PERSIAPAN subtotal: {prep_subtotal} (expected: 3500000)")
    if prep_subtotal != 3500000:
        log(f"❌ MATH ERROR: PEKERJAAN PERSIAPAN subtotal mismatch!")
        sys.exit(1)
    
    # totalItems = 13074500
    total_items = computed.get("totalItems", 0)
    log(f"totalItems: {total_items} (expected: 13074500)")
    if total_items != 13074500:
        log(f"❌ MATH ERROR: totalItems mismatch!")
        sys.exit(1)
    
    # grandTotal = 13074500 - 2417500 = 10657000 (ppn disabled)
    grand_total = computed.get("grandTotal", 0)
    log(f"grandTotal: {grand_total} (expected: 10657000)")
    if grand_total != 10657000:
        log(f"❌ MATH ERROR: grandTotal mismatch!")
        sys.exit(1)
    
    # Verify project.nominal == grandTotal and project.rabTotal == totalItems
    project_nominal = data.get("nominal", 0)
    project_rab_total = data.get("rabTotal", 0)
    log(f"project.nominal: {project_nominal} (expected: {grand_total})")
    log(f"project.rabTotal: {project_rab_total} (expected: {total_items})")
    if project_nominal != grand_total:
        log(f"❌ MATH ERROR: project.nominal != grandTotal!")
        sys.exit(1)
    if project_rab_total != total_items:
        log(f"❌ MATH ERROR: project.rabTotal != totalItems!")
        sys.exit(1)
    
    # Verify termins
    termins = computed.get("termins", [])
    log(f"Termins: {termins}")
    # DP 50% of 10657000 = 5328500
    # Termin 30% = 3197100
    # Pelunasan 20% = 2131400
    expected_termins = [5328500, 3197100, 2131400]
    for i, t in enumerate(termins):
        if t.get("nominal") != expected_termins[i]:
            log(f"❌ MATH ERROR: Termin {i} nominal mismatch! Got {t.get('nominal')}, expected {expected_termins[i]}")
            sys.exit(1)
    
    log("✅ ALL MATH VERIFIED CORRECTLY!")
    return data.get("id")

def test_get_rab(token, project_id):
    """GET /api/projects/{id}/rab"""
    log(f"\n3. GET /api/projects/{project_id}/rab")
    resp = requests.get(f"{BASE_URL}/projects/{project_id}/rab", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ GET RAB failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    data = resp.json()
    log(f"✅ GET RAB successful")
    log(f"   - projectName: {data.get('projectName')}")
    log(f"   - status: {data.get('status')}")
    log(f"   - rabSlug: {data.get('rabSlug')}")
    log(f"   - computed.grandTotal: {data.get('computed', {}).get('grandTotal')}")
    
    if not data.get("rabSlug"):
        log("❌ ERROR: rabSlug missing!")
        sys.exit(1)
    
    return data.get("rabSlug")

def test_update_rab(token, project_id):
    """PUT /api/projects/{id}/rab - change discount and verify re-sync"""
    log(f"\n4. PUT /api/projects/{project_id}/rab - change discount to 0")
    
    body = {
        "projectName": "RAB Test Penawaran",
        "category": "Residensial",
        "rab": {
            "clientName": "Mba Grace",
            "clientAddress": "Puri Imperium",
            "clientPhone": "0812",
            "quotationNo": "15/IX/26",
            "quotationDate": "2026-09-17",
            "companyName": "Furniture Interior",
            "discount": 0,  # Changed from 2417500 to 0
            "ppnEnabled": False,
            "ppnPercent": 11,
            "sections": [
                {
                    "name": "PEKERJAAN PERSIAPAN",
                    "subItems": [
                        {
                            "name": "Mobilisasi",
                            "qty": 1,
                            "unit": "Ls",
                            "hargaSatuan": 3500000,
                            "materials": []
                        }
                    ]
                },
                {
                    "name": "BEDROOM",
                    "subItems": [
                        {
                            "name": "Lemari Pakaian",
                            "qty": 3.11,
                            "unit": "m2",
                            "hargaSatuan": 2950000,
                            "materials": [
                                {"name": "Rail Slowmotion", "nilai": 250000},
                                {"name": "Engsel", "nilai": 150000}
                            ]
                        }
                    ]
                }
            ],
            "termins": [
                {"label": "DP", "percent": 50},
                {"label": "Termin", "percent": 30},
                {"label": "Pelunasan", "percent": 20}
            ]
        }
    }
    
    resp = requests.put(f"{BASE_URL}/projects/{project_id}/rab", json=body, headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ Update RAB failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    log("✅ RAB updated")
    
    # GET again to verify
    log("   Verifying updated values...")
    resp = requests.get(f"{BASE_URL}/projects/{project_id}/rab", headers={"Authorization": f"Bearer {token}"})
    data = resp.json()
    computed = data.get("computed", {})
    
    # With discount=0, grandTotal should equal totalItems (13074500)
    grand_total = computed.get("grandTotal", 0)
    total_items = computed.get("totalItems", 0)
    log(f"   - grandTotal: {grand_total} (expected: 13074500)")
    log(f"   - totalItems: {total_items} (expected: 13074500)")
    
    if grand_total != 13074500 or total_items != 13074500:
        log(f"❌ ERROR: Updated values incorrect!")
        sys.exit(1)
    
    # Verify project.nominal and rabTotal re-synced (still Prospek)
    resp = requests.get(f"{BASE_URL}/projects/{project_id}", headers={"Authorization": f"Bearer {token}"})
    project = resp.json()
    log(f"   - project.nominal: {project.get('nominal')} (expected: 13074500)")
    log(f"   - project.rabTotal: {project.get('rabTotal')} (expected: 13074500)")
    log(f"   - project.status: {project.get('status')} (expected: Prospek)")
    
    if project.get("nominal") != 13074500 or project.get("rabTotal") != 13074500:
        log(f"❌ ERROR: Project values not re-synced!")
        sys.exit(1)
    
    log("✅ Update and re-sync verified!")

def test_rab_pdf(token, project_id):
    """GET /api/projects/{id}/rab/pdf?auth={token}"""
    log(f"\n5. GET /api/projects/{project_id}/rab/pdf?auth={{token}}")
    resp = requests.get(f"{BASE_URL}/projects/{project_id}/rab/pdf?auth={token}")
    if resp.status_code != 200:
        log(f"❌ RAB PDF failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    content_type = resp.headers.get("Content-Type", "")
    pdf_bytes = resp.content
    
    log(f"✅ RAB PDF generated")
    log(f"   - Content-Type: {content_type}")
    log(f"   - Size: {len(pdf_bytes)} bytes")
    log(f"   - First 8 bytes: {pdf_bytes[:8]}")
    
    if content_type != "application/pdf":
        log(f"❌ ERROR: Wrong Content-Type!")
        sys.exit(1)
    
    if not pdf_bytes.startswith(b"%PDF"):
        log(f"❌ ERROR: Not a valid PDF (missing %PDF header)!")
        sys.exit(1)
    
    log("✅ PDF valid (%PDF header present)")

def test_rab_share_link(token, project_id):
    """GET /api/projects/{id}/rab/share-link and public PDF"""
    log(f"\n6. GET /api/projects/{project_id}/rab/share-link")
    resp = requests.get(f"{BASE_URL}/projects/{project_id}/rab/share-link", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ RAB share-link failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    data = resp.json()
    slug = data.get("slug")
    log(f"✅ Share link obtained: {slug}")
    
    # Test public PDF access (no auth)
    log(f"   Testing public PDF: GET /api/public/rab/{slug}/pdf")
    resp = requests.get(f"{BASE_URL}/public/rab/{slug}/pdf")
    if resp.status_code != 200:
        log(f"❌ Public RAB PDF failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    content_type = resp.headers.get("Content-Type", "")
    pdf_bytes = resp.content
    
    log(f"✅ Public RAB PDF accessible")
    log(f"   - Content-Type: {content_type}")
    log(f"   - Size: {len(pdf_bytes)} bytes")
    
    if content_type != "application/pdf" or not pdf_bytes.startswith(b"%PDF"):
        log(f"❌ ERROR: Invalid public PDF!")
        sys.exit(1)
    
    log("✅ Public PDF valid")

def test_deal_to_progress(token, project_id):
    """POST /api/projects/{id}/deal and verify progress mapping"""
    log(f"\n7. POST /api/projects/{project_id}/deal - Convert to Berjalan")
    resp = requests.post(f"{BASE_URL}/projects/{project_id}/deal", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ Deal failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    data = resp.json()
    log(f"✅ Deal successful, status: {data.get('status')}")
    
    if data.get("status") != "Berjalan":
        log(f"❌ ERROR: Status not changed to Berjalan!")
        sys.exit(1)
    
    # GET progress-summary to verify work_items created
    log(f"   GET /api/projects/{project_id}/progress-summary")
    resp = requests.get(f"{BASE_URL}/projects/{project_id}/progress-summary", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ Progress summary failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    progress = resp.json()
    items = progress.get("items", [])
    log(f"✅ Progress summary retrieved, {len(items)} work_items")
    
    # Verify 2 work_items created (PEKERJAAN PERSIAPAN, BEDROOM)
    if len(items) != 2:
        log(f"❌ ERROR: Expected 2 work_items, got {len(items)}")
        sys.exit(1)
    
    # Verify work_item values match RAB section subtotals
    # PEKERJAAN PERSIAPAN: 3500000
    # BEDROOM: 9574500
    expected_values = [3500000, 9574500]
    for i, item in enumerate(items):
        item_nilai = item.get("nilai", 0)
        log(f"   - {item.get('name')}: nilai={item_nilai}, weight={item.get('weight')}%")
        if item_nilai != expected_values[i]:
            log(f"❌ ERROR: Work item nilai mismatch! Got {item_nilai}, expected {expected_values[i]}")
            sys.exit(1)
    
    # Verify sub_items created
    bedroom_item = items[1]
    sub_items = bedroom_item.get("subItems", [])
    log(f"   - BEDROOM has {len(sub_items)} sub_items")
    
    if len(sub_items) != 1:
        log(f"❌ ERROR: Expected 1 sub_item for BEDROOM, got {len(sub_items)}")
        sys.exit(1)
    
    # Verify sub_item harga matches RAB subItem nilai (9574500)
    lemari_sub = sub_items[0]
    lemari_harga = lemari_sub.get("harga", 0)
    log(f"   - Lemari Pakaian sub_item: harga={lemari_harga} (expected: 9574500)")
    
    if lemari_harga != 9574500:
        log(f"❌ ERROR: Sub_item harga mismatch!")
        sys.exit(1)
    
    # Verify weights sum to ~100%
    total_weight = sum(item.get("weight", 0) for item in items)
    log(f"   - Total weight: {total_weight}% (expected: ~100%)")
    
    if abs(total_weight - 100) > 1:
        log(f"❌ ERROR: Weights don't sum to 100%!")
        sys.exit(1)
    
    log("✅ Deal-to-Progress mapping verified!")
    
    # Test idempotency: calling deal again should NOT duplicate work_items
    log("   Testing idempotency: calling deal again...")
    resp = requests.post(f"{BASE_URL}/projects/{project_id}/deal", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ Second deal call failed: {resp.status_code}")
        sys.exit(1)
    
    resp = requests.get(f"{BASE_URL}/projects/{project_id}/progress-summary", headers={"Authorization": f"Bearer {token}"})
    progress2 = resp.json()
    items2 = progress2.get("items", [])
    
    if len(items2) != 2:
        log(f"❌ ERROR: Deal not idempotent! Got {len(items2)} work_items after second call")
        sys.exit(1)
    
    log("✅ Deal is idempotent (no duplicate work_items)")

def test_premium_gating(token):
    """Test premium gating: free user should get 403"""
    log("\n8. Premium gating: Register free user and test POST /api/rab")
    
    # Register new free user
    import time
    email = f"test_rab_free_{int(time.time())}@test.com"
    resp = requests.post(f"{BASE_URL}/auth/register", json={
        "email": email,
        "name": "Test Free User",
        "password": "Test123456"
    })
    
    if resp.status_code != 200:
        log(f"❌ Register failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    free_token = resp.json().get("token")
    log(f"✅ Free user registered: {email}")
    
    # Try to create RAB with free user
    body = {
        "projectName": "Test RAB Free",
        "category": "Residensial",
        "rab": {
            "clientName": "Test",
            "sections": [],
            "termins": []
        }
    }
    
    resp = requests.post(f"{BASE_URL}/rab", json=body, headers={"Authorization": f"Bearer {free_token}"})
    
    if resp.status_code != 403:
        log(f"❌ ERROR: Free user should get 403, got {resp.status_code}")
        sys.exit(1)
    
    log(f"✅ Free user correctly blocked with 403")

def test_demo_gating():
    """Test demo gating: demo user should get 403 on POST /api/rab"""
    log("\n9. Demo gating: Demo user should get 403 on POST /api/rab")
    
    # Get demo token
    resp = requests.post(f"{BASE_URL}/auth/demo")
    if resp.status_code != 200:
        log(f"❌ Demo login failed: {resp.status_code}")
        sys.exit(1)
    
    demo_token = resp.json().get("token")
    log(f"✅ Demo user logged in")
    
    # Try to create RAB with demo user
    body = {
        "projectName": "Test RAB Demo",
        "category": "Residensial",
        "rab": {
            "clientName": "Test",
            "sections": [],
            "termins": []
        }
    }
    
    resp = requests.post(f"{BASE_URL}/rab", json=body, headers={"Authorization": f"Bearer {demo_token}"})
    
    if resp.status_code != 403:
        log(f"❌ ERROR: Demo user should get 403, got {resp.status_code}")
        log(f"   Response: {resp.text}")
        sys.exit(1)
    
    log(f"✅ Demo user correctly blocked with 403 (read-only mode)")

def main():
    log("=" * 60)
    log("RAB BUILDER (SURAT PENAWARAN) BACKEND TEST")
    log("=" * 60)
    
    try:
        # 1. Login premium
        token = test_login_premium()
        
        # 2. Create RAB with materials and verify math
        project_id = test_create_rab(token)
        
        # 3. GET RAB
        rab_slug = test_get_rab(token, project_id)
        
        # 4. Update RAB (change discount)
        test_update_rab(token, project_id)
        
        # 5. RAB PDF
        test_rab_pdf(token, project_id)
        
        # 6. Share link and public PDF
        test_rab_share_link(token, project_id)
        
        # 7. Deal to Progress
        test_deal_to_progress(token, project_id)
        
        # 8. Premium gating
        test_premium_gating(token)
        
        # 9. Demo gating
        test_demo_gating()
        
        log("\n" + "=" * 60)
        log("✅ ALL RAB BUILDER TESTS PASSED!")
        log("=" * 60)
        
    except Exception as e:
        log(f"\n❌ TEST FAILED WITH EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
