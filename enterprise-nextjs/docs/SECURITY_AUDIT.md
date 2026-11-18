# Security Audit — Enterprise Next.js CRM

**Audit date:** 2026-11-18 · **Method:** source review of all 24 Route Handlers, 3 Server Action modules, proxy, auth/session helpers, Supabase clients, Prisma client; client-bundle secret scan of `.next/static`; executed reproduction of the redirect guard; read-only inspection of the Supabase database. No penetration testing against a running instance was possible because no populated environment exists, so dynamic checks are BLOCKED.

## Summary

| Area | Status | Notes |
|---|---|---|
| Server-side authentication on CRM pages and actions | PASS (static) | `requireUser()`/`requireAdmin()` called in every CRM page and Server Action except `/crm/vendors` (SEC-08); `enabled` re-checked on every request (`src/lib/auth/session.ts:20`) |
| Role-based authorization (ADMIN/USER) | PASS (static) | Admin-only actions use `requireAdmin()`; lead update checks `LeadAssignment.canUpdate` (`lead-management/actions.ts:14`) |
| IDOR on leads / quotations / import jobs | PASS (static) | Non-admin queries are scoped by `assignments.some.userId` or `userId` |
| Inactive users blocked | PASS (static) | Login refuses disabled accounts; `requireUser` redirects disabled sessions |
| Secrets in client bundle | PASS | Secret **values** for `SUPABASE_SECRET_KEY`, `DATABASE_URL`, `RESEND_API_KEY`, `IP_HASH_SALT` were not found in `.next/static`. Only variable **names** appear (SEC-12). |
| `.env` excluded from git | PASS | `enterprise-nextjs/.gitignore:3` |
| SQL injection | PASS (static) | All DB access is through the Prisma query builder; no `$queryRaw`/`$executeRaw` in `src/` |
| XSS | PASS (static) | No `dangerouslySetInnerHTML`/`innerHTML` in `src/` or the synced marketing code; React escapes comment and blog text |
| CSRF — Server Actions | PASS | Next.js Server Actions enforce Origin/Host matching |
| CSRF — careers admin API | PASS (static) | Hashed per-session CSRF token and Origin check (`src/lib/careers/admin-session.ts:52-57`) |
| Open redirect | **FAIL** | SEC-03 |
| Rate limiting | **FAIL** | SEC-02, SEC-04, SEC-05 |
| Supabase RLS | **BLOCKED** | No tables exist; the RLS script has never run (SEC-06) |
| Storage bucket privacy | **BLOCKED** | No buckets exist (SEC-06) |
| Supabase Auth settings (redirect allow-list, rate limits, email templates) | **BLOCKED** | Dashboard configuration not inspected; 0 Auth users exist |
| Dependency vulnerabilities | PASS (prod) / FAIL (dev, Low) | `npm audit --omit=dev`: 0. Full audit: 14 high, all `picomatch` ReDoS in ESLint tooling (SEC-11) |

> **Prisma bypasses RLS.** `DATABASE_URL` connects as the `postgres` role, so RLS does not protect any Prisma query. Every authorization boundary in this app lives in TypeScript. The RLS script is defense in depth only, for the Data API roles `anon`/`authenticated`.

## Findings

### SEC-01 — Careers admin protected by a single shared 6-digit PIN
- **Severity:** High · **Module:** Careers admin · **Status:** FAIL
- **Files:** `src/app/api/careers/admin/login/route.ts:9-37`, `src/lib/careers/admin-session.ts:70-73`
- **Description:** One shared numeric PIN (10⁶ possibilities) protects every applicant record, CSV export, and resume download. Lockout is per IP hash only (5 failures → 15 minutes). An attacker rotating IPs gets about 480 guesses per IP per day with no global ceiling. There is no individual identity, no MFA, and no audit trail tying actions to a person. This design was inherited from the MERN app, and the port also dropped the original extra `limiter(10, 15 min)` (`backend/routes/main/careersRoutes.js:58`).
- **Business impact:** Disclosure of applicants' personal data and resumes. This is a data-protection exposure.
- **Recommended fix:** Put careers admin behind Supabase Auth with an ADMIN role check, as `/api/blogs/post-blogs` already does. If the PIN must stay, add a global failure counter and alerting.
- **Verification:** Unauthenticated and non-admin requests to `/api/careers/admin/*` return 401/403; brute-force simulation on staging.

