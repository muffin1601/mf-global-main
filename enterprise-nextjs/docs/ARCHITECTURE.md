# Enterprise architecture

Next.js App Router owns public SSR, protected CRM pages and route handlers. UI code calls server actions/handlers; those call domain services; services authorize the current Supabase identity and query through Prisma. PostgreSQL is the system of record. Supabase clients are limited to authentication and object storage.

Runtime database traffic uses the Supabase transaction pooler through `DATABASE_URL`. Prisma Migrate uses `DIRECT_URL`. User-specific CRM pages are dynamic and never publicly cached. Mutations must invalidate affected dashboard/list paths. Storage separates public marketing/product media from private resumes/vendor documents.

The migration is staged: inventory, schema, dry-run extraction, reconciliation, approved apply, auth identity linking, then cutover. The original MongoDB remains read-only throughout. Rollback is DNS/Vercel alias reversal plus disabling new writes; PostgreSQL is retained for forensic reconciliation.
