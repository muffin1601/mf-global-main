# CRM UI/UX redesign — coverage and verification report

Date: 2026-11-19 · Branch `remediation/enterprise-nextjs` · Uncommitted, not deployed.
Companion documents: `UI_UX_REDESIGN_AUDIT.md` (audit) and `DESIGN_SYSTEM.md` (tokens and components).

## What changed and what did not

**Changed:** the presentation layer of every CRM route and dialog, as listed below.
**Not changed:**
- `src/server/**` (business logic, queries, calculations, authorisation)
- Server actions and API routes
- `prisma/` and the database schema
- Enum values
- Supabase auth flow
- The public marketing website

**New dependencies:** none.

Two small behaviour additions, both built only on capabilities that already existed:
1. **Lead list date-range filter.** It exposes `dateType`/`from`/`to`, which `server/leads/where.ts` already supported. It validates from ≤ to before submitting.
2. **Quick-create deep links.** `?create=lead` on any lead list and `?create=product` on Products open the existing Add dialogs. The header Create menu uses them.

Two clarity fixes for pre-existing silent redirects:
- The login page now explains `?error=disabled|recovery_expired|auth_callback`.
- The dashboard explains `?error=forbidden`.

## Route coverage

"Functional test" means exercised in a real browser (Playwright) against a disposable local database with a stubbed Supabase auth endpoint. Production was never contacted. "Render" means the page loaded with status 200, no console errors and no horizontal overflow at 1440px, logged in as an admin.

| Route | Module | Redesigned | Functionality tested | Status |
|---|---|---|---|---|
| `/crm/login` | Auth | Yes | Sign in (admin + user) through the form | ✅ |
| `/crm/forgot-password`, `/crm/reset-password` | Auth | Yes | Not tested (needs real email recovery) | ⚠️ visual only |
| `/crm/entrydashboard` | Dashboard | Yes | KPIs, charts, performance period links, recent leads; admin + user scopes; dark mode | ✅ |
| `/crm/lead-management` | Leads | Yes | Search, filter dialog → chips, view, edit + save (persisted), create, delete via confirm, `?create=lead` | ✅ |
| `/crm/lead-management/[id]` | Lead detail | Yes | Render | ✅ |
| `/crm/unassigned-leads` | Leads | Yes | Bulk select → assign with searchable picker (25 → 23), delete | ✅ |
| `/crm/new-leads`, `/assigned-leads`, `/trending-leads`, `/won-leads` | Leads | Yes (shared view) | Render; non-admin redirect | ✅ |
| `/crm/my-leads`, `/my-trending-leads`, `/conversions` | Leads (user) | Yes (shared view) | Render as user; no bulk/delete controls for user | ✅ |
| `/crm/today-followups`, `/upcoming-followups` | Follow-ups | Yes (shared view + due/overdue badges) | Render | ✅ |
| `/crm/import-leads` | Import | Yes | CSV upload → preview (3 total / 2 valid / 1 invalid) → import → result | ✅ |
| `/crm/reports/lead-insertion` | Reports | Yes | Render with charts and tables; filters/exports not re-tested | ✅ render |
| `/crm/quotations` | Quotations | Yes | Render; delete via ConfirmDialog not exercised | ✅ render |
| `/crm/quotations/create` | Quotations | Yes | Pick client, add product, qty 10 → ₹1,545.60 (matches 12% GST), save, PDF downloaded | ✅ |
| `/crm/quotations/[id]/edit` | Quotations | Yes (same editor) | Not separately exercised | ⚠️ shared code with create |
| `/crm/product-management` | Products | Yes | `?create=product` → add (net auto-calc 118.00), detail panel | ✅ |
| `/crm/product-dashboard` | Products | Yes | Render | ✅ |
| `/crm/vendors`, `/active`, `/pending`, `/inactive` | Vendors | Yes | Render; profile navigation | ✅ render |
| `/crm/vendors/[id]` (8 tabs) | Vendors | Header, badges, tabs, panels | Overview render as user | ✅ render |
| `/crm/vendors/categories`, `/performance`, `/settings`, `/import` | Vendors | Badges + tokens; page structure kept | Render | ✅ render |
| `/crm/user-management` | Admin | Yes | Disable → confirm → Disabled; enable → Enabled; user blocked from page | ✅ |
| `/crm/activity-log` | Audit | Yes | Render; user blocked | ✅ |
| Shell | Layout | New | Collapse + persistence, mobile drawer (390px) closes on navigate, `/` focuses search, breadcrumbs, role-filtered nav | ✅ |

