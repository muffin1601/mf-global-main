# Final Feature Parity Audit — MERN → Next.js

**Audit date:** 2026-11-18 · **Sources:** `frontend/src` (React/Vite), `backend` (Express; mounts per `backend/server.js:59-188`) versus `enterprise-nextjs/src`.

**Method:** Source comparison only. Runtime verification of the Next.js app is **BLOCKED** for every database-backed feature, because the configured Supabase database has no schema or data (see `DATABASE_INTEGRITY_AUDIT.md`, DB-01). So "PASS" below means "**implemented and matches the original in source**". It never means "exercised at runtime". Where a feature is implemented but cannot be run, the status is BLOCKED.

**Status key:** PASS = implemented and equivalent in source · FAIL = missing, partial, or wrong · BLOCKED = implemented but runtime verification impossible · N/A = not a feature of the original (confirmed in MERN source).

**Out-of-scope MERN code:** confirmed dead and not counted. That covers `routes/blogRoutes.js`, `routes/fetch-client.js`, and `routes/Todo-Performance.js` (none are mounted), the unused models `Tasks`/`UserPerformance`, and `CoachingProduct`/`PrintkeeCategory` (their requires are broken). Also `CsvUploadModal` (never rendered), `QuotationModal` (commented out), and `EditQuotation.jsx` (no route).

## Scale of the gap

| | MERN | Next.js |
|---|---:|---:|
| CRM frontend routes | 33 | 10 (incl. login/forgot/reset) |
| Mounted CRM API endpoints (excl. public site) | ~150 | 0 Route Handlers + 7 Server Actions |
| CRM modals/forms with write actions | ~30 | 6 inline forms |

## Matrix

### Authentication and users

| # | Feature | MERN source | Next.js source | Prisma model | Status | Evidence | Severity |
|---|---|---|---|---|---|---|---|
| P-01 | Login by username or email | `routes/login.js:32` | `(auth)/crm/login/actions.ts:11` | User | BLOCKED | Implemented; no auth users exist | High |
| P-02 | Login rate limit 10/15 min | `middleware/rateLimiters.js` | — | — | FAIL | Not ported (SEC-04) | Medium |
| P-03 | Migrated users can sign in | (bcrypt in Mongo) | — | User.authUserId | FAIL | No linking script (DB-03) | Critical |
| P-04 | Logout | Navbar.jsx (clear token) | `auth/signout/route.ts` | — | BLOCKED | Implemented | Low |
| P-05 | Password recovery by email | none in MERN | `forgot-password`, `reset-password` | — | BLOCKED (new feature) | Implemented; Supabase templates not inspected | Low |
| P-06 | Disabled users blocked | `middleware/auth.js` (403) | `lib/auth/session.ts:20` | User.enabled | BLOCKED | Implemented | High |
| P-07 | Register user (admin) | `admin.js:55`, `RegisterUserModal.jsx` | `user-management/actions.ts:11` | User, UserSequence | BLOCKED | Implemented | High |
| P-08 | Enable/disable user | `admin.js:39` | `user-management/actions.ts:13` | User | BLOCKED | Implemented | High |
| P-09 | Admin password reset | `login.js:73`, `ChangePasswordModal.jsx` | `user-management/actions.ts:15` | — | BLOCKED | Implemented (refuses disabled users; MERN did not) | Medium |
| P-10 | User list (ID, email, username, role, status) | `UserTable.jsx`, `login.js:22` | `user-management/page.tsx` | User | BLOCKED | Implemented | Low |
| P-11 | Activity log viewer per user (Track Activity) | `admin.js:17`, `ActivityLogModal.jsx` | — | ActivityLog | FAIL | Logs are written, but there is no viewer | High |
| P-12 | Client-side activity logging (`/activity/log`) | `activitylog.js:7`, `utils/logActivity.jsx` | partial: server-side logs for lead/user actions only | ActivityLog | FAIL | Downloads, product, and vendor actions not logged | Medium |
| P-13 | `userId` auto-code (prefix + seq) | `models/User.js` + Counter | `user-management/actions.ts:11` | UserSequence | BLOCKED | Sequence is per role, as in the original | Low |

### Dashboard

