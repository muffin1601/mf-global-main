# Date-wise Lead Insertion Report Audit

**Audit date:** 2026-11-18

## Headline

**FAIL. The Lead Insertion Report does not exist in the Next.js application.** No route, page, Server Action, query, chart, or export implements date-wise lead insertion reporting. A search of `src/` for "insertion", "date-wise", and "datewise" finds nothing, and no CRM route besides the 10 listed in `FINAL_FEATURE_PARITY_AUDIT.md` exists.

**Important context:** the original MERN app does **not** have this report either. The closest MERN features are:

1. **Date-range lead CSV** (admin): `frontend/src/components/crm/Modals/DownloadModal.jsx` → `POST /api/leads/report/download` (`backend/routes/clientwork.js:216`). The user picks "Created Date" or "Follow-up Date" plus from/to. The CSV filters **only the leads already loaded in the browser table** (not a database query), and `to` is an exact timestamp, not end of day.
2. **Import history and per-import row report** (`backend/routes/leadImport.js:353,373`). These are per-file totals with no per-day aggregation, and they don't cover manual, cron, or webhook leads.
3. **"New leads"** KPI and list (`createdAt` ≥ today 00:00 server time; or last 24 h rolling).

So this report is a **new business requirement**, not a parity item. Its absence in Next.js is still a FAIL against this audit's mandatory scope. Items 1–2 above are themselves missing from Next.js (parity P-65, P-66, P-74).

## Data foundation (what a future report could rely on)

| Question | Finding | Status |
|---|---|---|
| Canonical insertion timestamp | MongoDB `ClientData` uses Mongoose `timestamps: true` → `createdAt`. Next.js maps it to `leads.created_at` (`prisma/schema.prisma`, `Lead.createdAt`). | PASS (design) |
| Historical dates preserved by migration | `scripts/migrate-mongodb/index.ts` writes `createdAt: doc.createdAt ?? new Date(0)` on both create and update. Imported leads are therefore **not** dated with migration time. | PASS (static) / BLOCKED (no migrated data) |
| Missing timestamps in source | Live MongoDB: 0 of 62 leads lack `createdAt` (read-only count). | PASS |
| `createdAt` immutable | No DB trigger or privilege prevents updates. No app code updates it today. | FAIL (DB-06) |
| Manual vs imported distinguishable | Only implicitly: `file_name` non-null ⇒ CSV import (47 of 62 live leads). Cron leads (IndiaMART/TradeIndia) also have `fileName = null`, so they look identical to manual entries apart from `datatype`. No `source` column and no `import_job_id` FK. | FAIL |
| Index for date-range queries | Only `(status, created_at DESC)`. No standalone `created_at` index. | FAIL (DB-06) |
| Historical status at insertion | Not stored anywhere (MongoDB or Postgres). Only **current** status exists, so "status at insertion" cannot be reported for historical data. | FAIL (cannot be reconstructed) |

### Reference reconciliation baseline (live MongoDB, read-only, grouped by IST day)

This is what a correct report must show for migrated data. Use it as the acceptance fixture once data is in staging.

| IST date | Leads inserted |
|---|---:|
| 2026-06-22 | 1 |
| 2026-06-23 | 47 |
| 2026-09-05 | 6 |
| 2026-10-05 | 1 |
| 2026-10-08 | 1 |
| 2026-10-09 | 2 |
| 2026-11-04 | 1 |
| 2026-11-05 | 2 |
| 2026-11-09 | 1 |
| **Total** | **62** |

Query: `clientdatas.aggregate([{ $group: { _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: "Asia/Kolkata" } }, n: { $sum: 1 } } }])`. The Postgres equivalent could not be run, because the target database has no `leads` table (DB-01).

## The 25 required checks

| # | Check | Status | Evidence / reason |
|---|---|---|---|
| 1 | Grouped by actual insertion date | FAIL | Report not implemented |
| 2 | `createdAt` immutable | FAIL | No DB-level protection (DB-06) |
| 3 | Historical MongoDB dates preserved | BLOCKED | Mapping correct in source; no migrated data to verify |
| 4 | Imported leads not dated with migration time | BLOCKED | Same as #3 |
| 5 | Manual vs imported distinguished | FAIL | No source column; cron leads indistinguishable from manual |
| 6 | Date ranges work | FAIL | Not implemented |
| 7 | Today / yesterday filters | FAIL | Not implemented |
| 8 | Weekly / monthly reports | FAIL | Not implemented |
| 9 | Asia/Kolkata boundaries | FAIL | Not implemented. Existing dashboard "today" logic uses server-local time, which is wrong on Vercel (UTC) |
| 10 | Employee filter | FAIL | Not implemented |
| 11 | Source filter | FAIL | Not implemented |
| 12 | Status filter | FAIL | Not implemented |
| 13 | Assignment filter | FAIL | Not implemented |
| 14 | Import filename / batch filter | FAIL | Not implemented; no batch FK |
| 15 | Summary totals correct | FAIL | Not implemented |
| 16 | Click date → leads | FAIL | Not implemented |
| 17 | Charts match DB totals | FAIL | Not implemented |
| 18 | CSV export | FAIL | Not implemented (no lead CSV export exists at all) |
| 19 | Excel export | FAIL | Not implemented (no library present) |
| 20 | PDF export | FAIL | Not implemented |
| 21 | Exports match filters | FAIL | Not implemented |
| 22 | Unauthorized employees cannot export restricted leads | FAIL | Not implemented, so nothing to verify |
| 23 | Large datasets paginated efficiently | FAIL | Not implemented; no `created_at` index |
| 24 | Empty ranges display correctly | FAIL | Not implemented |
| 25 | Repeated imports don't duplicate leads | FAIL | Import itself is disabled (`import-leads/page.tsx:4`); DB has no uniqueness (DB-05) |

**Totals:** PASS 0 · FAIL 23 · BLOCKED 2.

## Finding

### RPT-01 — Lead Insertion Report not implemented
- **Severity:** High · **Module:** Reports · **Status:** FAIL
- **File:** none (absent); related `src/app/(crm)/crm/entrydashboard/page.tsx:4`
- **Business impact:** Management cannot see daily lead intake per employee or source. This is the mandatory business-critical report named in the audit scope.
- **Recommended fix (for approval):**
  1. Add `source` (`MANUAL`/`IMPORT`/`INDIAMART`/`TRADEINDIA`/`WEBHOOK`), `import_job_id` FK, a `created_at` index, and a `created_at` immutability trigger.
  2. Build a server-side aggregation: `date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata')` with role scoping, and filters for employee, source, status, assignment, and file.
  3. Add a drill-down list with keyset pagination.
  4. Add streaming CSV and XLSX exports, plus PDF, all reusing the exact same `where` clause.
  5. Record a `lead_status_history` table going forward. Historical status at insertion cannot be recovered.
- **Verification:** Reconcile per-day totals against the baseline table above on a staging copy. Test IST midnight boundaries (18:29:59Z vs 18:30:00Z). Confirm a USER export contains only their assigned leads.
