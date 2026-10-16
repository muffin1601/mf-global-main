# Deployment and Rollback Plan

No deployment or live restart was performed.

## Pre-deployment

1. Back up MongoDB and verify a restore to an isolated database.
2. Run a read-only duplicate report for non-empty phone/contact values.
3. Deploy to staging with production-like PM2 worker count and shared upload behavior.
4. Run backend/frontend suites, browser client create-refresh-relogin tests, quotation PDF visual tests, and role/IDOR checks.
5. Confirm `MONGO_URI`, `JWT_SECRET`, CORS origins, Resend configuration and cron flags through the secret manager without printing values.

## Deployment

1. Build immutable frontend/backend artifacts from the reviewed commit.
2. Roll out one API instance/canary first; verify `/health` and `/ready`.
3. Use `pm2 reload crm-api` for rolling replacement only after authorization.
4. Monitor 4xx/5xx rates, Mongo latency/pool usage, restart count, memory, cron execution count, client creation and quotation creation.

## Data compatibility

`ClientData.createdBy` is optional. Existing documents require no rewrite and old code ignores the field, so this change is backward-compatible. No destructive migration is included.

## Rollback

1. Stop rollout and restore the previous application artifact/configuration.
2. Rolling-reload API workers and restore the prior frontend assets.
3. Do **not** remove `createdBy`; it is harmless to prior code and deleting audit attribution would be destructive.
4. If data corruption is suspected, make the application read-only, preserve logs, compare against the pre-deployment backup, and restore only with explicit approval.

Rollback trigger examples: sustained 5xx increase, auth/visibility regression, duplicate quotation numbers, incorrect financial totals, repeated PM2 crashes, duplicate cron ingestion, or failed readiness.

