#!/usr/bin/env python3
"""
Backend test for ProFinance Interior - Retention from Contract Value & Overdue Tracking
Tests the NEW retention calculation (from nominal) and overdue invoice tracking in billing-recap.
"""
import requests
import json
from datetime import datetime, timedelta

# Base URL for the API
BASE_URL = "https://interior-join.preview.emergentagent.com/api"

# Test credentials (premium account)
EMAIL = "furnitrue.mail@gmail.com"
PASSWORD = "Password123"

# Global token storage
token = None
test_project_id = None
test_invoices = []


def log(msg):
    """Print timestamped log message."""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def login():
    """Login and get bearer token."""
    global token
    log("=== LOGIN ===")
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    data = resp.json()
    token = data.get("token")
    assert token, "No token in login response"
    log(f"✓ Login successful, token: {token[:20]}...")
    return token


def headers():
    """Return authorization headers."""
    return {"Authorization": f"Bearer {token}"}


def create_test_project():
    """Create a controlled test project with known nominal."""
    global test_project_id
    log("\n=== CREATE TEST PROJECT ===")
    
    project_data = {
        "name": "Uji Retensi",
        "nominal": 100000000,  # 100 million - known contract value
        "category": "Residensial",
        "owner": "Bpk Uji"
    }
    
    resp = requests.post(f"{BASE_URL}/projects", json=project_data, headers=headers())
    assert resp.status_code == 200, f"Create project failed: {resp.status_code} {resp.text}"
    
    data = resp.json()
    test_project_id = data.get("id")
    assert test_project_id, "No project id in response"
    
    log(f"✓ Created test project: {test_project_id}")
    log(f"  Name: {data.get('name')}")
    log(f"  Nominal (Contract Value): Rp {data.get('nominal'):,}")
    
    # Verify the nominal is stored correctly
    resp = requests.get(f"{BASE_URL}/projects/{test_project_id}", headers=headers())
    assert resp.status_code == 200, f"Get project failed: {resp.status_code}"
    project = resp.json()
    actual_nominal = project.get("nominal")
    log(f"  Verified nominal from GET: Rp {actual_nominal:,}")
    assert actual_nominal == 100000000, f"Nominal mismatch: expected 100000000, got {actual_nominal}"
    
    return test_project_id, actual_nominal


