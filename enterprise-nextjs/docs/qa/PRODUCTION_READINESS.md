# Production readiness

**NO-GO, 21 November 2026.** Nothing is failing in code, and every local gate passes. Release is blocked by checks that need a staging environment: the shared migration ledger, hosted Supabase Auth and Storage, integration sandboxes, a backup restore rehearsal, and credential rotation. [STAGING_SETUP_CHECKLIST.md](STAGING_SETUP_CHECKLIST.md) lists exactly what to provide.

| Gate | Status | Evidence or missing input |
|---|---|---|
| Vitest (disposable PostgreSQL) | PASS | 417/417 in 31 files (final-tests.json) |
| ESLint | PASS | `eslint . --max-warnings=0`, 0 problems |
| TypeScript | PASS | `tsc --noEmit`, 0 errors |
| Production build | PASS | `next build` exit 0 (separate dist dir) |
| Playwright, local stack | PASS | journey 7/7 steps, module flows 7/7, API smoke 27/27 (3 engines signed in), viewport 380/380, endpoint contract 114/114, role access 103/103, control flows 20/20 |
| Prisma migration validation, isolated DB | PASS | `validate` OK. `migrate status`: 7 applied, up to date. `migrate diff` against the schema: no difference. |
| Database integrity, isolated DB | PASS | 44 FKs validated. 0 orphan quotations, items or assignments. 0 duplicate phone identities. |
| Dependency advisories | PASS | npm audit: 0 |
| Destructive migration (DB-DEL) | PASS locally | Now disables only. The owner says it never ran on a shared database. Confirm with the read-only ledger query in the checklist (§3) before any shared deploy. |
| Migration ledger, shared environments | UNKNOWN | No access. If any ledger already lists 20261120145700, stop and reconcile that environment against a backup. |
| Hosted Auth, Storage, integrations | BLOCKED | Needs a staging Supabase project, buckets, an SMTP sandbox and provider sandboxes |
| Backup and restore | BLOCKED | Needs a restorable staging backup and a timed restore |
| Credential rotation | UNKNOWN | No credential exists in git history (143 commits scanned) or in local logs or reports. Whether the exposed database password was rotated can only be checked in the Supabase dashboard. |
| Per-control and endpoint acceptance | PARTIAL | 765 matrix rows still NOT RUN (see below) |

## Deployment note

The migration disables every non-admin account on deploy. Employees cannot sign in until an admin re-enables them in User Management. This matches the owner's decision. Tell staff before release and plan who re-enables which accounts.

## What a GO needs

1. Ledger query on every shared database shows 20261120145700 absent, or a reconciliation done where it is present.
2. Staging deploy, then a re-run of the browser suites against staging, with the 9 BLOCKED rows closed.
3. A backup restored into a second database, with row counts and integrity matching.
4. The exposed database password rotated, dependent environments updated, and connectivity verified.
5. A decision on whether the remaining NOT RUN rows block release or become post-release acceptance work. Most are per-field rows on forms whose save paths are already covered.