### SEC-02 — Unauthenticated resume upload with no rate limit
- **Severity:** High · **Module:** Careers (public) · **Status:** FAIL (regression from MERN)
- **File:** `src/app/api/careers/apply/route.ts:27-83`
- **Description:** The route accepts anonymous 5 MB uploads. It writes each one to Supabase Storage using the **secret key**, creates a DB row, and sends 2 notification emails. The original had `limiter(5, 60 s)` (`backend/routes/main/careersRoutes.js:111`). The port has none. A fresh random `submissionKey` per request bypasses de-duplication.
- **Business impact:** Storage and egress cost abuse, inbox flooding for `sales@`/HR recipients, and database growth.
- **Recommended fix:** Restore per-IP throttling with a persistent store (the `contact_submissions` approach already used by `/api/send-email`, or Upstash/Vercel KV). Consider a CAPTCHA or Turnstile.
- **Verification:** The 6th request within 60 s returns 429.

### SEC-03 — Open redirect in `/auth/callback`
- **Severity:** Medium · **Module:** Authentication · **Status:** FAIL (reproduced)
- **File:** `src/app/auth/callback/route.ts:7-8`
- **Description:** The guard `startsWith("/") && !startsWith("//")` lets `/\evil.com` and `/<TAB>/evil.com` through. `new URL()` normalizes the backslash, so the redirect goes off-site.
- **Evidence:** Reproduction against the exact guard logic: `next=/%5Cevil.com` → `https://evil.com/`; `"/\t/evil.com"` → `https://evil.com/`.
- **Business impact:** Phishing. If Supabase's redirect allow-list permits arbitrary paths on the site, an attacker can request a recovery or magic link for a victim with `next=/%5Cevil.com`. After the victim signs in through the genuine email they land on the attacker's page.
- **Recommended fix:** Resolve `new URL(next, origin)` and require `resolved.origin === origin`. Better still, allow-list internal paths such as `/crm/`.
- **Verification:** Unit test that the backslash, tab, and encoded variants resolve to `/crm/entrydashboard`.

### SEC-04 — No application-level login throttling
- **Severity:** Medium · **Module:** Authentication · **Status:** FAIL (regression from MERN `loginLimiter`, 10/15 min)
- **File:** `src/app/(auth)/crm/login/actions.ts:11-25`
- **Description:** The Server Action does a Prisma lookup and then `signInWithPassword` with no throttling of its own. Supabase Auth has its own rate limits, but those settings were not verified (BLOCKED).
- **Recommended fix:** Add per-IP and per-identifier throttling. Confirm the Supabase Auth rate-limit settings.

### SEC-05 — Anonymous blog comments are auto-approved and unthrottled
- **Severity:** Medium · **Module:** Marketing blogs · **Status:** FAIL (parity with MERN, still a risk)
- **File:** `src/app/api/blogs/comments/route.ts:14`
- **Description:** `approved: true` with no rate limit, CAPTCHA, or moderation. The text is escaped, so this is not XSS, but spam and defamatory content appear publicly right away.
- **Recommended fix:** Throttle, and default to `approved: false` with an admin moderation view, or add a CAPTCHA.

### SEC-06 — RLS and Storage policies never applied; buckets missing
- **Severity:** High · **Module:** Supabase · **Status:** BLOCKED / FAIL
- **Files:** `supabase/storage-and-database-security.sql`; code expects buckets `career-resumes` (private) and `blog-media` (public)
- **Description:** The `public` schema has 0 tables and `storage.buckets` is empty. The intended controls (revoke from `anon`/`authenticated`, enable RLS, private resume bucket) exist only as a script. Also, the script's `alter default privileges` only affects objects later created **by the role that runs it**. If migrations run as a different role, new tables may still receive default Data API grants.
- **Recommended fix:** After `prisma migrate deploy`, run the script as the same role that runs migrations. Create the buckets with explicit `public` flags, size limits, and MIME allow-lists. Then verify with `select grantee, count(*) from information_schema.role_table_grants where grantee in ('anon','authenticated')` = 0 rows and `select relname from pg_class where relrowsecurity = false and relnamespace='public'::regnamespace` = 0 rows.

### SEC-07 — Password-change UX allows changes on any authenticated session
- **Severity:** Low · **Module:** Authentication · **Status:** FAIL
- **File:** `src/app/(auth)/crm/reset-password/page.tsx:5`
- **Description:** `/crm/reset-password` only requires *a* session, not a recovery session. Anyone holding a logged-in browser can change the password without knowing the current one. Admin password changes (`user-management/actions.ts:15`) also do not revoke the target's existing sessions.
- **Recommended fix:** Require an AMR of `recovery`, or reauthentication. Call `auth.admin.signOut(userId, 'global')` after an admin password reset.

