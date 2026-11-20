# Feature gap analysis — Enterprise CRM 2.0 brief vs. current code

**Date:** 2026-11-20. Each requirement from the Enterprise CRM 2.0 brief (§3–§27) is classified against the code as audited in `EXISTING_MODULES.md`.

**Classification:** **W** existing and working · **I** existing but incomplete · **M** missing · **N** needs improvement · **X** blocked by external credentials or infrastructure · **A** requires business approval before building.

"Phase" is the phase in `IMPLEMENTATION_PLAN.md` that closes the gap. Decision IDs (D-xx) refer to the plan's decision register.

## §3 Design system and shared components

| Item | Class | Notes | Phase |
|---|---|---|---|
| Semantic tokens, light/dark, enterprise blue palette | W | `globals.css` with dataviz-validated chart palette (`docs/DESIGN_SYSTEM.md`) | — |
| EnterpriseAppShell, SidebarNavigation, TopNavigation, breadcrumbs | W | `components/layout/app-shell.tsx`, `nav-config.ts` | — |
| PageHeader, MetricCard, StatusBadge, ConfirmDialog, EmptyState, Modal | W | `components/ui/*` | — |
| GlobalSearch, CommandPalette | W (new) | Phase 1: `command-palette.tsx`, `/api/search` | 1 ✔ |
| EnterpriseDataTable | W (new) | Phase 1: `ui/data-table.tsx`, server-driven via the URL. Adopted on the activity log | 1 ✔ |
| LoadingSkeleton, ErrorState, UserAvatar, FormSection | W (new) | Phase 1: `ui/skeleton.tsx`, `ui/error-state.tsx`, `ui/user-avatar.tsx`, `ui/form-section.tsx` | 1 ✔ |
| AdvancedFilterBuilder | I | Leads have a rich filter dialog; it is not generic | 2 |
| SavedViews | M | Needs `SavedView` table | 2 |
| RecordDetailsDrawer | M | Lead detail is a modal plus a full page | 2 |
| ActivityTimeline, AuditHistory | I | Lead status history exists; no unified timeline | 2 |
| NotificationCenter | M | Needs `Notification` table | 5 |
| DateRangePicker | I | Native date inputs are used everywhere and work; a custom picker is optional | 2 |
| FileUploader, DocumentPreview | I | Vendor-specific uploader; no generic one | 6 |
| shadcn/ui + Radix | A | The existing CSS-token system already covers the components. Adopting shadcn means a parallel styling stack (**D-08**) | — |
| TanStack Table | N | Installed (v9) but unused. All tables are server-sorted and server-paged, so client row models add nothing. Re-evaluate for client-side selection grids (**D-08**) | 2 |

## §4 Dashboards

| Item | Class | Notes | Phase |
|---|---|---|---|
| Admin: total/new/assigned/unassigned leads, won/lost, conversion %, today/overdue follow-ups, leaderboard, drill-down | W | `server/dashboard/metrics.ts`, IST-correct, tested | — |
| Admin: active opportunities, pipeline value, expected revenue | M | Needs Opportunity (Phase 3) | 3 |
| Admin: quotation totals | M | Data exists (`quotations.grand_total`); not surfaced | 2 |
| Recent activity, important alerts | I | Recent leads only | 2 |
| Employee: my leads, follow-ups, overdue, conversions, performance | W | Role-scoped | — |
| Employee: my tasks, appointments | M | Needs Activity/Task (Phase 2) | 2 |
| Date filters | I | Performance table has a period filter; KPIs are point-in-time | 2 |
| Documented KPI definitions | I | Inline code comments only; the KPI glossary is part of the Phase 2 deliverables | 2 |

## §5 Leads

