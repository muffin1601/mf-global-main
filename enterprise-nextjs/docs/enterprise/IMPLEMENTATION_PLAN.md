# Implementation plan — Enterprise CRM 2.0

**Date:** 2026-11-20 · Phases run in dependency order. Each phase ends with: typecheck, lint, full test suite, production build, docs update, remaining-issues list. Nothing is deployed and no migration is applied to Supabase without written owner approval.

## Phase 1 — Foundation ✅ (this change)

| Deliverable | Files | Verification |
|---|---|---|
| Repository audit + 5 enterprise docs | `docs/enterprise/*` | — |
| CRM permission catalog (`can`, `assertCan`, `permissionsFor`), grants identical to current behaviour | `src/lib/permissions/index.ts`, `src/server/actor.ts` | `tests/foundation.phase1.test.ts` |
| Global search API, permission-aware, wildcard-safe | `src/server/search/service.ts`, `src/app/api/search/route.ts` | `tests/search.global.test.ts` (12 tests) |
| Command palette (Ctrl/⌘+K, `/`), replaces the leads-only topbar search; "search all leads" kept as an action | `src/components/layout/command-palette.tsx`, `app-shell.tsx`, `globals.css` | build; manual browser check pending (see below) |
| `DataTable` (URL-driven sort, page size, columns, density) adopted on the activity log; `listActivity` gains `sortDir` (default unchanged) | `src/components/ui/data-table.tsx`, `src/lib/table-params.ts`, `activity-log/page.tsx`, `server/activity/service.ts` | unit + DB tests |
| Skeleton, ErrorState, UserAvatar/UserChip, FormSection/FormCard; adopted in CRM `loading.tsx` / `error.tsx` | `src/components/ui/*` | build |
| Security fix: lead and report exports are audited | `src/server/audit/log.ts`, `server/leads/export.ts`, `server/reports/lead-insertion-export.ts` | DB test |
| Database migration planning | this document (M1–M6), `ARCHITECTURE.md` §3 | — |

No schema change, no new dependency, no change to the public website.

## Phase 2 — Core CRM

Contacts, companies, unified activities/tasks/notes, lead timeline and ownership history, saved views, lead priority/qualification/tags, bulk status update, multi-column sort, wildcard-safe list filters, dashboard quotation totals and KPI glossary, `RecordDetailsDrawer`. Needs **M1, M2, M3** and decisions **D-02**.

## Phase 3 — Sales pipeline

Pipelines/stages/opportunities (Kanban + table, drag-and-drop, stage history, forecast), lead conversion and merge, scoring, assignment rules. Needs **M4**, **D-03, D-11, D-12**.

## Phase 4 — Sales operations

Quotation status/approval/revisions/duplicate, product price history and bulk import/export; then — only after **D-05** — sales orders, invoices, payments, credit notes. Needs **M5**, **D-04, D-05, D-13, D-14**.

## Phase 5 — Intelligence & automation

Durable job runner, notifications, automation rules, report builder and remaining reports, lead import field mapping. Needs **M6**, **D-06, D-07**.

## Phase 6 — Administration

Configurable roles (**D-01**), settings (company profile, numbering, pipelines, templates), generic attachments, custom fields (**D-10**), user-management UX fixes.

## Phase 7 — Production hardening

Committed Playwright E2E suite with stubbed auth, enforcing CSP, error monitoring + structured logs, accessibility and responsive QA, synthetic-data load tests (e.g. 100k leads) with published results, backup/restore rehearsal on staging, deployment and rollback runbook.

## Migration inventory (proposed, none applied)

| ID | Content | Type | Risk / rollback |
|---|---|---|---|
| M1 | `CREATE EXTENSION pg_trgm`; GIN trigram indexes on leads (name, company, phone, contact, email), products (p_name, p_code), vendors (name); `activity_logs(occurred_at DESC)`; `ActivityLog` + nullable `entity_type`, `entity_id`, `before`, `after` | Additive | Use `CREATE INDEX CONCURRENTLY` in production; rollback = drop indexes/columns |
| M2 | `companies`, `company_addresses`, `contacts`; nullable `leads.company_id`, `leads.contact_id`; lead `priority`, `qualification`, `tags`, `last_activity_at`; `saved_views`; `lead_assignment_events` | Additive | Rollback = drop new tables/columns; no existing data rewritten |
| M3 | `activities`, `activity_comments`; backfill script (separate, dry-run first) creating FOLLOW_UP activities from `leads.follow_up_date` | Additive + optional backfill | Backfill is idempotent (unique `(related_id, legacy_source)`); lead fields untouched |
| M4 | `pipelines`, `pipeline_stages`, `opportunities`, `opportunity_stage_history`, `opportunity_products`, scoring columns/config | Additive | Seed default pipeline only after D-03 |
| M5 | Quotation lifecycle columns, `quotation_revisions`, `quotation_approvals`, `document_sequences`, `product_price_history`; (after D-05) orders/invoices/payments | Additive | Existing quotations get `status = NULL` meaning "legacy/unspecified" — never auto-assigned a status |
| M6 | `jobs`, `notifications`, `notification_preferences`, `automation_rules`, `automation_executions` | Additive | Drop tables |

Process for every migration: generate SQL locally → review → apply to embedded test DB (`npm test`) → apply to **staging** Supabase → verify → owner approval → backup/PITR checkpoint → `prisma migrate deploy` on production. No destructive statement without explicit approval.

## Decision register (requires business approval)

| ID | Decision | Recommendation |
|---|---|---|
| D-01 | Role set and mapping of the 11 existing users | Adopt the 7 roles; ADMIN→Admin, USER→Sales Executive; nominate Super Admin(s) |
| D-02 | Lead ↔ company/contact relationship; when conversion creates a customer | Conversion is an explicit action (not automatic on "Won Lead"); match on GSTIN, then phone/email, with a confirm step |
| D-03 | Default pipeline stages and probabilities; relation to lead status | Use the brief's 8 stages; lead status untouched; opportunity won ≠ lead status change unless chosen |
| D-04 | Quotation statuses, who approves, thresholds (discount %, value) | Statuses per brief; approval required above a discount % set by admin |
| D-05 | Scope of orders/invoices/payments; GST rules, e-invoicing, FY numbering; accountant sign-off | Defer tax invoices until reviewed; build sales orders first |
| D-06 | Job scheduler platform (Vercel plan vs Supabase pg_cron) | Postgres job table + one scheduler tick per minute |
| D-07 | Email provider/sender for CRM notifications | Resend with verified domain; in-app first |
| D-08 | UI stack: keep token CSS vs adopt shadcn/Radix | Keep token CSS; adopt individual Radix primitives only where needed |
| D-09 | Soft delete for leads (currently hard delete) | Soft delete with admin-only purge |
| D-10 | Custom fields framework | Defer until a concrete field list exists |
| D-11 | Lead scoring factors and weights | Completeness, source, recency of real activities, qualification; shown with breakdown |
| D-12 | Assignment rules (round-robin, workload, rule-based) | Round-robin among enabled Sales Executives, opt-in per source |
| D-13 | Product variants and price books | Not needed unless requested |
| D-14 | Purchase orders / procurement | Separate optional scope |
| D-15 | Production cut-over: password rotation, staging project, rehearsal | Required before any of the above reaches production |

## Remaining issues after Phase 1

1. Command palette and DataTable verified by typecheck, lint, unit/DB tests and production build; **not yet exercised in a real browser** in this session.
2. List-filter LIKE wildcard behaviour (lead/vendor/product lists) unchanged — Phase 2.
3. All carried production blockers in `docs/PRODUCTION_BLOCKERS.md` that require owner action remain open.
