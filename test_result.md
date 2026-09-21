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
  version: "1.2"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Please test the new backup endpoints only. Auth: you can create a session via POST /api/auth/demo (public, returns token) OR register/login. Use Bearer token. Verify /api/backup/summary returns counts and /api/backup/export returns a valid non-empty application/zip. Do NOT test payment/Midtrans or other existing flows."
    -agent: "testing"
    -message: "✅ Backup endpoints testing COMPLETE. All 3 tests passed (100% success rate). Endpoints working correctly: (1) Unauthenticated access properly blocked with 401, (2) Authenticated /api/backup/summary returns valid counts, (3) Authenticated /api/backup/export returns valid ZIP with data.json, data.xlsx, and manifest.json. Demo account (read-only) can successfully export. Note: photos=0 for demo is correct behavior (external URLs excluded by design). No backend errors found in logs. Ready for production use."