def test_retention_from_contract_value(project_id, nominal):
    """
    Test (A): Retention calculation from contract value (nominal), NOT from invoice subtotal.
    """
    log("\n=== TEST (A): RETENTION FROM CONTRACT VALUE ===")
    
    # Test 1: Create final invoice with retention 5%
    log("\n--- Test A.1: Create invoice with 5% retention ---")
    invoice_data = {
        "type": "final",
        "number": "RET/001",
        "status": "Terkirim",
        "clientName": "Bpk Uji",
        "clientAddress": "Jakarta",
        "clientPhone": "08123456789",
        "items": [
            {
                "description": "Pelunasan",
                "qty": 1,
                "unitPrice": 20000000  # 20 million subtotal
            }
        ],
        "ppnEnabled": True,
        "ppnPercent": 11,
        "retentionEnabled": True,
        "retentionPercent": 5,
        "companyName": "CV Test",
        "bankName": "BCA",
        "bankAccount": "1234567890",
        "bankHolder": "CV Test"
    }
    
    resp = requests.post(f"{BASE_URL}/projects/{project_id}/invoices", json=invoice_data, headers=headers())
    assert resp.status_code == 200, f"Create invoice failed: {resp.status_code} {resp.text}"
    
    invoice = resp.json()
    invoice_id = invoice.get("id")
    test_invoices.append(invoice_id)
    
    log(f"✓ Created invoice: {invoice.get('number')} (id: {invoice_id})")
    
    # Verify computed values
    computed = invoice.get("computed", {})
    subtotal = computed.get("subtotal")
    ppn_amount = computed.get("ppnAmount")
    gross_total = computed.get("grossTotal")
    retention_amount = computed.get("retentionAmount")
    retention_base = computed.get("retentionBase")
    amount_due = computed.get("amountDue")
    
    log(f"  Subtotal: Rp {subtotal:,}")
    log(f"  PPN (11%): Rp {ppn_amount:,}")
    log(f"  Gross Total: Rp {gross_total:,}")
    log(f"  Retention Base: Rp {retention_base:,}")
    log(f"  Retention Amount (5%): Rp {retention_amount:,}")
    log(f"  Amount Due: Rp {amount_due:,}")
    
    # CRITICAL VERIFICATION: Retention should be from NOMINAL (100M), NOT subtotal (20M)
    expected_retention = round(nominal * 5 / 100)  # 5% of 100M = 5M
    wrong_retention = round(subtotal * 5 / 100)    # 5% of 20M = 1M (OLD WAY)
    
    assert subtotal == 20000000, f"Subtotal mismatch: expected 20000000, got {subtotal}"
    assert ppn_amount == 2200000, f"PPN mismatch: expected 2200000 (11% of 20M), got {ppn_amount}"
    assert gross_total == 22200000, f"Gross total mismatch: expected 22200000, got {gross_total}"
    
    log(f"\n  CRITICAL CHECK:")
    log(f"  Expected retention (5% of nominal 100M): Rp {expected_retention:,}")
    log(f"  Wrong retention (5% of subtotal 20M): Rp {wrong_retention:,}")
    log(f"  Actual retention: Rp {retention_amount:,}")
    
    assert retention_base == nominal, f"Retention base should be nominal ({nominal}), got {retention_base}"
    assert retention_amount == expected_retention, f"Retention should be {expected_retention} (5% of nominal), got {retention_amount}"
    assert retention_amount != wrong_retention, f"Retention should NOT be {wrong_retention} (5% of subtotal)"
    
    expected_amount_due = gross_total - expected_retention  # 22.2M - 5M = 17.2M
    assert amount_due == expected_amount_due, f"Amount due mismatch: expected {expected_amount_due}, got {amount_due}"
    
    log(f"  ✓ PASS: Retention correctly calculated from contract value (nominal)")
    log(f"  ✓ PASS: retentionBase = {retention_base:,} (equals nominal)")
    log(f"  ✓ PASS: retentionAmount = {retention_amount:,} (5% of nominal)")
    log(f"  ✓ PASS: amountDue = {amount_due:,} (gross - retention)")
    
    # Test 2: GET invoice and verify retention persists
    log("\n--- Test A.2: GET invoice and verify retention ---")
    resp = requests.get(f"{BASE_URL}/invoices/{invoice_id}", headers=headers())
    assert resp.status_code == 200, f"Get invoice failed: {resp.status_code}"
    
    invoice = resp.json()
    computed = invoice.get("computed", {})
    retention_amount_get = computed.get("retentionAmount")
    retention_base_get = computed.get("retentionBase")
    
    log(f"  Retention Amount: Rp {retention_amount_get:,}")
    log(f"  Retention Base: Rp {retention_base_get:,}")
    
    assert retention_amount_get == expected_retention, f"Retention amount mismatch on GET"
    assert retention_base_get == nominal, f"Retention base mismatch on GET"
    log(f"  ✓ PASS: Retention values persist correctly")
    
    # Test 3: Update retention percent to 10%
    log("\n--- Test A.3: Update retention percent to 10% ---")
    invoice_data["retentionPercent"] = 10
    
    resp = requests.put(f"{BASE_URL}/invoices/{invoice_id}", json=invoice_data, headers=headers())
    assert resp.status_code == 200, f"Update invoice failed: {resp.status_code} {resp.text}"
    
    invoice = resp.json()
    computed = invoice.get("computed", {})
    retention_amount_updated = computed.get("retentionAmount")
    retention_base_updated = computed.get("retentionBase")
    amount_due_updated = computed.get("amountDue")
    
    expected_retention_10 = round(nominal * 10 / 100)  # 10% of 100M = 10M
    expected_amount_due_10 = gross_total - expected_retention_10  # 22.2M - 10M = 12.2M
    
    log(f"  New Retention Amount (10%): Rp {retention_amount_updated:,}")
    log(f"  Expected: Rp {expected_retention_10:,}")
    log(f"  Retention Base: Rp {retention_base_updated:,}")
    log(f"  Amount Due: Rp {amount_due_updated:,}")
    
    assert retention_amount_updated == expected_retention_10, f"Updated retention mismatch: expected {expected_retention_10}, got {retention_amount_updated}"
    assert retention_base_updated == nominal, f"Retention base should still be nominal"
    assert amount_due_updated == expected_amount_due_10, f"Updated amount due mismatch"
    
    log(f"  ✓ PASS: Retention recalculated correctly to 10% of nominal")
    log(f"  ✓ PASS: retentionAmount = {retention_amount_updated:,}")
    log(f"  ✓ PASS: amountDue = {amount_due_updated:,}")
    
    # Test 4: Invoice PDF generation
    log("\n--- Test A.4: Invoice PDF generation ---")
    resp = requests.get(f"{BASE_URL}/invoices/{invoice_id}/pdf?auth={token}", headers=headers())
    assert resp.status_code == 200, f"PDF generation failed: {resp.status_code}"
    assert resp.headers.get("Content-Type") == "application/pdf", f"Wrong content type: {resp.headers.get('Content-Type')}"
    
    pdf_bytes = resp.content
    assert pdf_bytes[:4] == b"%PDF", "PDF does not start with %PDF magic bytes"
    
    log(f"  ✓ PASS: PDF generated successfully ({len(pdf_bytes)} bytes)")
    
    # Try to verify "dari Nilai Kontrak" text in PDF (if pymupdf available)
    try:
        import fitz  # pymupdf
        pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = ""
        for page in pdf_doc:
            text += page.get_text()
        pdf_doc.close()
        
        if "dari Nilai Kontrak" in text or "Nilai Kontrak" in text:
            log(f"  ✓ PASS: PDF contains 'dari Nilai Kontrak' text")
        else:
            log(f"  ⚠ WARNING: Could not find 'dari Nilai Kontrak' in PDF text")
            log(f"    (This may be a formatting issue, not a critical failure)")
    except ImportError:
        log(f"  ⚠ pymupdf not available, skipping PDF text verification")
    except Exception as e:
        log(f"  ⚠ PDF text extraction failed: {e}")
    
    return invoice_id


