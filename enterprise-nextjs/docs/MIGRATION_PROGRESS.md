# Migration progress

Last checkpoint: 2026-11-17. The original `backend/`, `frontend/`, and root artifacts have not been modified.

| Module | Original source | New source | Status | Verification | Known issue / next action |
|---|---|---|---|---|---|
| Project foundation | MERN packages | `package.json`, `src/app`, config | Implemented | Install, lint, typecheck and production build pass | Requires Node 22.12+ |
| PostgreSQL model | `backend/models/*` | `prisma/schema.prisma` | Foundation | Prisma 7.10.1 format/validate/generate pass | Tasks/UserPerformance need final mapping |
| Supabase authentication | login/auth middleware | `src/lib/supabase`, `src/lib/auth`, login/recovery/admin actions | In progress | Static verification and build pass | Real Supabase identity-link and email tests required |
| RBAC | requireRole/vendorPermissions | `src/lib/permissions`, query scopes | Foundation | Static review done | All mutation services still required |
| Public design | main pages/components | `(website)`, global design system | In progress | Responsive CSS review pending | Exact source content/media pending |
| Contact | email route | contact page/API | In progress | DB capture, HMAC rate limit and Resend path implemented | Real delivery configuration/test pending |
| Blog | blog routes/pages | blog pages/schema | In progress | Real DB reads | Admin/comments/media pending |
| Careers | careers routes/pages | careers listing/detail/application/schema | In progress | Private validated resume upload path implemented | Admin workflow and real Storage test pending |
| CRM shell | Sidebar/Navbar | CrmShell | Implemented | Role-aware render | Mobile drawer/search pending |
| Dashboard | dashboard routes/widgets | entrydashboard | In progress | Real scoped aggregates | Remaining charts/tasks/performance pending |
| Leads | lead pages/routes | lead-management/actions | In progress | Scoped create/update/delete/assign/filter actions pass static checks | Bulk flows, dedicated views, import/report pending |
| Products | product module | product-management | In progress | Real list query | CRUD/images/overview pending |
| Vendors | vendor module | vendors/schema | In progress | Real list query | All profile/actions/import/docs pending |
| Quotations | quotation module | quotations/schema | In progress | Real scoped list | Create/edit/calc/PDF pending |
| Data migration | 25 MongoDB collections | `scripts/migrate-mongodb`, Prisma schema, reconciliation reports | Dry-run complete | 13,885/13,885 documents accounted; 4,878 directly ready and 9,007 explicit archived exceptions; no PostgreSQL writes | Rehearse on non-production Supabase, resolve/sign off exceptions, then request production approval |
| Deployment | Vercel reports | deployment docs/config | Foundation | Credential-free production build passes | Credentials/domain required |

## Next executable slice

1. Configure a non-production Supabase project and execute the rehearsal in `MIGRATION_EXECUTION_PLAN.md`.
2. Resolve or formally sign off stale permissions, the orphan comment, category/actor mismatches, duplicates and missing file references.
3. Run destination counts, canonical checksums, financial comparisons, file hashes and identity-link tests.
4. Continue application feature parity and security acceptance work listed above.
5. Request explicit production migration approval only after backup, rehearsal and reconciliation gates pass.

The application is **not** claimed complete or production-ready at this checkpoint.
