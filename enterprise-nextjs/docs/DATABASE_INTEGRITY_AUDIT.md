# Database and Migration Integrity Audit

**Audit date:** 2026-11-18 · **Mode:** read-only · **Scope:** Prisma schema, Prisma migrations, Supabase PostgreSQL (project referenced by `enterprise-nextjs/.env`), MongoDB migration utility, migration reports, live MongoDB `my-crm`.

## Summary

**Result: FAIL.** No data has been migrated to PostgreSQL. The Supabase database in `.env` holds no application schema at all. Reconciliation coverage is 0 of 13,885 MongoDB documents.

| Check | Status | Evidence |
|---|---|---|
| Prisma schema valid | PASS | `npx prisma validate` → "The schema at prisma\schema.prisma is valid" |
| Prisma Client generation | PASS | `npx prisma generate` exit 0 |
| Migrations applied to Supabase | **FAIL** | `_prisma_migrations` does not exist; `public` schema has 0 tables (read-only query, see Evidence E1) |
| Data imported | **FAIL** | No `users`, `leads`, or other application tables exist; `auth.users` = 0 |
| Every Mongo collection accounted for (dry run) | PASS (dry run only) | `migration-reports/reconciliation-2026-11-17T08-05-17-746Z.json`: 25 collections, 13,885 source docs, 13,885 accounted |
| Live Mongo counts match dry-run report | PASS | Live read-only `countDocuments` matches the report for all 25 collections (E2) |
| `clientpermissions` migrated | **FAIL** | 9,006 of 9,006 documents classified as exceptions; relationship audit: 9,006 orphan clients, 5,888 orphan users, 2,942 duplicate pairs |
| Product → category mapping | **FAIL** | 125 of 125 products have `unresolved_category_code` warnings; the products would migrate with `category_id = NULL` |
| Activity log actor mapping | FAIL (Low) | 25 activity logs with unknown user codes |
| Blog comment mapping | FAIL (Low) | 1 of 1 comment is an exception (orphan blog) |
| Migrated users can log in | **FAIL** | No code creates Supabase Auth identities or sets `users.auth_user_id` for migrated users (DB-03) |
| Timestamps preserved | PASS (static) / BLOCKED (data) | `scripts/migrate-mongodb/index.ts` maps `createdAt: doc.createdAt ?? new Date(0)`; live Mongo has 0 leads without `createdAt`, so the epoch fallback would not trigger today. Not verifiable in Postgres. |
| Idempotent re-runs | PASS (static) | All writes are `upsert` keyed on `legacyId` (or composite keys) |
| Foreign keys valid / no orphans / no duplicates in Postgres | BLOCKED | No data in Postgres |
| Financial precision | PASS (schema) / BLOCKED (data) | `Decimal(16,2)` on quotation totals; `Decimal(14,3)` lead quantity. Data not migrated. |
| File references valid | BLOCKED | 0 Storage buckets exist; `migrate:mongo:marketing-files` has not been run against this project |
| RLS enabled on all tables | BLOCKED | `supabase/storage-and-database-security.sql` has not been applied (no tables to apply it to) |

## Evidence

**E1 — Supabase PostgreSQL (read-only session, `default_transaction_read_only = on`), both `DATABASE_URL` and `DIRECT_URL`:**

| Schema | Tables |
|---|---|
| auth | 27 |
| extensions | 2 |
| realtime | 3 |
| storage | 10 |
| vault | 2 |
| **public** | **0** |

`auth.users` count: 0. `storage.buckets`: none. `_prisma_migrations`: does not exist.

**E2 — Live MongoDB `my-crm` (read-only `countDocuments`):**

