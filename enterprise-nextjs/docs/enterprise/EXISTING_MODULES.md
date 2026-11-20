# Existing modules — Enterprise CRM 2.0 audit

**Audit date:** 2026-11-20 · **Branch:** `remediation/enterprise-nextjs` · **App:** `enterprise-nextjs/` (Next.js 16.4 App Router, React 19.3, Prisma 7.10, PostgreSQL/Supabase)

**Method:** source review of every route, service, Prisma model, migration and test, plus a full baseline run: `tsc --noEmit` clean, `eslint --max-warnings=0` clean, and **338/338 Vitest tests passing in 24 files** against a disposable embedded PostgreSQL. The live Supabase database was not contacted.

**Companion audits (still current, 2026-11-18/19):** `docs/FINAL_FEATURE_PARITY_AUDIT.md` (MERN parity matrix; statuses there predate the parity workstreams committed in `f9bd490`), `docs/SECURITY_AUDIT.md`, `docs/DESIGN_SYSTEM.md`, `docs/UI_UX_REDESIGN_REPORT.md`, `docs/PHASE_10_PRODUCTION_MIGRATION_REPORT.md`.

**Status key**

| Key | Meaning |
|---|---|
| ✅ Working | Implemented and covered by automated tests, a browser check, or both |
| 🟡 Incomplete | Implemented, but parts the enterprise brief needs are missing |
| ⛔ Blocked | Code exists, but needs external credentials or infrastructure |
| ❌ Missing | Not present in the codebase |

## 1. Platform

| Area | What exists | Where | Status |
|---|---|---|---|
| Routing | 3 route groups with separate root layouts: `(website)` public site, `(auth)` CRM sign-in, `(crm)` authenticated CRM. `global-not-found.tsx` for unmatched URLs | `src/app` | ✅ |
| Auth | Supabase Auth (SSR cookies) → `User.authUserId` maps identity to role and enabled flag. Login by username or email, per-IP and per-account throttling, forgot/reset password, sign-out | `lib/auth/session.ts`, `lib/auth/api.ts`, `(auth)/crm/*`, `proxy.ts` | ✅ (tests: `security.auth`, `auth.provision`) |
| Authorization | Two roles (`ADMIN`, `USER`). `requireUser`/`requireAdmin` in pages and actions, `requireApiActor` in route handlers, `assertAdmin` and `leadScope()` in services. Vendor module has a 12-permission catalog. **New in Phase 1:** a CRM capability catalog (`can`, `assertCan`) | `server/actor.ts`, `lib/permissions` | ✅ |
| Data access | Services `(actor, input)` in `src/server/<module>`, thin actions and routes, Zod validation, `HttpError` → JSON | `src/server/**` | ✅ |
| Database | 43 Prisma models, 4 migrations (`initial`, `careers_admin`, `remediation_foundation`, `lead_source_giftaguru`). Decimal money, UUID keys, `legacyId` on migrated rows | `prisma/` | ✅ |
| Time | All business dates in Asia/Kolkata (server runs UTC) | `lib/time/ist.ts` | ✅ |
| Rate limiting | PostgreSQL fixed-window limiter (works across serverless instances) | `lib/rate-limit.ts` | ✅ |
| Storage | Supabase Storage behind a driver. Private: `career-resumes`, `vendor-documents`. Public: `blog-media`, `product-images`. Magic-byte file sniffing | `lib/storage.ts`, `lib/files/signature.ts` | ✅ code · ⛔ buckets need provisioning per environment |
| Export | CSV/XLSX with formula-injection guard; PDF via pdfkit | `lib/export/tabular.ts` | ✅ |
| Security headers | HSTS, nosniff, frame DENY, COOP, Permissions-Policy; CSP is **report-only** | `next.config.ts` | 🟡 |
| Tests | Vitest on embedded PostgreSQL 17, 24 files / 338 tests (baseline) | `tests/` | ✅ |
| Background jobs | Cron route handler with `IntegrationRun` audit rows. **`vercel.json` crons is empty** (TradeIndia/IndiaMART schedules removed in `e65e98b`; the IndiaMART route was deleted) | `api/cron/tradeindia`, `server/integrations/cron.ts` | ⛔ no scheduler configured |
| Observability | `console.error` only; no error monitoring or structured logging | — | ❌ |

## 2. CRM modules

