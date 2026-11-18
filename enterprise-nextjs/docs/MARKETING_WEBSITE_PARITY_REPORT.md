# Marketing Website Parity Report

Date: 2026-11-17
Scope: the public marketing website of the original MERN app (`frontend/`, `backend/`) and its migration into `enterprise-nextjs/`.
Reference: the original MERN marketing website only. The previous redesigned Next.js marketing pages were not used as a reference.

## Summary

The marketing website now runs from the original React source, copied byte-for-byte except for mechanical Next.js changes. Its CSS is identical and its assets are byte-identical. It has its own root layout, so no CRM or Tailwind CSS loads on it.

We compared the original production build (`frontend/dist`) and the Next.js production build in a real browser. Both sites used the same API, so they rendered the same data.

| Check | Original MERN | New Next.js | Status |
|---|---|---|---|
| Routes | `/`, `/contact`, `/blogs`, `/blogs/new`, `/blogs/:id`, `/careers`, `/careers/admin`, unknown URL → empty page | Same URLs; `/blogs/[slug]` accepts the original Mongo ids; unknown URL → the same empty page with a real 404 status | Pass |
| Headings and text | React source in `pages/main`, `components/main` | Same source; rendered `innerText` identical on every page at 3 viewports | Pass |
| Page titles and meta | `useMarketingMeta()` (client-side) | Same strings, now also rendered server-side via the Metadata API; hook kept | Pass |
| Images and assets | `frontend/public` (21 files) | `enterprise-nextjs/public`: MD5 identical. External Pexels/Google Fonts URLs unchanged | Pass |
| CSS | 14 files in `styles/main` + 3 in `pages/main` | Byte-identical copies; loaded only in the website root layout | Pass |
| Fonts | Google Fonts Outfit link + Poppins `@import` | Same stylesheets | Pass |
| Icons | react-icons 5.5.0, lucide-react 0.525.0 | react-icons 5.5.0; lucide-react 0.525.0 via the `lucide-react-legacy` alias (the CRM keeps 1.74) | Pass |
| Layout (desktop, tablet, mobile) | — | Element-by-element geometry and computed styles identical; page heights identical | Pass |
| Pixel comparison | — | 41 of 42 viewport screenshots 0.000% different; 1 at 0.010% (an 11px band at the tablet header edge, sub-pixel antialiasing) | Pass |
| Header and footer | Navbar, dropdown, mobile sidebar, scrolled state, Footer | Same components; active-link `aria-current` kept; scrolled and menu-open states verified | Pass |
| Animations and sliders | Swiper 11 (testimonials, careers banners), CSS transitions | Same Swiper config on Swiper 14 (see Difference 1); same CSS transitions | Pass |
| Contact form | `POST /send-email` → `{success}` | `POST /api/send-email`: same request, response, email subject and body; enquiry also stored | Pass (see Difference 3) |
| Blog list, detail and comments | `GET /blogs`, `GET /blogs/:id`, comments newest first | Same response shape; `_id` stays the original Mongo id, so old URLs keep working | Pass |
| Blog creation | `POST /blogs/post-blogs`, admin only, jpeg/jpg/png/webp, 5 MB | Same rules (CRM admin session required); media goes to Supabase `blog-media` | Pass |
| Careers listing and apply | `/careers/jobs`, `/careers/apply` | Same filters, ordering, validation, idempotency, error messages and email notification; resume goes to Supabase `career-resumes` | Pass |
| Careers admin | PIN login, CSRF, 30-minute sliding session, lockout, jobs CRUD, applications, resume, CSV export, stats, change PIN | All 13 endpoints ported (previously missing in Next.js) | Pass, needs DB migration |
| Data-driven content (blogs, jobs) | MongoDB | Prisma/Postgres | **Blocked**: the Supabase database has no tables yet (see Open items) |
| SEO: robots and sitemap | Static `robots.txt` (allow all), static `sitemap.xml` | Generated: CRM, API and admin screens disallowed; sitemap lists real pages and blog posts | Changed on purpose (see Difference 4) |
| TypeScript, ESLint, production build | — | `tsc --noEmit` ✓, `eslint --max-warnings=0` ✓, `next build` ✓ | Pass |

