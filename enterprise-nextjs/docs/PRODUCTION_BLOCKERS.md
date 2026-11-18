# Production Blockers

**Audit date:** 2026-11-18. Every item below must be closed before a GO decision. Full details live in the referenced audit documents. Nothing here has been fixed; this audit was read-only, and fixes await owner approval.

## Critical

| ID | Blocker | Module | File / evidence | Fix | Verify by |
|---|---|---|---|---|---|
| DB-01 | Target Supabase DB has **no schema and no data** (public schema 0 tables, 0 auth users, 0 buckets) | Database | Read-only query; `/api/careers/jobs` → HTTP 500 in browser test | Staging project → `migrate deploy` → RLS script → buckets → `migrate:mongo:apply` → reconcile | Table counts equal MongoDB counts per collection |
| DB-03 | Migrated users have no Supabase Auth identity; **all 11 employees locked out** | Auth | `scripts/migrate-mongodb/index.ts` (no `authUserId`); `login/actions.ts:19` | Linking/invite script + first-admin bootstrap + forced reset | Each migrated user logs in on staging |
| VER-01 | `enterprise-nextjs/` is **not in git** (0 tracked files) | Deployment | `git ls-files` | Commit on a branch, review, merge | Vercel Preview builds from the commit |
| VER-02 | No staging environment; migration never rehearsed | Deployment | Single empty Supabase project | Provision staging Supabase + Vercel Preview | Full rehearsal log |
| P-75–78 / VER-03 | **Inbound lead sources not ported**: TradeIndia cron (always on), IndiaMART cron, Coachingpromo and Printkee webhooks | Leads | `backend/cron/*`, `backend/routes/leads.js:9,50` vs nothing in Next.js | Vercel Cron route + webhook routes with API key and rate limit | Leads arrive on staging from each source |
| MKT-01 | Public careers, blog, comment, and contact features fail without DB and buckets | Website | `500 /api/careers/jobs` | Same as DB-01 | Public forms work on staging |

## High

| ID | Blocker | Reference |
|---|---|---|
| PARITY | 80 MERN features missing or broken. Highlights: bulk assign/transfer/remove (P-55–57), filters (P-60), **pagination controls (P-62)**, lead detail view (P-42), full lead edit (P-43), follow-up lists (P-38), lead CSV exports (P-65–66), **lead import (P-71–72)**, sales performance (P-25), activity log viewer (P-11), product CRUD and categories (P-80–84), vendor management (P-87–104), **quotation create/edit/PDF/numbering (P-107–111)** | `FINAL_FEATURE_PARITY_AUDIT.md` |
| P-18 | Dashboard "Converted" KPI counts statuses that don't exist; always 0 (real value is "Won Lead") | `entrydashboard/page.tsx:4` |
| P-22 | "Follow-ups today" uses server-local (UTC on Vercel), not IST | `entrydashboard/page.tsx:4` |
| RPT-01 | Date-wise Lead Insertion Report not implemented (new requirement; not in MERN either) | `LEAD_REPORT_AUDIT.md` |
| DB-02 | 9,006 `clientpermissions` unmigrated (orphans), with no signed disposition | `DATABASE_INTEGRITY_AUDIT.md` |
| DB-04 | All 125 products lose their category (`cat_id` holds the ObjectId, but the join uses the code) | `DATABASE_INTEGRITY_AUDIT.md` |
| SEC-01 | Careers admin = one shared 6-digit PIN guarding applicant PII | `SECURITY_AUDIT.md` |
| SEC-02 | Public resume upload has no rate limit (regression from MERN 5/min) | `api/careers/apply/route.ts` |
| SEC-06 | RLS script never applied; storage buckets absent | `supabase/storage-and-database-security.sql` |
| TESTS | Zero automated tests in the Next.js app (MERN had 16 test files) | `VERCEL_READINESS_AUDIT.md` |

## Medium

SEC-03 open redirect in `/auth/callback` · SEC-04 no login throttling · SEC-05 unmoderated anonymous comments · SEC-14 **rotate the database password** (exposed in this audit session's tool output; looks human-chosen) · DB-05 no DB-level lead uniqueness · DB-06 mutable `created_at`, no index, no source/batch columns · PERF-01 proxy calls Supabase on every public API request · PERF-02 ILIKE search and offset paging · logging and error monitoring absent · `NEXT_PUBLIC_APP_URL` must be the production domain (MKT-03).

## Low

SEC-07 reset page accepts non-recovery sessions · SEC-08 vendors page lacks page-level auth · SEC-09 disabled-account enumeration · SEC-10 no CSP/HSTS · SEC-11 dev-dependency advisories · SEC-12 env schema in client bundle · SEC-13 unsalted IP hash fallback · DB-07 epoch fallback · DB-08 five unmapped dead models · MKT-02 `/crm` landing 404 · P-58 non-functional "May delete" checkbox · health endpoints missing.

## Exact sequence required before deployment

1. **Rotate the Supabase database password** and update local `.env` and Vercel env vars.
2. Commit `enterprise-nextjs/` to a feature branch (VER-01).
3. Provision a **staging** Supabase project and Vercel Preview environment (VER-02).
4. Fix the migration defects: category join (DB-04), user identity linking and first-admin bootstrap (DB-03), ObjectId timestamp fallback (DB-07). Get written disposition of the 9,006 orphan permissions (DB-02).
5. On staging: `prisma migrate deploy` → run the RLS script as the migration role → create buckets → `migrate:mongo:apply` → `migrate:mongo:marketing-files` → reconcile every collection to the MongoDB counts in `DATABASE_INTEGRITY_AUDIT.md`.
6. Implement the missing CRM features in priority order: inbound lead sources → pagination, filters, bulk assignment/transfer → lead import → exports → follow-up lists and dashboard KPIs (correct "Won Lead" and IST boundaries) → quotations (create/edit/PDF/numbering) → products and categories → vendor management → activity log viewer.
7. Implement the Lead Insertion Report (RPT-01) and the schema support it needs (DB-06).
8. Fix the security findings SEC-01 through SEC-06, at minimum.
9. Add automated tests: authorization matrix per role, lead workflows, import dedup, report reconciliation, IST boundaries, careers/contact endpoints.
10. Run a user acceptance test on staging with each role; repeat the visual comparison of the full public pages.
11. Plan the production cut-over: freeze MongoDB writes, final delta migration, DNS switch, and a rehearsed rollback (including data written after cut-over).
12. Re-run this audit. A GO requires 0 Critical/High open and 0 essential checks BLOCKED.