| Collection | Docs | Destination in dry-run plan | Ready | Exceptions |
|---|---:|---|---:|---:|
| activitylogs | 4,222 | activity_logs | 4,222 | 0 (25 warnings) |
| blogs | 1 | blog_posts | 1 | 0 |
| careerjobs | 3 | career_jobs | 3 | 0 |
| categories | 12 | categories | 12 | 0 |
| clientdatas (leads) | 62 | leads + lead_assignments | 62 | 0 |
| clientpermissions | 9,006 | legacy_orphan_records | 0 | **9,006** |
| comments | 1 | blog_comments | 0 | 1 |
| companysettings | 1 | company_settings | 1 | 0 |
| counters | 12 | legacy_counters | 12 | 0 |
| products | 125 | products + product_prices | 125 | 0 (125 warnings) |
| quotations | 18 | quotations + quotation_items | 18 | 0 |
| users | 11 | users | 11 | 0 |
| vendors | 3 | vendors | 3 | 0 |
| visitors | 408 | visitor_days | 408 | 0 |
| careerapplications, careerloginattempts, careersessions, careersettings, importhistories, vendoractivities, vendorcategories, vendordocuments, vendorevaluations, vendorimportjobs, vendorproducts | 0 each | (mapped) | 0 | 0 |

Additional live facts: 62 leads, 0 without `createdAt`, 47 carry a `fileName` (imported), 49 have at least one embedded assignment. Users: 2 admin, 9 user.

Five Mongoose models have **no collection in the live database** and **no Prisma model**: `Tasks`, `UserPerformance`, `UserActivity`, `CoachingProduct`, `PrintkeeCategory`. An earlier dry run also warned "Expected collection not present" for `tasks` and `sales`. These features hold no data today, but their Next.js equivalents are also absent (see the feature parity audit).

## Findings

### DB-01 — No schema and no data in the target Supabase database
- **Severity:** Critical · **Module:** Database · **Status:** FAIL
- **File:** `prisma/migrations/20261117000000_initial/migration.sql`, `prisma/migrations/20261118000000_careers_admin/migration.sql`
- **Description:** Neither migration has been applied; the `public` schema is empty. Every Prisma query in the app (dashboard, leads, login, careers, blogs, contact) will throw `relation does not exist` against this database.
- **Evidence:** E1.
- **Business impact:** The CRM and the database-backed marketing features (blogs, careers, contact) cannot function. Deploying would take the public site's forms and careers page down.
- **Recommended fix:** Create a separate staging Supabase project, run `prisma migrate deploy`, apply `supabase/storage-and-database-security.sql`, create buckets, run `migrate:mongo:apply` there, reconcile, and only then repeat for production with owner approval.
- **Verification:** Read-only query of `_prisma_migrations`, table row counts, and per-collection count comparison.

### DB-02 — `clientpermissions` (9,006 documents) not migrated
- **Severity:** High · **Module:** Lead permissions · **Status:** FAIL
- **File:** `scripts/migrate-mongodb/index.ts` (clientpermissions transform → `legacyOrphanRecord`); `migration-reports/mongodb-relationship-audit.json`
- **Description:** All 9,006 permission documents reference clients that do not exist (`clientPermissionOrphanClients: 9006`), and 5,888 reference users that do not exist. They are parked in `legacy_orphan_records` rather than becoming `lead_permissions`.
- **Evidence:** reconciliation report `exceptions: 9006`; relationship audit.
- **Business impact:** Probably low, since the referenced leads were deleted in MongoDB. But no one has reviewed and signed off on them, and the 49 leads with embedded `assignedTo` are the only assignment source that will carry over.
- **Recommended fix:** Have the business owner confirm in writing that these permissions are obsolete. Then record the decision in the reconciliation report.
- **Verification:** After the apply run, `select count(*) from legacy_orphan_records where collection='clientpermissions'` = 9,006, with a signed disposition.

### DB-03 — Migrated users have no Supabase Auth identity and cannot log in
- **Severity:** Critical · **Module:** Authentication / Users · **Status:** FAIL
- **File:** `scripts/migrate-mongodb/index.ts` (user upsert sets no `authUserId`); `src/app/(auth)/crm/login/actions.ts:19`; `src/app/(crm)/crm/user-management/actions.ts:11`
- **Description:** The migration creates `users` rows without `auth_user_id`. Login rejects any user without `authUserId`. The admin "Register user" action refuses existing usernames/emails, so an administrator cannot link an existing migrated user either. The linking process is documented (`docs/DATABASE_RECONCILIATION_REPORT.md:77`) but not implemented. There is also no bootstrap path for the first administrator.
- **Evidence:** `grep authUserId scripts/` → 0 matches.
- **Business impact:** After cut-over all 11 employees, including both admins, are locked out of the CRM.
- **Recommended fix:** Add a reviewed linking script that creates or invites Supabase Auth users for each migrated email and writes `auth_user_id`. Include a documented first-admin bootstrap. Force a password reset, since bcrypt hashes are intentionally not copied.
- **Verification:** On staging, log in as each migrated role; `select count(*) from users where auth_user_id is null` = 0.

