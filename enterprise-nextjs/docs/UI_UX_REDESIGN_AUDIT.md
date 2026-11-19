# CRM UI/UX redesign — initial audit

Date: 2026-11-19 · Branch: `remediation/enterprise-nextjs` · Scope: authenticated CRM (`/crm/**`) and CRM auth screens.
The public marketing website (`src/app/(website)`, `src/legacy-marketing`) is **out of scope** and is isolated: it has its own
root layout and never imports `src/app/globals.css`.

## 1. Architecture facts that shape the redesign

| Area | Finding | Consequence for the redesign |
|---|---|---|
| Roots | `(crm)` and `(auth)` share `AppRootLayout` → `globals.css`. `(website)` has a separate root. | All CRM styling can be rebuilt in `globals.css` without touching the public site. |
| Styling | Tailwind v4 is installed but almost unused. UI uses ~15 global classes (`page`, `page-head`, `button`, `card`, `table-card`, `field`, `kpi`, `badge`…) plus 6 CSS modules. | Redesign the global class layer as a token-based design system; tokenise the CSS modules. No new dependencies required. |
| Leads | One `LeadListView` server component renders 11 routes via presets; `LeadsClient` handles table, filters, bulk actions; server actions enforce authz. | Redesign once, applies to every lead list. Business logic stays in `src/server/**`. |
| Data | Every list uses server-side pagination/filtering (leads, products, vendors, quotations, activity, reports). | Keep it. No client-side fetching of full datasets. |
| Auth | Supabase session → `requireUser`/`requireAdmin` in every page and action. | UI changes only hide/show controls; backend checks are untouched. |
| Charts | Recharts with hardcoded hex colours. | Move to theme-aware CSS variables. |
| Dependencies | `lucide-react`, `recharts`, `sonner`, `@tanstack/react-table` present; **no** shadcn/Radix installed. | Build small accessible primitives in-house rather than adding Radix + shadcn (avoids a large dependency change on a live app). |

## 2. Route and module inventory

| Route | Module | Access | Rendered by |
|---|---|---|---|
| `/crm` | Shell | user | redirect → dashboard |
| `/crm/login`, `/crm/forgot-password`, `/crm/reset-password` | Auth | public / recovery | `(auth)` pages |
| `/crm/entrydashboard` | Dashboard | user (admin sees all data) | `entrydashboard/page.tsx` |
| `/crm/lead-management` | Leads (all) | user (scoped) | `LeadListView preset=all` |
| `/crm/lead-management/[id]` | Lead detail | user (scoped) | `LeadDetailBody` |
| `/crm/new-leads`, `/crm/assigned-leads`, `/crm/unassigned-leads`, `/crm/trending-leads`, `/crm/won-leads` | Leads | admin | `LeadListView` |
| `/crm/my-leads`, `/crm/my-trending-leads`, `/crm/conversions` | Leads | user | `LeadListView` |
| `/crm/today-followups`, `/crm/upcoming-followups` | Follow-ups | user | `LeadListView` |
| `/crm/import-leads` | Lead import | user | `ImportWizard` + history |
| `/crm/reports/lead-insertion` | Reports | user (scoped) | report page + charts |
| `/crm/quotations`, `/create`, `/[id]/edit` | Quotations | user (admin deletes) | `QuotationForm` |
| `/crm/product-management` | Products + categories | user (admin edits) | `CatalogClient` |
| `/crm/product-dashboard` | Product stats | user | page |
| `/crm/vendors`, `/active`, `/pending`, `/inactive` | Vendors | permission-based | `VendorListView` |
| `/crm/vendors/[id]` (8 tabs) | Vendor profile | permission-based | `profile-tabs.tsx` |
| `/crm/vendors/categories`, `/import`, `/performance`, `/settings` | Vendors | permission-based | pages |
| `/crm/user-management` | Users | admin | page + server actions |
| `/crm/activity-log` | Audit log | admin | page |

Not implemented in the backend (therefore **not** added to the UI as working features): customers module, roles &
permissions editor (roles are a fixed `ADMIN`/`USER` enum + vendor permission matrix), notifications, personal
profile/settings, saved views.

## 3. Problems found

### Critical (usability / accessibility)
1. **No navigation below 900px.** `.sidebar { display:none }` with no replacement — phones and small tablets cannot navigate.
2. **No active-route indication** in the sidebar; no breadcrumbs anywhere.
3. **Status is colour-less and meaning-less.** Every `.badge` is green — "Lost Lead", "Disabled", "Failed" import all render green.
4. **User-management actions fail opaquely.** Server actions throw; errors go to the error boundary; no success feedback; disabling a user has no confirmation.
5. **Destructive confirmations are inconsistent:** custom modal (leads), `window.confirm` (products, categories, quotations, vendors).
6. **Focus is not managed in the leads/products modals** (no initial focus, no focus trap, no focus return). The vendor dialogs use native `<dialog>` and are fine.

### Visual consistency
7. Typography is `Arial`; heading sizes vary page-to-page (h1 2rem, card h2/h3 browser default).
8. ~60 hardcoded colours across CSS modules (`#fff`, `#cfd5e2`, `#f9fafc`…) → no dark theme possible today.
9. Three different modal implementations with three different looks (leads `Modal`, catalog overlay, vendor `<dialog>`).
10. `className="button small"` is used 22× but `.small` is not a global class — those buttons render full-size.
11. Bare `<select>`/`<input>` outside `.field` (dashboard range, activity filters, pager selects) are unstyled browser defaults.
12. KPI cards are plain numbers: no icons, no hierarchy, no visual grouping.
13. Lead row actions are three text buttons per row → very wide rows.

### Responsive
14. Tables rely on `overflow-x:auto` (acceptable) but several lack the wrapper (activity log has it; quotations list, import history and report tables do not on narrow screens).
15. Page header actions don't wrap well; the quotation editor's items table has fixed 90px inputs.

## 4. Redesign plan (prioritised)

1. **Design tokens + global component layer** in `globals.css` (light + dark), keeping legacy variable names as aliases so existing modules inherit the theme.
2. **New application shell:** collapsible grouped sidebar with active state and tooltips, mobile drawer, header with breadcrumbs, record search (routes to the existing lead search), quick-create, theme toggle, user menu.
3. **Shared primitives** (`src/components/ui`): `PageHeader`, `StatusBadge` (semantic tones per lead/call/vendor/product/import status — values unchanged), `MetricCard`, `EmptyState`, `Modal` with focus management.
4. Module passes: dashboard → leads → follow-ups/conversions → products → vendors → quotations → imports → reports → users → audit log → auth.
5. Theme-aware charts.

## 5. Regression risks and mitigations

| Risk | Mitigation |
|---|---|
| Changing markup breaks server-action forms | Form `name`s, hidden inputs and action bindings left untouched; only wrappers/classes change. |
| Changing enum display alters data | `StatusBadge` maps **display tone only**; the value rendered and submitted is the stored value. |
| Theme script flash / hydration mismatch | Inline pre-paint script sets `data-theme`; `suppressHydrationWarning` on `<html>`. |
| Quotation totals | `calc.ts` untouched; editor only restyled. |
| Permissions | Navigation filtering mirrors the existing `adminOnly` rules; pages still enforce `requireAdmin`. |
