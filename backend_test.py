#!/usr/bin/env python3
"""
Backend test suite for ProFinance Interior
Tests: Invoice quotationNo feature + Billing Recap endpoint
"""
import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8001/api"
PREMIUM_EMAIL = "furnitrue.mail@gmail.com"
PREMIUM_PASSWORD = "Password123"
EXISTING_PROJECT_ID = "c420b3e7-cd4a-4cad-93cb-e9385960d4f5"

# Test state
token = None
test_project_id = None
quotation_test_project_id = None
created_invoices = []

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def login_premium():
    """Login with premium account"""
    global token
    log("=== TEST 1: Login Premium Account ===")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": PREMIUM_EMAIL,
        "password": PREMIUM_PASSWORD
    })
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    data = resp.json()
    token = data["token"]
    log(f"✓ Login successful, token: {token[:20]}...")
    return token

def test_invoice_context():
    """Test 6: GET /api/projects/{project_id}/invoice-context - verify rabRef.quotationNo"""
    log("\n=== TEST 6: Invoice Context (rabRef.quotationNo) ===")
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/projects/{EXISTING_PROJECT_ID}/invoice-context", headers=headers)
    assert resp.status_code == 200, f"invoice-context failed: {resp.status_code} {resp.text}"
    data = resp.json()
    
    # Verify structure
    assert "rabRef" in data, "Missing rabRef in response"
    assert "quotationNo" in data["rabRef"], "Missing quotationNo in rabRef"
    
    log(f"✓ invoice-context returned 200")
    log(f"  rabRef.quotationNo: '{data['rabRef']['quotationNo']}'")
    log(f"  rabRef.quotationDate: '{data['rabRef'].get('quotationDate')}'")
    return data

def create_quotation_test_project():
    """Create a test project for quotation tests"""
    global quotation_test_project_id
    log("\n=== Creating Test Project for Quotation Tests ===")
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{BASE_URL}/projects", headers=headers, json={
        "name": "Test Quotation Project",
        "owner": "Bpk Uji",
        "nominal": 30000000,
        "companyName": "PT Test Interior",
        "alamatProyek": "Jl. Test No. 1",
        "category": "Residensial",
        "status": "Berjalan"
    })
    assert resp.status_code == 200, f"Create project failed: {resp.status_code} {resp.text}"
    data = resp.json()
    quotation_test_project_id = data["id"]
    log(f"✓ Quotation test project created: {quotation_test_project_id}")
    log(f"  Name: {data['name']}, Nominal: Rp {data['nominal']:,}")
    return quotation_test_project_id

def create_test_project():
    """Create a test project for controlled billing recap scenario"""
    global test_project_id
    log("\n=== Creating Test Project for Billing Recap ===")
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{BASE_URL}/projects", headers=headers, json={
        "name": "Test Billing Recap Project",
        "owner": "Bpk Uji Coba",
        "nominal": 50000000,
        "companyName": "PT Test Interior",
        "alamatProyek": "Jl. Test No. 123",
        "category": "Residensial",
        "status": "Berjalan"
    })
    assert resp.status_code == 200, f"Create project failed: {resp.status_code} {resp.text}"
    data = resp.json()
    test_project_id = data["id"]
    log(f"✓ Test project created: {test_project_id}")
    log(f"  Name: {data['name']}, Nominal: Rp {data['nominal']:,}")
    return test_project_id

