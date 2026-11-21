# Staging setup checklist

This checklist lists what staging needs before the 9 BLOCKED release checks can run. Put secret values only in the staging host's environment settings or in an untracked `.env.local`. Never put them in git, chat, tickets or these documents. Local browser testing does not need any of this: `node scripts/e2e/start-stack.mjs` runs entirely on fake auth, storage and integrations.

Owner: ______  Target date: ______

## 1. Supabase project

- [ ] Create a separate Supabase project for staging, in the same region as production. Do not reuse the production project, and do not reuse the project whose database password was exposed.
- [ ] Record only the project reference here: `__________`.
- [ ] Turn on the backups available on the plan (PITR if possible) before loading any data.

## 2. PostgreSQL

- [ ] Set `DATABASE_URL` to the pooled URL (port 6543, `pgbouncer=true&connection_limit=1&sslmode=require`).
- [ ] Set `DIRECT_URL` to the direct URL (port 5432, `sslmode=require`). Migrations use this one.
- [ ] Run `npx prisma migrate status` against staging and save the output.
- [ ] Run `npx prisma migrate deploy`. Seven migrations should apply, including the rewritten `20261120145700_remove_non_admin_users`, which disables USER accounts and deletes nothing.
- [ ] Run `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`. It should exit with code 0, meaning no drift.
- [ ] Apply `supabase/storage-and-database-security.sql` (RLS and grants).
- [ ] Run the integrity queries from section 9 of the QA master report: foreign keys validated, no orphan quotations or items, no duplicate phone identities.

## 3. Migration ledger check (before any shared environment deploys)

- [ ] On every shared database (production, any old staging), run this read-only query: `select migration_name, checksum, finished_at, rolled_back_at from _prisma_migrations order by started_at;`
- [ ] Confirm that `20261120145700_remove_non_admin_users` is absent everywhere. If it is present anywhere, stop. The deleting version may have run there, and that environment needs reconciling against a backup instead.
- [ ] After deploying, confirm that the ledger checksum for that migration starts with `50bac0a81f6c`, which is the SHA-256 of the rewritten file with LF line endings. Git on Windows may check it out with CRLF, which changes the checksum. Run deploys from a consistent checkout, ideally CI on Linux, or add a `.gitattributes` rule `*.sql text eol=lf`.

## 4. Supabase Auth

- [ ] Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` (server only).
- [ ] Add the staging app URL to the redirect allow-list, including `/auth/callback`.
- [ ] Configure SMTP to a test inbox (for example Mailpit or a Resend test domain) so recovery emails can be checked without reaching real staff.
- [ ] Run the provisioner so disabled users get a banned Supabase identity (`src/server/auth/provision.ts`).

## 5. Test identities (synthetic only)

| Identity | Role | State | Purpose |
|---|---|---|---|
| qa.admin | ADMIN | enabled | Full administration |
| qa.admin2 | ADMIN | enabled | Second admin for self-disable and concurrency checks |
| qa.exec1 | USER | enabled | Employee with assigned leads |
| qa.exec2 | USER | enabled | Transfer target and cross-user isolation |
| qa.disabled | USER | disabled | Sign-in refusal and banned identity |

- [ ] Use `@example.test` or a dedicated test domain for every address.
- [ ] Store the passwords in the team password manager. Never put them in the repo.
- [ ] Remember that the migration disables every USER at deploy. Re-enable `qa.exec1` and `qa.exec2` afterwards and confirm that they can sign in.

## 6. Supabase Storage

- [ ] Create private buckets `career-resumes` and `vendor-documents`.
- [ ] Create `blog-media` and `product-images`, public-read only if the site needs it.
- [ ] Check that an anonymous request for a private object returns 401 or 403. Check that an employee without the vendor documents grant cannot download a vendor document.
- [ ] Check upload size limits: 5 MB for blog media, `MAX_DOCUMENT_BYTES` for vendor documents.

## 7. Integration sandboxes

| Variable | Staging value |
|---|---|
| `INTEGRATIONS_ENABLED` | `false` until the sandbox checks pass |
| `ENABLE_INDIAMART_SYNC` | `false` |
| `INDIAMART_API_KEY`, `TRADEINDIA_USERID`, `TRADEINDIA_PROFILE_ID`, `TRADEINDIA_KEY` | Provider sandbox credentials, or leave unset |
| `COACHINGPROMO_API_KEY` | A staging-only key shared with the partner's test site |
| `CRON_SECRET` | New random value of 32+ characters |
| `RESEND_API_KEY`, `CONTACT_EMAIL_FROM`, `CONTACT_EMAIL_TO` | Test domain, with mail going to a QA inbox |
| `CAREERS_NOTIFICATION_EMAILS`, `CAREERS_NOTIFICATION_FROM` | QA inbox |
| `CAREERS_ADMIN_PIN_HASH` | bcrypt hash of a staging-only PIN |
| `IP_HASH_SALT` | New random value of 32+ characters (production refuses to run without one) |
| `NEXT_PUBLIC_APP_URL` | Staging URL |

- [ ] `vercel.json` has no cron entries. Decide what triggers `/api/cron/tradeindia` on staging and production, and record the decision.

## 8. Backup and restore rehearsal

- [ ] Take a backup of staging after seeding.
- [ ] Restore it into a second, empty Supabase project or a local PostgreSQL instance.
- [ ] On the restored copy, compare row counts for users, leads, lead_assignments, quotations, quotation_items, vendors and activity_logs with the source.
- [ ] Run `prisma migrate status` and the integrity queries on the restored copy.
- [ ] Record how long the restore took and the recovery point. Save the evidence under `test-artifacts/staging/`.

## 9. Credential rotation

- [ ] In the Supabase dashboard for the project whose password was exposed, reset the database password.
- [ ] Update `DATABASE_URL` and `DIRECT_URL` everywhere the old one was used: hosting env vars, CI secrets, local `.env` files, and any migration-runner machines.
- [ ] Rotate `SUPABASE_SECRET_KEY` if it was ever shared alongside the password.
- [ ] Redeploy, then check `/api/health` and a sign-in.
- [ ] Confirm that the old password is refused. Use the Supabase dashboard's connection logs, or a one-off connection attempt by the account owner. Do not paste the old value anywhere.
- [ ] Note the rotation date and who did it in `SECURITY_AUDIT.md`, without the value.

## 10. Release rehearsal on staging

- [ ] Run the four local browser suites (`customer-journey`, `module-flows`, `api-smoke`, `viewport-audit`) with `base` pointed at staging.
- [ ] Run the three new suites (`endpoint-contract`, `role-access`, `control-flows`) the same way. The new suites read seed data straight from the local database, so adapt them, or seed staging with the same script.
- [ ] Re-test the 9 BLOCKED matrix rows and attach evidence.