## Problems found in the previous Next.js marketing implementation

These were fixed:

1. **Corrupted text everywhere.** The earlier copy was written with a non-UTF-8 tool, so every `’ — → · © 📞 ☎️ ✉️ 📍 🕘` showed as mojibake (`â€™`, `ðŸ“ž`, `Â©`…). All files were regenerated from the originals.
2. **CRM CSS on the marketing site.** The shared root layout loaded `globals.css` (Tailwind preflight plus global `body`, `h1`, `.hero`, `.container`, `.card`, `.button`, `.section`, `.page`… rules). Fifteen of those class names are also used by the marketing site.
3. **`/api/blogs/post-blogs` was unauthenticated.** Anyone could publish posts and upload files. It now requires an enabled CRM admin, as in the original.
4. **The careers admin API was missing.** `/careers/admin` could not log in.
5. **Blog URLs with original Mongo ids returned 500.** Non-UUID values were compared against a UUID column.
6. **Comments were oldest first.** The original showed newest first.
7. **Careers apply used different validation and messages, and sent no notification email.**
8. **The contact form called a different endpoint** with a remapped payload.
9. **`public/robots.txt` overrode `app/robots.ts`,** so `/crm` and `/api` were not disallowed.

## Implementation

- `src/legacy-marketing/` is generated by `npm run sync:legacy-marketing` (`scripts/sync-legacy-marketing.mjs`) from `../frontend/src/{components,pages,styles}/main`. The only changes are:
  - a `"use client"` directive;
  - `react-router-dom` → `src/legacy-marketing/router.jsx` (a thin shim over Next.js navigation);
  - flattened import paths;
  - `import.meta.env.VITE_API_URL` → `/api`;
  - Vite asset imports → URL strings;
  - `lucide-react` → `lucide-react-legacy`.

  Re-run the script whenever the original changes. `Careers.test.jsx` (a Vitest test) is not copied.
- The components stay as `.jsx`, which `tsconfig` allows. Converting them to `.tsx` would have meant rewriting them, which risks visual drift; the route files, API handlers and libraries are TypeScript.
- Root layouts:
  - `app/(website)/layout.tsx` reproduces `frontend/index.html`: Outfit font link, favicon, Google Analytics `G-H81NE594BN`, `global.css`.
  - `app/(crm)/layout.tsx` and `app/(auth)/layout.tsx` share `components/layout/app-root-layout.tsx`: `globals.css` and the Toaster.
  - `app/global-not-found.tsx` (needs `experimental.globalNotFound`) handles unmatched URLs.
- New libraries:
  - `src/lib/careers/*`: admin session, CSRF and lockout; job validation that mirrors the Mongoose schema; status label mapping; filters; notification email;
  - `src/lib/marketing/blogs.ts`.
- New tables (migration `prisma/migrations/20261118000000_careers_admin`): `career_admin_settings`, `career_admin_sessions`, `career_login_attempts`, all with RLS enabled.
- New script: `npm run migrate:mongo:marketing-files`. It is a dry run unless `--apply` is passed. It copies three things to Supabase:
  - blog media from the old backend;
  - resume binaries stored inside MongoDB;
  - the existing careers PIN hash.

## Remaining differences