def test_overdue_tracking(project_id):
    """
    Test (B): Overdue invoice tracking in billing-recap endpoint.
    """
    log("\n=== TEST (B): OVERDUE INVOICE TRACKING ===")
    
    # Create test invoices with different due dates and statuses
    today = datetime.now().date()
    past_date = (today - timedelta(days=365)).isoformat()  # 2024-01-01 equivalent
    future_date = "2099-12-31"
    
    log(f"\n  Today: {today.isoformat()}")
    log(f"  Past date: {past_date}")
    log(f"  Future date: {future_date}")
    
    # Invoice X: Terkirim, past due date (SHOULD BE OVERDUE)
    log("\n--- Test B.1: Create Invoice X (Terkirim, past due date) ---")
    invoice_x_data = {
        "type": "final",
        "number": "INV-X/001",
        "status": "Terkirim",
        "dueDate": past_date,
        "clientName": "Klien X",
        "clientAddress": "Jakarta",
        "clientPhone": "08123456789",
        "items": [{"description": "Item X", "qty": 1, "unitPrice": 3000000}],
        "ppnEnabled": False,
        "retentionEnabled": False,
        "companyName": "CV Test",
        "bankName": "BCA",
        "bankAccount": "1234567890",
        "bankHolder": "CV Test"
    }
    
    resp = requests.post(f"{BASE_URL}/projects/{project_id}/invoices", json=invoice_x_data, headers=headers())
    assert resp.status_code == 200, f"Create invoice X failed: {resp.status_code} {resp.text}"
    invoice_x = resp.json()
    invoice_x_id = invoice_x.get("id")
    test_invoices.append(invoice_x_id)
    log(f"  ✓ Created Invoice X: {invoice_x.get('number')} (id: {invoice_x_id})")
    log(f"    Status: {invoice_x.get('status')}, Due: {invoice_x.get('dueDate')}")
    log(f"    Amount Due: Rp {invoice_x.get('computed', {}).get('amountDue'):,}")
    
    # Invoice Y: Terkirim, future due date (NOT OVERDUE)
    log("\n--- Test B.2: Create Invoice Y (Terkirim, future due date) ---")
    invoice_y_data = {
        "type": "final",
        "number": "INV-Y/001",
        "status": "Terkirim",
        "dueDate": future_date,
        "clientName": "Klien Y",
        "clientAddress": "Jakarta",
        "clientPhone": "08123456789",
        "items": [{"description": "Item Y", "qty": 1, "unitPrice": 4000000}],
        "ppnEnabled": False,
        "retentionEnabled": False,
        "companyName": "CV Test",
        "bankName": "BCA",
        "bankAccount": "1234567890",
        "bankHolder": "CV Test"
    }
    
    resp = requests.post(f"{BASE_URL}/projects/{project_id}/invoices", json=invoice_y_data, headers=headers())
    assert resp.status_code == 200, f"Create invoice Y failed: {resp.status_code} {resp.text}"
    invoice_y = resp.json()
    invoice_y_id = invoice_y.get("id")
    test_invoices.append(invoice_y_id)
    log(f"  ✓ Created Invoice Y: {invoice_y.get('number')} (id: {invoice_y_id})")
    log(f"    Status: {invoice_y.get('status')}, Due: {invoice_y.get('dueDate')}")
    log(f"    Amount Due: Rp {invoice_y.get('computed', {}).get('amountDue'):,}")
    
    # Invoice Z: Lunas, past due date (NOT OVERDUE - already paid)
    log("\n--- Test B.3: Create Invoice Z (Lunas, past due date) ---")
    invoice_z_data = {
        "type": "final",
        "number": "INV-Z/001",
        "status": "Lunas",
        "dueDate": past_date,
        "clientName": "Klien Z",
        "clientAddress": "Jakarta",
        "clientPhone": "08123456789",
        "items": [{"description": "Item Z", "qty": 1, "unitPrice": 2000000}],
        "ppnEnabled": False,
        "retentionEnabled": False,
        "companyName": "CV Test",
        "bankName": "BCA",
        "bankAccount": "1234567890",
        "bankHolder": "CV Test"
    }
    
    resp = requests.post(f"{BASE_URL}/projects/{project_id}/invoices", json=invoice_z_data, headers=headers())
    assert resp.status_code == 200, f"Create invoice Z failed: {resp.status_code} {resp.text}"
    invoice_z = resp.json()
    invoice_z_id = invoice_z.get("id")
    test_invoices.append(invoice_z_id)
    log(f"  ✓ Created Invoice Z: {invoice_z.get('number')} (id: {invoice_z_id})")
    log(f"    Status: {invoice_z.get('status')}, Due: {invoice_z.get('dueDate')}")
    log(f"    Amount Due: Rp {invoice_z.get('computed', {}).get('amountDue'):,}")
    
    # Test billing-recap endpoint
    log("\n--- Test B.4: GET billing-recap and verify overdue tracking ---")
    resp = requests.get(f"{BASE_URL}/projects/{project_id}/billing-recap", headers=headers())
    assert resp.status_code == 200, f"Billing recap failed: {resp.status_code} {resp.text}"
    
    recap = resp.json()
    
    log(f"\n  Billing Recap Response:")
    log(f"  - nominal: Rp {recap.get('nominal', 0):,}")
    log(f"  - totalBilled: Rp {recap.get('totalBilled', 0):,}")
    log(f"  - draftAmount: Rp {recap.get('draftAmount', 0):,}")
    log(f"  - paid: Rp {recap.get('paid', 0):,}")
    log(f"  - receivable: Rp {recap.get('receivable', 0):,}")
    log(f"  - retentionHeld: Rp {recap.get('retentionHeld', 0):,}")
    log(f"  - invoiceCount: {recap.get('invoiceCount', 0)}")
    log(f"  - billedCount: {recap.get('billedCount', 0)}")
    log(f"  - overdueCount: {recap.get('overdueCount', 0)}")
    log(f"  - overdueAmount: Rp {recap.get('overdueAmount', 0):,}")
    
    # Verify overdue fields exist
    assert "overdueCount" in recap, "overdueCount field missing in billing-recap"
    assert "overdueAmount" in recap, "overdueAmount field missing in billing-recap"
    
    overdue_count = recap.get("overdueCount")
    overdue_amount = recap.get("overdueAmount")
    
    log(f"\n  CRITICAL CHECK:")
    log(f"  Expected overdueCount: 1 (only Invoice X)")
    log(f"  Actual overdueCount: {overdue_count}")
    log(f"  Expected overdueAmount: Rp 3,000,000 (Invoice X amount)")
    log(f"  Actual overdueAmount: Rp {overdue_amount:,}")
    
    # Verify overdue logic:
    # - Invoice X: Terkirim + past due = OVERDUE ✓
    # - Invoice Y: Terkirim + future due = NOT overdue
    # - Invoice Z: Lunas + past due = NOT overdue (already paid)
    # - Invoice RET/001: no dueDate = NOT overdue
    
    assert overdue_count == 1, f"Expected overdueCount=1 (only Invoice X), got {overdue_count}"
    assert overdue_amount == 3000000, f"Expected overdueAmount=3000000 (Invoice X), got {overdue_amount}"
    
    log(f"  ✓ PASS: overdueCount = {overdue_count} (correct)")
    log(f"  ✓ PASS: overdueAmount = Rp {overdue_amount:,} (correct)")
    
    # Verify other fields still exist
    assert "totalBilled" in recap, "totalBilled field missing"
    assert "draftAmount" in recap, "draftAmount field missing"
    assert "paid" in recap, "paid field missing"
    assert "receivable" in recap, "receivable field missing"
    assert "retentionHeld" in recap, "retentionHeld field missing"
    assert "invoiceCount" in recap, "invoiceCount field missing"
    assert "billedCount" in recap, "billedCount field missing"
    
    log(f"  ✓ PASS: All legacy fields present in billing-recap")


