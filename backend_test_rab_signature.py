#!/usr/bin/env python3
"""
Backend test for RAB company template + signature image + Quotation-by enhancement.
Tests template endpoints, signature image handling, oversized guards, and PDF embedding.
"""
import requests
import json
import sys

# Internal backend URL
BASE_URL = "http://localhost:8001/api"

# Test credentials
PREMIUM_EMAIL = "premium@test.com"
PREMIUM_PASSWORD = "Premium123"

# Small valid 1x1 PNG data URI (as provided in review request)
SMALL_PNG_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

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

def test_put_company_template(token):
    """PUT /api/rab/company-template with signature image."""
    log("\n2. PUT /api/rab/company-template with signature image")
    
    body = {
        "companyName": "Furniture Interior Design",
        "companyAddress": "Jl. H. Dimun Raya, Depok",
        "companyPhone": "0817177337",
        "bankName": "BCA",
        "bankAccount": "8720473039",
        "bankHolder": "Agung Satrio",
        "signerLeft": "Arimarta Chandra",
        "signerRight": "",
        "signatureImage": SMALL_PNG_DATA_URI
    }
    
    resp = requests.put(f"{BASE_URL}/rab/company-template", json=body, headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ PUT company-template failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    data = resp.json()
    log(f"✅ Company template saved")
    log(f"   - companyName: {data.get('companyName')}")
    log(f"   - signatureImage length: {len(data.get('signatureImage', ''))}")
    
    return data

def test_get_company_template(token):
    """GET /api/rab/company-template and verify fields."""
    log("\n3. GET /api/rab/company-template")
    
    resp = requests.get(f"{BASE_URL}/rab/company-template", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ GET company-template failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    data = resp.json()
    log(f"✅ Company template retrieved")
    
    # Verify all fields present
    expected_fields = ["companyName", "companyAddress", "companyPhone", "bankName", 
                      "bankAccount", "bankHolder", "signerLeft", "signerRight", "signatureImage"]
    
    for field in expected_fields:
        if field not in data:
            log(f"❌ ERROR: Field '{field}' missing from response!")
            sys.exit(1)
    
    # Verify signatureImage is non-empty
    sig_img = data.get("signatureImage", "")
    if not sig_img:
        log(f"❌ ERROR: signatureImage is empty!")
        sys.exit(1)
    
    log(f"   - signatureImage: NON-EMPTY ({len(sig_img)} chars)")
    
    # Verify user_id and _id NOT exposed
    if "user_id" in data:
        log(f"❌ ERROR: user_id should NOT be exposed in response!")
        sys.exit(1)
    
    if "_id" in data:
        log(f"❌ ERROR: _id should NOT be exposed in response!")
        sys.exit(1)
    
    log(f"✅ Response does NOT expose user_id or _id (correct)")
    
    # Verify values match what we saved
    if data.get("companyName") != "Furniture Interior Design":
        log(f"❌ ERROR: companyName mismatch!")
        sys.exit(1)
    
    if data.get("signerLeft") != "Arimarta Chandra":
        log(f"❌ ERROR: signerLeft mismatch!")
        sys.exit(1)
    
    log(f"✅ All fields verified correctly")
    return data

def test_oversized_template_signature(token):
    """PUT /api/rab/company-template with oversized signatureImage -> expect 400."""
    log("\n4. OVERSIZED GUARD: PUT company-template with >3MB signatureImage")
    
    # Create a string longer than 3,000,000 chars
    oversized_sig = "data:image/png;base64," + ("A" * 3000001)
    
    body = {
        "companyName": "Test Company",
        "companyAddress": "",
        "companyPhone": "",
        "bankName": "",
        "bankAccount": "",
        "bankHolder": "",
        "signerLeft": "",
        "signerRight": "",
        "signatureImage": oversized_sig
    }
    
    resp = requests.put(f"{BASE_URL}/rab/company-template", json=body, headers={"Authorization": f"Bearer {token}"})
    
    if resp.status_code != 400:
        log(f"❌ ERROR: Expected 400 for oversized signature, got {resp.status_code}")
        sys.exit(1)
    
    log(f"✅ Oversized signature correctly rejected with 400")
    log(f"   - Error message: {resp.json().get('detail', resp.text)}")

def test_template_gating_demo():
    """Demo user should get 403 on PUT /api/rab/company-template."""
    log("\n5. GATING: Demo user PUT company-template -> expect 403")
    
    # Get demo token
    resp = requests.post(f"{BASE_URL}/auth/demo")
    if resp.status_code != 200:
        log(f"❌ Demo login failed: {resp.status_code}")
        sys.exit(1)
    
    demo_token = resp.json().get("token")
    log(f"✅ Demo user logged in")
    
    # Try PUT with demo token
    body = {
        "companyName": "Test",
        "signatureImage": SMALL_PNG_DATA_URI
    }
    
    resp = requests.put(f"{BASE_URL}/rab/company-template", json=body, headers={"Authorization": f"Bearer {demo_token}"})
    
    if resp.status_code != 403:
        log(f"❌ ERROR: Demo user should get 403 on PUT, got {resp.status_code}")
        sys.exit(1)
    
    log(f"✅ Demo user correctly blocked with 403 on PUT")

def test_template_gating_free():
    """Free user should get 403 on PUT and GET /api/rab/company-template."""
    log("\n6. GATING: Free user PUT/GET company-template -> expect 403")
    
    # Register new free user
    import time
    email = f"test_rab_template_free_{int(time.time())}@test.com"
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
    
    # Try PUT with free token
    body = {
        "companyName": "Test",
        "signatureImage": SMALL_PNG_DATA_URI
    }
    
    resp = requests.put(f"{BASE_URL}/rab/company-template", json=body, headers={"Authorization": f"Bearer {free_token}"})
    
    if resp.status_code != 403:
        log(f"❌ ERROR: Free user should get 403 on PUT, got {resp.status_code}")
        sys.exit(1)
    
    log(f"✅ Free user correctly blocked with 403 on PUT")
    
    # Try GET with free token
    resp = requests.get(f"{BASE_URL}/rab/company-template", headers={"Authorization": f"Bearer {free_token}"})
    
    if resp.status_code != 403:
        log(f"❌ ERROR: Free user should get 403 on GET, got {resp.status_code}")
        sys.exit(1)
    
    log(f"✅ Free user correctly blocked with 403 on GET")

def test_create_rab_with_signature(token):
    """Create RAB with signatureImage and verify PDF embeds it."""
    log("\n7. CREATE RAB WITH SIGNATURE: POST /api/rab with signatureImage")
    
    body = {
        "projectName": "RAB Sig Test",
        "category": "Residensial",
        "rab": {
            "clientName": "Mba Grace",
            "companyName": "Furniture Interior Design",
            "companyPhone": "0817177337",
            "signerLeft": "Arimarta Chandra",
            "signatureImage": SMALL_PNG_DATA_URI,
            "discount": 0,
            "ppnEnabled": False,
            "ppnPercent": 11,
            "sections": [
                {
                    "name": "BEDROOM",
                    "subItems": [
                        {
                            "name": "Lemari",
                            "qty": 1,
                            "unit": "Unit",
                            "hargaSatuan": 5000000,
                            "materials": []
                        }
                    ]
                }
            ],
            "termins": [
                {"label": "DP", "percent": 50}
            ]
        }
    }
    
    resp = requests.post(f"{BASE_URL}/rab", json=body, headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ Create RAB with signature failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    data = resp.json()
    project_id = data.get("id")
    log(f"✅ RAB with signature created, project_id: {project_id}")
    
    # Verify signatureImage round-trips in GET
    log(f"   GET /api/projects/{project_id}/rab to verify signatureImage")
    resp = requests.get(f"{BASE_URL}/projects/{project_id}/rab", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ GET RAB failed: {resp.status_code}")
        sys.exit(1)
    
    rab_data = resp.json()
    rab_sig = rab_data.get("rab", {}).get("signatureImage", "")
    
    if not rab_sig:
        log(f"❌ ERROR: signatureImage NOT round-tripped (empty)!")
        sys.exit(1)
    
    log(f"✅ signatureImage round-tripped correctly ({len(rab_sig)} chars)")
    
    # Get PDF and verify it's valid and > 3000 bytes
    log(f"   GET /api/projects/{project_id}/rab/pdf?auth={{token}}")
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
    
    if len(pdf_bytes) <= 3000:
        log(f"❌ ERROR: PDF too small ({len(pdf_bytes)} bytes), signature may not be embedded!")
        sys.exit(1)
    
    log(f"✅ PDF valid (%PDF header present) and size > 3000 bytes (signature likely embedded)")
    
    return project_id

def test_oversized_rab_signature(token):
    """POST /api/rab with oversized rab.signatureImage -> expect 400."""
    log("\n8. OVERSIZED RAB SIGNATURE GUARD: POST /api/rab with >3MB signatureImage")
    
    # Create a string longer than 3,000,000 chars
    oversized_sig = "data:image/png;base64," + ("A" * 3000001)
    
    body = {
        "projectName": "Test Oversized",
        "category": "Residensial",
        "rab": {
            "clientName": "Test",
            "signatureImage": oversized_sig,
            "sections": [],
            "termins": []
        }
    }
    
    resp = requests.post(f"{BASE_URL}/rab", json=body, headers={"Authorization": f"Bearer {token}"})
    
    if resp.status_code != 400:
        log(f"❌ ERROR: Expected 400 for oversized RAB signature, got {resp.status_code}")
        sys.exit(1)
    
    log(f"✅ Oversized RAB signature correctly rejected with 400")
    log(f"   - Error message: {resp.json().get('detail', resp.text)}")

def test_cleanup(token, project_id):
    """Delete test project."""
    log(f"\n9. CLEANUP: Delete test project {project_id}")
    
    resp = requests.delete(f"{BASE_URL}/projects/{project_id}", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"⚠️  Warning: Failed to delete project: {resp.status_code}")
        return
    
    log(f"✅ Test project deleted")

def main():
    log("=" * 70)
    log("RAB COMPANY TEMPLATE + SIGNATURE IMAGE + QUOTATION-BY TEST")
    log("=" * 70)
    
    try:
        # 1. Login premium
        token = test_login_premium()
        
        # 2. PUT company-template with signature
        test_put_company_template(token)
        
        # 3. GET company-template and verify
        test_get_company_template(token)
        
        # 4. Oversized template signature guard
        test_oversized_template_signature(token)
        
        # 5. Demo user gating on template
        test_template_gating_demo()
        
        # 6. Free user gating on template
        test_template_gating_free()
        
        # 7. Create RAB with signature and verify PDF
        project_id = test_create_rab_with_signature(token)
        
        # 8. Oversized RAB signature guard
        test_oversized_rab_signature(token)
        
        # 9. Cleanup
        test_cleanup(token, project_id)
        
        log("\n" + "=" * 70)
        log("✅ ALL RAB SIGNATURE TESTS PASSED!")
        log("=" * 70)
        
    except Exception as e:
        log(f"\n❌ TEST FAILED WITH EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