| Item | Class | Notes | Phase |
|---|---|---|---|
| All/New/Assigned/Unassigned/My leads, details, edit, assign, transfer, remove | W | Presets + `buildLeadWhere`, tested for both roles | — |
| Lead conversion | I | "Won Lead" status only; no conversion to company/contact/deal (**D-02**) | 3 |
| Server pagination, filters incl. blank matching, existing statuses | W | Preserved verbatim (`lib/crm/constants.ts`) | — |
| Multi-column sorting | M | Fixed order (created desc, or follow-up asc) | 2 |
| Saved filters/views, configurable columns | M | `SavedView` table + DataTable adoption | 2 |
| Bulk assign, bulk export with permissions | W | Admin-only bulk assign; scoped export | — |
| Bulk status update | M | Must write `LeadStatusHistory` per lead | 2 |
| Activity timeline, notes | I | `remarks` + status history only | 2 |
| Ownership/reassignment history | I | `ActivityLog` has lead ids (capped at 200 per action); no per-lead table | 2 |
| Lead aging, inactivity alerts | M | Derivable from `createdAt`/`updatedAt`; alerts need jobs (**D-06**) | 2 / 5 |
| Duplicate detection | W | Phone/contact on create and import; concurrent-insert safe | — |
| Lead merge with safeguards | M | | 3 |
| Lead scoring (configurable, explainable) | A | Factors and weights need sign-off (**D-11**) | 3 |
| Source tracking, import source history | W | `source`, `sourceInferred`, `importJobId`, `fileName` | — |
| Qualification, priority, tags | M | New columns (additive) | 2 |
| Custom fields framework | A | Only if justified (**D-10**) | 6 |
| Round-robin, workload and rule-based assignment | A | Rules need sign-off (**D-12**); must be transactional | 3 |
| LIKE wildcard handling in search filters | N | Prisma `contains` does not escape `%`/`_` on PostgreSQL (proven in `tests/search.global.test.ts`). Global search escapes them. Lead/vendor/product list filters still treat them as wildcards (scope still enforced; correctness only) | 2 |

## §6 Contacts, companies, customers

| Item | Class | Notes | Phase |
|---|---|---|---|
| Contact, Company entities, 360° profile | M | Today, "customer" data is split across `Lead.company` (text), lead `additionalContacts` (JSON) and quotation `party` (JSON) | 2 |
| Lead ↔ contact/company relationship, matching, merge | A | **D-02** must be decided before any migration | 2 |
| GSTIN, billing/shipping addresses | I | Present on leads (JSON) and quotation party; not normalised | 2 |

## §7 Deals and pipeline

All **M**. Pipeline/stage/opportunity tables, Kanban + table, stage history, forecasting. Default stages per the brief, *in addition to* lead statuses (**D-03**). Phase 3.

## §8 Activities and follow-ups

| Item | Class | Notes | Phase |
|---|---|---|---|
| Follow-up scheduling, today/upcoming/overdue | W | Lead fields with IST boundaries | — |
| Unified Activity (call, email, meeting, task, note), outcomes, calendar, workspace | M | New `Activity` table; existing follow-up dates stay authoritative until migrated (see plan M3) | 2 |
| Reminders | M | Needs a durable job runner (**D-06**) | 5 |
| Email/call logging | A | Logged as *manual records only*. Nothing claims a call or email was sent without a real integration | 2 |

## §9 Tasks

All **M** (personal and team tasks, recurrence, comments, attachments, board view, workload). Modelled on `Activity` (type `TASK`). Recurrence needs the job runner. Phase 2 (core) and Phase 5 (recurrence).

## §10 Products

| Item | Class | Notes | Phase |
|---|---|---|---|
| SKU/code, name, description, category, type, colour, image, HSN, GST, cost price, selling slabs, status, search | W | | — |
| Price history | M | Additive `ProductPriceHistory` | 4 |
| Bulk import/export | M | Reuse the vendor import engine | 4 |
| Variants, price books | A | Only if needed (**D-13**) | 4 |
| Inventory | A | Out of scope unless requested; a stock ledger would be required. Never invent balances | — |

## §11 Vendors

Directory, profiles, contacts, GSTIN, addresses, products, documents, notes, status, performance: **W**. Purchase history and vendor quotations: **M**, optional. Purchase orders: **A** (separate scope, **D-14**).

## §12 Quotations

| Item | Class | Notes | Phase |
|---|---|---|---|
| Create, edit, line items, discounts, GST, tax summary, terms, notes, PDF, numbering | W | Decimal-safe, migrated totals never recomputed | — |
| Duplicate quotation | M | Safe: new number, copies lines | 4 |
| Status lifecycle, approval workflow | A | Statuses and approvers/thresholds (**D-04**) | 4 |
| Version history, revision numbers | M | `QuotationRevision` snapshots; saved quotations are never silently altered | 4 |
| Customer/deal association | M | After Company/Opportunity exist | 4 |
| Validity tracking, expiry | I | Validity days/date stored in JSON; no expiry status | 4 |
| Attachments | M | Generic attachments (Phase 6) | 6 |

## §13 Sales orders, invoicing, payments

All **M** and **A**. Requires a written decision on scope, GST treatment (CGST/SGST vs IGST by place of supply, e-invoicing applicability, credit notes), numbering per financial year, and accountant review before production use (**D-05**). Note: today's "invoice" naming in quotations (`invoice_details`, `invoice_counters`) is quotation numbering and must not be reused for tax invoices.

## §14 Import and export center

