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
- Per line: `subtotal = qty × unit_price`, discount off subtotal, tax off
  taxable amount, total = taxable + tax.
- Document totals = sum of rounded line values (sum-of-rounded).
- Errors: `CALC_INVALID_NUMBER`, `CALC_NEGATIVE_QUANTITY`,
  `CALC_NEGATIVE_UNIT_PRICE`, `CALC_RATE_OUT_OF_RANGE`.

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