| Module | Routes | Existing functionality | Status |
|---|---|---|---|
| **Dashboard** | `/crm/entrydashboard` | Role-scoped KPIs (total, new today, assigned, unassigned, in progress, won, lost, conversion %), follow-ups due today/upcoming/overdue (IST), leads-per-day chart, status breakdown, per-employee performance with period filter, recent leads. Every KPI links to its filtered list | ✅ (tests: `dashboard.metrics`) · 🟡 no revenue/pipeline/quotation KPIs |
| **Leads** | `/crm/lead-management` (+`/[id]`), `new-leads`, `assigned-leads`, `unassigned-leads`, `trending-leads`, `won-leads`, `my-leads`, `my-trending-leads`, `conversions` | Server-side pagination (25–200), search, multi-value filters (category, location, state, data type, file name, status, call status, assignee, assigned/unassigned, blank matching, created/follow-up date range), create/edit/delete, additional contacts, billing/shipping address, bulk category/location update, bulk assign (merge), transfer (replace), unassign, delete-all-matching (refuses unfiltered), duplicate check by phone/contact, status history, CSV/XLSX export (cap 50,000) | ✅ (tests: `leads.access`, `leads.behaviour`) · 🟡 no saved views, column config, scoring, tags, merge, owner history table |
| **Follow-ups** | `/crm/today-followups`, `/crm/upcoming-followups` | Lead `followUpDate` (+ 3 rotated history slots), IST day boundaries, overdue KPI | ✅ · 🟡 follow-ups are lead fields, not activity records |
| **Lead import** | `/crm/import-leads`, `/api/lead-import/**` | CSV/XLSX upload, header validation, preview (100 rows), dedupe (phone/contact/email, in-file and against DB), resumable batched commit with `retryKey` idempotency, history, per-row error report, optional assign-on-import (admin) | ✅ (tests: `import.csv`, `import.commit`) · 🟡 no column mapping UI for leads (vendors have it) |
| **Inbound lead sources** | `/api/cron/tradeindia`, `/api/{coachinpromo,printkee,giftaguru}/capture-lead` | Webhooks with API key, rate limit, dedupe; TradeIndia polling with run audit | ✅ code (tests: `integrations.*`) · ⛔ live keys untested; crons unscheduled; IndiaMART route removed |
| **Lead insertion report** | `/crm/reports/lead-insertion` | Date-wise insertion report with source/status/employee/initial-status filters, IST days, charts, CSV/XLSX export, role scope | ✅ (tests: `report.insertion`, `report.export-access`) |
| **Products** | `/crm/product-management`, `/crm/product-dashboard`, `/api/products/**`, `/api/categories/**` | Catalogue CRUD (admin), categories, image upload with content sniffing, slab pricing (5–50 / 50–100 / 100+), GST, HSN, archive, optimistic concurrency, search API for quotations. Users see the catalogue read-only | ✅ (tests: `products.*`) · 🟡 no price history, variants, bulk import/export |
| **Quotations** | `/crm/quotations` (+`/create`, `/[id]/edit`), `/api/quotations/**` | Create/edit/delete (admin), party + shipping addresses, line items (qty, price, discount %, tax %), summary discount (₹/%), additional charges, TCS, round-off, amount received, decimal-safe totals, concurrency-safe numbering per prefix (`invoice_counters`), PDF, client lookup from leads. Users see only their own | ✅ (tests: `quotations.*`) · 🟡 no status, approval, revisions, validity tracking, deal/company link |
| **Vendors** | `/crm/vendors/**`, `/api/vendors/**` | Directory with status views, profiles (contacts, addresses, bank details gated by permission), categories, products with price tiers, activities, private documents with signed downloads and expiry, evaluations and performance scoring, CSV import with mapping and report, export, audit view | ✅ (tests: `vendors.*`) · 🟡 no purchase orders (optional scope) |
| **User management** | `/crm/user-management` | Create (Supabase Auth + app user, rolled back if either fails), enable/disable (not self), admin password reset; all audited | ✅ · 🟡 two fixed roles; actions throw instead of returning `{ ok: false }` |
| **Activity (audit) log** | `/crm/activity-log`, `/api/activity/log` | Append-only `ActivityLog` for every business mutation; admin viewer with user/date/text filters. **Phase 1:** sortable, page-size, column and density controls via `DataTable` | ✅ (tests: `dashboard.activity`, `foundation.phase1`) · 🟡 no entity/record columns or before/after |
| **Global search** | Topbar, `Ctrl/⌘+K`, `/api/search` | **New in Phase 1:** permission-aware search across leads, quotations, products and vendors, plus page navigation, quick actions and recent records | ✅ (tests: `search.global`) |

## 3. Public website (out of scope: preserve)

`(website)`: home, blogs (+ comments), careers (+ PIN-protected admin), contact. Rendered from `src/legacy-marketing` with its own root layout and CSS. **Not modified by this programme.** Careers admin uses a shared PIN (`SECURITY_AUDIT.md` SEC-01, still open).

## 4. Data inventory (from the verified migration rehearsal, 2026-11-18)

11 users · 62 leads · 125 products · 18 quotations · 3 vendors · 4,222 activity logs · 9,006 legacy client permissions (archived; none resolve). The datasets are small, so performance claims beyond them need synthetic load tests (see the implementation plan).

## 5. Legacy and historical code (kept, untouched)

`../frontend`, `../backend` (MERN source, the business-rule reference), `scripts/migrate-mongodb/*` (migration and verification), `migration-reports/`, `migration-*.log`, root-level audit documents.
