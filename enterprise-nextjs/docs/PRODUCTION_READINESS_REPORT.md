# Production readiness report

Assessment date: 2026-11-17. **Overall status: PARTIAL — deployment is blocked.**

## Completed

- **Build toolchain — COMPLETE:** pinned mutually compatible Next.js 16, React 19, Prisma 7 and TypeScript 6; strict typecheck, ESLint, Prisma validation/client generation and production build passed on 2026-11-17. `npm audit --audit-level=high` reported zero vulnerabilities.
- **Application isolation — COMPLETE:** implementation changes remain under `enterprise-nextjs`; original MERN source remains the read-only parity authority.
- **Core architecture — COMPLETE:** App Router, module-scoped one-connection `pg` pool, Prisma server access, Supabase SSR session clients, protected CRM layout, no public database ORM.
- **Inventory and relational design — COMPLETE for discovered models:** source-backed feature/API/route/database/permission inventories and initial SQL exist.
- **Credential-free configuration — COMPLETE:** example files contain placeholders only; validation reports variable names without values.

## Partial

- **Authentication — PARTIAL:** username/email login, logout, SSR session refresh, recovery callback/reset, enabled-user enforcement and administrator Supabase provisioning/password controls are implemented. Real-project email recovery, identity linking and end-to-end permission tests require Supabase configuration.
- **Database migration — PRE-IMPORT COMPLETE, EXECUTION BLOCKED:** read-only inventory covers 25 collections and 13,885 documents. The dry run accounts for all 13,885: 4,878 directly ready and 9,007 retained as explicit exceptions. The runner covers every non-empty source collection with batch transactions, checkpoints and idempotent upserts. No PostgreSQL production write has occurred; rehearsal, destination reconciliation, exception sign-off, backup evidence and explicit approval remain mandatory.
- **CRM — PARTIAL:** live database-backed dashboard/read views plus scoped lead create/update/delete/assignment and basic filters exist. Lead bulk transfer/exact advanced filter semantics/import/export, product mutations, quotation authoring/PDF, vendor profiles/children/import/documents, activity and remaining dashboard widgets are missing.
- **Public website — PARTIAL:** redesigned SSR homepage, contact, blogs, careers and a validated private-resume application flow exist. Exact original content/media, blog administration/comments, careers administration and visitor capture are incomplete.
- **Contact — PARTIAL:** validated storage, HMAC rate limiting and optional Resend notification are implemented. Production domain/API configuration and delivery verification are outstanding.
- **Storage — PARTIAL:** secure bucket and policy design is documented; file upload/download handlers are not complete and buckets have not been created.
- **Security — PARTIAL:** server authorization foundation, noindex, headers, Zod validation, safe callback redirect and Data API lockdown SQL exist. A complete IDOR/CSRF/upload/content security review must follow completion of every mutation endpoint.
- **Vercel — PARTIAL:** build and configuration guide exist. No project, production environment, domain or deployment has been configured or executed.

## Not started or blocked

- **Production Supabase resources — BLOCKED:** owner must create the project, copy values privately, create buckets and approve schema/security application.
- **Production data migration — BLOCKED:** credentials, verified backup/restore, non-production rehearsal, destination reconciliation, exception approval and explicit execution approval are required. Known exceptions include 9,006 stale permission records, one orphan comment, 125 missing product-category relationships, 25 unknown activity actors and missing local file references.
- **Production deployment — BLOCKED:** feature parity and security acceptance are incomplete; Vercel account/domain actions belong to the owner.

## Required environment variables

Runtime: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `SUPABASE_SECRET_KEY`, `IP_HASH_SALT`. Contact delivery additionally requires `RESEND_API_KEY`, `CONTACT_EMAIL_FROM`, and `CONTACT_EMAIL_TO`. Controlled migrations require `DIRECT_URL`; legacy data migration additionally requires the `LEGACY_MONGODB_*` variables. Details are in `ENV_SETUP_GUIDE.md`.

## Manual actions remaining

1. Create the Mumbai Supabase project and record configuration privately.
2. Configure Auth URLs/email and Storage buckets using `SUPABASE_SETUP_GUIDE.md`.
3. Rehearse and approve Prisma migration/security SQL in a non-production project.
4. Complete and reconcile every MongoDB transform before approving live import.
5. Finish all modules listed as partial in `MIGRATION_PROGRESS.md` and run permission/security acceptance tests.
6. Create the Vercel project only after those gates pass; configure environment variables and domain, then deploy manually.

The application must not be described as production-ready until every critical item above is COMPLETE and verified against real infrastructure.
