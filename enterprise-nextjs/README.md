# MF Global Enterprise CRM

This is the isolated Next.js migration of the existing MERN CRM and public website. The original sibling `backend/`, `frontend/`, documentation and data files are read-only and remain the parity source of truth.

## Local setup

1. Use Node.js 22.12 or newer.
2. Copy `.env.example` to `.env.local` and provide a development Supabase project.
3. Run `npm install`, `npx prisma generate`, and `npm run dev`.
4. Create migrations against a non-production database with `npx prisma migrate dev --name initial`.

`npm run migrate:mongo:dry-run` reads legacy MongoDB and writes a reconciliation report. It does not write PostgreSQL. `npm run migrate:mongo:apply` writes PostgreSQL and must not be used against production until the report is reviewed and the owner gives explicit approval.

Read `docs/MIGRATION_PROGRESS.md` before treating any module as complete.
