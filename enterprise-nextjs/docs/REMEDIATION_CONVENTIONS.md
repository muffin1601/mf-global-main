# Remediation conventions (read before touching code)

Goal: complete MERN parity in the Next.js CRM with verified behaviour. This document is the contract between parallel workstreams.

## Hard rules
1. **Never** modify the original MERN source (`../frontend`, `../backend`) or MongoDB. Read them freely: they are the specification of business behaviour.
2. **Never** connect to Supabase or read `.env` for database access. All verification runs against the disposable embedded PostgreSQL started by `tests/global-setup.ts` (`npm test`). Do not print or log any secret.
3. **Do not edit** `prisma/schema.prisma`, `prisma/migrations/**`, `package.json`, `src/components/layout/crm-shell.tsx`, `src/lib/auth/session.ts`, or other workstreams' files. If you need a schema/dependency change, work around it (e.g. JSON column, existing deps) and list the request in your final report.
4. **Do not run** `next build`, `next dev`, `prisma migrate`, or any git command that writes (no commit/stash/checkout). The lead integrates, builds and commits.
5. Do not change the public marketing site (`src/legacy-marketing`, `src/app/(website)`), except where your brief says so.
6. No mock business data. Preserve MERN business rules; where you deliberately deviate (bug in MERN), say so in the report.
7. Every sensitive operation authorises **server-side** (Prisma bypasses RLS). Non-admins only ever see/modify leads assigned to them (`leadScope(actor)`).

## Architecture
- **Services** hold logic: `src/server/<module>/*.ts`, plain functions `(actor: Actor, input)`, using `prisma` from `@/lib/prisma/client`. They throw `HttpError` (`@/server/errors`). They are what tests call directly.
- **Server Actions / Route Handlers / pages** are thin: resolve the user (`requireUser()` / `requireAdmin()` from `@/lib/auth/session` in pages & actions; `requireApiActor()` + `handle()` from `@/lib/auth/api` in Route Handlers), validate input with `zod`, call the service, revalidate, return.
- Shared: `@/lib/time/ist` (**all** business-date logic: Asia/Kolkata; the server runs UTC), `@/lib/crm/constants`, `@/lib/export/tabular` (CSV/XLSX with formula-injection guard; PDF via `pdfkit`), `@/lib/rate-limit` (persistent), `@/server/leads/ingest` (**the only way to insert a lead**), `@/server/actor`.
- Lead status/call-status changes must call `recordStatusChange` in the same transaction. Write an `ActivityLog` row for every business mutation (`userId`, `action` like `lead.updated`, `details`).
- Money: `Decimal` columns, never JS floats for stored totals (round to 2 dp at the edge, as MERN's `utils/quotationCalc.js`).
- Pagination is server-side (`take`/`skip`, max 200). Search uses `contains` + `mode: "insensitive"`.
- Forms that need interactivity (modals, bulk selection, filters) are Client Components calling Server Actions; prefer progressive enhancement. Every visible control must work: no dead buttons.
- Errors: Server Actions return `{ ok: false, error }` for expected failures (shown via `sonner` toast) instead of throwing into the error page.

## UI
Reuse global classes from `src/app/globals.css` (`page`, `page-head`, `eyebrow`, `kpis`/`kpi`, `card`, `table-card`, `form-grid`, `field`, `button`/`button secondary`, `badge`, `error`). Anything extra goes in a CSS Module next to your component. Allowed libraries: those already in `package.json` (lucide-react, sonner, react-hook-form, @tanstack/react-table, recharts, zod, exceljs, pdfkit, csv-parse). Mobile-friendly tables (horizontal scroll inside `table-card`).

## Route ownership (sidebar already links to all of these)
| Workstream | Routes / files |
|---|---|
| Leads | `/crm/lead-management` (+`/[id]`), `/crm/unassigned-leads`, `/crm/assigned-leads`, `/crm/new-leads`, `/crm/trending-leads`, `/crm/won-leads`, `/crm/my-leads`, `/crm/my-trending-leads`, `/crm/conversions`, `/crm/today-followups`, `/crm/upcoming-followups`; `src/server/leads/*` (except `ingest.ts`, which is shared and frozen), `src/app/api/leads/**` |
| Dashboard | `/crm/entrydashboard`, `/crm/activity-log`; `src/server/dashboard/*`, `src/server/activity/*`; client-side activity logging endpoint |
| Import + integrations | `/crm/import-leads`; `src/server/imports/*`, `src/server/integrations/*`, `src/app/api/lead-import/**`, `src/app/api/cron/**`, the two webhook routes, `vercel.json` (crons) |
| Insertion report | `/crm/reports/lead-insertion`; `src/server/reports/**`, `src/app/api/reports/**` |
| Products | `/crm/product-management`, `/crm/product-dashboard`; `src/server/catalog/*`, `src/app/api/products/**`, `src/app/api/categories/**` |
| Quotations | `/crm/quotations` (+`/create`, `/[id]/edit`); `src/server/quotations/*`, `src/app/api/quotations/**` |
| Vendors | `/crm/vendors/**`; `src/server/vendors/*`, `src/app/api/vendors/**` |

## Definition of done for a workstream
- Behaviour matches the MERN source for the listed features (cite MERN file:line in code comments only where non-obvious).
- Tests in `tests/<module>.*.test.ts` against the real test database cover: happy paths, **authorization for both roles (admin, user, and a user who is not assigned)**, validation failures, and the module's edge cases. Use `tests/helpers/db.ts` (`resetDb`, `makeUser`, `makeLead`, `actorOf`). Run with `npx vitest run tests/<your files>`.
- `npx next typegen && npx tsc --noEmit` passes for your files, and `npx eslint <your files> --max-warnings=0` is clean.
- Final report (max ~60 lines): what was built (files), MERN features covered by parity-matrix ID (P-xx from `docs/FINAL_FEATURE_PARITY_AUDIT.md`), tests added + results, deviations from MERN, anything NOT done or not verifiable, and requested schema/dependency changes. **Do not claim a feature works unless a test or a run proves it.**
