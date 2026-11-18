# Vercel production deployment guide

Deployment is intentionally manual. Do not deploy or migrate production until feature parity, data reconciliation, and the security checklist are complete.

## 1. Prepare source control

1. Review `git status` and ensure `.env`, `.env.local`, migration reports, `.next`, generated Prisma Client, and local npm caches are not tracked.
2. Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm audit --audit-level=high`, and a production build.
3. Push the repository to a private GitHub repository owned by the business. Do not commit secrets.

## 2. Create the Vercel project

1. Sign in to Vercel and select the correct team.
2. Click **Add New → Project**, choose **Import Git Repository**, and select the repository.
3. In project configuration click **Edit** beside Root Directory and choose `enterprise-nextjs`.
4. Framework Preset: **Next.js**. Build command: use the detected `npm run build`. Install command: `npm ci`. Do not override output directory.
5. Select Node.js 22 in **Project → Settings → Build and Deployment** if it is not inferred from `package.json`.

Vercel documents the root-directory step in its [monorepo guide](https://vercel.com/docs/monorepos).

## 3. Add environment variables

Open **Project → Settings → Environment Variables**. Add the production values described in `ENV_SETUP_GUIDE.md`:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL`
- `DIRECT_URL` only if approved migrations run in Vercel’s build/deployment workflow; otherwise keep it in the controlled migration runner.
- `SUPABASE_SECRET_KEY`
- `RESEND_API_KEY`, `CONTACT_EMAIL_FROM`, `CONTACT_EMAIL_TO`
- `IP_HASH_SALT`

Do not add legacy MongoDB credentials to the normal Vercel application. Mark secrets as Sensitive/Secret. Choose Production; use a separate Supabase project and values for Preview/Development. Environment changes affect only new deployments, so redeploy after changes. See [Vercel’s environment variable guide](https://vercel.com/docs/environment-variables/managing-environment-variables).

## 4. Domain and authentication URLs

1. Open **Project → Settings → Domains**, add the production domain, and follow the displayed DNS records.
2. Set `NEXT_PUBLIC_APP_URL` to that canonical `https://` domain and redeploy.
3. In Supabase open **Authentication → URL Configuration**. Set Site URL to the production domain and add the production callback pattern, local development pattern, and intentionally supported Vercel preview pattern.

## 5. Approved database release

Run migrations once from a controlled job/workstation using `DIRECT_URL`:

```text
npm ci
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
```

Apply the reviewed security SQL afterward. Run the legacy migration dry-run, approve its reconciliation report, take backups, then run the apply command from the controlled migration workstation—not a Vercel Function. Production data migration requires separate explicit approval.

## 6. Deploy and verify

1. Trigger the production deployment from the production branch.
2. Confirm the build logs show Prisma generation and a successful Next.js build without printing environment values.
3. In **Project → Deployments**, open the production deployment. In **Observability → Functions**, inspect errors and durations.
4. Verify homepage, contact delivery/database capture, blogs, careers, sitemap, robots, canonical metadata and mobile layouts.
5. Verify administrator and staff login/logout/session refresh/password recovery; anonymous CRM access must redirect to login.
6. Verify lead ownership boundaries, admin-only functions, disabled users, database mutations, dashboard invalidation and exports.
7. Verify Storage MIME/size rejection, private downloads, signed URL expiry and public media.
8. Verify Supabase logs, Resend logs and Vercel logs contain identifiers but no credentials, raw IPs, resumes, document contents or password reset tokens.

## Rollback

Keep the MERN deployment and MongoDB unchanged through acceptance. If cutover fails, move the production domain back to the prior deployment, disable mutations in the new application, retain PostgreSQL/logs for reconciliation, and replay only reviewed writes after correction. Never reset either production database.
