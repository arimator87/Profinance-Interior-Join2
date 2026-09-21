#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Tambahkan fitur Backup Data Otomatis: ekspor cadangan data proyek (termasuk foto) agar bisa diunduh ke perangkat dan disimpan ke Google Drive. Fase 1: backup unduh ke perangkat (ZIP berisi data.json + data.xlsx + folder foto)."

backend:
  - task: "Backup export endpoints (/api/backup/summary & /api/backup/export)"
    implemented: true
    working: true
    file: "backend/backup.py, backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "New module backup.py gathers all user data (projects, transactions, workers, work_items, sub_items, progress_entries, files, orders) and builds a ZIP with data.json, data.xlsx (openpyxl, per-sheet) and photos/ folder (fetched from Emergent Object Storage via get_object). /api/backup/summary returns counts; /api/backup/export streams the ZIP (FileResponse + BackgroundTask cleanup, assembled in threadpool). Both require auth (Bearer/cookie). Demo user (read-only) should be ALLOWED since these are GET requests. Test: (1) unauth -> 401; (2) authenticated summary returns integer counts; (3) export returns application/zip with non-empty body and valid zip containing data.json+data.xlsx; (4) demo account can also export."
        -working: true
        -agent: "testing"
        -comment: "✅ ALL TESTS PASSED. Test results: (1) Unauthenticated GET /api/backup/summary correctly returns 401. (2) Authenticated GET /api/backup/summary returns 200 with valid JSON containing integer fields: projects=3, transactions=20, workers=5, work_items=8, progress_entries=11, photos=0. (3) Authenticated GET /api/backup/export returns 200 with Content-Type: application/zip, valid ZIP file (14029 bytes) containing data.json (20205 bytes, valid JSON with all collections), data.xlsx (10452 bytes, valid Excel with 5 sheets: Proyek, Transaksi, Tukang, Item Pekerjaan, Progress Lapangan), and manifest.json (357 bytes, valid JSON with counts and metadata). (4) Demo account (read-only, premium) successfully exports backup without being blocked. Note: photos=0 is CORRECT behavior - demo seed uses external URLs (Unsplash/Pexels) which are intentionally excluded from backup per design (backup.py line 62: skip URLs starting with 'http'). Only photos stored in Emergent Object Storage are included in backup. All data collections are properly exported and can be used for restore."

metadata:
  created_by: "main_agent"
  version: "1.5"
  test_sequence: 5
  run_ui: false

test_plan:
  current_focus:
    - "Promo countdown expiry + announcement theme"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

backend_promo2:
  - task: "Promo countdown expiry + announcement theme"
    implemented: true
    working: true
    file: "backend/server.py"
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Settings add promoEndsAt (ISO, empty=no expiry) + announcementTheme (info/promo/warning, pydantic Literal validated). _promo_active() treats promo as off once now>promoEndsAt; checkout uses _promo_active so expired promo charges base price. /api/settings/public adds promoEndsAt, announcementTheme, serverNow. Frontend: countdown timer on Pricing (server-offset corrected), theme-colored announcement banner in Header, theme picker + promo end datetime input in AdminSettings."
        -working: true
        -agent: "testing"
        -comment: "✅ ALL TESTS PASSED (4/4). Test results: (1) GET /api/settings/public (no auth) -> 200, includes all required fields: promoEndsAt='', announcementTheme='info', serverNow='2026-09-21T12:18:51.806728+00:00' (valid ISO timestamp), plus legacy fields (announcement='Promo Launching WEB ProFinance Interior 50%', monthlyPrice=350000, monthlyPromo=149000, yearlyPrice=4200000, yearlyPromo=1590000, promoActive=true). (2) EXPIRED PROMO: Updated db.settings with promoActive=true, monthlyPrice=350000, monthlyPromo=149000, promoEndsAt='2020-01-01T00:00:00+00:00' (past date). Registered user test_promo_expired_20260921121851@test.com, POST /api/subscription/checkout {plan:'monthly'} -> 200 (Midtrans accepted). GET /api/subscription/orders -> latest monthly order gross_amount=350000 (CORRECT: expired promo falls back to base price). (3) LIVE PROMO: Updated promoEndsAt='2099-12-31T23:59:59+00:00' (future date). Same user checkout monthly again -> 200. GET /api/subscription/orders -> NEW monthly order gross_amount=149000 (CORRECT: live promo uses promo price). (4) RESTORE: Restored db.settings from /app/memory/settings_backup.json (full replace). GET /api/settings/public confirmed all fields match snapshot: announcement='Promo Launching WEB ProFinance Interior 50%', monthlyPrice=350000, monthlyPromo=149000, yearlyPrice=4200000, yearlyPromo=1590000, promoActive=true, promoEndsAt='' (empty as in snapshot - snapshot has no promoEndsAt field). Settings successfully restored. No 500 errors, backend logs clean. Promo expiry logic working perfectly."

