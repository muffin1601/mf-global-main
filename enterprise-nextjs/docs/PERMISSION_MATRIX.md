# Permission matrix and authorization boundary

| Capability | Admin | User | Public |
|---|---:|---:|---:|
| View own/assigned leads | Yes | Yes | No |
| View all/unassigned leads | Yes | No | No |
| Assign/transfer/delete leads | Yes | No | No |
| Update lead with explicit permission | Yes | Yes | No |
| Manage users/passwords | Yes | No | No |
| View product management | Yes | No | No |
| View/create/edit/export vendors | Yes | Yes | No |
| Vendor documents | Yes | Yes | No |
| Archive/delete/import vendors | Yes | No | No |
| Vendor performance/categories/bank fields | Yes | No | No |
| Own quotations | Yes | Yes | No |
| All quotations | Yes | No | No |
| Blog/career administration | Yes | No | No |
| Published website content and submissions | No admin required | No admin required | Yes |

Supabase Auth proves identity. `User.authUserId` maps that identity to application role and enabled state. Prisma uses a privileged server connection, so RLS does **not** automatically constrain Prisma queries. Every service must apply role and ownership predicates before querying or mutating. Browser code never receives `DATABASE_URL` or the service-role key. Storage buckets for resumes and vendor documents are private and downloads use short-lived signed URLs after application authorization.