| # | Feature | MERN source | Next.js source | Status | Evidence | Severity |
|---|---|---|---|---|---|---|
| P-14 | Total leads (admin all / user own) | `dashboardoverview.js:15` | `entrydashboard/page.tsx:4` | BLOCKED | Implemented | High |
| P-15 | New leads (created today) | same | — | FAIL | Missing | High |
| P-16 | Assigned leads count | same | — | FAIL | Missing | High |
| P-17 | Unassigned leads count | same | `entrydashboard/page.tsx:4` | BLOCKED | Implemented | High |
| P-18 | Converted / Won leads (`status = "Won Lead"`) | `dashboardoverview.js` | `entrydashboard/page.tsx:4` | **FAIL** | Counts `status in ["Converted","Won","converted"]`, which never matches the real value "Won Lead" (live Mongo statuses: New Lead, Followed Up, In Progress). KPI would always read 0. | High |
| P-19 | Conversion rate % | `Overview.jsx` | — | FAIL | Missing | High |
| P-20 | Trending (In Progress) leads | `dashboardoverview.js` | — | FAIL | Missing | High |
| P-21 | Lost leads | not in MERN | — | N/A | — | — |
| P-22 | Today's follow-ups | `user-stats` | `entrydashboard/page.tsx:4` | **FAIL** | Uses `new Date().setHours(0)` in server time; Vercel runs UTC, so the IST day is off by 5.5 h | High |
| P-23 | Upcoming follow-ups | `user-stats` | — | FAIL | Missing | High |
| P-24 | Overdue follow-ups | not in MERN | — | N/A (new requirement; absent) | — | Medium |
| P-25 | Sales/employee performance (leads, deals, close %) | `salesPerformance.js:9`, `SalesPerformance.jsx` | — | FAIL | Missing | High |
| P-26 | Clickable KPI cards → filtered lists | `Overview.jsx` | — | FAIL | Cards are static | Medium |
| P-27 | Charts | `ChartOverview.jsx` (**hard-coded mock data**) | — | N/A | Original charts are fake | — |
| P-28 | To-do list | `ToDoList.jsx` (local state only, not saved) | — | N/A | Not persisted in original | — |
| P-29 | Date filters on dashboard | Sales dropdown is cosmetic | — | N/A | Not functional in original | — |
| P-30 | Recent leads table | not in MERN | `entrydashboard/page.tsx` | PASS (new) | — | — |

### Lead lists and lead management

