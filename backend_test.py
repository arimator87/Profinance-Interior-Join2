#!/usr/bin/env python3
"""
Backend test for ProFinance Interior - Promo Expiry + Announcement Theme
Tests the promo countdown expiry and announcement theme backend changes.
"""
import os
import sys
import json
import httpx
from datetime import datetime
from pathlib import Path
from pymongo import MongoClient

# Load environment variables
ROOT_DIR = Path(__file__).parent
sys.path.insert(0, str(ROOT_DIR / "backend"))

# Get configuration from environment
BACKEND_URL = "https://interior-pro-63.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

# Test results
test_results = []

def log_test(test_name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    test_results.append({
        "test": test_name,
        "passed": passed,
        "details": details
    })
    print(f"{status}: {test_name}")
    if details:
        print(f"  Details: {details}")

def get_mongo_client():
    """Get MongoDB client"""
    return MongoClient(MONGO_URL)

def backup_settings():
    """Backup current settings to verify restoration"""
    client = get_mongo_client()
    db = client[DB_NAME]
    settings = db.settings.find_one({"id": "app_settings"}, {"_id": 0})
    client.close()
    return settings

def restore_settings_from_snapshot():
    """Restore settings from snapshot file"""
    snapshot_path = ROOT_DIR / "memory" / "settings_backup.json"
    with open(snapshot_path, 'r') as f:
        snapshot = json.load(f)
    
    client = get_mongo_client()
    db = client[DB_NAME]
    
    # Replace the entire document (except _id)
    db.settings.replace_one(
        {"id": "app_settings"},
        snapshot,
        upsert=True
    )
    client.close()
    return snapshot

def update_settings(updates):
    """Update settings in MongoDB"""
    client = get_mongo_client()
    db = client[DB_NAME]
    db.settings.update_one(
        {"id": "app_settings"},
        {"$set": updates},
        upsert=True
    )
    client.close()

def register_user(email, password="testpass123"):
    """Register a new user"""
    response = httpx.post(
        f"{BACKEND_URL}/auth/register",
        json={
            "email": email,
            "name": "Test User",
            "password": password,
            "phone": ""
        },
        timeout=30
    )
    return response

def get_orders(token):
    """Get user orders"""
    response = httpx.get(
        f"{BACKEND_URL}/subscription/orders",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    return response

def checkout(token, plan):
    """Create checkout"""
    response = httpx.post(
        f"{BACKEND_URL}/subscription/checkout",
        json={"plan": plan},
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    return response

def main():
    print("=" * 80)
    print("ProFinance Interior - Promo Expiry + Announcement Theme Backend Tests")
    print("=" * 80)
    print()
    
    # Load snapshot for comparison
    snapshot_path = ROOT_DIR / "memory" / "settings_backup.json"
    with open(snapshot_path, 'r') as f:
        snapshot = json.load(f)
    
    print(f"Loaded settings snapshot: {json.dumps(snapshot, indent=2)}")
    print()
    
    # TEST 1: GET /api/settings/public (no auth) - verify new fields
    print("\n--- TEST 1: GET /api/settings/public (no auth) ---")
    try:
        response = httpx.get(f"{BACKEND_URL}/settings/public", timeout=30)
        if response.status_code == 200:
            data = response.json()
            required_fields = ["promoEndsAt", "announcementTheme", "serverNow"]
            legacy_fields = ["announcement", "monthlyPrice", "monthlyPromo", "yearlyPrice", "yearlyPromo", "promoActive"]
            
            missing_fields = [f for f in required_fields if f not in data]
            missing_legacy = [f for f in legacy_fields if f not in data]
            
            if not missing_fields and not missing_legacy:
                # Verify serverNow is a valid ISO timestamp
                try:
                    datetime.fromisoformat(data["serverNow"].replace("Z", "+00:00"))
                    log_test(
                        "GET /api/settings/public includes all required fields",
                        True,
                        f"Status: {response.status_code}, Fields: promoEndsAt={data.get('promoEndsAt')}, announcementTheme={data.get('announcementTheme')}, serverNow={data.get('serverNow')}, announcement={data.get('announcement')}, monthlyPrice={data.get('monthlyPrice')}"
                    )
                except Exception as e:
                    log_test(
                        "GET /api/settings/public includes all required fields",
                        False,
                        f"serverNow is not a valid ISO timestamp: {data.get('serverNow')}, error: {e}"
                    )
            else:
                log_test(
                    "GET /api/settings/public includes all required fields",
                    False,
                    f"Missing fields: {missing_fields + missing_legacy}"
                )
        else:
            log_test(
                "GET /api/settings/public includes all required fields",
                False,
                f"Status: {response.status_code}, Body: {response.text}"
            )
    except Exception as e:
        log_test("GET /api/settings/public includes all required fields", False, f"Exception: {e}")
    
    # TEST 2: EXPIRED PROMO - Update settings with past date
    print("\n--- TEST 2: EXPIRED PROMO (past promoEndsAt) ---")
    try:
        # Update settings with expired promo
        update_settings({
            "promoActive": True,
            "monthlyPrice": 350000,
            "monthlyPromo": 149000,
            "promoEndsAt": "2020-01-01T00:00:00+00:00"
        })
        print("Updated settings: promoActive=True, monthlyPrice=350000, monthlyPromo=149000, promoEndsAt=2020-01-01T00:00:00+00:00")
        
        # Register a new user
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        test_email = f"test_promo_expired_{timestamp}@test.com"
        reg_response = register_user(test_email)
        
        if reg_response.status_code == 200:
            token = reg_response.json()["token"]
            print(f"Registered user: {test_email}")
            
            # Checkout monthly plan
            checkout_response = checkout(token, "monthly")
            print(f"Checkout response: {checkout_response.status_code}")
            
            # Accept both 200 (success) and 502 (Midtrans external error)
            if checkout_response.status_code in [200, 502]:
                # Get orders to verify gross_amount
                orders_response = get_orders(token)
                if orders_response.status_code == 200:
                    orders = orders_response.json()
                    # Find the latest monthly order
                    monthly_orders = [o for o in orders if o.get("plan") == "monthly"]
                    if monthly_orders:
                        latest_order = monthly_orders[0]  # Already sorted by created_at desc
                        gross_amount = latest_order.get("gross_amount")
                        
                        if gross_amount == 350000:
                            log_test(
                                "Expired promo uses base price (350000)",
                                True,
                                f"Order {latest_order.get('order_id')}: gross_amount={gross_amount} (expected 350000 for expired promo)"
                            )
                        else:
                            log_test(
                                "Expired promo uses base price (350000)",
                                False,
                                f"Order {latest_order.get('order_id')}: gross_amount={gross_amount}, expected 350000"
                            )
                    else:
                        log_test("Expired promo uses base price (350000)", False, "No monthly orders found")
                else:
                    log_test("Expired promo uses base price (350000)", False, f"Failed to get orders: {orders_response.status_code}")
            elif checkout_response.status_code == 500:
                log_test("Expired promo uses base price (350000)", False, f"Backend returned 500 error: {checkout_response.text}")
            else:
                log_test("Expired promo uses base price (350000)", False, f"Checkout failed with status {checkout_response.status_code}: {checkout_response.text}")
        else:
            log_test("Expired promo uses base price (350000)", False, f"Failed to register user: {reg_response.status_code}")
    except Exception as e:
        log_test("Expired promo uses base price (350000)", False, f"Exception: {e}")
    
    # TEST 3: LIVE PROMO - Update settings with future date
    print("\n--- TEST 3: LIVE PROMO (future promoEndsAt) ---")
    try:
        # Update settings with live promo
        update_settings({
            "promoActive": True,
            "monthlyPrice": 350000,
            "monthlyPromo": 149000,
            "promoEndsAt": "2099-12-31T23:59:59+00:00"
        })
        print("Updated settings: promoActive=True, monthlyPrice=350000, monthlyPromo=149000, promoEndsAt=2099-12-31T23:59:59+00:00")
        
        # Use the same user from TEST 2
        if 'token' in locals():
            # Checkout monthly plan again
            checkout_response = checkout(token, "monthly")
            print(f"Checkout response: {checkout_response.status_code}")
            
            # Accept both 200 (success) and 502 (Midtrans external error)
            if checkout_response.status_code in [200, 502]:
                # Get orders to verify gross_amount
                orders_response = get_orders(token)
                if orders_response.status_code == 200:
                    orders = orders_response.json()
                    # Find the latest monthly order (should be the second one)
                    monthly_orders = [o for o in orders if o.get("plan") == "monthly"]
                    if len(monthly_orders) >= 2:
                        latest_order = monthly_orders[0]  # First in list (most recent)
                        gross_amount = latest_order.get("gross_amount")
                        
                        if gross_amount == 149000:
                            log_test(
                                "Live promo uses promo price (149000)",
                                True,
                                f"Order {latest_order.get('order_id')}: gross_amount={gross_amount} (expected 149000 for live promo)"
                            )
                        else:
                            log_test(
                                "Live promo uses promo price (149000)",
                                False,
                                f"Order {latest_order.get('order_id')}: gross_amount={gross_amount}, expected 149000"
                            )
                    else:
                        log_test("Live promo uses promo price (149000)", False, f"Expected 2 monthly orders, found {len(monthly_orders)}")
                else:
                    log_test("Live promo uses promo price (149000)", False, f"Failed to get orders: {orders_response.status_code}")
            elif checkout_response.status_code == 500:
                log_test("Live promo uses promo price (149000)", False, f"Backend returned 500 error: {checkout_response.text}")
            else:
                log_test("Live promo uses promo price (149000)", False, f"Checkout failed with status {checkout_response.status_code}: {checkout_response.text}")
        else:
            log_test("Live promo uses promo price (149000)", False, "No token available from TEST 2")
    except Exception as e:
        log_test("Live promo uses promo price (149000)", False, f"Exception: {e}")
    
    # TEST 4: RESTORE SETTINGS from snapshot
    print("\n--- TEST 4: RESTORE SETTINGS from snapshot ---")
    try:
        # Restore settings from snapshot
        restored = restore_settings_from_snapshot()
        print(f"Restored settings from snapshot: {json.dumps(restored, indent=2)}")
        
        # Verify restoration by getting public settings
        response = httpx.get(f"{BACKEND_URL}/settings/public", timeout=30)
        if response.status_code == 200:
            data = response.json()
            
            # Check that all snapshot fields match
            mismatches = []
            for key, value in snapshot.items():
                if key == "id":
                    continue  # Skip id field
                if data.get(key) != value:
                    mismatches.append(f"{key}: got {data.get(key)}, expected {value}")
            
            # Check that promoEndsAt is empty or not present (as in snapshot)
            if "promoEndsAt" in snapshot:
                # If snapshot has promoEndsAt, it should match
                if data.get("promoEndsAt") != snapshot["promoEndsAt"]:
                    mismatches.append(f"promoEndsAt: got {data.get('promoEndsAt')}, expected {snapshot['promoEndsAt']}")
            else:
                # If snapshot doesn't have promoEndsAt, the restored value should be empty or default
                promo_ends = data.get("promoEndsAt", "")
                if promo_ends and promo_ends != "":
                    mismatches.append(f"promoEndsAt: got {promo_ends}, expected empty/absent (snapshot has no promoEndsAt)")
            
            if not mismatches:
                log_test(
                    "Settings restored from snapshot",
                    True,
                    f"All fields match snapshot. announcement={data.get('announcement')}, monthlyPrice={data.get('monthlyPrice')}, monthlyPromo={data.get('monthlyPromo')}, yearlyPrice={data.get('yearlyPrice')}, yearlyPromo={data.get('yearlyPromo')}, promoActive={data.get('promoActive')}, promoEndsAt={data.get('promoEndsAt')}"
                )
            else:
                log_test(
                    "Settings restored from snapshot",
                    False,
                    f"Mismatches: {', '.join(mismatches)}"
                )
        else:
            log_test("Settings restored from snapshot", False, f"Failed to get public settings: {response.status_code}")
    except Exception as e:
        log_test("Settings restored from snapshot", False, f"Exception: {e}")
    
    # Print summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for r in test_results if r["passed"])
    total = len(test_results)
    
    for result in test_results:
        status = "✅ PASS" if result["passed"] else "❌ FAIL"
        print(f"{status}: {result['test']}")
        if result["details"]:
            print(f"  {result['details']}")
    
    print()
    print(f"Total: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