## Quality gates

| Check | Result |
|---|---|
| `npm run lint` (`--max-warnings=0`) | ✅ 0 errors, 0 warnings |
| `tsc --noEmit` (strict) | ✅ 0 errors |
| `vitest run` | ✅ 24 files, 336 tests passed |
| `npm run build` | ✅ success |
| Browser regression (Playwright, local harness) | ✅ flows listed above; 23 routes rendered with no console errors |
| Accessibility | ⚠️ Partial (see below) |

**What the accessibility check covered:**
- An in-page check on 7 key pages found no unnamed buttons or links, no unlabelled controls (the one gap found was fixed), no images without alt text, no duplicate ids, and exactly one `main` and one `h1` per page.
- A WCAG contrast calculation covered every text token pair.
- Dialog focus management (trap, initial focus, return) and Esc handling were verified.

axe-core could not be run, because loading it from a CDN was not permitted in this session.

## Before → after (highlights)
- **Navigation.** Phones previously had no navigation at all. Now:
  - an off-canvas drawer with a hamburger button
  - a collapsible desktop sidebar with tooltips
  - an active-route highlight
  - an expandable Vendors section
  - breadcrumbs, lead search (`/` or Ctrl+K), a Create menu, a theme toggle and an account menu
- **Status meaning.** Every badge used to be green. Now lead status, call status, vendor, product, user and import states each have a semantic tone and a text label.
- **Leads grid.**
  - Three text buttons per row became icon actions.
  - View switcher, removable filter chips, an indeterminate select-all checkbox and a selection-highlighted bulk bar.
  - Due-today/overdue follow-up flags.
  - Assignee avatars and an icon pager.
- **Dialogs.** Three different modal implementations became one accessible `Modal`. Every `window.confirm` became an in-app `ConfirmDialog` with destructive styling.
- **User management.** Admins used to get no feedback, and errors went to the error page. Now there are success/failure toasts, confirmation before disabling, password + confirm fields, KPIs, and only display fields are queried.
- **Dark theme.** All CSS-module colours (≈60 hardcoded values) now use tokens, and chart colours were validated for both themes.
- **Loading and error states.** A route-level skeleton (`crm/loading.tsx`), skeletons in the lead dialogs, empty states with guidance, and a redesigned error boundary.

## Remaining work / known limitations
1. **Forms are partly redesigned.** The vendor create/edit/contacts/addresses/documents dialogs (native `<dialog>` + `ModalForm`) were restyled through tokens, but their field layout is unchanged.
2. **Vendor sub-pages kept their structure.** Categories, performance, settings, import and the profile tabs content got tokens, badges and spacing but were not restructured.
3. **Input border contrast.** `--border-strong` on white is about 1.4:1, below the 3:1 non-text contrast guidance. This is common in enterprise UIs, but strict WCAG 1.4.11 conformance needs a darker control border. This is a design decision for the product owner.
4. **Not built, because the backend does not support them** (no placeholder UI was added):
   - customers module
   - roles & permissions editor
   - notifications
   - saved views
   - personal profile/settings
   - global search beyond leads
5. **Not exercised in the browser:**
   - password reset (real email)
   - quotation edit and quotation delete
   - lead transfer, unassign and bulk update
   - report filters and exports
   - vendor create/edit and vendor import
   - document upload (storage is not emulated locally)

   These code paths only received markup changes around unchanged actions and calls, but they should be smoke-tested on staging.
6. The Sonner toaster follows its own light styling, not the CRM dark theme.
