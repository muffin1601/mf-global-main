# Environment setup guide

Never paste secrets into chat, commit `.env.local`, or expose a secret with a `NEXT_PUBLIC_` prefix. Copy `.env.local.example` to `.env.local` and replace placeholders on your own computer.

## Application and Supabase Auth

### `NEXT_PUBLIC_APP_URL`

- Purpose: canonical site URL, metadata, sitemap, and authentication redirects.
- Source: locally use `http://localhost:3000`; on Vercel use the final `https://` production domain.
- Classification: public. Required locally and on Vercel.
- Verify: open the exact URL and confirm `/robots.txt` and `/sitemap.xml` use it.

### `NEXT_PUBLIC_SUPABASE_URL`

- Purpose: Supabase Auth and Storage API endpoint.
- Source: Supabase project → **Connect**, or **Settings → API Keys**.
- Classification: public. Required locally and on Vercel.
- Format: `https://PROJECT_REF.supabase.co`.
- Verify: the host must match the project selected in the Dashboard; do not print keys while testing.

### `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

- Purpose: initializes browser/server session clients; authorization still depends on a user JWT and policies.
- Source: Supabase project → **Connect**, or **Settings → API Keys → Publishable keys**.
- Classification: public. Required locally and on Vercel.
- Format: `sb_publishable_...`.
- Verify: login returns an ordinary authentication result rather than `Invalid API key`.

### `SUPABASE_SECRET_KEY`

- Purpose: administrator-created Auth users, password administration, and authorized server-only Storage operations.
- Source: Supabase project → **Settings → API Keys → Secret keys**. Create a dedicated server key if none exists.
- Classification: critical secret. Required locally for user administration and on Vercel. Never send it to a browser or over chat.
- Format: `sb_secret_...`; prefer this over the legacy `service_role` JWT.
- Verify: from the protected administrator screen, create a disposable account only in a non-production project, confirm it appears under **Authentication → Users**, then delete it there.

## PostgreSQL and Prisma 7

### `DATABASE_URL`

- Purpose: runtime Prisma queries from Vercel.
- Source: Supabase project → **Connect → Transaction pooler**.
- Classification: secret. Required locally and on Vercel.
- Format: copy the Dashboard value exactly, replace `[YOUR-PASSWORD]` with the URL-encoded database password, then append `?pgbouncer=true&connection_limit=1&sslmode=require` (or `&...` if a query already exists).
- Expected port: `6543`. Shared-pooler usernames include the project reference.
- Verify: run `npx prisma db execute --stdin` only with a harmless query in a controlled terminal, or start the app and load a database-backed page. Never echo the URL.

### `DIRECT_URL`

- Purpose: Prisma migration commands in a controlled deployment/admin environment.
- Source: Supabase project → **Connect → Direct connection**. If the runner lacks IPv6 and the project has no IPv4 add-on, use **Session pooler** on port `5432` for migration sessions.
- Classification: secret. Required locally for migration development and in the approved production migration job; the running application does not read it.
- Format: copied Dashboard URL with URL-encoded password and `sslmode=require`.
- Verify: `npx prisma migrate status` after the project database exists. Do not use `migrate reset`, `db push --force-reset`, or `migrate dev` against production.

## Legacy read-only migration

### `LEGACY_MONGODB_URI`

- Purpose: source for `migrate:mongo:dry-run` and the separately approved apply process.
- Source: create/read a MongoDB user limited to `find`/read operations on the CRM database.
- Classification: secret. Required only on the migration workstation/job; do not add to the normal Vercel runtime.
- Verify: run the dry-run and inspect the generated reconciliation report. It must not change MongoDB.

### `LEGACY_MONGODB_DATABASE`

- Purpose: selects the legacy database. Example placeholder: `crm`.
- Classification: operational, not normally secret. Migration only.
- Verify: the dry-run collection audit should recognize the expected collections.

### `MIGRATION_BATCH_SIZE` and `MIGRATION_REPORT_DIR`

- Purpose: migration tuning and local reconciliation output location.
- Classification: non-secret and optional. Defaults are `250` and `./migration-reports`.
- Vercel: not required; the live data migration should not run inside a Vercel function.

## Contact delivery and abuse protection

### `RESEND_API_KEY`

- Purpose: sends contact notifications after the submission is safely stored.
- Source: Resend Dashboard → **API Keys** after verifying the sending domain.
- Classification: secret. Required locally only to test email and required on Vercel for delivery.
- Format: `re_...`.

### `CONTACT_EMAIL_FROM` and `CONTACT_EMAIL_TO`

- Purpose: verified sender identity and internal recipient.
- Source: your verified Resend domain and business mailbox.
- Classification: configuration; mailbox addresses may be sensitive. Required wherever email delivery is enabled.
- Example: `Website <website@your-verified-domain.example>` and `info@your-domain.example`.
- Verify: submit the contact form and confirm both the database row and delivery in Resend logs.

### `IP_HASH_SALT`

- Purpose: irreversible IP hashing for contact rate limiting.
- Source: generate at least 32 random characters locally with a password manager or cryptographic secret generator.
- Classification: secret. Required locally and on Vercel.
- Verify: submit more than five messages from one address inside 15 minutes in a non-production environment; the sixth should return HTTP 429. Never log the salt or raw IP.

## Validation behavior

`src/lib/env.ts` reports only missing/invalid variable **names**, never values. `.env.example` is the canonical inventory. `.env.local.example` is a copy-ready local template. Real `.env*` files are ignored by Git.

Official references: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [database connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres), and [Vercel environment variables](https://vercel.com/docs/environment-variables).
