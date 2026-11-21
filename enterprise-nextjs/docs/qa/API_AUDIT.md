# API audit

| Chromium admin GET | Status | Bytes | Assertion |
|---|---|---|---|
| /api/health | 200 | 21 | PASS |
| /api/categories | 200 | 298 | PASS |
| /api/products | 200 | 6992 | PASS |
| /api/products/2f6d55b0-85ab-4d02-82bb-a9141f9efd56 | 200 | 583 | PASS |
| /api/products/search?q=E2E | 200 | 15 | PASS |
| /api/products/code-preview?categoryId=bd5cce46-581d-406a-80f9-114167fc66a7 | 200 | 24 | PASS |
| /api/search?q=E2E | 200 | 2451 | PASS |
| /api/lead-import/history | 200 | 1621 | PASS |
| /api/lead-import/sample | 200 | 460 | PASS |
| /api/leads/export | 200 | 9806 | PASS |
| /api/reports/lead-insertion/export?format=csv | 200 | 6511 | PASS |
| /api/reports/lead-insertion/export?format=xlsx | 200 | 9037 | PASS |
| /api/reports/lead-insertion/export?format=pdf | 200 | 2839 | PASS |
| /api/quotations/clients?q=Journey | 200 | 2063 | PASS |
| /api/quotations/bed4f504-03ac-496b-b657-b876e12b1bd5/pdf | 200 | 72158 | PASS |
| /api/vendors | 200 | 2501 | PASS |
| /api/vendors/export | 200 | 1023 | PASS |
| /api/vendors/import/template | 200 | 173 | PASS |
| /api/vendors/4086e343-f41a-4557-9174-13814dfc86b8/documents | 200 | 45 | PASS |
| /api/vendors/4086e343-f41a-4557-9174-13814dfc86b8/audit | 200 | 43 | PASS |
| /api/blogs | 200 | 163 | PASS |
| /api/blogs/cc4ada0c-36ba-4934-a01f-ee4897837631 | 200 | 161 | PASS |
| /api/blogs/comments/cc4ada0c-36ba-4934-a01f-ee4897837631 | 200 | 2 | PASS |
| /api/careers/jobs | 200 | 40 | PASS |

The browser used a local authenticated session. Checks covered nonempty bodies, expected status, the product count against PostgreSQL, XLSX ZIP signature and PDF signature. Unit and service tests cover additional failures and authorization logic. Complete HTTP contracts for all verbs and hosted integrations remain open.

[API and action inventory](API_INVENTORY.md) · [Raw responses metadata](../../test-artifacts/api-browser-results.json)

The lead export retest parsed the CSV, compared the complete multiset of name, company and phone triples with local PostgreSQL, and checked the row-count header.
