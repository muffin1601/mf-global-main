# Vercel Production Readiness Audit

**Audit date:** 2026-11-18. **Scope:** local repository and build only. The **live Vercel project, its environment variables, domains, and Supabase dashboard settings were not inspected.** No Vercel access was used, and nothing was deployed. Those items are BLOCKED.

## Automated verification (run locally, 2026-11-18)

| Command | Result |
|---|---|
| `npx prisma validate` | PASS — schema valid |
| `npx prisma generate` | PASS — exit 0 |
| `npm run typecheck` (`next typegen && tsc --noEmit`) | PASS — exit 0 |
| `npm run lint` (`eslint . --max-warnings=0`) | PASS — exit 0 |
| `npm run build` (`prisma generate && next build`) | PASS — exit 0. 23 static pages; 46 routes; Proxy present |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |
| `npm audit` | FAIL (Low) — 14 high in dev tooling (SEC-11) |
| Automated tests | **FAIL — none exist.** No `*.test.*`/`*.spec.*` files and no test script in `package.json`. The MERN backend had 13 test files and the frontend 3; none were ported. |

A passing build does not prove functionality. Most CRM features are missing (see `FINAL_FEATURE_PARITY_AUDIT.md`).

## Configuration review

| Item | Status | Evidence / finding |
|---|---|---|
| App is in version control | **FAIL** | `git ls-files enterprise-nextjs` → **0 files**. The whole `enterprise-nextjs/` directory is untracked (git status `?? enterprise-nextjs/`). A Vercel Git deployment cannot build it, and there is no rollback history. (VER-01) |
| Root directory configured | BLOCKED | The docs instruct setting Root Directory = `enterprise-nextjs` (`docs/DEPLOYMENT.md:4`). There is no `vercel.json`; the live setting was not inspected. |
| Node runtime | PASS | `engines.node >=22.12.0`; all handlers use the Node.js runtime (no `edge` exports) |
| Prisma Client generation on Vercel | PASS | `build` runs `prisma generate`; `prisma.config.ts` falls back to a dummy URL so generation needs no secret; `generated/` is git-ignored |
| Prisma connection strategy | PASS (design) / BLOCKED (live) | `@prisma/adapter-pg` with `pg.Pool({max:1})` on the Supavisor transaction pooler (port 6543); `DIRECT_URL` (5432) is for migrations only. Appropriate for serverless. Not exercised, because the DB is empty. |
| Migrations safely deployable | PARTIAL | `prisma migrate deploy` is **not** part of the build (good, no accidental prod migrations). The initial migration is generated SQL that has never been applied anywhere. **No staging database exists to rehearse it.** (VER-02) |
| Environment variable validation | PASS | `src/lib/env.ts` validates with zod and fails with variable names only |
| Env vars documented | PASS | `.env.example` documents all variables. **Gap:** `.env.example` lists `CAREERS_ADMIN_PIN_HASH`, but `env.ts` does not validate it, and the IndiaMART/TradeIndia/Coachingpromo keys are present but unused (their features are not ported). |
| `NEXT_PUBLIC_APP_URL` | BLOCKED | Local value is localhost; must be the production domain (MKT-03) |
| Secrets excluded from git | PASS | `.env` ignored (`.gitignore:3`); no secret values in the client bundle |
| Auth redirects | FAIL | Open redirect in `/auth/callback` (SEC-03). Supabase Site URL and Redirect URL allow-list: BLOCKED (not inspected). |
| Storage buckets and permissions | **FAIL** | Code needs `career-resumes` (private) and `blog-media` (public); `storage.buckets` is empty |
| RLS script applied | **FAIL** | Never run (SEC-06) |
| Scheduled jobs | **FAIL** | MERN ran IndiaMART and TradeIndia syncs every 5 minutes. There is no `vercel.json` `crons` and no cron route. (VER-03) |
| Inbound webhooks | **FAIL** | `/api/coachinpromo/capture-lead` and `/api/printkee/capture-lead` don't exist; external senders will get 404 |
| Health check endpoint | FAIL (Low) | MERN `/health`, `/ready` not ported |
| Security headers | PASS (partial) | nosniff, frame DENY, referrer, permissions, COOP. No CSP or HSTS (SEC-10). |
| Logging / error monitoring | FAIL (Medium) | `console.*` only; no error tracking (Sentry etc.), no request IDs, no alerting. Server Action errors surface as Next.js's generic error page with no user-facing feedback. |
| Rollback procedure | PARTIAL | Documented in `docs/DEPLOYMENT.md`, `docs/VERCEL_DEPLOYMENT_GUIDE.md`, and the root `CRM_DEPLOYMENT_ROLLBACK_PLAN.md`. Not rehearsed. Rollback of **data** written after cut-over (Postgres → MongoDB) is not addressed by any tool. |
| Domain / HTTPS | BLOCKED | Documented in the guides; live DNS and certificate not inspected |
| Serverless limits for imports/exports | N/A today | Import and export aren't implemented. When they are, the MERN 15 MB / 20k-row vendor import and 50k-row exports will need streaming or background jobs to stay within Vercel's body-size and duration limits. |