| Item | Class | Notes | Phase |
|---|---|---|---|
| CSV/Excel import, preview, validation, duplicates, confirmation, history, error reports, idempotent retry | W | Leads and vendors | — |
| Field mapping for leads | I | Vendors have mapping; leads use a fixed template | 5 |
| Background processing for large files | I | Client-driven resumable batches (works on serverless); no server queue | 5 |
| Export with active filters | W | Leads, reports, vendors | — |

## §15 Reporting

| Item | Class | Notes | Phase |
|---|---|---|---|
| Date-wise/insertion, by source/status/employee, assigned vs unassigned | W | Lead insertion report | — |
| By category/location, conversion by employee, follow-up completion | I | Category/location filters exist; no dedicated reports | 5 |
| Funnel, pipeline, revenue, won/lost, quotation, product, vendor, invoice reports | M | Depend on Phases 3–4 | 5 |
| Report builder, saved reports | M | | 5 |
| Scheduled reports | X | Needs a job runner + email delivery (**D-06**, **D-07**) | 5 |

## §16 Automation

All **M**. Requires a durable job/queue table, idempotency keys, loop guards and execution logs. **X/A:** no scheduler is configured today (`vercel.json` crons is empty), so a platform decision is needed first (**D-06**). Phase 5.

## §17 Notifications

In-app: **M** (Phase 5). Email: **X**. Resend is integrated for contact/careers mail, but CRM notification sending needs a verified sender domain and consent for internal mail (**D-07**).

## §18 RBAC

| Item | Class | Notes | Phase |
|---|---|---|---|
| Server-side enforcement, record ownership/scope | W | Every service checks; `leadScope` | — |
| Named permission catalog | W (new) | Phase 1: `CRM_PERMISSIONS` + `can`/`assertCan`. Grants equal today's behaviour (pinned by tests) | 1 ✔ |
| Seven configurable roles | A | Needs a role model and mapping of the 11 existing users (**D-01**) | 6 |

## §19 Audit and security

| Item | Class | Notes | Phase |
|---|---|---|---|
| Audit of lead assignment/transfer/delete, user create/role/password, quotations, imports | W | `ActivityLog`, written in the same transaction | — |
| Structured record type/id, before/after | I | `details` JSON only; additive columns planned (M1) | 2 |
| Export audit | W (fixed) | The audit found that lead and lead-insertion-report exports wrote **no** audit row. Phase 1 adds `lead.exported` / `report.lead_insertion.exported` (metadata only), with tests. Careers applicant export (PIN-guarded, website scope) is still unaudited | 1 ✔ |
| Login throttling, input validation, private files with signed URLs, safe errors | W | | — |
| CSP enforcing | N | Report-only today | 7 |
| Error monitoring, structured logging | M | | 7 |
| Backup/restore procedure | X | Needs Supabase plan details (PITR) and a staging project | 7 |

## §20 Documents

Vendor documents: **W** (private bucket, signed URLs, type/size checks, expiry). Generic attachments for leads, contacts, companies, deals, quotations, orders and invoices: **M**, Phase 6, reusing the vendor document service pattern.

## §21 Global search

**W (new, Phase 1)** for leads, quotations, products and vendors, permission-aware and server-side. Contacts, companies, deals and orders are added as those entities ship. Trigram indexes: **A** (migration M1).

## §22 Administration

Users: **W**. Audit log: **W**. Company profile, numbering sequences, lead statuses, pipelines, assignment rules, templates, notification and integration settings: **M** (Phase 6). `CompanySettings` exists but has no UI. Lead statuses are code constants by design, so changing them is **A**.

## §26 Performance

Server pagination, indexed filters on leads, parallel aggregate counts: **W**. Missing: `activity_logs.occurred_at` index (M1), trigram search indexes (M1), and the leads-per-day chart, which loads one row per lead in the window (fine at today's 62 leads; switch to SQL `GROUP BY` in Phase 2). No load tests exist, so no capacity claim is made.

## §27 Testing

Unit and integration: **W** (24 → 26 files). End-to-end browser tests: **I** (manual Playwright run recorded in `docs/UI_UX_REDESIGN_REPORT.md`, but no committed E2E suite). An automated E2E suite needs a stubbed auth harness (Phase 7).

## Blocked by external credentials (carried from `docs/PRODUCTION_BLOCKERS.md`, still open)

1. Rotate the Supabase database password exposed in a prior session (SEC-14).
2. Provision a staging Supabase project and Vercel Preview. No migration has been rehearsed against Supabase itself.
3. `SUPABASE_SECRET_KEY` for auth provisioning and storage on staging/production.
4. Live keys for TradeIndia, IndiaMART, Coachingpromo and Printkee; scheduler for polling sources.
5. Careers admin shared PIN (SEC-01), which needs an owner decision.