backend_pricing:
  - task: "Admin pricing/promo settings + public + checkout amount"
    implemented: true
    working: true
    file: "backend/server.py"
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Added settings fields monthlyPrice/monthlyPromo/yearlyPrice/yearlyPromo/promoActive (defaults 149000/149000/1290000/1290000/false). GET/PUT /api/admin/settings (admin-only) accept them. GET /api/settings/public exposes them. Checkout computes gross_amount from settings: effective=promo if(promoActive and 0<promo<base) else base; fallback base if<=0. Announcement banner rendered in Header (frontend)."
        -working: true
        -agent: "testing"
        -comment: "✅ ALL TESTS PASSED. Test results: (1) GET /api/settings/public (no auth) returns 200 with all required fields: monthlyPrice=149000, monthlyPromo=149000, yearlyPrice=1290000, yearlyPromo=1290000, promoActive=false. Also returns appName='ProFinance Interior' and announcement='' (legacy fields preserved). All defaults match specification. (2) Admin guard GET: Registered normal user test_pricing_20260921_115856@test.com, attempted GET /api/admin/settings with Bearer token -> correctly returns 403 (Akses khusus admin). (3) Admin guard PUT: Same normal user attempted PUT /api/admin/settings with body {promoActive:true} -> correctly returns 403. (4) Checkout amount derivation: Using normal user token, POST /api/subscription/checkout {plan:'monthly'} -> 200 with Midtrans token (order_id: PF-user_4de9949-d74350b89a). POST /api/subscription/checkout {plan:'yearly'} -> 200 with Midtrans token (order_id: PF-user_4de9949-1a32348570). GET /api/subscription/orders returned 2 orders with correct gross_amount: monthly=149000, yearly=1290000 (amounts correctly derived from settings defaults). No 500 errors or backend crashes. Backend logs clean (no tracebacks). All 4 test cases passed."

