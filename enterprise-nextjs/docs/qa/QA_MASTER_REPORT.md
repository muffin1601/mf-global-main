# MF Global Services CRM audit

**21 November 2026 · NO-GO: every local gate passes; staging verification outstanding**

The destructive migration now disables non-admin users instead of deleting them, which matches the owner's decision. A new endpoint, role and control sweep found four defects, and all are fixed with regression tests. No production database or credential was used. The release blockers are environmental and listed in [STAGING_SETUP_CHECKLIST.md](STAGING_SETUP_CHECKLIST.md).

| Scope or check | Result |
|---|---|
| Functional areas | 15 |
| Next.js routes | 43 pages + 55 HTTP handler paths, plus robots.txt and sitemap.xml |
| Server and client surface | 66 HTTP method registrations, 63 exported server actions, 687 JSX control declarations |
| Prisma models | 47 |
| Vitest | 417 passed, 0 failed in 31 files |
| Layout checks | 380 |
| QA matrix | 2,136 rows: 1,357 PASS, 0 FAIL, 9 BLOCKED, 765 NOT RUN, 5 NOT IMPLEMENTED |
| Browser and API suites | Journey 7/7, module flows 7/7, API smoke 27/27, viewport 380/380, endpoint contract 114/114, role access 103/103, control flows 20/20 |
| Legacy regression suites | 145 backend and 70 frontend tests passed |
| Bug register | 10 found, 10 fixed, 0 open in code (DB-DEL, BLOG-1, MKT-1, MKT-2, VEND-AUDIT, LEAD-6, DEP-01, QUOTE-PREFIX, QA-ORACLES, UI-MOBILE) |

## 21 November 2026 continuation

**Migration.** `20261120145700_remove_non_admin_users` originally deleted USER accounts and their quotations. It now runs `UPDATE users SET enabled=false WHERE role='USER' AND enabled`.
- The original commit's stated goal was to keep only admins. The owner confirmed that disabling, not deleting, is required, and that the migration had not run anywhere.
- Regression tests show it contains no destructive statement, preserves users, quotations, items and ownership, and is idempotent. Disabled employees are refused at sign-in, admins are not, and re-enabling restores access.
- On the isolated database: `prisma validate` passes, `migrate status` reports 7 of 7 applied and up to date, `migrate diff` against the schema shows no difference, and the ledger checksum `50bac0a81f6c` equals the rewritten file.
- Shared-environment ledgers remain **UNKNOWN**. Read them before deploying.

**Database integrity (isolated).** All 44 foreign keys are validated. There are zero orphan quotations, quotation items or lead assignments, and zero duplicate normalised phone identities.

**New coverage.** Three new Playwright suites:
- **Endpoint contract:** all 62 handler and method pairs.
- **Role access:** 32 pages for each of 3 roles, plus cross-user refusal and scoped counts matched against SQL.
- **Control flows:** 20 workflows, each verified in PostgreSQL.

Together they added 237 executed cases. The control-flow suite also closed 57 per-control matrix rows whose controls it drove end to end. Eight new Vitest regressions cover DB-DEL and the four sweep defects.

**Final regression run.** Vitest 417/417. ESLint and TypeScript clean. `next build` exit 0. npm audit 0. All seven browser suites green.

**Not run, and why.** 765 rows remain NOT RUN.
- 630 are per-control rows: individual fields, table cells and sub-modals whose parent save paths are covered.
- 129 are endpoint rows that ask for success, rollback and retry paths beyond the auth and validation contract now covered.
- 6 are broad coverage rows.
- The Careers and Marketing rows (157) also need the careers admin PIN session and mail sandboxes.
- The 9 BLOCKED rows need staging.

## Business workflow

1. Admin login
2. Create lead and verify employee assignment in PostgreSQL
3. Formatted duplicate preview and submission rejected
4. Employee edit, notes, status and follow-up survive refresh
5. Schedule and complete employee follow-up
6. Selected customer and product, saved quotation, checked tax and total in PostgreSQL and downloaded PDF
7. Reopened saved quotation

The saved quotation had two units at ₹100 and 18% GST. PostgreSQL held ₹36 tax and ₹236 total. The PDF downloaded and the item quantity persisted after reopening. Sales orders, tax invoices, payments and the deal pipeline have no independent Next.js implementations in the discovered schema and routes.

## Module results

