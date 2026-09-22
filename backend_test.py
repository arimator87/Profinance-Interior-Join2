#!/usr/bin/env python3
"""
Backend test suite for Invoice endpoints
Tests all invoice CRUD operations, PDF generation, validation, and premium/demo gating
"""
import requests
import json
import sys
import time

# Backend URL from frontend/.env
BASE_URL = "https://profinance-interior-1.preview.emergentagent.com/api"

# Test credentials
PREMIUM_EMAIL = "furnitrue.mail@gmail.com"
PREMIUM_PASSWORD = "Password123"
EXISTING_PROJECT_ID = "c420b3e7-cd4a-4cad-93cb-e9385960d4f5"

# Test results
results = []

def log(msg):
    print(f"[TEST] {msg}")
    results.append(msg)

def test_login():
    """Test 1: Login with premium account"""
    log("=" * 80)
    log("TEST 1: Login with premium account")
    log("=" * 80)
    
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": PREMIUM_EMAIL,
        "password": PREMIUM_PASSWORD
    })
    
    if response.status_code != 200:
        log(f"❌ FAIL: Login failed with status {response.status_code}")
        log(f"Response: {response.text}")
        return None
    
    data = response.json()
    token = data.get("token")
    
    if not token:
        log(f"❌ FAIL: No token in response")
        return None
    
    log(f"✅ PASS: Login successful, token obtained")
    return token

def test_invoice_context(token):
    """Test 2: GET /api/projects/{project_id}/invoice-context"""
    log("=" * 80)
    log("TEST 2: GET /api/projects/{project_id}/invoice-context")
    log("=" * 80)
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/projects/{EXISTING_PROJECT_ID}/invoice-context", headers=headers)
    
    if response.status_code != 200:
        log(f"❌ FAIL: Status {response.status_code}")
        log(f"Response: {response.text}")
        return False
    
    data = response.json()
    
    # Verify structure
    required_keys = ["project", "client", "company", "ppn", "termins", "summary", "suggestion", "existingCount"]
    missing = [k for k in required_keys if k not in data]
    
    if missing:
        log(f"❌ FAIL: Missing keys: {missing}")
        return False
    
    # Verify suggestion structure
    suggestion = data.get("suggestion", {})
    if "type" not in suggestion or "description" not in suggestion or "amount" not in suggestion:
        log(f"❌ FAIL: Invalid suggestion structure: {suggestion}")
        return False
    
    # Verify suggestion type is valid
    if suggestion["type"] not in ["proforma", "final"]:
        log(f"❌ FAIL: Invalid suggestion type: {suggestion['type']}")
        return False
    
    log(f"✅ PASS: Invoice context returned with correct structure")
    log(f"  - Project: {data['project']['name']}")
    log(f"  - Suggestion: {suggestion['type']} - {suggestion['description']} - Rp {suggestion['amount']:,}")
    log(f"  - Existing invoices: {data['existingCount']}")
    
    return True

