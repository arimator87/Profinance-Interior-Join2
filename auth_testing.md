# Auth-Gated App Testing Playbook (ProFinance Interior)

Auth: Emergent Google OAuth + Email/Password (JWT-style opaque session tokens).
Sessions stored in Mongo `user_sessions` (session_token, user_id, expires_at ISO).
Users stored in `users` (user_id custom UUID, email, password_hash, subscriptionTier).

## Email/Password login (preferred for automated tests)
POST /api/auth/register {email,name,password}  -> {user, token}
POST /api/auth/login {email,password}          -> {user, token}
Token works as `Authorization: Bearer <token>` AND as cookie `session_token`.

Primary account: furnitrue.mail@gmail.com / Password123 (premium, seeded).

## Browser testing
- After login, frontend stores token in localStorage key `pf_token` and cookie is set httpOnly.
- To drive UI directly, either:
  1. Use the login form: fill [data-testid=login-email-input], [data-testid=login-password-input], click [data-testid=login-submit-button].
  2. Or set cookie:
     await context.add_cookies([{ "name":"session_token","value":TOKEN,"domain":"profinance-interior.preview.emergentagent.com","path":"/","httpOnly":True,"secure":True,"sameSite":"None"}])
     AND set localStorage pf_token before navigating (interceptor uses it):
     await page.add_init_script(f"localStorage.setItem('pf_token','{TOKEN}')")

## Create session directly in Mongo (alternative)
mongosh --eval "use('test_database'); db.users.insertOne({user_id:'test-1',email:'t@t.com',name:'T',subscriptionTier:'premium',created_at:new Date()}); db.user_sessions.insertOne({user_id:'test-1',session_token:'tok123',expires_at:new Date(Date.now()+7*864e5).toISOString()});"

## Key endpoints
- GET /api/auth/me
- GET /api/dashboard, GET /api/projects, POST /api/projects
- POST /api/projects/{id}/transactions, GET .../transactions, DELETE /api/transactions/{id}
- POST /api/projects/{id}/workers, GET .../workers, POST /api/workers/{id}/pay {type:kasbon|pelunasan,amount}
- Premium: POST /api/projects/{id}/workitems, POST /api/workitems/{id}/progress, GET /api/projects/{id}/progress-summary, GET /api/projects/{id}/report, GET /api/projects/{id}/report/pdf?auth=TOKEN
- POST /api/seed-demo, POST /api/subscription/upgrade, POST /api/subscription/toggle