backend_new:
  - task: "Per-project backup export (/api/projects/{id}/backup/export)"
    implemented: true
    working: true
    file: "backend/backup.py, backend/server.py"
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET, auth required, verifies project ownership. Returns application/zip scoped to ONE project (data.json + data.xlsx + photos/ of that project only). Demo (GET) allowed."
        -working: true
        -agent: "testing"
        -comment: "✅ PASSED. Test flow: (1) Registered new user test_backup_20260921_113536@test.com, got token. (2) Created project 'Backup Test Proyek' (id: f7512be3-82ed-490e-ad62-8fd48933a6d6) with nominal 100M. (3) Added transaction (type=in, amount=5M, category=Termin). (4) GET /api/projects/{id}/backup/export returned 200, Content-Type: application/zip, 7820 bytes. (5) ZIP verified: contains data.json (1248 bytes), data.xlsx (7687 bytes), manifest.json (379 bytes). (6) data.json contains exactly 1 project with correct id. All fields validated. Export working perfectly."
  - task: "Restore from ZIP (/api/backup/restore)"
    implemented: true
    working: true
    file: "backend/backup.py, backend/server.py"
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "POST multipart file. Parses data.json, re-uploads photos to Object Storage (remaps paths), restores projects whose id does NOT already exist for the user (skips existing), plus their transactions/workers/work_items/sub_items/progress_entries. Returns counts. Demo blocked (POST->403)."
        -working: true
        -agent: "testing"
        -comment: "✅ PASSED. Complete restore flow tested: (1) Exported project ZIP (7820 bytes). (2) Deleted project via DELETE /api/projects/{id} -> 200. (3) Verified project removed from GET /api/projects. (4) POST /api/backup/restore with multipart file -> 200, returned {restored_projects:1, restored_transactions:1, photos_restored:0, skipped_projects:0}. (5) Verified project reappeared in GET /api/projects with correct name 'Backup Test Proyek'. (6) Verified transaction restored via GET /api/projects/{id}/transactions (1 transaction found). (7) IDEMPOTENCY TEST: Restored same ZIP again -> 200, returned {restored_projects:0, skipped_projects:1} - correctly skips existing projects. Restore feature working perfectly including idempotent behavior."
  - task: "Stored backups run/list/download + weekly cron"
    implemented: true
    working: true
    file: "backend/backup.py, backend/server.py, .emergent/crons.yml"
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "POST /api/backup/run creates a stored backup (uploads ZIP to Object Storage + backups collection, retention keep 8). GET /api/backups lists metadata. GET /api/backups/{id}/download streams stored ZIP. POST /api/cron/weekly-backup (Bearer WEBHOOK_CRON_SECRET) queues run_weekly_backups. Demo blocked on POST /backup/run."
        -working: true
        -agent: "testing"
        -comment: "✅ PASSED. All stored backup endpoints tested: (1) POST /api/backup/run -> 200, returned backup doc with id=892205e4-252d-4a85-9a72-a9eed8f4d9bc, filename='profinance-backup-20260921-113537.zip', size=7818, kind='manual', counts={projects:1, transactions:1, photos:0}, createdAt timestamp. All required fields present. (2) GET /api/backups -> 200, returned array with 1 backup, found expected backup by id. (3) GET /api/backups/{id}/download?auth={token} -> 200, Content-Type: application/zip, 7818 bytes, valid ZIP with 3 files. (4) Demo user block: POST /api/auth/demo got token, then POST /api/backup/run with demo token -> 403 (correctly blocked). (5) Cron auth: POST /api/cron/weekly-backup without auth -> 401. With Authorization: Bearer {WEBHOOK_CRON_SECRET} -> 200 {ok:true, queued:true}. All endpoints working correctly."

