# Bug register

Ten findings, all fixed locally. None is open in code. The release blockers are environmental (see PRODUCTION_READINESS.md).

| ID | Severity | Finding and reproduction | Disposition and evidence |
|---|---|---|---|
| DB-DEL | P0 | The original 20261120145700 migration deleted every USER account with their quotations and line items. In a rollback rehearsal on seeded data, USER accounts went from 3 to 0, quotations from 2 to 0 and lines from 1 to 0. | FIXED locally, 21 Nov. The owner confirmed it had not run anywhere and that the requirement is to disable, not delete, non-admin users. It was rewritten in place to `UPDATE users SET enabled=false WHERE role='USER' AND enabled`. The original commit (8726596, "keep only admins") shows the intent was access removal, which disabling achieves. Evidence: tests/migration.non-destructive.test.ts (no DELETE/TRUNCATE/DROP, counts and ownership unchanged, idempotent) and the access test in tests/security.auth.test.ts (employee refused after the migration, admin allowed, re-enable restores access). The isolated database ledger checksum `50bac0a81f6c` matches the new file. Deploy effect: every employee is disabled until an admin re-enables them. Still needs ledger checks on shared environments. |
| BLOG-1 | P2 | `POST /api/blogs/post-blogs` as admin with a JSON or non-multipart body returned HTTP 500, because `request.formData()` threw. | FIXED. Returns 400 "Expected multipart form data". Vitest regression failed before the fix and passes after. endpoint-contract.json passes. |
| MKT-1 | P2 | `POST /api/send-email` with `{}` returned 200, stored a blank contact submission and attempted a notification email. This is a spam and empty-lead vector. | FIXED. The server now requires name, phone and message (matching the ContactUs form's `required` inputs), and an email, if given, must be valid. Regression: four bad payloads are refused and none is stored. A complete payload still returns 200. |
| MKT-2 | P3 | `POST /api/contact` with malformed JSON returned HTTP 500 (unguarded `request.json()`). | FIXED. Returns 400. Regression covers both contact endpoints. |
| VEND-AUDIT | P3 | `GET /api/vendors/{id}/audit` for a non-existent vendor returned 200 with an empty page instead of 404. | FIXED. `vendorAudit` checks that the vendor exists first. Service regression returns 404 for a missing vendor and a page for a real one. |
| LEAD-6 | P1 | Store (98111) 22233 in contact, preview 98111-22233 in phone, then insert the bare digits. The old preview returned exists=false. | FIXED locally. PostgreSQL regression and browser duplicate rejection pass. Existing duplicates need business reconciliation. Zero duplicate phone identities remain in the E2E database. |
| DEP-01 | P1 | The initial npm audit listed seven affected packages, including a critical advisory for the Vitest UI server and a high-severity Effect advisory. | FIXED. npm audit retest on 21 Nov: 0 advisories at every severity. |
| QUOTE-PREFIX | P2 | A USER could type a quotation prefix that the server later replaced. | FIXED. The employee sees a disabled prefix (re-verified in control-flows.json). |
| QA-ORACLES | P2 | Five existing assertions failed after earlier behaviour changes. The task wrapper masked the exit code. | Assertions and fixtures corrected. Related: on Windows, a lowercase drive letter in the shell path makes every Vitest file fail with "failed to find the runner". Run from the canonically cased path. |
| UI-MOBILE | P2 | At 375 px the closed sidebar stayed in the accessibility tree, and the icon-only Create button had no accessible name. | FIXED. Chromium checks the closed and open states. |

## Expectations corrected during the sweep (not product defects)

- Careers admin `session` (GET without a session) and `login` (POST without a valid PIN) return 401 by design. They were wrongly classed as public in the first sweep draft.
- The first employee access draft expected `/crm/lead-management` to be admin-only. It is open to employees and scoped to their own leads.
- Lead modal Cancel, Enable confirmation, the disabled Last page button on the final page, the absence of row checkboxes for employees, and the greyed-out self-disable button were all correct. The first control-flow draft used the wrong selectors.

## Previous work

Earlier fixes remain in the working tree. Their regression cases keep their original issue IDs in TEST_MATRIX.md.
