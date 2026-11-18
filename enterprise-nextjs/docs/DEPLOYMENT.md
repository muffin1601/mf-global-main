# Vercel and Supabase deployment

1. Create Supabase production project and private storage buckets for `vendor-documents` and `career-resumes`; create media buckets according to the chosen public/private policy.
2. In Vercel import the repository and set **Root Directory** to `enterprise-nextjs`, framework preset Next.js, and Node.js 22.
3. Configure every variable in `.env.example`. Use the Supabase pooled connection for `DATABASE_URL` and the direct/session connection for `DIRECT_URL`. Never expose service-role or database secrets with `NEXT_PUBLIC_`.
4. Run `npm ci`, `npx prisma migrate deploy`, then `npm run build` in a controlled deployment workflow. The build script generates Prisma Client.
5. Add the production URL to Supabase Auth redirect URLs. Configure the custom domain and update `NEXT_PUBLIC_APP_URL`.
6. Verify login/logout/session refresh, role scopes, CRUD workflows, signed downloads, contact/career submissions, metadata, sitemap, robots, security headers and logs.
7. Do not run `migrate:mongo:apply` until the dry-run reconciliation report is reviewed and explicit approval is recorded.

Rollback: keep the prior MERN deployment and MongoDB unchanged; move the domain alias back to the prior deployment, disable new-system mutations, preserve PostgreSQL and logs, reconcile writes, and only retry after the defect is corrected.