| # | Feature | MERN source | Next.js source | Status | Evidence | Severity |
|---|---|---|---|---|---|---|
| P-31 | All-leads table (admin) | `LeadTable.jsx`, `filterRoutes.js:71` | `lead-management/page.tsx` | BLOCKED | Implemented (admin and user scope) | High |
| P-32 | My leads | `MyLeadTable.jsx` | `lead-management/page.tsx` (user scope) | BLOCKED | Equivalent through scoping | Medium |
| P-33 | Unassigned leads page | `UnassignedLeadTable.jsx` | — | FAIL | No filter for unassigned | High |
| P-34 | Assigned leads page | `AssignedLeadsTable.jsx` | — | FAIL | Missing | High |
| P-35 | New leads page (24 h) | `NewLeadTable.jsx` | — | FAIL | Missing | Medium |
| P-36 | Trending / my-trending pages | `TrendingLeadsTable.jsx`, `MyTrendingLeads.jsx` | status filter "In Progress" only | FAIL | No dedicated view | Low |
| P-37 | Won leads / my conversions pages | `ConvertedLeadsTable.jsx`, `MyConversionTable.jsx` | status filter only | FAIL | No dedicated view | Low |
| P-38 | Today / upcoming follow-up lists | `TodayFollowupsTable.jsx`, `UpcomingFollowupsTable.jsx` | — | FAIL | Missing | High |
| P-39 | Create lead | `client.js:11`, `FormModal.jsx` | `lead-management/actions.ts:11` | BLOCKED | Implemented. Missing fields: countryCode, address, callingDate, status, and callStatus at creation | Medium |
| P-40 | Live duplicate check (phone/contact) showing existing lead | `client.js:60,83` | server-side check on submit only | FAIL | No live check; shows a generic error page | Medium |
| P-41 | Duplicate prevention | `client.js:11` | `actions.ts:11` | BLOCKED | Implemented, but race-prone (DB-05) | Medium |
| P-42 | View lead details modal | `LeadModal.jsx` | — | FAIL | No detail view; most fields (email, state, quantity, addresses, contacts, follow-up history) are never displayed | High |
| P-43 | Edit lead (name, email, phone, company, contact, location, state, category, address, requirements, remarks) | `EditLeadModal.jsx`, `client.js:161` | `actions.ts:14` | FAIL | Only name, location, category, requirements, remarks, status, callStatus, and follow-up date are editable. Email, phone, company, contact, state, and address are not. | High |
| P-44 | Calling date | `EditLeadModal.jsx` | — | FAIL | Missing | Medium |
| P-45 | Additional contacts (add/delete) | `AdditionalContactsModal.jsx` | — | FAIL | Missing (schema has a `additionalContacts` Json) | Medium |
| P-46 | Billing / shipping address | ClientData | — | FAIL | Schema only | Low |
| P-47 | Status update | `followup.js:56` | `actions.ts:14` | BLOCKED | Implemented | High |
| P-48 | Call status update | `client.js:161` | `actions.ts:14` | BLOCKED | Implemented | High |
| P-49 | Follow-up date with 3-slot rotation | `client.js:161` | `actions.ts:14` | BLOCKED | Same rotation logic | Medium |
| P-50 | Follow-up history view | slots displayed in `LeadModal` | — | FAIL | Not displayed | Medium |
| P-51 | Delete lead (admin) | `client.js:105` | `actions.ts:18` | BLOCKED | Single delete only | Medium |
| P-52 | Bulk delete / delete-all-filtered (admin) | `LeadTable.jsx`, `client.js:105` | — | FAIL | Missing | Medium |
| P-53 | Bulk update category/location | `BulkUpdateModal.jsx` | — | FAIL | Missing | Medium |
| P-54 | Assign lead to user (single) | `assignment-routes.js:67` | `actions.ts:16` | BLOCKED | Implemented; **replaces** all assignees (one only) | High |
| P-55 | Bulk assign to multiple users with view/update/delete perms | `assignment-routes.js:11`, `AssignModal.jsx` | — | FAIL | Missing | High |
| P-56 | Remove assignments (bulk) | `assignment-routes.js:135` | per-lead "Unassigned" only | FAIL | No bulk | High |
| P-57 | Transfer assignments user → user | `assignment-routes.js:160`, `FetchReportModal.jsx` | — | FAIL | Missing | High |
| P-58 | Assignee `canDelete` permission honored | MERN FE gates delete to admin | checkbox saved but never enforced | FAIL | Non-functional UI control | Low |
| P-59 | Search | `/clients/filter` | `page.tsx:30-37` (name, company, phone, contact) | BLOCKED | Implemented | Medium |
| P-60 | Multi-select filters: category, location, state, datatype, fileName, status, callStatus, assigned/unassigned, assignee | `FilterModal.jsx`, `filterRoutes.js` | status and callStatus single-select only | FAIL | 7 of 9 filter dimensions missing | High |
| P-61 | Filter option metadata (distinct values) | `assignment-routes.js:215-255` | — | FAIL | Missing | Medium |
| P-62 | Pagination | numeric pager | `page.tsx:43-44,181` | **FAIL** | Server paging exists, but **no next/previous controls**. Only "Page X of Y" text is shown, so leads beyond the first 25 are unreachable from the UI. | High |
| P-63 | Sorting | createdAt desc | createdAt desc | BLOCKED | Same (no user sort in either) | Low |
| P-64 | Product search from lead page | `SearchProductModal.jsx` | — | FAIL | Missing | Low |
| P-65 | Lead CSV export by date range (createdAt / followUpDate) | `DownloadModal.jsx`, `clientwork.js:216` | — | FAIL | Missing | High |
| P-66 | Lead CSV export of current list | `clientwork.js:283` | — | FAIL | Missing | High |
| P-67 | Saved filters | none | — | N/A | — | — |
| P-68 | Lead conversion to customer | none (status "Won Lead" only) | — | N/A | — | — |
| P-69 | Blank/null filtering | none | — | N/A | — | — |

### Lead import

