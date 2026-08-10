# multirate-web

Frontend for the multi-rate pricing / billing app. React + TypeScript + Vite,
using AntD v5, TanStack Query, and React Router v6. Talks exclusively to
`billing-api`; no direct Supabase access from the browser.

## Overview

A small billing UI for creating and managing invoices/quotes with per-line
tax and discount rates. Totals are computed live in the editor (via a
duplicated calc module) and re-validated by the server on save.

## Requirements

- Node.js 18+ (Node 20+ recommended)
- npm 10+
- A running `billing-api` instance for auth and data

## Setup

```bash
cp .env.example .env.local
# fill in VITE_API_URL
npm install
npm run dev
```

## Environment variables

| Var            | Description                                      |
| -------------- | ------------------------------------------------ |
| `VITE_API_URL` | Base URL of `billing-api` (e.g. `http://localhost:4000`) |

Only one variable — no Supabase URL or anon key lives on the frontend.

## Scripts

| Command             | What it does                       |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Start Vite dev server              |
| `npm run build`     | Type-check then produce production build |
| `npm run preview`   | Preview the production build       |
| `npm run typecheck` | `tsc --noEmit`                     |
| `npm run lint`      | ESLint                             |

## Architecture

- `src/main.tsx` — providers: `QueryClientProvider`, `BrowserRouter`, AntD
  `ConfigProvider` (`colorPrimary: #1677ff`), plus React Query devtools.
- `src/App.tsx` — route table; unauth routes for `/login` and `/signup`,
  everything else behind `ProtectedRoute` inside `AppShell`.
- `src/lib/session.ts` — tiny localStorage-backed session store with a
  subscribe/notify bus and cross-tab `storage` event sync.
- `src/lib/api.ts` — axios instance. Request interceptor attaches
  `Authorization: Bearer <access_token>`. Response interceptor performs a
  single-flight refresh on `401 TOKEN_EXPIRED`/`INVALID_TOKEN`, retries the
  original request once, and hard-redirects to `/login` if the refresh fails.
- `src/lib/calc.ts` — **duplicated from `billing-api` on purpose**; the
  server is source of truth. Same rules, rounding, and error codes.
- `src/hooks/useAuth.ts` — `useSyncExternalStore` binding over the session
  store; exposes `{ session, user, signOut }`.

## Authentication

The frontend has no Supabase SDK. Auth flow:

1. `POST /api/auth/login` (or `/signup`) → `{ session: { access_token,
   refresh_token, expires_at, user } }`.
2. `setSession(...)` writes it to localStorage under `billing.session`.
3. Every API request gets `Authorization: Bearer <access_token>`.
4. On `401` with `error.code` of `TOKEN_EXPIRED` or `INVALID_TOKEN`, the
   response interceptor calls `POST /api/auth/refresh` with the stored
   refresh token, updates the session, and retries the original request.
   Concurrent 401s share the same refresh promise (single-flight).
5. If refresh fails or is impossible, the session is cleared and the app
   hard-redirects to `/login`.

## Routing

| Path                | Component        | Auth |
| ------------------- | ---------------- | ---- |
| `/login`            | `Login`          | no   |
| `/signup`           | `Signup`         | no   |
| `/documents`        | `DocumentsList`  | yes  |
| `/documents/new`    | `DocumentEditor` | yes  |
| `/documents/:id`    | `DocumentEditor` | yes  |
| `/reports`          | `Reports`        | yes  |
| `*`                 | `NotFound`       | —    |

## Calc module

`src/lib/calc.ts` is duplicated from `billing-api/app/services/calc.py` for
optimistic live totals in the editor. If calc policy changes, **update
both**. Same rules:

- decimal.js, precision 12, HALF_UP rounding, money to 2 dp.
- Percentages 0..100.
- Per line: `subtotal = qty × unit`. Discount is one of:
  - `null` — no discount
  - `%`   — `subtotal × value / 100`
  - `fixed` — `value` (absolute amount)
- `taxable = subtotal − discount`, then `tax = taxable × tax_pct / 100`,
  then `total = taxable + tax`.
- Document totals = sum of rounded line values (sum-of-rounded).
- Errors: `INVALID_NUMBER`, `NEGATIVE_QUANTITY`, `NEGATIVE_UNIT_PRICE`,
  `RATE_OUT_OF_RANGE`, `DISCOUNT_EXCEEDS_SUBTOTAL`.

## Line sync strategy (saving edits)

When saving an existing document, the editor:

1. `PATCH /api/documents/:id` with the metadata (`title`, `customer`,
   `issue_date`).
2. `DELETE /api/documents/:id/lines` — bulk delete all existing lines.
3. `POST /api/documents/:id/lines` — bulk insert the current lines.

This "wipe and re-insert" approach is deliberately simple. **Tradeoffs:**

- Every save invalidates any external references to individual line IDs.
  If you build integrations or webhooks that key off line IDs, they'll see
  a fresh set of IDs after every draft save.
- It's not atomic across the three requests. If the `POST` fails after the
  `DELETE` succeeds, the document is left with zero lines. For a
  take-home this is acceptable; for production, either wrap the operation
  in a transactional endpoint (`PUT /api/documents/:id` that replaces the
  whole document) or diff line IDs client-side and issue
  `POST`/`PATCH`/`DELETE` per changed row.
- The server should reject any of these writes on a finalized document
  with `409 DOCUMENT_FINALIZED`; the editor surfaces that error and
  invalidates its cached copy of the document.

## Deployment (Vercel)

`vercel.json` rewrites every path to `/index.html` so the SPA router owns
routing. Build command: `npm run build`. Output: `dist/`.

## Project layout

```
src/
  main.tsx
  App.tsx
  lib/
    api.ts
    session.ts
    calc.ts
    format.ts
  hooks/
    useAuth.ts
  routes/
    Login.tsx
    Signup.tsx
    DocumentsList.tsx
    DocumentEditor.tsx
    Reports.tsx
    NotFound.tsx
  components/
    ProtectedRoute.tsx
    AppShell.tsx
    LineItemsEditor.tsx
    TotalsPanel.tsx
    StatusTag.tsx
  types/
    api.ts
```
# multirate-web