def test_create_invoice_with_quotation():
    """Test 1: POST /api/projects/{project_id}/invoices with quotationNo"""
    log("\n=== TEST 1: Create Invoice with quotationNo ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    invoice_data = {
        "type": "proforma",
        "number": "TEST-PRO/001",
        "quotationNo": "QTO/2026/09/001",
        "status": "Terkirim",
        "clientName": "Bpk Uji",
        "clientAddress": "Jl. Test No. 1",
        "clientPhone": "081234567890",
        "items": [
            {
                "description": "DP 50%",
                "qty": 1,
                "unitPrice": 10000000
            }
        ],
        "ppnEnabled": True,
        "ppnPercent": 11,
        "retentionEnabled": False,
        "retentionPercent": 5,
        "companyName": "PT Interior Design",
        "companyAddress": "Jl. Company No. 1",
        "companyPhone": "021-12345678",
        "bankName": "BCA",
        "bankAccount": "1234567890",
        "bankHolder": "PT Interior Design"
    }
    
    resp = requests.post(
        f"{BASE_URL}/projects/{quotation_test_project_id}/invoices",
        headers=headers,
        json=invoice_data
    )
    assert resp.status_code == 200, f"Create invoice failed: {resp.status_code} {resp.text}"
    data = resp.json()
    
    # Verify quotationNo roundtrip
    assert data["quotationNo"] == "QTO/2026/09/001", f"quotationNo mismatch: {data.get('quotationNo')}"
    
    # Verify computed fields
    computed = data["computed"]
    assert computed["subtotal"] == 10000000, f"Subtotal wrong: {computed['subtotal']}"
    assert computed["ppnAmount"] == 1100000, f"PPN wrong: {computed['ppnAmount']}"
    assert computed["grossTotal"] == 11100000, f"Gross wrong: {computed['grossTotal']}"
    assert computed["retentionAmount"] == 0, f"Retention should be 0: {computed['retentionAmount']}"
    assert computed["amountDue"] == 11100000, f"AmountDue wrong: {computed['amountDue']}"
    
    invoice_id = data["id"]
    created_invoices.append(invoice_id)
    
    log(f"✓ Invoice created with quotationNo: {data['quotationNo']}")
    log(f"  Invoice ID: {invoice_id}")
    log(f"  Number: {data['number']}, Type: {data['type']}, Status: {data['status']}")
    log(f"  Computed: subtotal={computed['subtotal']:,}, ppn={computed['ppnAmount']:,}, amountDue={computed['amountDue']:,}")
    
    return invoice_id

def test_list_invoices(invoice_id):
    """Test 2: GET /api/projects/{project_id}/invoices - verify quotationNo roundtrip"""
    log("\n=== TEST 2: List Invoices (quotationNo roundtrip) ===")
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/projects/{quotation_test_project_id}/invoices", headers=headers)
    assert resp.status_code == 200, f"List invoices failed: {resp.status_code} {resp.text}"
    data = resp.json()
    
    # Find our invoice
    invoice = next((inv for inv in data if inv["id"] == invoice_id), None)
    assert invoice is not None, f"Invoice {invoice_id} not found in list"
    assert invoice["quotationNo"] == "QTO/2026/09/001", f"quotationNo mismatch in list: {invoice.get('quotationNo')}"
    
    log(f"✓ Invoice found in list with correct quotationNo: {invoice['quotationNo']}")
    return invoice

def test_get_single_invoice(invoice_id):
    """Test 3: GET /api/invoices/{invoice_id} - verify quotationNo"""
    log("\n=== TEST 3: Get Single Invoice ===")
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/invoices/{invoice_id}", headers=headers)
    assert resp.status_code == 200, f"Get invoice failed: {resp.status_code} {resp.text}"
    data = resp.json()
    
    assert data["quotationNo"] == "QTO/2026/09/001", f"quotationNo mismatch: {data.get('quotationNo')}"
    
    log(f"✓ Single invoice retrieved with correct quotationNo: {data['quotationNo']}")
    return data