## Performance review (static; no benchmarks were run or invented)

| ID | Severity | Finding |
|---|---|---|
| PERF-01 | Medium | `src/proxy.ts:23` matches **all `/api/:path*`**, so every public API call (careers, blogs, contact) makes a Supabase `auth.getUser()` network round trip it does not need. Narrow the matcher to `/crm/:path*` and `/auth/:path*`. |
| PERF-02 | Medium | Lead list `count` plus `skip/take` offset paging, and `contains` (ILIKE) search on name/company/phone without trigram indexes. Fine for 62 leads; it degrades at tens of thousands of rows. Add `pg_trgm` GIN indexes and keyset paging. |
| PERF-03 | Medium | No `created_at` index on `leads` for date-range reports (DB-06) |
| PERF-04 | Low | The dashboard runs 5 queries in one `$transaction` over a single pooled connection. That's acceptable. The non-admin scope `assignments.some` uses the `(user_id, assigned_at)` index. |
| PERF-05 | Low | Every CRM page is `force-dynamic` with no caching. That's correct for per-user data. Server Actions call `revalidatePath`, which is harmless here. |
| PERF-06 | Low | Client JS: 1.5 MB total in `.next/static/chunks` (largest chunk 360 KB, the marketing site including Swiper and two lucide versions). It matches the original site's payload; not measured with Lighthouse. |
| PERF-07 | Low | `sitemap.xml` queries all published blog posts on every request (`force-dynamic`). Add `revalidate`. |
| PERF-08 | Medium | The careers stats endpoint runs 12 parallel queries, but `Pool({max:1})` serializes them on one connection. Acceptable at current volume. |

## Findings

### VER-01 — Application not committed to git
- **Severity:** Critical · **Status:** FAIL
- **Evidence:** `git ls-files enterprise-nextjs | wc -l` → 0
- **Impact:** Vercel cannot build from the repository. There is no audit trail and no rollback to a previous commit.
- **Fix:** Commit `enterprise-nextjs/` on a branch (excluding `.env`, `generated/`, `.next/`, `migration-reports/` as already ignored), review, and merge.

### VER-02 — No staging environment; migrations never rehearsed
- **Severity:** Critical · **Status:** FAIL
- **Evidence:** The only configured Supabase project has an empty `public` schema.
- **Fix:** Provision a staging Supabase project and Vercel Preview environment, then rehearse the full sequence there: `migrate deploy` → RLS script → buckets → data apply → user linking → reconciliation.

### VER-03 — Automated lead ingestion not deployed
- **Severity:** Critical · **Status:** FAIL
- **Fix:** Port the TradeIndia/IndiaMART fetchers to an authenticated Route Handler invoked by Vercel Cron (protected by `CRON_SECRET`). Port both webhooks with API-key checks and rate limits.