1. **Swiper 14 instead of 11.2.10.** Swiper 11.2.10 has a critical advisory (GHSA-hmx5-qpq5-p643, prototype pollution, fixed in 12.1.2). With the same configuration, Swiper 14 measured identical geometry and identical pixels. The only DOM difference is an identity `transform: matrix(1,0,0,1,0,0)` on each slide, which has no visual effect.
2. **Scroll position on client navigation.** React Router (with no scroll restoration) kept the current scroll position when you clicked an internal link. Next.js `<Link>` scrolls to the top of the new page. The original behaviour can be restored by passing `scroll={false}` in `src/legacy-marketing/router.jsx`. That would bring back what was effectively a bug, so it is left for you to decide.
3. **Contact form when email fails.** The original returned `success: false` if Resend failed. The enquiry is now saved to `contact_submissions` first, so the visitor sees success and the message is not lost. Delivery failures are logged.
4. **robots.txt and sitemap.** The original allowed everything and listed `/about` and `/services`, which never existed: the original app showed an empty page for them. The new robots file disallows `/crm`, `/api`, `/careers/admin` and `/blogs/new`. The sitemap lists `/`, `/contact`, `/blogs`, `/careers` and every published post at its original URL. `/careers/admin` and `/blogs/new` also get `noindex` meta tags.
5. **Server-rendered metadata.** Titles and descriptions now appear in the initial HTML instead of being set by JavaScript after load. The strings are unchanged.
6. **Unknown URLs.** They show the same empty page as before, but now return HTTP 404 (Next.js adds `noindex`).
7. **Google Analytics** loads only on marketing pages. The original `index.html` also loaded it inside the CRM.
8. **Rate limits.** The original express-rate-limit counters were per process. The contact limit (5 per minute per IP) and the careers PIN lockout (5 failures → 15 minutes) are now stored in the database. The extra limits on `/careers/apply` (5 per minute) and on login (10 per 15 minutes) were not ported; the lockout still applies to login. Use Vercel firewall rules if you need them.
9. **Careers admin cookie** is always `SameSite=Lax`. The original's `CAREERS_COOKIE_SAMESITE=none` option is not needed now that the site and API share an origin.
10. **`/crm` (original CRM product landing page, `landingpage/components/Home.jsx`).** It was public in the original and is a 404 in Next.js. It belongs to the CRM, not the marketing site, so it was left alone. Say whether it should be migrated.

## Open items (need your approval; nothing below has been run)

The Supabase database configured in `.env` currently has **no tables**: every Prisma query fails with `P2021 table does not exist`. Blog and careers data could therefore only be checked as matching empty and error states on both sites. To go live:

1. `npm run prisma:migrate:deploy`: applies `20261117000000_initial` and the new `20261118000000_careers_admin`.
2. Apply `supabase/storage-and-database-security.sql`. Create the buckets `blog-media` (public) and `career-resumes` (private).
3. `npm run migrate:mongo:dry-run`, then `npm run migrate:mongo:apply`. This imports blogs, comments, jobs and applications.
4. `npm run migrate:mongo:marketing-files`, then the same command with `-- --apply`. This copies blog media, resumes and the careers PIN.
5. Set `RESEND_API_KEY`, `CONTACT_EMAIL_FROM` / `CONTACT_EMAIL_TO` (defaults: `no-reply@` → `sales@mfglobalservices.com`) and `CAREERS_NOTIFICATION_*` in Vercel.
6. Re-run the blog and careers visual comparison with real data.

## How parity was verified

- **Original site.** `frontend/dist` (built after the latest marketing source change) was served read-only from a scratch directory. Its baked-in API (`http://localhost:5010/api`) was proxied to the Next.js API, so both sites used the same backend.
- **Element comparison.** For every element on each page, tag, classes, position, size and 16 computed style properties were collected. This was done for `/`, `/contact`, `/blogs`, `/blogs/<mongo-id>`, `/careers`, `/careers/admin`, `/blogs/new` and an unknown URL, at 1440×900, 820×1180 and 390×844. The scrolled-header and mobile-menu states were also covered.
- **Pixel comparison.** Viewport screenshots were taken with CSS animations frozen and sliders reset, at scroll offsets 0, 1200 and 2400. Pixels were counted as different when their RGB channels differed by more than 30 in total.
- **API checks.** Validation, authentication and messages were checked with curl: 401 on unauthenticated blog post and admin routes; the original `Please complete all required application fields.`, `Invalid submission key.` and `Upload a valid PDF, DOC, or DOCX resume.` messages; 404 for unknown URLs.
- **CSS isolation.** Every CSS chunk on marketing pages was checked for Tailwind or CRM tokens, and every CRM chunk for marketing selectors. None were found.
- **Read-only original.** The original `frontend/`, `backend/` and MongoDB were only read.
