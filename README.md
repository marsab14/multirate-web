# Billing web

Frontend for the billing take-home. Companion backend: billing-api.

## Setup
1. Copy .env.example → .env, set VITE_API_URL.
2. npm ci
3. npm run dev

## Auth architecture
Frontend never talks to Supabase. Auth calls hit backend endpoints:
- POST /api/auth/signup, /login → returns { session }
- POST /api/auth/refresh → new session (called by axios interceptor
  on 401 TOKEN_EXPIRED or INVALID_TOKEN)
- POST /api/auth/logout → best-effort
Tokens live in localStorage. Access token attaches to every request
via axios interceptor.

## Deploy
- Vercel, framework preset "Vite"
- Env var: VITE_API_URL
- vercel.json handles SPA rewrites

## Design decisions
- AntD default theme (evaluator time is precious; defaults look pro)
- calc.ts duplicated from backend — server is source of truth; UI
  copy exists only for live-editing feel
- Server response replaces local state after every save
- localStorage for session storage (simpler than in-memory + tab sync;
  acceptable for a take-home; note as production improvement)

## Smoke test
- [ ] Sign up new user → auto logged in → /documents
- [ ] Log out, log in with same creds
- [ ] Create the spec's sample doc (Widget A, B, Service fee)
      → grand total shows 421.50 live AND after save
- [ ] Reload — values persist
- [ ] Edit a line, totals update live
- [ ] Delete a line, totals update
- [ ] Finalize — form goes read-only, action buttons hide
- [ ] Try to PATCH via curl — API returns 409 DOCUMENT_FINALIZED
- [ ] Wait for token expiry (or manually corrupt access_token in
      localStorage) → next request auto-refreshes, no user disruption
- [ ] Reports page aggregates match the list
- [ ] Log in as a second user — first user's docs invisible

## What I'd improve before production
- Move session from localStorage to HttpOnly cookies (XSS resilience;
  requires CSRF token + same-site cookie config)
- Preemptive refresh (check expires_at before requests) instead of
  reactive-on-401
- Debounced autosave on drafts
- Optimistic updates via TanStack Query
- PDF export
- Keyboard shortcuts (⌘S save, ⌘⏎ finalize)
- Line reordering via drag handle
- Better validation surfacing (per-field highlighting)
- E2E tests via Playwright