def test_create_proforma_invoice(token):
    """Test 3: POST /api/projects/{project_id}/invoices - Create proforma invoice"""
    log("=" * 80)
    log("TEST 3: POST /api/projects/{project_id}/invoices - Create proforma invoice")
    log("=" * 80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    invoice_data = {
        "type": "proforma",
        "number": "PRO/2025/07/001",
        "invoiceDate": None,
        "dueDate": None,
        "status": "Draft",
        "clientName": "Bpk. Andika",
        "clientAddress": "Canggu, Bali",
        "clientPhone": "08123",
        "items": [
            {
                "description": "Uang Muka (DP) 50%",
                "qty": 1,
                "unitPrice": 10000000
            }
        ],
        "ppnEnabled": True,
        "ppnPercent": 11,
        "retentionEnabled": False,
        "retentionPercent": 5,
        "companyName": "CV Karya",
        "companyAddress": "",
        "companyPhone": "",
        "bankName": "BCA",
        "bankAccount": "123",
        "bankHolder": "CV Karya",
        "signerLeft": "",
        "signerRight": "",
        "signatureImage": "",
        "notes": "Terima kasih"
    }
    
    response = requests.post(f"{BASE_URL}/projects/{EXISTING_PROJECT_ID}/invoices", 
                            json=invoice_data, headers=headers)
    
    if response.status_code != 200:
        log(f"❌ FAIL: Status {response.status_code}")
        log(f"Response: {response.text}")
        return None
    
    data = response.json()
    
    # Verify computed values
    computed = data.get("computed", {})
    
    expected_subtotal = 10000000
    expected_ppn = round(10000000 * 11 / 100)  # 1100000
    expected_gross = expected_subtotal + expected_ppn  # 11100000
    expected_retention = 0
    expected_due = expected_gross - expected_retention  # 11100000
    
    if computed.get("subtotal") != expected_subtotal:
        log(f"❌ FAIL: Subtotal mismatch. Expected {expected_subtotal}, got {computed.get('subtotal')}")
        return None
    
    if computed.get("ppnAmount") != expected_ppn:
        log(f"❌ FAIL: PPN mismatch. Expected {expected_ppn}, got {computed.get('ppnAmount')}")
        return None
    
    if computed.get("grossTotal") != expected_gross:
        log(f"❌ FAIL: Gross total mismatch. Expected {expected_gross}, got {computed.get('grossTotal')}")
        return None
    
    if computed.get("retentionAmount") != expected_retention:
        log(f"❌ FAIL: Retention mismatch. Expected {expected_retention}, got {computed.get('retentionAmount')}")
        return None
    
    if computed.get("amountDue") != expected_due:
        log(f"❌ FAIL: Amount due mismatch. Expected {expected_due}, got {computed.get('amountDue')}")
        return None
    
    invoice_id = data.get("id")
    if not invoice_id:
        log(f"❌ FAIL: No invoice ID in response")
        return None
    
    log(f"✅ PASS: Proforma invoice created successfully")
    log(f"  - Invoice ID: {invoice_id}")
    log(f"  - Number: {data.get('number')}")
    log(f"  - Type: {data.get('type')}")
    log(f"  - Subtotal: Rp {computed['subtotal']:,}")
    log(f"  - PPN (11%): Rp {computed['ppnAmount']:,}")
    log(f"  - Gross Total: Rp {computed['grossTotal']:,}")
    log(f"  - Retention: Rp {computed['retentionAmount']:,}")
    log(f"  - Amount Due: Rp {computed['amountDue']:,}")
    
    return invoice_id

def test_create_final_invoice_with_retention(token):
    """Test 4: POST /api/projects/{project_id}/invoices - Create final invoice with retention"""
    log("=" * 80)
    log("TEST 4: POST /api/projects/{project_id}/invoices - Create final invoice with retention")
    log("=" * 80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    invoice_data = {
        "type": "final",
        "number": "INV/2025/07/001",
        "invoiceDate": None,
        "dueDate": None,
        "status": "Draft",
        "clientName": "Bpk. Andika",
        "clientAddress": "Canggu, Bali",
        "clientPhone": "08123",
        "items": [
            {
                "description": "Pelunasan Proyek",
                "qty": 1,
                "unitPrice": 20000000
            }
        ],
        "ppnEnabled": True,
        "ppnPercent": 11,
        "retentionEnabled": True,
        "retentionPercent": 5,
        "companyName": "CV Karya",
        "companyAddress": "",
        "companyPhone": "",
        "bankName": "BCA",
        "bankAccount": "123",
        "bankHolder": "CV Karya",
        "signerLeft": "",
        "signerRight": "",
        "signatureImage": "",
        "notes": "Terima kasih"
    }
    
    response = requests.post(f"{BASE_URL}/projects/{EXISTING_PROJECT_ID}/invoices", 
                            json=invoice_data, headers=headers)
    
    if response.status_code != 200:
        log(f"❌ FAIL: Status {response.status_code}")
        log(f"Response: {response.text}")
        return None
    
    data = response.json()
    
    # Verify computed values with retention
    computed = data.get("computed", {})
    
    expected_subtotal = 20000000
    expected_ppn = round(20000000 * 11 / 100)  # 2200000
    expected_gross = expected_subtotal + expected_ppn  # 22200000
    expected_retention = round(20000000 * 5 / 100)  # 1000000 (5% of subtotal/DPP)
    expected_due = expected_gross - expected_retention  # 21200000
    
    if computed.get("subtotal") != expected_subtotal:
        log(f"❌ FAIL: Subtotal mismatch. Expected {expected_subtotal}, got {computed.get('subtotal')}")
        return None
    
    if computed.get("ppnAmount") != expected_ppn:
        log(f"❌ FAIL: PPN mismatch. Expected {expected_ppn}, got {computed.get('ppnAmount')}")
        return None
    
    if computed.get("grossTotal") != expected_gross:
        log(f"❌ FAIL: Gross total mismatch. Expected {expected_gross}, got {computed.get('grossTotal')}")
        return None
    
    if computed.get("retentionAmount") != expected_retention:
        log(f"❌ FAIL: Retention mismatch. Expected {expected_retention}, got {computed.get('retentionAmount')}")
        log(f"  Note: Retention should be 5% of subtotal (DPP), not gross total")
        return None
    
    if computed.get("amountDue") != expected_due:
        log(f"❌ FAIL: Amount due mismatch. Expected {expected_due}, got {computed.get('amountDue')}")
        return None
    
    invoice_id = data.get("id")
    if not invoice_id:
        log(f"❌ FAIL: No invoice ID in response")
        return None
    
    log(f"✅ PASS: Final invoice with retention created successfully")
    log(f"  - Invoice ID: {invoice_id}")
    log(f"  - Number: {data.get('number')}")
    log(f"  - Type: {data.get('type')}")
    log(f"  - Subtotal: Rp {computed['subtotal']:,}")
    log(f"  - PPN (11%): Rp {computed['ppnAmount']:,}")
    log(f"  - Gross Total: Rp {computed['grossTotal']:,}")
    log(f"  - Retention (5% of subtotal): Rp {computed['retentionAmount']:,}")
    log(f"  - Amount Due: Rp {computed['amountDue']:,}")
    
    return invoice_id

def test_validation_empty_number(token):
    """Test 5: Validation - Empty invoice number should return 400"""
    log("=" * 80)
    log("TEST 5: Validation - Empty invoice number should return 400")
    log("=" * 80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    invoice_data = {
        "type": "proforma",
        "number": "",  # Empty number
        "status": "Draft",
        "clientName": "Test",
        "items": [{"description": "Test", "qty": 1, "unitPrice": 1000000}],
        "ppnEnabled": False,
        "retentionEnabled": False
    }
    
    response = requests.post(f"{BASE_URL}/projects/{EXISTING_PROJECT_ID}/invoices", 
                            json=invoice_data, headers=headers)
    
    if response.status_code != 400:
        log(f"❌ FAIL: Expected 400, got {response.status_code}")
        log(f"Response: {response.text}")
        return False
    
    data = response.json()
    if "Nomor invoice wajib diisi" not in data.get("detail", ""):
        log(f"❌ FAIL: Wrong error message: {data.get('detail')}")
        return False
    
    log(f"✅ PASS: Empty number validation working correctly")
    log(f"  - Error message: {data.get('detail')}")
    
    return True

def test_validation_invalid_type(token):
    """Test 6: Validation - Invalid invoice type should return 400"""
    log("=" * 80)
    log("TEST 6: Validation - Invalid invoice type should return 400")
    log("=" * 80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    invoice_data = {
        "type": "foo",  # Invalid type
        "number": "TEST/001",
        "status": "Draft",
        "clientName": "Test",
        "items": [{"description": "Test", "qty": 1, "unitPrice": 1000000}],
        "ppnEnabled": False,
        "retentionEnabled": False
    }
    
    response = requests.post(f"{BASE_URL}/projects/{EXISTING_PROJECT_ID}/invoices", 
                            json=invoice_data, headers=headers)
    
    if response.status_code != 400:
        log(f"❌ FAIL: Expected 400, got {response.status_code}")
        log(f"Response: {response.text}")
        return False
    
    data = response.json()
    if "Tipe invoice tidak valid" not in data.get("detail", ""):
        log(f"❌ FAIL: Wrong error message: {data.get('detail')}")
        return False
    
    log(f"✅ PASS: Invalid type validation working correctly")
    log(f"  - Error message: {data.get('detail')}")
    
    return True

def test_list_invoices(token):
    """Test 7: GET /api/projects/{project_id}/invoices"""
    log("=" * 80)
    log("TEST 7: GET /api/projects/{project_id}/invoices")
    log("=" * 80)
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/projects/{EXISTING_PROJECT_ID}/invoices", headers=headers)
    
    if response.status_code != 200:
        log(f"❌ FAIL: Status {response.status_code}")
        log(f"Response: {response.text}")
        return False
    
    data = response.json()
    
    if not isinstance(data, list):
        log(f"❌ FAIL: Expected list, got {type(data)}")
        return False
    
    log(f"✅ PASS: Invoice list retrieved successfully")
    log(f"  - Total invoices: {len(data)}")
    
    if len(data) > 0:
        # Verify newest first (descending order by createdAt)
        log(f"  - First invoice: {data[0].get('number')} (type: {data[0].get('type')})")
        
        # Verify each has computed
        for inv in data:
            if "computed" not in inv:
                log(f"❌ FAIL: Invoice {inv.get('id')} missing computed field")
                return False
    
    return True

def test_get_single_invoice(token, invoice_id):
    """Test 8: GET /api/invoices/{invoice_id}"""
    log("=" * 80)
    log("TEST 8: GET /api/invoices/{invoice_id}")
    log("=" * 80)
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/invoices/{invoice_id}", headers=headers)
    
    if response.status_code != 200:
        log(f"❌ FAIL: Status {response.status_code}")
        log(f"Response: {response.text}")
        return False
    
    data = response.json()
    
    if data.get("id") != invoice_id:
        log(f"❌ FAIL: ID mismatch. Expected {invoice_id}, got {data.get('id')}")
        return False
    
    if "computed" not in data:
        log(f"❌ FAIL: Missing computed field")
        return False
    
    log(f"✅ PASS: Single invoice retrieved successfully")
    log(f"  - Invoice ID: {data.get('id')}")
    log(f"  - Number: {data.get('number')}")
    log(f"  - Type: {data.get('type')}")
    
    return True

def test_update_invoice(token, invoice_id):
    """Test 9: PUT /api/invoices/{invoice_id}"""
    log("=" * 80)
    log("TEST 9: PUT /api/invoices/{invoice_id}")
    log("=" * 80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # First get the invoice
    response = requests.get(f"{BASE_URL}/invoices/{invoice_id}", headers=headers)
    if response.status_code != 200:
        log(f"❌ FAIL: Could not get invoice for update")
        return False
    
    invoice = response.json()
    
    # Update status and change an item
    update_data = {
        "type": invoice.get("type"),
        "number": invoice.get("number"),
        "invoiceDate": invoice.get("invoiceDate"),
        "dueDate": invoice.get("dueDate"),
        "status": "Terkirim",  # Changed from Draft
        "clientName": invoice.get("clientName"),
        "clientAddress": invoice.get("clientAddress"),
        "clientPhone": invoice.get("clientPhone"),
        "items": [
            {
                "description": "Uang Muka (DP) 50% - Updated",  # Changed description
                "qty": 1,
                "unitPrice": 12000000  # Changed amount
            }
        ],
        "ppnEnabled": invoice.get("ppnEnabled"),
        "ppnPercent": invoice.get("ppnPercent"),
        "retentionEnabled": invoice.get("retentionEnabled"),
        "retentionPercent": invoice.get("retentionPercent"),
        "companyName": invoice.get("companyName"),
        "companyAddress": invoice.get("companyAddress", ""),
        "companyPhone": invoice.get("companyPhone", ""),
        "bankName": invoice.get("bankName"),
        "bankAccount": invoice.get("bankAccount"),
        "bankHolder": invoice.get("bankHolder"),
        "signerLeft": invoice.get("signerLeft", ""),
        "signerRight": invoice.get("signerRight", ""),
        "signatureImage": invoice.get("signatureImage", ""),
        "notes": invoice.get("notes")
    }
    
    response = requests.put(f"{BASE_URL}/invoices/{invoice_id}", 
                           json=update_data, headers=headers)
    
    if response.status_code != 200:
        log(f"❌ FAIL: Status {response.status_code}")
        log(f"Response: {response.text}")
        return False
    
    data = response.json()
    
    if data.get("status") != "Terkirim":
        log(f"❌ FAIL: Status not updated. Expected 'Terkirim', got {data.get('status')}")
        return False
    
    # Verify computed recalculated
    computed = data.get("computed", {})
    expected_subtotal = 12000000
    expected_ppn = round(12000000 * 11 / 100)  # 1320000
    expected_gross = expected_subtotal + expected_ppn  # 13320000
    
    if computed.get("subtotal") != expected_subtotal:
        log(f"❌ FAIL: Computed not recalculated correctly")
        return False
    
    log(f"✅ PASS: Invoice updated successfully")
    log(f"  - Status: {data.get('status')}")
    log(f"  - New subtotal: Rp {computed['subtotal']:,}")
    log(f"  - New amount due: Rp {computed['amountDue']:,}")
    
    return True

def test_invoice_pdf(token, invoice_id, invoice_type):
    """Test 10: GET /api/invoices/{invoice_id}/pdf?auth={token}"""
    log("=" * 80)
    log(f"TEST 10: GET /api/invoices/{invoice_id}/pdf?auth={{token}} (type: {invoice_type})")
    log("=" * 80)
    
    response = requests.get(f"{BASE_URL}/invoices/{invoice_id}/pdf?auth={token}")
    
    if response.status_code != 200:
        log(f"❌ FAIL: Status {response.status_code}")
        log(f"Response: {response.text[:200]}")
        return False
    
    content_type = response.headers.get("Content-Type", "")
    if "application/pdf" not in content_type:
        log(f"❌ FAIL: Wrong content type: {content_type}")
        return False
    
    pdf_content = response.content
    if not pdf_content.startswith(b"%PDF"):
        log(f"❌ FAIL: Not a valid PDF (doesn't start with %PDF)")
        return False
    
    log(f"✅ PASS: PDF generated successfully")
    log(f"  - Content-Type: {content_type}")
    log(f"  - Size: {len(pdf_content)} bytes")
    log(f"  - Starts with: {pdf_content[:10]}")
    
    return True

def test_premium_gating_free_user(token):
    """Test 11: Premium gating - Free user should get 403"""
    log("=" * 80)
    log("TEST 11: Premium gating - Free user should get 403")
    log("=" * 80)
    
    # Register a new free user
    free_email = f"test_invoice_free_{int(time.time())}@test.com"
    response = requests.post(f"{BASE_URL}/auth/register", json={
        "email": free_email,
        "name": "Test Free User",
        "password": "Test123456"
    })
    
    if response.status_code != 200:
        log(f"❌ FAIL: Could not register free user. Status {response.status_code}")
        return False
    
    free_token = response.json().get("token")
    
    # Try to access invoice-context with free token
    headers = {"Authorization": f"Bearer {free_token}"}
    response = requests.get(f"{BASE_URL}/projects/{EXISTING_PROJECT_ID}/invoice-context", headers=headers)
    
    # Should get 403 or 404 (404 if project doesn't belong to free user)
    if response.status_code == 404:
        log(f"⚠️  Got 404 (project not found for free user) - trying to create invoice instead")
        
        # Try to create invoice (should also fail with 403 at require_premium level)
        invoice_data = {
            "type": "proforma",
            "number": "TEST/001",
            "status": "Draft",
            "clientName": "Test",
            "items": [{"description": "Test", "qty": 1, "unitPrice": 1000000}],
            "ppnEnabled": False,
            "retentionEnabled": False
        }
        
        # First need to create a project for the free user
        project_response = requests.post(f"{BASE_URL}/projects", json={
            "name": "Test Project Free",
            "nominal": 10000000
        }, headers=headers)
        
        if project_response.status_code == 200:
            free_project_id = project_response.json().get("id")
            
            # Now try to create invoice
            response = requests.post(f"{BASE_URL}/projects/{free_project_id}/invoices", 
                                    json=invoice_data, headers=headers)
            
            if response.status_code != 403:
                log(f"❌ FAIL: Expected 403, got {response.status_code}")
                log(f"Response: {response.text}")
                return False
            
            log(f"✅ PASS: Free user correctly blocked with 403")
            return True
    
    if response.status_code != 403:
        log(f"❌ FAIL: Expected 403, got {response.status_code}")
        log(f"Response: {response.text}")
        return False
    
    log(f"✅ PASS: Free user correctly blocked with 403")
    
    return True

def test_demo_gating(token):
    """Test 12: Demo gating - Demo user should get 403 on write operations"""
    log("=" * 80)
    log("TEST 12: Demo gating - Demo user should get 403 on write operations")
    log("=" * 80)
    
    # Get demo token
    response = requests.post(f"{BASE_URL}/auth/demo")
    
    if response.status_code != 200:
        log(f"❌ FAIL: Could not get demo token. Status {response.status_code}")
        return False
    
    demo_token = response.json().get("token")
    
    # Get demo projects
    headers = {"Authorization": f"Bearer {demo_token}"}
    response = requests.get(f"{BASE_URL}/projects", headers=headers)
    
    if response.status_code != 200 or not response.json():
        log(f"❌ FAIL: Could not get demo projects")
        return False
    
    demo_project_id = response.json()[0].get("id")
    
    # Try to create invoice with demo token (should fail with 403)
    invoice_data = {
        "type": "proforma",
        "number": "DEMO/001",
        "status": "Draft",
        "clientName": "Demo Client",
        "items": [{"description": "Demo", "qty": 1, "unitPrice": 1000000}],
        "ppnEnabled": False,
        "retentionEnabled": False
    }
    
    response = requests.post(f"{BASE_URL}/projects/{demo_project_id}/invoices", 
                            json=invoice_data, headers=headers)
    
    if response.status_code != 403:
        log(f"❌ FAIL: Expected 403, got {response.status_code}")
        log(f"Response: {response.text}")
        return False
    
    data = response.json()
    if "Mode Demo" not in data.get("detail", ""):
        log(f"⚠️  Warning: Expected 'Mode Demo' in error message, got: {data.get('detail')}")
    
    log(f"✅ PASS: Demo user correctly blocked with 403")
    log(f"  - Error message: {data.get('detail')}")
    
    return True

def test_rab_pdf_regression(token):
    """Test 13: Regression - RAB PDF should still work (titled QUOTATION)"""
    log("=" * 80)
    log("TEST 13: Regression - RAB PDF should still work (titled QUOTATION)")
    log("=" * 80)
    
    # Check if project has RAB
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/projects/{EXISTING_PROJECT_ID}/rab", headers=headers)
    
    if response.status_code == 404:
        log(f"⚠️  SKIP: Project has no RAB, cannot test RAB PDF")
        return True
    
    if response.status_code != 200:
        log(f"❌ FAIL: Could not get RAB. Status {response.status_code}")
        return False
    
    # Try to get RAB PDF
    response = requests.get(f"{BASE_URL}/projects/{EXISTING_PROJECT_ID}/rab/pdf?auth={token}")
    
    if response.status_code != 200:
        log(f"❌ FAIL: RAB PDF failed. Status {response.status_code}")
        log(f"Response: {response.text[:200]}")
        return False
    
    content_type = response.headers.get("Content-Type", "")
    if "application/pdf" not in content_type:
        log(f"❌ FAIL: Wrong content type: {content_type}")
        return False
    
    pdf_content = response.content
    if not pdf_content.startswith(b"%PDF"):
        log(f"❌ FAIL: Not a valid PDF")
        return False
    
    log(f"✅ PASS: RAB PDF still working")
    log(f"  - Size: {len(pdf_content)} bytes")
    log(f"  - Note: Cannot verify 'QUOTATION' title without parsing PDF, but PDF generates successfully")
    
    return True

def test_delete_invoice(token, invoice_id):
    """Test 14: DELETE /api/invoices/{invoice_id}"""
    log("=" * 80)
    log("TEST 14: DELETE /api/invoices/{invoice_id}")
    log("=" * 80)
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.delete(f"{BASE_URL}/invoices/{invoice_id}", headers=headers)
    
    if response.status_code != 200:
        log(f"❌ FAIL: Status {response.status_code}")
        log(f"Response: {response.text}")
        return False
    
    data = response.json()
    if not data.get("ok"):
        log(f"❌ FAIL: Delete did not return ok:true")
        return False
    
    # Verify invoice is deleted (should get 404)
    response = requests.get(f"{BASE_URL}/invoices/{invoice_id}", headers=headers)
    
    if response.status_code != 404:
        log(f"❌ FAIL: Invoice still exists after delete. Status {response.status_code}")
        return False
    
    log(f"✅ PASS: Invoice deleted successfully")
    log(f"  - Subsequent GET returns 404")
    
    return True

def main():
    print("\n" + "=" * 80)
    print("INVOICE ENDPOINTS TEST SUITE")
    print("=" * 80 + "\n")
    
    # Test 1: Login
    token = test_login()
    if not token:
        log("\n❌ CRITICAL: Cannot proceed without token")
        sys.exit(1)
    
    # Test 2: Invoice context
    test_invoice_context(token)
    
    # Test 3: Create proforma invoice
    proforma_id = test_create_proforma_invoice(token)
    
    # Test 4: Create final invoice with retention
    final_id = test_create_final_invoice_with_retention(token)
    
    # Test 5-6: Validation tests
    test_validation_empty_number(token)
    test_validation_invalid_type(token)
    
    # Test 7: List invoices
    test_list_invoices(token)
    
    # Test 8-9: Get and update invoice
    if proforma_id:
        test_get_single_invoice(token, proforma_id)
        test_update_invoice(token, proforma_id)
    
    # Test 10: PDF generation
    if proforma_id:
        test_invoice_pdf(token, proforma_id, "proforma")
    if final_id:
        test_invoice_pdf(token, final_id, "final")
    
    # Test 11-12: Premium and demo gating
    test_premium_gating_free_user(token)
    test_demo_gating(token)
    
    # Test 13: RAB PDF regression
    test_rab_pdf_regression(token)
    
    # Test 14: Delete invoices (cleanup)
    if proforma_id:
        test_delete_invoice(token, proforma_id)
    if final_id:
        test_delete_invoice(token, final_id)
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for r in results if "✅ PASS" in r)
    failed = sum(1 for r in results if "❌ FAIL" in r)
    skipped = sum(1 for r in results if "⚠️  SKIP" in r)
    
    print(f"\nTotal tests: {passed + failed + skipped}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"⚠️  Skipped: {skipped}")
    
    if failed > 0:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)
    else:
        print("\n✅ ALL TESTS PASSED")
        sys.exit(0)

if __name__ == "__main__":
    main()
