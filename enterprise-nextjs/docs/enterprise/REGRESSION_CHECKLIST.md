# Regression checklist

Run after every phase. **Automated** items are covered by `npm test` (embedded PostgreSQL); **Manual** items need a browser against a local or staging environment (never production), signed in as an admin and as a regular user.

## Gate (automated, must all pass)

- [ ] `npx next typegen && npx tsc --noEmit`
- [ ] `npx eslint . --max-warnings=0`
- [ ] `npx vitest run` — baseline before Phase 1: 24 files / 338 tests; after Phase 1: 26 files (see completion report)
- [ ] `npm run build` with `DATABASE_URL`/`DIRECT_URL` pointed at a non-existent local DB and a placeholder `SUPABASE_SECRET_KEY`

## Authentication & access

- [ ] Admin and user can sign in; disabled user is refused; throttling after 10 failures (auto: `security.auth`)
- [ ] Non-admin opening admin-only URLs (`/crm/lead-management`, `/crm/user-management`, `/crm/activity-log`, `/crm/reports/lead-insertion` scope) is redirected or scoped (auto: `leads.access`, `report.export-access`)
- [ ] Permission catalog grants unchanged (auto: `foundation.phase1`)

## Leads

- [ ] Every preset list loads with correct scope and count (auto)
- [ ] Filters incl. blank matching, date ranges (IST), chips (auto + manual)
- [ ] Create, edit, delete, additional contacts, status history entry on status change (auto)
- [ ] Bulk assign (merge), transfer (replace), unassign, bulk update, delete-all-filtered refuses unfiltered (auto)
- [ ] Duplicate detection on create/import, concurrent inserts (auto: `ingest`)
- [ ] Export CSV/XLSX respects scope **and writes `lead.exported` audit row** (auto)
- [ ] Follow-up lists today/upcoming, overdue KPI at IST midnight boundaries (auto: `dashboard.metrics`)

## Dashboard & reports

- [ ] KPI values equal list counts for each card's link (manual spot check)
- [ ] Lead insertion report totals, drill-down, CSV/XLSX/PDF export, **audit row** (auto)

## Import & integrations

- [ ] Preview, dedupe, resumable commit, retry idempotency, history, error report (auto)
- [ ] Webhooks reject bad key, dedupe, rate-limit (auto); cron run audit (auto)

## Products, quotations, vendors

- [ ] Product CRUD, image sniffing, archive, user read-only (auto)
- [ ] Quotation totals (decimal), numbering under concurrency, owner scope, PDF (auto)
- [ ] Vendor CRUD, permissions per role, documents private + signed URLs, import report (auto)

## Shell & shared UI (Phase 1)

- [ ] Ctrl/⌘+K and `/` open the palette; Esc closes and returns focus; ↑/↓/Enter work; Tab stays inside (manual)
- [ ] Search results respect role scope (auto: `search.global`); `%`/`_` matched literally (auto)
- [ ] "Search all leads for …" lands on the lead list with `?q=` (manual)
- [ ] Recent records are per user; opening one re-checks access (manual)
- [ ] Mobile (<640px): search icon opens a full-screen palette; no horizontal page scroll (manual)
- [ ] Activity log: sort toggle, rows per page, columns picker, compact density; filters keep table preferences; pagination (manual + auto `listActivity sortDir`)
- [ ] Loading skeleton and error boundary render in light and dark themes (manual)

## Phase 2 (core CRM)

- [ ] Migration `20261120000000_enterprise_phase2_core` applies on a fresh DB (auto: every test run) and on staging before production
- [ ] Existing leads show no priority and no tags after migration (auto)
- [ ] Every assignment path writes ownership history (auto: `phase2.leads`)
- [ ] Activities: access rules, IST views, explicit completion only, idempotent complete (auto: `phase2.activities`)
- [ ] Log a completed call from a lead, see it on the timeline; create a follow-up due today, mark done, see it under Completed (manual, done 2026-11-20)
- [ ] Bulk status & tags as admin; sort A–Z with tiebreak; save and share a view; open it as another user and confirm scope (manual)
- [ ] `%` and `_` in any search box match literally (auto)
- [ ] Dashboard activity and quotation cards match `KPI_GLOSSARY.md` (auto + manual spot check)

## Public website

- [ ] Home, blogs, careers, contact render unchanged; no CRM CSS leaks (manual; no files in `src/legacy-marketing` or `src/app/(website)` changed — check `git diff --stat`)