### SEC-08 — `/crm/vendors` page has no page-level auth call
- **Severity:** Low · **Module:** Vendors · **Status:** FAIL (defense in depth)
- **File:** `src/app/(crm)/crm/vendors/page.tsx:3`
- **Description:** The page relies only on the parent layout's `requireUser()`. Next.js renders layouts and pages concurrently, so the vendor query runs for unauthenticated requests even though the layout's redirect wins. The vendor permission matrix in `src/lib/permissions/index.ts` exists but is never used.
- **Recommended fix:** Call `requireUser()` plus `assertVendorPermission(role, "vendor.view")` in the page.

### SEC-09 — Login reveals disabled accounts
- **Severity:** Low · **File:** `src/app/(auth)/crm/login/actions.ts:20`
- **Description:** "This account is disabled" is returned before the password is checked, which confirms the username exists.
- **Recommended fix:** Check the password first, or return the generic message.

### SEC-10 — No Content-Security-Policy or HSTS header
- **Severity:** Low · **File:** `next.config.ts:9-20`
- **Description:** Good baseline headers are set (nosniff, frame DENY, referrer, permissions, COOP), but there is no CSP and no `Strict-Transport-Security`. Vercel adds HSTS on its own domains; custom-domain HSTS was not verified.
- **Recommended fix:** Add a CSP (start report-only) and HSTS.

### SEC-11 — Dev-dependency advisories
- **Severity:** Low · **Status:** FAIL (build-time only)
- **Evidence:** `npm audit` → 14 high (`picomatch` GHSA-fc5q-39xc-vjpf through `eslint-config-next` → `fast-glob`/`tinyglobby`). `npm audit --omit=dev` → 0.
- **Recommended fix:** Track an `eslint-config-next` update. Do not run `npm audit fix --force`, which downgrades to 14.x.

### SEC-12 — Server env schema shipped to the browser
- **Severity:** Low (information only) · **File:** `src/lib/supabase/browser.ts:4` imports `src/lib/env.ts`
- **Description:** The browser bundle includes the zod schema that names `DATABASE_URL`, `SUPABASE_SECRET_KEY`, and the other variables. It reveals names, not values.
- **Recommended fix:** Split `publicEnv` into its own module, and mark `env.ts` server-only.

### SEC-13 — Unsalted IP hash fallback
- **Severity:** Low · **File:** `src/app/api/send-email/route.ts:19-23`
- **Description:** If `IP_HASH_SALT` is unset, the route stores an unsalted SHA-256 of the IP, which can be reversed by brute force over the IPv4 space. That is personal data.
- **Recommended fix:** Make `IP_HASH_SALT` required in production, as `/api/contact` already does.

### SEC-14 — Production database password exposed during this audit session; credential hygiene
- **Severity:** Medium (operational) · **Status:** Action required
- **Description:** During this audit, a redaction step failed and the full `DATABASE_URL`/`DIRECT_URL`, including the database password, were printed into the audit session's tool output. They were not written to any file or report. The password also looks human-chosen rather than generated.
- **Recommended fix:** Rotate the Supabase database password, use a generated value, and update `.env` and the Vercel environment variables.

## Authorization matrix verified in source

| Operation | ADMIN | USER | Enforcement |
|---|---|---|---|
| View dashboard / leads | all | assigned (`canView`) | `entrydashboard/page.tsx:4`, `lead-management/page.tsx:23-25` |
| Create lead | yes (any assignee) | yes (self-assigned) | `actions.ts:11` |
| Update lead | yes | only with `canUpdate` | `actions.ts:14` |
| Assign / unassign / delete lead | yes | no | `requireAdmin()` `actions.ts:16,18` |
| Delete lead with `canDelete` grant | — | **not honored** (UI checkbox is non-functional) | `actions.ts:18` |
| Users: create / enable / disable / password | yes | no | `user-management/actions.ts` |
| Products, vendor performance | yes | no | `requireAdmin()` |
| Vendors list | yes | yes | layout only (SEC-08) |
| Quotations list | all | own | `quotations/page.tsx:4` |
| Blog create | yes | no | `post-blogs/route.ts:14-16` |
| Careers admin | PIN holder | PIN holder | SEC-01 |

Runtime verification of this matrix (logging in as each role) is **BLOCKED**: there are no users or tables.
