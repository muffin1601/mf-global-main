# Staging verification pack

These scripts verify the hosted pieces that cannot be tested on the local stack. They run **only against staging** and are never part of `npm test`.

## Safety rails

All scripts share these rules (see `guard.mjs`):
- They refuse to run unless `STAGING_CONFIRM=I-UNDERSTAND-THIS-IS-STAGING` is set.
- They refuse to run if `STAGING_APP_URL` or the Supabase URL matches `PRODUCTION_HOST_PATTERN`, a regex you set to your production hostnames.
- They never print a secret, connection string or key. Output uses hostnames and counts only.
- Every script is read-only, except `02-storage.mjs`, which writes one synthetic object and then deletes it.

## Environment (put in an untracked `.env.staging`, load with `node --env-file=.env.staging ...`)

| Variable | Used by |
|---|---|
| `STAGING_CONFIRM`, `PRODUCTION_HOST_PATTERN` | all |
| `STAGING_APP_URL` | 01, 02, 03 |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 01, 02 |
| `SUPABASE_SECRET_KEY` | 02 (creates and removes one test object) |
| `STAGING_ADMIN_USER`, `STAGING_EMPLOYEE_USER`, `STAGING_DISABLED_USER`, `STAGING_TEST_PASSWORD` | 01 |
| `CRON_SECRET` | 03 |
| `VERIFY_DATABASE_URL` | 04 (read-only ledger query) |
| `OLD_DATABASE_URL` | 06 (the rotated-out credential; expected to be refused) |
| `SOURCE_DATABASE_URL`, `RESTORED_DATABASE_URL` | 05 |

## Scripts

| Script | Verifies | Evidence written |
|---|---|---|
| `01-auth.mjs` | Admin and employee sign in. The disabled user is refused. A wrong password gets the generic error. Recovery request returns a generic response. Sign-out invalidates the session. | `test-artifacts/staging/auth.json` |
| `02-storage.mjs` | The 4 buckets exist with the expected privacy. Anonymous reads of a private object are refused. A signed URL works and then expires. | `storage.json` |
| `03-integrations.mjs` | `/api/health`. Cron refuses a missing or wrong secret. With the right secret, cron reports `skipped` while `INTEGRATIONS_ENABLED` is not true. Capture endpoints refuse a missing key. | `integrations.json` |
| `04-migrations.mjs` | Runs `scripts/verify-migration-checksums.mjs` against `VERIFY_DATABASE_URL`: every applied migration's checksum matches its file, and 20261120145700 is the disable-only version. | `migrations.txt` |
| `05-backup-restore.mjs` | Compares row counts and integrity queries between the source and the restored database. | `restore.json` |
| `06-credential-rotation.mjs` | The old database credential is refused and the current one connects. | `rotation.json` |

Run them in order after following `docs/qa/STAGING_SETUP_CHECKLIST.md`. Each exits non-zero on failure. Attach the `test-artifacts/staging/` folder to the release record.