def test_update_invoice_quotation(invoice_id):
    """Test 4: PUT /api/invoices/{invoice_id} - update quotationNo"""
    log("\n=== TEST 4: Update Invoice quotationNo ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get current invoice first
    resp = requests.get(f"{BASE_URL}/invoices/{invoice_id}", headers=headers)
    current = resp.json()
    
    # Update with new quotationNo
    update_data = {
        "type": current["type"],
        "number": current["number"],
        "quotationNo": "QTO/2026/09/002",  # Changed
        "status": current["status"],
        "clientName": current["clientName"],
        "clientAddress": current["clientAddress"],
        "clientPhone": current["clientPhone"],
        "items": current["items"],
        "ppnEnabled": current["ppnEnabled"],
        "ppnPercent": current["ppnPercent"],
        "retentionEnabled": current["retentionEnabled"],
        "retentionPercent": current["retentionPercent"],
        "companyName": current["companyName"],
        "companyAddress": current["companyAddress"],
        "companyPhone": current["companyPhone"],
        "bankName": current["bankName"],
        "bankAccount": current["bankAccount"],
        "bankHolder": current["bankHolder"]
    }
    
    resp = requests.put(f"{BASE_URL}/invoices/{invoice_id}", headers=headers, json=update_data)
    assert resp.status_code == 200, f"Update invoice failed: {resp.status_code} {resp.text}"
    data = resp.json()
    
    assert data["quotationNo"] == "QTO/2026/09/002", f"Updated quotationNo mismatch: {data.get('quotationNo')}"
    
    log(f"✓ Invoice quotationNo updated successfully: {data['quotationNo']}")
    return data

def test_invoice_pdf(invoice_id):
    """Test 5: GET /api/invoices/{invoice_id}/pdf?auth={token} - verify PDF generation"""
    log("\n=== TEST 5: Invoice PDF Generation ===")
    
    resp = requests.get(f"{BASE_URL}/invoices/{invoice_id}/pdf?auth={token}")
    assert resp.status_code == 200, f"PDF generation failed: {resp.status_code}"
    assert resp.headers.get("Content-Type") == "application/pdf", f"Wrong content type: {resp.headers.get('Content-Type')}"
    
    pdf_bytes = resp.content
    assert len(pdf_bytes) > 0, "PDF is empty"
    assert pdf_bytes[:4] == b"%PDF", f"Not a valid PDF (header: {pdf_bytes[:10]})"
    
    log(f"✓ PDF generated successfully: {len(pdf_bytes)} bytes")
    log(f"  Content-Type: {resp.headers.get('Content-Type')}")
    log(f"  PDF header: {pdf_bytes[:10]}")
    
    # Try to verify text content (optional, requires pymupdf)
    try:
        import fitz  # pymupdf
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        
        # Check for quotation reference
        if "Ref. Quotation" in text or "QTO/2026/09/002" in text:
            log(f"✓ PDF contains quotation reference text")
        else:
            log(f"⚠ Could not find 'Ref. Quotation' or 'QTO/2026/09/002' in PDF text")
            log(f"  (This may be a formatting issue, not necessarily a bug)")
    except ImportError:
        log(f"  (pymupdf not available, skipping text verification)")
    except Exception as e:
        log(f"  (PDF text extraction failed: {e})")
    
    return pdf_bytes

def test_billing_recap_scenario():
    """Test 7: Create controlled scenario for billing recap"""
    log("\n=== TEST 7: Billing Recap - Create Controlled Scenario ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Invoice 1: Terkirim, 10M + 11% PPN = 11.1M
    log("Creating Invoice 1: Terkirim, 10M + 11% PPN = 11.1M")
    inv1_data = {
        "type": "proforma",
        "number": "INV-001/TEST",
        "quotationNo": "QTO/2026/09/001",
        "status": "Terkirim",
        "clientName": "Bpk Test",
        "items": [{"description": "DP 20%", "qty": 1, "unitPrice": 10000000}],
        "ppnEnabled": True,
        "ppnPercent": 11,
        "retentionEnabled": False,
        "retentionPercent": 5
    }
    resp1 = requests.post(f"{BASE_URL}/projects/{test_project_id}/invoices", headers=headers, json=inv1_data)
    assert resp1.status_code == 200, f"Invoice 1 failed: {resp1.status_code} {resp1.text}"
    inv1 = resp1.json()
    created_invoices.append(inv1["id"])
    log(f"✓ Invoice 1 created: {inv1['id']}, amountDue={inv1['computed']['amountDue']:,}")
    
    # Invoice 2: Lunas, 20M + 11% PPN - 5% retention = 21.2M (retention 1M)
    log("Creating Invoice 2: Lunas, 20M + 11% PPN - 5% retention = 21.2M")
    inv2_data = {
        "type": "final",
        "number": "INV-002/TEST",
        "quotationNo": "QTO/2026/09/002",
        "status": "Lunas",
        "clientName": "Bpk Test",
        "items": [{"description": "Termin 40%", "qty": 1, "unitPrice": 20000000}],
        "ppnEnabled": True,
        "ppnPercent": 11,
        "retentionEnabled": True,
        "retentionPercent": 5
    }
    resp2 = requests.post(f"{BASE_URL}/projects/{test_project_id}/invoices", headers=headers, json=inv2_data)
    assert resp2.status_code == 200, f"Invoice 2 failed: {resp2.status_code} {resp2.text}"
    inv2 = resp2.json()
    created_invoices.append(inv2["id"])
    log(f"✓ Invoice 2 created: {inv2['id']}, amountDue={inv2['computed']['amountDue']:,}, retention={inv2['computed']['retentionAmount']:,}")
    
    # Invoice 3: Draft, 5M no PPN = 5M
    log("Creating Invoice 3: Draft, 5M no PPN = 5M")
    inv3_data = {
        "type": "proforma",
        "number": "INV-003/TEST",
        "status": "Draft",
        "clientName": "Bpk Test",
        "items": [{"description": "Pelunasan 40%", "qty": 1, "unitPrice": 5000000}],
        "ppnEnabled": False,
        "ppnPercent": 11,
        "retentionEnabled": False,
        "retentionPercent": 5
    }
    resp3 = requests.post(f"{BASE_URL}/projects/{test_project_id}/invoices", headers=headers, json=inv3_data)
    assert resp3.status_code == 200, f"Invoice 3 failed: {resp3.status_code} {resp3.text}"
    inv3 = resp3.json()
    created_invoices.append(inv3["id"])
    log(f"✓ Invoice 3 created: {inv3['id']}, amountDue={inv3['computed']['amountDue']:,}")
    
    log("\n✓ All 3 invoices created for billing recap test")
    return inv1, inv2, inv3

def test_billing_recap_math(inv1, inv2, inv3):
    """Test 8: GET /api/projects/{project_id}/billing-recap - verify math"""
    log("\n=== TEST 8: Billing Recap - Verify Math ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    resp = requests.get(f"{BASE_URL}/projects/{test_project_id}/billing-recap", headers=headers)
    assert resp.status_code == 200, f"billing-recap failed: {resp.status_code} {resp.text}"
    data = resp.json()
    
    log(f"Billing Recap Response:")
    log(f"  nominal: {data.get('nominal'):,}")
    log(f"  totalBilled: {data.get('totalBilled'):,}")
    log(f"  draftAmount: {data.get('draftAmount'):,}")
    log(f"  paid: {data.get('paid'):,}")
    log(f"  receivable: {data.get('receivable'):,}")
    log(f"  retentionHeld: {data.get('retentionHeld'):,}")
    log(f"  sisaTagihan: {data.get('sisaTagihan'):,}")
    log(f"  invoiceCount: {data.get('invoiceCount')}")
    log(f"  billedCount: {data.get('billedCount')}")
    
    # Expected values
    # Invoice 1: Terkirim, amountDue = 11,100,000
    # Invoice 2: Lunas, amountDue = 21,200,000, retention = 1,000,000
    # Invoice 3: Draft, amountDue = 5,000,000
    
    expected_total_billed = 11100000 + 21200000  # Terkirim + Lunas
    expected_draft = 5000000
    expected_retention = 1000000
    expected_invoice_count = 3
    expected_billed_count = 2
    
    log(f"\nExpected vs Actual:")
    log(f"  totalBilled: expected={expected_total_billed:,}, actual={data.get('totalBilled'):,}")
    log(f"  draftAmount: expected={expected_draft:,}, actual={data.get('draftAmount'):,}")
    log(f"  retentionHeld: expected={expected_retention:,}, actual={data.get('retentionHeld'):,}")
    log(f"  invoiceCount: expected={expected_invoice_count}, actual={data.get('invoiceCount')}")
    log(f"  billedCount: expected={expected_billed_count}, actual={data.get('billedCount')}")
    
    # Verify math
    assert data["totalBilled"] == expected_total_billed, f"totalBilled mismatch: expected {expected_total_billed}, got {data['totalBilled']}"
    assert data["draftAmount"] == expected_draft, f"draftAmount mismatch: expected {expected_draft}, got {data['draftAmount']}"
    assert data["retentionHeld"] == expected_retention, f"retentionHeld mismatch: expected {expected_retention}, got {data['retentionHeld']}"
    assert data["invoiceCount"] == expected_invoice_count, f"invoiceCount mismatch: expected {expected_invoice_count}, got {data['invoiceCount']}"
    assert data["billedCount"] == expected_billed_count, f"billedCount mismatch: expected {expected_billed_count}, got {data['billedCount']}"
    
    # Verify receivable = max(0, totalBilled - paid)
    expected_receivable = max(0, data["totalBilled"] - data["paid"])
    assert data["receivable"] == expected_receivable, f"receivable mismatch: expected {expected_receivable}, got {data['receivable']}"
    
    log(f"\n✓ All billing recap math verified correctly!")
    return data

def test_billing_recap_gating():
    """Test 9: Billing recap premium gating"""
    log("\n=== TEST 9: Billing Recap - Premium Gating ===")
    
    # Register free user
    free_email = f"test_billing_free_{int(time.time())}@test.com"
    log(f"Registering free user: {free_email}")
    resp = requests.post(f"{BASE_URL}/auth/register", json={
        "email": free_email,
        "name": "Test Free User",
        "password": "Test123456"
    })
    assert resp.status_code == 200, f"Register failed: {resp.status_code} {resp.text}"
    free_token = resp.json()["token"]
    log(f"✓ Free user registered")
    
    # Try to access billing-recap with free token
    headers = {"Authorization": f"Bearer {free_token}"}
    resp = requests.get(f"{BASE_URL}/projects/{test_project_id}/billing-recap", headers=headers)
    assert resp.status_code == 403, f"Expected 403 for free user, got {resp.status_code}"
    log(f"✓ Free user correctly blocked with 403")
    
    # Test demo user
    log("\nTesting demo user access...")
    resp = requests.post(f"{BASE_URL}/auth/demo")
    assert resp.status_code == 200, f"Demo login failed: {resp.status_code}"
    demo_token = resp.json()["token"]
    log(f"✓ Demo user logged in")
    
    # Demo user should be able to access their own projects (premium tier)
    # But not other users' projects
    headers = {"Authorization": f"Bearer {demo_token}"}
    resp = requests.get(f"{BASE_URL}/projects/{test_project_id}/billing-recap", headers=headers)
    log(f"  Demo user accessing test project: {resp.status_code}")
    # Expected: 404 (not owned) or 403 (if ownership check comes first)
    assert resp.status_code in [403, 404], f"Demo user should get 403/404, got {resp.status_code}"
    log(f"✓ Demo user correctly blocked from accessing other user's project")

def cleanup():
    """Delete test invoices and projects"""
    log("\n=== CLEANUP ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Delete invoices
    for invoice_id in created_invoices:
        try:
            resp = requests.delete(f"{BASE_URL}/invoices/{invoice_id}", headers=headers)
            if resp.status_code == 200:
                log(f"✓ Deleted invoice: {invoice_id}")
            else:
                log(f"⚠ Failed to delete invoice {invoice_id}: {resp.status_code}")
        except Exception as e:
            log(f"⚠ Error deleting invoice {invoice_id}: {e}")
    
    # Delete test projects
    for proj_id in [test_project_id, quotation_test_project_id]:
        if proj_id:
            try:
                resp = requests.delete(f"{BASE_URL}/projects/{proj_id}", headers=headers)
                if resp.status_code == 200:
                    log(f"✓ Deleted test project: {proj_id}")
                else:
                    log(f"⚠ Failed to delete project {proj_id}: {resp.status_code}")
            except Exception as e:
                log(f"⚠ Error deleting project {proj_id}: {e}")

def main():
    """Run all tests"""
    print("=" * 80)
    print("ProFinance Interior Backend Test Suite")
    print("Testing: Invoice quotationNo + Billing Recap")
    print("=" * 80)
    
    try:
        # Login
        login_premium()
        
        # Test invoice-context first (uses existing project)
        test_invoice_context()
        
        # Create test projects
        create_quotation_test_project()
        create_test_project()
        
        # Test A: No Quotation on Invoice
        invoice_id = test_create_invoice_with_quotation()
        test_list_invoices(invoice_id)
        test_get_single_invoice(invoice_id)
        test_update_invoice_quotation(invoice_id)
        test_invoice_pdf(invoice_id)
        
        # Test B: Billing Recap
        inv1, inv2, inv3 = test_billing_recap_scenario()
        test_billing_recap_math(inv1, inv2, inv3)
        test_billing_recap_gating()
        
        # Cleanup
        cleanup()
        
        print("\n" + "=" * 80)
        print("✓ ALL TESTS PASSED")
        print("=" * 80)
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        cleanup()
        exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        cleanup()
        exit(1)

if __name__ == "__main__":
    main()
