# Public Marketing Website Audit

**Audit date:** 2026-11-18

**Method:**
1. Source diff of the original `frontend/src/{components,pages,styles}/main` against `enterprise-nextjs/src/legacy-marketing`.
2. Route comparison against `frontend/src/App.jsx:60-66`.
3. Headless-browser comparison: the original Vite dev server (port 5174) and the Next.js production build (`next start`, port 3100), at 1440×900 and 390×844. Animations were disabled before capture.
4. HTTP checks of `robots.txt`, `sitemap.xml`, and CRM `noindex` metadata.

No forms were submitted. No data was written.

## Summary

**Visual and content parity: PASS for all static content.**
**Data-backed features: FAIL in the configured environment.** Careers jobs, blogs, comments, contact, and apply all depend on the empty database. `/api/careers/jobs` returned **HTTP 500** during the browser test.

| Check | Status | Evidence |
|---|---|---|
| All original public routes exist | PASS | `/`, `/contact`, `/blogs`, `/blogs/[slug]`, `/blogs/new`, `/careers`, `/careers/admin` under `src/app/(website)` |
| `/crm` public landing page | FAIL (Low) | Original `/crm` → `landingpage/components/Home.jsx`; Next.js has no `/crm` page (404) |
| Source unchanged | PASS | 38 of 38 original files present (3 CSS files relocated to `styles/`, `Careers.test.jsx` intentionally skipped, `router.jsx` shim added). Every **CSS file is byte-identical**. All 20 JS/JSX diffs disappear after normalizing the documented sync transforms (`"use client"`, import paths, `/api` base, asset constants, `lucide-react-legacy` alias). Zero residual differences. |
| Synced from the latest original | PASS | The comparison includes the three most recent commits' Careers/ContactUs/Footer changes; no residual diffs |
| Pixel parity — `/` | PASS | 0.00% of pixels differ above the fold at 1440×900 and 390×844; same document height (7,028 / 10,854 px), 6 images, 0 broken |
| Pixel parity — `/contact` | PASS | 0.00% at both widths; heights 2,583 / 4,447 |
| Pixel parity — `/blogs` | PASS | 0.00% at both widths; heights 2,314 / 3,319 |
| Pixel parity — `/careers` | PASS | Screenshots visually identical when the banner carousel is on the same slide. The first automated pass showed 23.58% / 7.21% from carousel timing only. Heights identical (3,086 / 4,253). |
| Fonts and colors | PASS | `body` font `Poppins, sans-serif` and background `rgb(250,245,245)` identical on all pages |
| Page titles and meta | PASS | Titles identical on all four pages |
| Full-page below-the-fold comparison | NOT TESTED | Only above-the-fold pixels were diffed. Document heights, image counts, and text lengths match exactly. |
| Mobile layout | PASS | 390 px viewport identical (see above) |
| Animations | NOT TESTED | Disabled for capture. The same Swiper and CSS are used (Swiper upgraded 11→14 for advisory GHSA-hmx5-qpq5-p643). |
| `/blogs/[slug]` detail, `/careers/admin`, `/blogs/new` visual | BLOCKED | Need data and sessions |
| Contact form submission (`/api/send-email`) | BLOCKED | Not submitted (would write to DB and send email); DB has no `contact_submissions` table, so it would fail with 500 |
| Careers job list | **FAIL (env)** | `GET /api/careers/jobs?limit=100&page=1` → **500** in the browser test (no tables) |
| Careers apply / resume upload | BLOCKED | No `career-resumes` bucket and no tables; also no rate limit (SEC-02) |
| Blog create / comment | BLOCKED | No tables and no `blog-media` bucket |
| `robots.txt` | PASS | Disallows `/crm/`, `/crm`, `/api/`, `/careers/admin`, `/blogs/new` |
| CRM not indexable | PASS | `/crm/login` returns `<meta name="robots" content="noindex, nofollow"/>`; CRM layout sets `robots: {index:false}` |
| `sitemap.xml` | PASS (code) / FAIL (local env) | Lists `/`, `/contact`, `/blogs`, `/careers` plus blog posts. The `Sitemap:` line used `http://localhost:3000` because the local `NEXT_PUBLIC_APP_URL` is localhost. Production must set it to the real domain. |
| Original `/about`, `/services` in old sitemap | N/A | They never existed as routes in the original (documented in `src/app/sitemap.ts:6-9`) |

## Findings

### MKT-01 — Database-backed public features fail in the configured environment
- **Severity:** Critical (if deployed as-is) · **Status:** FAIL
- **Evidence:** Browser network log: `500 /api/careers/jobs?limit=100&page=1`. Root cause DB-01.
- **Business impact:** Careers listings, applications, blogs, comments, and the contact enquiry form would all break on the live site.
- **Fix:** Complete the migration on staging first (see `PRODUCTION_BLOCKERS.md`).

### MKT-02 — `/crm` landing page missing
- **Severity:** Low · **Status:** FAIL
- **Fix:** Port `frontend/src/landingpage/components/Home.jsx`, or redirect `/crm` → `/crm/login`. Confirm which the business wants.

### MKT-03 — `NEXT_PUBLIC_APP_URL` must be the production domain
- **Severity:** Medium · **Status:** NOT TESTED (Vercel env not inspected)
- **Evidence:** The local `robots.txt` advertised `http://localhost:3000/sitemap.xml`.
- **Fix:** Set it in the Vercel Production environment and verify `/robots.txt` after deploy.

## Conclusion

The marketing front end is a faithful, verifiably unchanged copy of the original. Its visible pages match pixel for pixel. Its **dynamic** features cannot work until the database, storage buckets, and email environment are provisioned.