def cleanup():
    """Delete all test invoices and project."""
    log("\n=== CLEANUP ===")
    
    # Delete invoices
    for invoice_id in test_invoices:
        try:
            resp = requests.delete(f"{BASE_URL}/invoices/{invoice_id}", headers=headers())
            if resp.status_code == 200:
                log(f"  ✓ Deleted invoice: {invoice_id}")
            else:
                log(f"  ⚠ Failed to delete invoice {invoice_id}: {resp.status_code}")
        except Exception as e:
            log(f"  ⚠ Error deleting invoice {invoice_id}: {e}")
    
    # Delete project
    if test_project_id:
        try:
            resp = requests.delete(f"{BASE_URL}/projects/{test_project_id}", headers=headers())
            if resp.status_code == 200:
                log(f"  ✓ Deleted project: {test_project_id}")
            else:
                log(f"  ⚠ Failed to delete project {test_project_id}: {resp.status_code}")
        except Exception as e:
            log(f"  ⚠ Error deleting project {test_project_id}: {e}")


def main():
    """Main test execution."""
    log("=" * 80)
    log("BACKEND TEST: Retention from Contract Value & Overdue Tracking")
    log("ProFinance Interior - FastAPI Backend")
    log("=" * 80)
    
    try:
        # Login
        login()
        
        # Create test project
        project_id, nominal = create_test_project()
        
        # Test (A): Retention from contract value
        test_retention_from_contract_value(project_id, nominal)
        
        # Test (B): Overdue tracking
        test_overdue_tracking(project_id)
        
        # Cleanup
        cleanup()
        
        log("\n" + "=" * 80)
        log("✓ ALL TESTS PASSED")
        log("=" * 80)
        
    except AssertionError as e:
        log(f"\n❌ TEST FAILED: {e}")
        log("\nAttempting cleanup...")
        cleanup()
        raise
    except Exception as e:
        log(f"\n❌ UNEXPECTED ERROR: {e}")
        log("\nAttempting cleanup...")
        cleanup()
        raise


if __name__ == "__main__":
    main()