| Functional area | Surface | Vitest passes¹ | Layout checks | Remaining verification |
|---|---|---|---|---|
| Authentication and users | Login, recovery, callback, sign-out, employee administration | 31 | 25 | Hosted identity, email changes, recovery links and disabled sessions |
| Dashboard | Overview, entry dashboard, employee metrics | 11 | 20 | Independent reconciliation against a production-like snapshot |
| Leads and assignments | Lead presets, create, edit, ownership, transfers, record detail, tags | 40 | 100 | Every filter combination, concurrent bulk operations and record updates |
| Activities and follow-ups | Timeline, logged calls, notes, tasks, scheduling and completion | 10 | 30 | All calendar boundaries and reminder delivery |
| Imports and exports | Lead CSV preview, batches, history, retry, templates, downloads | 26 | 10 | Large end-to-end browser imports and slow upload recovery |
| Reports | Lead insertion report with CSV, XLSX and PDF | 20 | 10 | Every date, variant and export under each role |
| Product catalog | Categories, items, prices, images, product dashboard | 39 | 20 | Hosted storage lifecycle and historical product references |
| Vendors | Directory, contacts, bank details, archive, blacklist, documents, import, performance | 97 | 90 | Hosted attachments, all modals and complete role-by-action grid |
| Quotations | Client/product selection, line calculations, numbering, editing, PDF | 17 | 30 | Complete approval/revision requirements and all rounding combinations |
| Global search and saved views | Command palette, saved list configuration | 12 | 0 | Keyboard flow and persisted preference combinations |
| Audit history | Activity log and entity changes | 10 | 10 | Source-by-source completeness and production retention |
| Inbound integrations | Capture endpoints and trade-platform jobs | 23 | 0 | Provider sandbox callbacks, scheduling, retry and delivery |
| Careers | Public jobs, applications, resume uploads, administrative portal | 0 | 10 | Admin session, real storage and notification sandbox |
| Marketing and blogs | Home, contact, blogs and blog comments | 0 | 25 | Embedded assets and mail sandbox |
| Platform and migration | Health, schema, migration, storage policy and dependencies | 77 | 0 | Restore rehearsal and shared migration ledger |

## Evidence and checkpoint

[Coverage matrix](TEST_MATRIX.md) · [Action inventory](ACTION_INVENTORY.md) · [Route inventory](ROUTE_INVENTORY.md) · [API inventory](API_INVENTORY.md) · [Module inventory](MODULE_INVENTORY.md)

[Bug register](BUG_REGISTER.md) · [Fix log](FIX_LOG.md) · [Security](SECURITY_AUDIT.md) · [Database](DATABASE_AUDIT.md) · [API tests](API_AUDIT.md) · [Browser tests](UI_UX_AUDIT.md) · [Performance](PERFORMANCE_REPORT.md) · [Release gates](PRODUCTION_READINESS.md)

[Raw automated assertions](../../test-artifacts/final-tests.json) · [Browser journey and PDF](../../test-artifacts/journey) · [Migration rehearsal](../../test-artifacts/database-rehearsal.json) · [Endpoint contract](../../test-artifacts/endpoint-contract.json) · [Role access](../../test-artifacts/role-access.json) · [Control flows](../../test-artifacts/control-flows.json) · [Staging checklist](STAGING_SETUP_CHECKLIST.md)

Open rows are explicit in TEST_MATRIX.md. All three browsers signed in and opened the dashboard. Chromium also exercised ten dashboard counts against independent SQL, product creation, vendor creation, filtered list refresh, dark theme, keyboard search, CSV preview/commit and sign-out. [Module workflow assertions](../../test-artifacts/module-flows.json). The broad per-control contract and every HTTP failure mode remain incomplete. Local auth and storage used test doubles. Older workspace reports describe different snapshots and are not evidence of current production state.

## Reproduce locally

On Windows, start the shell from the canonically cased path (for example C:\Users\...). A lowercase drive letter (c:\Users\...) made all 30 Vitest files fail with "Vitest failed to find the runner" and no tests executed. That is a tooling artifact, not a product failure. From the canonical path the suite passes 417 of 417. In PowerShell: `Set-Location 'C:\Users\...\enterprise-nextjs'; npx vitest run`.

From enterprise-nextjs, use `npm test` for the disposable PostgreSQL regression suite. For the browser tests, install the Playwright browser binaries with `npx playwright-core install chromium firefox webkit`. Start `node scripts/e2e/start-stack.mjs` and wait for the local login page on port 3100. In a separate terminal in the same directory, run `node tests/e2e/customer-journey.mjs`, then `node tests/e2e/module-flows.mjs`, `node tests/e2e/viewport-audit.mjs`, `node tests/e2e/api-smoke.mjs`, `node tests/e2e/endpoint-contract.mjs`, `node tests/e2e/role-access.mjs` and `node tests/e2e/control-flows.mjs`. The journey creates the quotation fixture used by subsequent checks. Test artifacts are local and git-ignored. Repeated sign-ins can reach the test stack's throttle. The local-only reset helper is `node scripts/e2e/reset-rate-limits.mjs`.