### DB-04 — All 125 products lose their category
- **Severity:** High · **Module:** Products · **Status:** FAIL
- **File:** `scripts/migrate-mongodb/index.ts` (product transform); reconciliation findings `unresolved_category_code` × 125
- **Description:** The migration resolves `product.cat_id` against `Category.cat_id` (codes like `CA001`). In live MongoDB, `product.cat_id` actually holds the category's **ObjectId string**. A read-only check found 10 distinct product `cat_id` values: 9 match a `categories._id` and none match a `categories.cat_id`. Every product would therefore get `category_id = NULL`.
- **Evidence:** Read-only aggregation: product `cat_id` sample `6901af27f0729d2a996fcd8e`; category `cat_id` sample `CA001`; 9 of 10 distinct values match a category `_id`.
- **Business impact:** Category filtering, product codes, and quotation grouping by category would break.
- **Recommended fix:** Resolve `cat_id` by category `legacyId` (ObjectId) first, then by code. Review the 1 unmatched value manually. Rerun the dry run until warnings drop to that 1 reviewed case.
- **Verification:** Dry-run warnings = 0; after apply, `select count(*) from products where category_id is null` = 0.

### DB-05 — Lead uniqueness is not enforced in the database
- **Severity:** Medium · **Module:** Leads · **Status:** FAIL
- **File:** `prisma/schema.prisma` (`model Lead`: `@@index([phone])`, no unique); `src/app/(crm)/crm/lead-management/actions.ts:11`
- **Description:** Duplicate prevention is a `findFirst` followed by `create` with no unique constraint or lock. Two concurrent creates or imports can both insert. MongoDB also has no unique index on phone, so legacy duplicates may already exist.
- **Recommended fix:** Decide on canonical normalized phone uniqueness. Add a unique partial index (after de-duplicating legacy data) or use an advisory lock in the create/import path.
- **Verification:** Concurrency test on staging; a `group by phone having count(*)>1` query returns 0 rows.

### DB-06 — Lead insertion timestamp is mutable, and no index supports date reports
- **Severity:** Medium · **Module:** Leads / Reports · **Status:** FAIL
- **File:** `prisma/schema.prisma` (`Lead.createdAt @default(now())`; indexes `[status, createdAt]` only)
- **Description:** Nothing at the database level prevents `created_at` from being updated, such as a trigger or a column privilege. No standalone `created_at` index exists for the date-wise insertion report. Leads also have no import-batch foreign key; only `file_name` text links a lead to its import.
- **Recommended fix:** Add a `BEFORE UPDATE` trigger that rejects `created_at` changes and an index on `created_at`. Add a nullable `import_job_id` FK and an explicit `source` (`MANUAL`/`IMPORT`/`API`) column.
- **Verification:** Attempt an `UPDATE leads SET created_at=…` on staging and confirm it is rejected; check `EXPLAIN` on the report query.

### DB-07 — The epoch fallback would mis-date records without timestamps
- **Severity:** Low · **Module:** Migration · **Status:** PASS for current data, latent risk
- **File:** `scripts/migrate-mongodb/index.ts` (`createdAt: doc.createdAt ?? new Date(0)`)
- **Description:** A record missing `createdAt` would get 1970-01-01. Live data has 0 such leads. The ObjectId timestamp (`_id.getTimestamp()`) would be the accurate fallback.
- **Recommended fix:** Fall back to the ObjectId timestamp and log a finding.

### DB-08 — Mongoose models without a destination
- **Severity:** Low (no live data) · **Status:** FAIL (no documented destination)
- **Description:** `Tasks`, `UserPerformance`, `UserActivity`, `CoachingProduct`, and `PrintkeeCategory` have no Prisma model and no migration mapping. They have 0 live documents now, but the features that write them in MERN are not ported.

## Items that could not be verified (BLOCKED)

FK validity, orphan counts, duplicate counts, assignment preservation, follow-up preservation, precision, and file reference validity all need a populated staging database. None exists, so they are **BLOCKED**, not passed.