agent_communication:
    -agent: "main"
    -message: "Round 3: Test the NEW backup endpoints. Use a REAL registered user (register via POST /api/auth/register with email+password), because restore & /backup/run are POST and demo is read-only (would 403). Flow to test: (1) Register user, get token. (2) Create a project (POST /api/projects) + add a transaction. (3) GET /api/projects/{id}/backup/export -> expect application/zip. (4) POST /api/backup/run -> expect 200 with a backup doc (id, filename, counts). (5) GET /api/backups -> list contains that backup. (6) GET /api/backups/{backup_id}/download?auth=<token> -> valid zip bytes. (7) RESTORE TEST: export the project ZIP body from step3, DELETE the project (DELETE /api/projects/{id}), then POST /api/backup/restore with that ZIP file (multipart 'file') -> expect restored_projects>=1; confirm the project reappears in GET /api/projects. (8) Confirm demo user (POST /api/auth/demo) gets 403 on POST /api/backup/run. (9) Cron: POST /api/cron/weekly-backup without auth -> 401; with Bearer WEBHOOK_CRON_SECRET (from backend/.env) -> 200 {queued:true}. Do NOT test Midtrans."
    -agent: "testing"
    -message: "✅ ALL NEW BACKUP ENDPOINTS TESTED AND WORKING PERFECTLY. Executed comprehensive test suite covering all 3 new tasks: (1) Per-project export: Registered user, created project with transaction, exported via GET /api/projects/{id}/backup/export, verified ZIP contains data.json (1 project), data.xlsx, manifest.json. (2) Restore: Deleted project, restored from ZIP via POST /api/backup/restore, verified project and transaction reappeared, tested idempotency (second restore correctly skipped existing project). (3) Stored backups: Created manual backup via POST /api/backup/run, listed via GET /api/backups, downloaded via GET /api/backups/{id}/download, verified demo user blocked (403), verified cron auth (401 without secret, 200 with correct Bearer token). All 7 test cases passed with correct status codes, response formats, and data integrity. No backend errors in logs. Ready for production."
    -agent: "main"
    -message: "Round 4: Test admin pricing/promo. (1) GET /api/settings/public -> confirm returns monthlyPrice, monthlyPromo, yearlyPrice, yearlyPromo, promoActive (defaults 149000/149000/1290000/1290000/false). (2) Register a NORMAL user (non-admin) -> GET /api/admin/settings and PUT /api/admin/settings must return 403. (3) Register a normal user, POST /api/subscription/checkout {plan:'monthly'} then {plan:'yearly'}; Midtrans is production/external so a 200(token) OR 502 are both acceptable - the point is NO 500 from our code. Then GET /api/subscription/orders and confirm the created orders have gross_amount == 149000 (monthly) and 1290000 (yearly) i.e. amount is derived from settings defaults. Do NOT fail the task if Midtrans itself returns 502; only fail on 500/crash in our code or wrong gross_amount. Do not test unrelated flows."
    -agent: "testing"
    -message: "✅ ALL ADMIN PRICING/PROMO TESTS PASSED. Executed 4 test cases: (1) GET /api/settings/public (no auth) -> 200, returned all required fields (monthlyPrice=149000, monthlyPromo=149000, yearlyPrice=1290000, yearlyPromo=1290000, promoActive=false) plus legacy fields (appName, announcement). All defaults match specification. (2) Admin guard GET: Registered normal user, GET /api/admin/settings -> 403 (correctly blocked). (3) Admin guard PUT: Same user, PUT /api/admin/settings {promoActive:true} -> 403 (correctly blocked). (4) Checkout amount derivation: POST /api/subscription/checkout for monthly and yearly plans both returned 200 (Midtrans accepted), GET /api/subscription/orders confirmed gross_amount=149000 (monthly) and 1290000 (yearly) - amounts correctly derived from settings. No 500 errors, no backend crashes, logs clean. Feature working perfectly."
    -agent: "main"
    -message: "Round 5: Test promo expiry + announcement theme. IMPORTANT: the owner has LIVE settings - a snapshot is saved at /app/memory/settings_backup.json. You may temporarily modify MongoDB db.settings (id=app_settings) for testing but MUST restore it exactly afterward using that snapshot file. Tests: (1) GET /api/settings/public -> must include promoEndsAt, announcementTheme, serverNow (ISO). (2) Promo expiry: set promoActive=true, monthlyPrice=350000, monthlyPromo=149000, promoEndsAt=<PAST date e.g. 2020-01-01T00:00:00+00:00>; register normal user, POST /api/subscription/checkout {plan:'monthly'}; then GET /api/subscription/orders and confirm gross_amount == 350000 (expired promo -> base price). (3) Set promoEndsAt=<FUTURE date e.g. 2099-12-31T23:59:59+00:00>, checkout monthly again -> confirm new order gross_amount == 149000 (live promo -> promo price). Midtrans may return 200 or 502, both fine; only fail on our 500 or wrong gross_amount. (4) Restore settings from /app/memory/settings_backup.json and GET /api/settings/public to confirm restored. Report status codes + gross_amounts."
    -agent: "testing"
    -message: "✅ ALL PROMO EXPIRY + ANNOUNCEMENT THEME TESTS PASSED (4/4). Comprehensive test suite executed: (1) GET /api/settings/public (no auth) -> 200, confirmed all new fields present: promoEndsAt, announcementTheme='info', serverNow (valid ISO timestamp), plus all legacy fields. (2) EXPIRED PROMO TEST: Set promoEndsAt='2020-01-01T00:00:00+00:00' (past), registered user, checkout monthly -> 200, verified gross_amount=350000 (base price, expired promo correctly ignored). (3) LIVE PROMO TEST: Set promoEndsAt='2099-12-31T23:59:59+00:00' (future), same user checkout monthly again -> 200, verified NEW order gross_amount=149000 (promo price, live promo correctly applied). (4) SETTINGS RESTORATION: Restored db.settings from /app/memory/settings_backup.json, verified all fields match snapshot including promoEndsAt='' (empty as in original). No 500 errors, no backend crashes, logs clean. Promo expiry logic (_promo_active function) working perfectly - correctly compares server time with promoEndsAt to determine if promo is active. Feature ready for production."
