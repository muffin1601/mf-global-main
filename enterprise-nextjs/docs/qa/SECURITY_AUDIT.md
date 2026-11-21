# Security audit

## 21 November 2026 update

- **Dependencies:** npm audit reports 0 advisories at every severity.
- **Endpoint contract:** all 62 handler and method pairs were swept (114 checks, all passing).
  - Every protected handler refuses anonymous callers, and admin-only handlers return 403 to employees.
  - Malformed JSON, missing ids and malformed ids get a 4xx, never a 5xx. Cross-origin writes are refused.
  - The sweep found and fixed three crash and validation defects (BLOG-1, MKT-1, MKT-2) and one wrong-status defect (VEND-AUDIT).
- **Page access:** employees are bounced from the 8 admin-only pages. They cannot open another user's lead, quotation edit page or quotation PDF. Their lead list and CSV export contain exactly their own leads, matched against SQL.
- **Sign-in:** wrong passwords and unknown users get the same generic message. Disabled users are refused, including every employee disabled by the DB-DEL migration until re-enabled.
- **Exposed database credential:** no real connection string, Supabase secret key or JWT appears in any of the 143 commits. Every `DATABASE_URL` and `DIRECT_URL` in history is a placeholder. No untracked log, report, CSV or JSON in the workspace holds one either, and `.env` and `*.log` are git-ignored. Whether the exposed password was rotated is **UNKNOWN**. Only the project owner can confirm it in the Supabase dashboard, and I did not probe production with any credential. The rotation steps are in [STAGING_SETUP_CHECKLIST.md §9](STAGING_SETUP_CHECKLIST.md).

## Earlier findings

- The initial dependency scan counted 1 critical, 5 high and 1 moderate affected packages. The critical one concerned the development test UI, and no exposed UI server was found.
- Production Supabase Auth, recovery emails, RLS and bucket policies need an isolated hosted project to verify.
- The local .env has empty values for INTEGRATIONS_ENABLED, ENABLE_INDIAMART_SYNC, CRON_SECRET and CAREERS_ADMIN_PIN_HASH.
- vercel.json defines no cron schedule, so a trigger for `/api/cron/tradeindia` still needs deciding.

[Endpoint contract](../../test-artifacts/endpoint-contract.json) · [Role access](../../test-artifacts/role-access.json) · [Dependency retest](../../test-artifacts/dependency-retest.json) · [Permission definitions](../../src/lib/permissions/index.ts)