| # | Feature | MERN source | Next.js source | Status | Evidence | Severity |
|---|---|---|---|---|---|---|
| P-70 | Sample CSV download | `leadImport.js:66` | — | FAIL | Missing | Medium |
| P-71 | Upload + preview + validation + dedup | `leadImport.js:83`, `LeadImport.jsx` | — | **FAIL** | Page states "CSV preview and commit remain disabled" (`import-leads/page.tsx:4`) | High |
| P-72 | Batched commit with progress; admin assign-on-import | `leadImport.js:227` | — | FAIL | Missing | High |
| P-73 | Import history | `leadImport.js:353` | `import-leads/page.tsx` | BLOCKED | Read-only list implemented | Medium |
| P-74 | Per-row import report CSV | `leadImport.js:373` | — | FAIL | Missing | Medium |

### External lead sources

| # | Feature | MERN source | Next.js source | Status | Evidence | Severity |
|---|---|---|---|---|---|---|
| P-75 | IndiaMART sync every 5 min | `cron/indiaMartCron.js` | — | **FAIL** | No cron route or `vercel.json` crons | Critical (if enabled in production; gated by `ENABLE_INDIAMART_SYNC`) |
| P-76 | TradeIndia sync every 5 min | `cron/tradeIndiaCron.js` | — | **FAIL** | Missing | Critical — always on in MERN; inbound leads stop at cut-over |
| P-77 | Webhook `/api/coachinpromo/capture-lead` | `leads.js:9` | — | **FAIL** | Missing; external caller would get 404 | Critical |
| P-78 | Webhook `/api/printkee/capture-lead` | `leads.js:50` | — | **FAIL** | Missing | Critical |

### Products and categories

| # | Feature | MERN source | Next.js source | Status | Evidence | Severity |
|---|---|---|---|---|---|---|
| P-79 | Product list | `product.js:127`, `ProductsTable.jsx` | `product-management/page.tsx` (50 rows, read-only) | FAIL | No search, filters, sort, or paging; capped at 50 | High |
| P-80 | Add product with image, code preview, pricing | `product.js:55`, `AddProductModal.jsx` | — | FAIL | Missing | High |
| P-81 | Edit product (optimistic concurrency, image replace) | `product.js:234` | — | FAIL | Missing | High |
| P-82 | Archive product | `product.js:319` | — | FAIL | Missing | Medium |
| P-83 | Product details panel | `ProductsTable.jsx` | — | FAIL | Missing | Medium |
| P-84 | Categories CRUD (delete blocked when in use) | `Category.js`, `AddCategoryModal.jsx` | — | FAIL | Missing | High |
| P-85 | Product dashboard (counts) | `PDashboard.jsx` (mostly mock) | — | FAIL (real counts only) | Total products/vendors cards missing | Low |
| P-86 | Users can read products (for quotations) | `product.js:127,202` | page is admin-only | FAIL | Users have no product access | Medium |

### Vendors

| # | Feature | MERN source | Next.js source | Status | Evidence | Severity |
|---|---|---|---|---|---|---|
| P-87 | Vendor list | `vendors.js:287`, `VendorList.jsx` | `vendors/page.tsx` (50 rows, read-only) | FAIL | No search, filters, or paging | High |
| P-88 | Status presets (active/pending/inactive) | `App.jsx` routes | — | FAIL | Missing | Medium |
| P-89 | Summary cards | `vendors.js:108` | — | FAIL | Missing | Medium |
| P-90 | Create / edit vendor (incl. bank with permission) | `vendors.js:476,530`, `VendorFormModal.jsx` | — | FAIL | Missing | High |
| P-91 | Duplicate check | `vendors.js:343` | — | FAIL | Missing | Medium |
| P-92 | Status change, bulk status, archive/restore, permanent delete | `vendors.js:359-718` | — | FAIL | Missing | High |
| P-93 | Vendor profile (8 tabs) | `VendorProfile.jsx` | — | FAIL | Missing | High |
| P-94 | Contacts and addresses CRUD | `vendorContacts.js` | — | FAIL | Missing | Medium |
| P-95 | Vendor products and pricing tiers | `vendorProducts.js` | — | FAIL | Missing | Medium |
| P-96 | Vendor documents upload/preview/replace/expiry | `vendorDocuments.js` | — | FAIL | Missing; no storage bucket | Medium |
| P-97 | Vendor activities timeline | `vendorActivities.js` | — | FAIL | Missing | Medium |
| P-98 | Evaluations (record/delete) | `vendorPerformance.js:97,133` | — | FAIL | Missing | Medium |
| P-99 | Performance leaderboard (admin) | `vendorPerformance.js:38` | `vendors/performance/page.tsx` | BLOCKED | Read-only leaderboard implemented | Low |
| P-100 | Vendor categories CRUD with reassignment | `vendorCategories.js` | — | FAIL | Missing | Medium |
| P-101 | Vendor CSV import (map/validate/commit/report) | `vendorImportExport.js:130-448` | — | FAIL | Missing | Medium |
| P-102 | Vendor CSV export | `vendorImportExport.js:459` | — | FAIL | Missing | Medium |
| P-103 | Vendor settings / permissions page | `VendorSettings.jsx` | — | FAIL | Missing; permission map exists but unused | Low |
| P-104 | Audit history | `vendors.js:764` | — | FAIL | Missing | Low |
| P-105 | Legacy vendor table (`/crm/vendor-management`) | `Products/vendor.js` | — | FAIL | Missing (superseded in MERN too) | Low |

