# API inventory

The Express server mounts routes beneath `/api`, plus `/api/quotations`, `/api/overview`, `/api/blogs`, and `/api/vendor-management`. The following active groups were verified from route declarations.

- Authentication/users: login; users/all users; register; toggle; change password; user activity.
- Leads: add, duplicate phone/contact checks, delete, bulk save, assigned lists, filtered lists, update, assignment/removal/transfer, metadata.
- Lead imports: sample, preview, commit, history, report; legacy CSV upload.
- Filters/reports: admin/assigned/unassigned filters; CSV reports by user or lead selection.
- Dashboard: role dashboard, counts, per-user stats, all/converted/trending/assigned/unassigned/new clients.
- Follow-ups: reminder buckets and update status.
- Products/categories: catalogue CRUD/archive/image behavior, overview analytics, category CRUD.
- Quotations: list/detail/create/update/delete and related client lookup.
- Vendors: meta, summary, list/detail/create/update, duplicate checks, bulk status/archive, status/archive/restore/delete/audit.
- Vendor child resources: contacts, addresses, activities, products/pricing, documents/files, evaluations/leaderboard, categories.
- Vendor import/export: upload, validate, commit, report, template, export.
- Public: contact email, visitors, blogs/comments, career jobs/applications/admin/statistics/resume downloads.
- Webhooks/integrations: CoachingPromo capture, Printkee capture; IndiaMART and TradeIndia ingestion execute outside route handlers.

New Next.js handlers must call domain services that run server-side authorization before Prisma. Public handlers require Zod validation and rate limiting at the deployment edge. Prisma is the only general application ORM.
