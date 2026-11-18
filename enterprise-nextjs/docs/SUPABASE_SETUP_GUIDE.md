# Supabase production setup

## 1. Create the organization and project

1. Sign in to the Supabase Dashboard. Create an organization or select the business-owned organization.
2. Click **New project**, choose the organization, enter the production project name, and generate a unique database password in a password manager.
3. Select **South Asia (Mumbai), `ap-south-1`** for primarily India-based users and Indian data residency. Region selection is permanent for the primary project, so confirm residency requirements first. Supabase lists Mumbai as the specific South Asia region in its [region guide](https://supabase.com/docs/guides/platform/regions).
4. Choose the production plan based on backup, recovery, and availability requirements. Wait for provisioning to finish.

## 2. Collect public API configuration

1. Open the project and click **Connect** at the top.
2. Copy the Project URL into `NEXT_PUBLIC_SUPABASE_URL`.
3. Copy the publishable key into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. If the Connect dialog does not show the desired key, open **Settings → API Keys**. There is no separate “Settings → API” page in the current Dashboard.
5. Under **Secret keys**, create/copy a dedicated backend secret into `SUPABASE_SECRET_KEY`. Store it only in `.env.local` and Vercel’s encrypted environment settings. Do not paste it into chat.

## 3. Collect database connections

1. Click **Connect → Transaction pooler**. Copy the port `6543` string to `DATABASE_URL`. Replace the password placeholder locally and append `pgbouncer=true`, `connection_limit=1`, and `sslmode=require` query parameters.
2. Click **Connect → Direct connection**. Copy this to `DIRECT_URL` for Prisma migrations. The direct host is normally IPv6. If the migration runner is IPv4-only and no IPv4 add-on is enabled, use the **Session pooler** string on port `5432` instead.
3. Do not derive the pooler host manually; copy it because pooler cluster indexes differ.
4. In **Database → Settings → SSL Configuration**, enforce SSL after confirming every client uses SSL. Downloaded CA certificates only improve verification when the driver is explicitly configured to use them.

Runtime code creates one module-scoped `pg` pool with a maximum of one connection per warm Vercel instance. Prisma uses the transaction pooler; migrations use a direct/session connection. See Supabase’s [connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 4. Apply schema and database security — approval required

After a non-production rehearsal and explicit production approval:

```text
npm ci
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
```

Then review and run `supabase/storage-and-database-security.sql` in **SQL Editor → New query**. It removes browser Data API privileges from application tables and enables RLS with no browser policies. Prisma still uses server credentials, so every Prisma service must enforce application RBAC; RLS alone does not constrain privileged Prisma queries.

Never run `prisma migrate reset`, `db push --force-reset`, or `migrate dev` against production.

## 5. Configure Supabase Auth

1. Open **Authentication → URL Configuration**.
2. Set **Site URL** to the canonical production URL, such as `https://crm.example.com`.
3. Add redirect URLs:
   - `http://localhost:3000/**`
   - `https://YOUR_PRODUCTION_DOMAIN/**`
   - Optional Vercel previews: `https://*-YOUR_TEAM_SLUG.vercel.app/**`
4. Open **Authentication → Providers → Email**. Keep email/password enabled. Decide whether administrator-created staff accounts require confirmation; this app creates approved staff with confirmed email through a protected server action.
5. Open **Authentication → Email Templates → Reset password** and confirm links use the redirect URL/callback supported by `/auth/callback`.
6. Open **Authentication → Rate Limits** and set limits appropriate to the workforce size. Configure custom SMTP before production so recovery emails are reliable and branded.
7. Under **Authentication → Users**, do not hand-create parallel application records. Use the CRM administrator workflow or the documented migration linking process so `auth.users.id` is recorded in `public.users.auth_user_id`.

Supabase requires the password-reset destination to be allowlisted; its [redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls) documents local and Vercel patterns.

## 6. Create Storage buckets

Open **Storage → New bucket** and create:

- `vendor-documents`: private, 10 MB limit; allow PDF, common office documents, and approved images.
- `career-resumes`: private, 5 MB limit; allow PDF, DOC, and DOCX only.
- `blog-media`: public only if all published blog media is intentionally public; 10 MB limit and explicit image/video MIME allowlist.
- `product-images`: public only for catalogue images intended for the website/CRM; 5 MB and image MIME allowlist.

Private buckets are private by default. Add no broad `storage.objects` policies. Browser clients therefore cannot list or mutate files. Authorized server routes use the server secret after application authorization and return short-lived signed URLs. Public buckets bypass read access controls but still require authorization for writes. Never insert/delete rows directly in the `storage` schema; use the Storage API. See [bucket access models](https://supabase.com/docs/guides/storage/buckets/fundamentals) and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## 7. Safe verification

1. Run `npx prisma migrate status`; confirm all migrations are applied.
2. Sign in as an enabled administrator and a normal user; verify user-scoped lead totals differ correctly.
3. Disable the normal user and verify the next protected request is rejected.
4. Request password recovery and verify the callback remains on the approved domain.
5. Upload a harmless fixture in each non-production bucket; confirm unauthorized browser listing/download fails and authorized signed download expires.
6. Confirm Data API requests made with only the publishable key cannot read CRM tables.

Do not share screenshots containing connection strings, database passwords, secret keys, or recovery links.
