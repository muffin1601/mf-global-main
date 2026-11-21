# Fix log

| Change | Files | Verification |
|---|---|---|
| DB-DEL: non-admin migration now disables accounts and deletes nothing | prisma/migrations/20261120145700_remove_non_admin_users/migration.sql | tests/migration.non-destructive.test.ts (3 tests) and a DB-DEL access test in tests/security.auth.test.ts. `prisma migrate status` is up to date, `migrate diff` against the schema is empty, and the ledger checksum matches the file. |
| BLOG-1: post-blogs answers 400 to a non-multipart body | src/app/api/blogs/post-blogs/route.ts | Vitest regression (failed before the fix, passes after) and endpoint-contract.json |
| MKT-1: send-email rejects blank or incomplete enquiries | src/app/api/send-email/route.ts | Vitest regression (4 bad payloads refused, none stored, complete payload accepted). The existing SEC-13 test still passes. |
| MKT-2: contact answers 400 to malformed JSON | src/app/api/contact/route.ts | Vitest regression and endpoint-contract.json |
| VEND-AUDIT: vendor audit returns 404 for a missing vendor | src/server/vendors/vendors.ts (`vendorAudit`) | qa.regressions.test.ts and endpoint-contract.json |
| Formatted phone identity across phone/contact, preview, manual create, edits and CSV checks | src/server/leads/{phone-identity,ingest,queries,mutations}.ts, src/server/imports/service.ts, prisma/migrations/20261120170000_lead_phone_identity | Lookup and concurrent insert tests. Browser rejected a reformatted duplicate. |
| Employee quotation prefix | quotations/create/page.tsx, quotations/quotation-form.tsx | Employee browser assertion (control-flows.json) |
| Dependency advisories | package.json, package-lock.json | npm audit on 21 Nov: 0 |
| Five conflicting regression assertions | tests/{foundation,leads.behaviour,products.service,quotations.service}.test.ts | Full suite green |
| Responsive sidebar and mobile Create button | src/app/globals.css, src/components/layout/app-shell.tsx | Chromium accessibility assertion |

## New QA tooling (21 Nov)

| Suite | What it checks | Result |
|---|---|---|
| tests/e2e/endpoint-contract.mjs | Every HTTP handler: anonymous denial, employee 403 on admin-only routes, malformed JSON, missing and malformed ids, blank enquiries, cross-origin write. Uses bogus ids only, so no seeded record changes. | 114/114 |
| tests/e2e/role-access.mjs | 32 CRM pages × anonymous/admin/employee, foreign lead and quotation refusal, scoped list and export counts against SQL, sign-in failure paths | 103/103 |
| tests/e2e/control-flows.mjs | Lead form validation, create, assign, search, sort and pagination; transfer; export; bulk delete; user create, validation, edit, disable and enable with sign-in effect; self-disable guard; report filters and exports; activity-log filters; quotation validation; employee restrictions. Every check verified in PostgreSQL. | 20/20 |

All three suites run against `node scripts/e2e/start-stack.mjs` and never touch Supabase or production.
