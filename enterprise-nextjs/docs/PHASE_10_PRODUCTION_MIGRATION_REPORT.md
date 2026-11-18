# Phase 10 production migration report

Generated: 2026-11-18 (Asia/Kolkata)

Decision: **NO-GO for production cutover. GO for a staging rehearsal after credentials are supplied.**

The application code, PostgreSQL schema, MongoDB transformer, authentication provisioner, storage provisioner, and verification suite are ready. Production execution remains blocked because the configured Supabase project has an exposed, non-rotated database password, no server-side `SUPABASE_SECRET_KEY` is configured, no isolated staging project has been supplied, and no explicit production-write approval has been recorded.

## Verified migration baseline

The legacy MongoDB source was accessed read-only on 2026-11-18. The dry run accounted for every source document.

| Collection or group | Source | Migration result |
|---|---:|---|
| Users | 11 | 11 application users; Supabase Auth identities provisioned separately |
| Categories | 12 | 12 ready |
| Leads (`clientdatas`) | 62 | 62 ready; timestamps preserved |
| Client permissions | 9,006 | All retained in `legacy_client_permissions`; none resolve to current lead/user pairs |
| Products and prices | 125 | 125 products and 125 price rows ready |
| Quotations | 18 | 18 quotations and 32 items ready |
| Vendors | 3 | 3 vendors, 2 contacts, and 2 addresses ready |
| Activity logs | 4,222 | 4,222 ready; legacy actor identity retained |
| Visitor days | 408 | 408 days and 1,645 visitor events ready; IPs HMAC-hashed |
| Blogs/comments | 1 / 1 | Blog ready; orphan comment retained in the orphan archive |
| Career jobs/applications | 3 / 0 | 3 jobs ready |
| Company settings/counters | 1 / 12 | All ready |
| All 25 collections | **13,885** | **13,885 accounted; 0 transform errors** |

The disposable PostgreSQL rehearsal imported the data twice. Both field-level verification passes reported **34/34 checks passed**, and the second import changed no table.

## Date and time verification

- MongoDB `createdAt` and `updatedAt` are copied as absolute instants into PostgreSQL `timestamptz` fields.
- If a legacy document lacks a valid `createdAt`, the transformer uses its MongoDB ObjectId timestamp. It never substitutes migration time.
- All 62 leads matched MongoDB at millisecond precision for `createdAt` and `updatedAt`.
- Lead insertion totals matched for every Asia/Kolkata calendar day. The verified baseline is:

| IST date | Leads |
|---|---:|
| 2026-06-22 | 1 |
| 2026-06-23 | 47 |
| 2026-09-05 | 6 |
| 2026-10-05 | 1 |
| 2026-10-08 | 1 |
| 2026-10-09 | 2 |
| 2026-11-04 | 1 |
| 2026-11-05 | 2 |
| 2026-11-09 | 1 |
| **Total** | **62** |

## Feature parity matrix

| Workstream | MERN capability | Next.js/Supabase result | Verification |
|---|---|---|---|
| Authentication | Login, disabled users, admin users | Supabase Auth linking, reset flow, role/enabled checks | Automated auth and provisioning tests pass |
| Leads | Lists, detail, filters, assignments, bulk actions, follow-ups | Implemented with server-side role and assignment scope | Access and behavior tests pass |
| Dashboard | KPIs, activity, follow-ups | Real database metrics with IST boundaries | Dashboard tests pass |
| Lead import | CSV preview, validation, batched commit, history/report | Resumable and idempotent | Import tests pass |
| Integrations | IndiaMART, TradeIndia, Coachingpromo, Printkee | Guarded cron/webhook routes with dedupe and audit runs | Cron/webhook tests pass; live keys not tested |
| Products/categories | CRUD, image validation, prices, archive | Implemented with private server writes and optimistic concurrency | API/service tests pass |
| Quotations | Create/edit/list/delete, numbering, PDF | Implemented with authoritative totals and ownership | Calculation/service tests pass |
| Vendors | CRUD, profiles, status, contacts, addresses, products, documents, activities, evaluation, import/export | Implemented with granular permission matrix | 97 vendor tests pass |
| Reports | Lead insertion summary, filters, drill-down, CSV/XLSX/PDF | Implemented using the same scoped query | Report and export-access tests pass |
| Public website | Blog, careers, contact | Server-side validation, rate limits, protected admin | Security tests and production build pass |
| Storage | Resumes, vendor documents, blog media, product images | Four bucket specifications; server-brokered private access | Unit tests pass; real Supabase provisioning pending |