### Quotations

| # | Feature | MERN source | Next.js source | Status | Evidence | Severity |
|---|---|---|---|---|---|---|
| P-106 | Quotation list (admin all / user own) | `quotation.js:100,133` | `quotations/page.tsx` | FAIL | Read-only, 50 rows. No quotation number, customer, company, or phone columns; no paging | High |
| P-107 | Create quotation (client picker, ship-to, items, terms, bank, summary, TCS, round-off) | `quotation.js:12`, `QuotationCreate.jsx` | — | **FAIL** | Missing | High |
| P-108 | Edit quotation | `quotation.js:53` | — | FAIL | Missing | High |
| P-109 | Delete quotation (admin) | `quotation.js:177` | — | FAIL | Missing | Medium |
| P-110 | Atomic invoice numbering | `utils/invoiceNumber.js` | — | FAIL | Missing | High |
| P-111 | Quotation PDF generation | `utils/generateQuotationPDF.jsx` | — | **FAIL** | Missing | High |
| P-112 | BOQ / purchase orders / inventory | none in MERN | — | N/A | Confirmed absent from MERN | — |

### Public website (summary; details in `MARKETING_WEBSITE_AUDIT.md`)

| # | Feature | MERN source | Next.js source | Status | Severity |
|---|---|---|---|---|---|
| P-113 | Pages `/`, `/contact`, `/blogs`, `/blogs/:id`, `/blogs/new`, `/careers`, `/careers/admin` | `App.jsx:60-66` | `app/(website)/…` | PASS (source parity) / BLOCKED (visual) | — |
| P-114 | `/crm` landing page | `landingpage/components/Home.jsx` | — | FAIL (404) | Low |
| P-115 | Contact enquiry email | `emailRoutes.js:9` | `api/send-email/route.ts` | BLOCKED | High |
| P-116 | Blog list/detail/comments/create | `main/blogRoutes.js` | `api/blogs/*` | BLOCKED | Medium |
| P-117 | Careers jobs/apply/admin (19 endpoints) | `careersRoutes.js` | `api/careers/*` | BLOCKED (no rate limit on apply, SEC-02) | High |
| P-118 | Visitor counter | `main/visitor.js:34` (no FE caller) | — | N/A (unused) | — |
| P-119 | Health / readiness probes | `server.js:59,64` | — | FAIL | Low |

### Not present in MERN (confirmed) — N/A

Customers module, BOQ, purchase orders, inventory, notifications, saved filters, settings UI (company settings has data but no UI in MERN), lead "conversion" workflow, and real dashboard charts.

## Totals

| Status | Count |
|---|---:|
| PASS (source-verified, incl. new features) | 2 |
| FAIL | 80 |
| BLOCKED (implemented, not runnable) | 27 |
| N/A | 10 |
| **Total rows** | **119** |

Counting method: one row = one feature; P-113 is counted as PASS for source parity.

**Conclusion:** The Next.js CRM is a partial shell. Core sales workflows are missing or broken: bulk assignment and transfer, filtering, pagination controls, lead import, CSV exports, follow-up lists, quotation creation and PDF, product and vendor management, and all four automated inbound lead sources. Parity is **not** achieved.