## Security and build results

| Check | Result |
|---|---|
| `npx next typegen` | PASS |
| `npx tsc --noEmit` | PASS |
| `npx eslint . --max-warnings=0` | PASS |
| `npm test` | PASS: 24 files, 336 tests |
| `npm run build` | PASS |
| `npm audit --omit=dev` | PASS: 0 production vulnerabilities |
| `npm audit` | 17 development-only findings; not deployed in the production dependency tree |
| Secret values in tracked environment templates | None; placeholders only |

Security controls include fail-closed integration flags, authenticated CRM routes, role/assignment scoping, database-backed rate limiting, file magic-byte validation, HMAC IP storage, private document buckets, immutable lead insertion timestamps, RLS/no-Data-API access, and guarded Supabase writes.

## Required staging sequence

Create a separate Supabase project in the intended production region and put its values in an untracked `.env.local`. Do not reuse the current project or its exposed password.

1. Rotate the exposed Supabase database password in the current project.
2. Configure staging `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`.
3. Set `ALLOW_PRODUCTION_WRITE=I_HAVE_WRITTEN_APPROVAL` only for the reviewed staging command session.
4. Keep `INTEGRATIONS_ENABLED=false` and `ENABLE_INDIAMART_SYNC=false`.
5. Run:

```powershell
npm ci
npm run prisma:migrate:deploy
npx tsx scripts/provision-storage.ts --apply
npm run migrate:mongo:apply
npx tsx scripts/migrate-mongodb/verify.ts
npx tsx scripts/provision-auth-users.ts --apply
npx tsx scripts/provision-storage.ts --verify
npm run typecheck
npm run lint
npm test
npm run build
```

6. Do not add `--send-invites` until the staging users and redirect URLs have been reviewed.
7. Perform ADMIN and USER UAT, file upload/download tests, email tests, integration sandbox tests, health checks, and an export comparison.
8. Save reconciliation JSON, screenshots/UAT evidence, bucket settings, and migration logs with secrets redacted.

## Production cutover plan

Production requires written approval, a maintenance window, named migration and rollback owners, and a verified MongoDB backup.

1. Disable inbound integrations and announce the write-freeze window.
2. Stop legacy application writes.
3. Create and restore-test a final encrypted `mongodump`; record its SHA-256 checksum.
4. Re-run inventory, relationship audit, and dry run. Counts must match the approved baseline or be explained.
5. Apply Prisma migrations and storage provisioning to the new production Supabase project.
6. Run the Mongo import, field-level verifier, Auth provisioner, and storage verifier.
7. Require 34/34 migration checks, 13,885 accounted source documents (adjusted only for approved freeze-window changes), zero failed checkpoints, 62/62 lead timestamp matches, and exact IST daily totals.
8. Smoke-test login, authorization, lead CRUD, imports, reports, quotation PDF, product images, vendor documents, careers, blogs, and contact email.
9. Point Vercel production variables at the verified project and deploy the locally committed revision.
10. Enable traffic. Enable integrations last, one provider at a time, after dedupe monitoring is active.

## Rollback plan

Before new-system writes begin, rollback is DNS/traffic reversal: disable the Next.js deployment, keep the imported Supabase project isolated for evidence, restore legacy traffic, and resume MongoDB writes.

After new-system writes begin, do not overwrite either database or attempt an automatic reverse transform. Disable integrations and writes, preserve MongoDB, PostgreSQL, logs, and migration reports, export the post-cutover PostgreSQL delta, reconcile it under the incident owner, and then choose the authoritative system. The tested importer is one-way and idempotent; rollback is operational, not a destructive database down-migration.

## Final deployment checklist

- [ ] Exposed database password rotated.
- [ ] Isolated staging Supabase project supplied and fully rehearsed.
- [ ] Staging reconciliation and UAT signed off.
- [ ] Treatment of 9,006 orphan permission records accepted (current implementation preserves all for reference).
- [ ] Vercel plan supports the required five-minute cron schedule, or an external scheduler is approved.
- [ ] Production Supabase project and secrets configured outside git.
- [ ] `CRON_SECRET`, provider keys, email key, and webhook key configured.
- [ ] MongoDB backup restore-tested and checksum recorded.
- [ ] Maintenance window and write freeze approved.
- [ ] Migration and rollback owners named.
- [ ] Production migration returns all verification gates green.
- [ ] Integrations enabled only after post-cutover smoke testing.

Until every checkbox is complete, the production decision remains **NO-GO**.
