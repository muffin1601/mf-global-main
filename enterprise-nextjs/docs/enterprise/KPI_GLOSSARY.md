# KPI glossary

Every number on the dashboard, with its exact rule. "Scope" means: **admin** = every record; **user** = leads where the user has an assignment with view access, or quotations/activities the user owns, as stated. All days are Asia/Kolkata (IST) calendar days; the server runs in UTC.

Source: `src/server/dashboard/metrics.ts`, `src/server/activities/service.ts`. Tests: `tests/dashboard.metrics.test.ts`, `tests/phase2.dashboard.test.ts`, `tests/phase2.activities.test.ts`.

## Leads

| KPI | Definition |
|---|---|
| Total leads / My leads | Count of leads in scope |
| New today | Leads created on or after 00:00 IST today |
| Assigned / Unassigned | Leads with at least one / no assignment (admin only) |
| In progress | Leads with status `In Progress` |
| Won / Lost | Leads with status `Won Lead` / `Lost Lead` |
| Conversion rate | Won ÷ total leads in scope × 100, 2 decimals; 0 when there are no leads |
| Lead acquisition chart | Leads created per IST day, last 30 days, zero-filled |
| Pipeline by status | Count of leads per current status |
| Employee performance | Per assignee: leads assigned (by lead creation date in the chosen period) and how many are `Won Lead`. A lead with two assignees counts for both |

## Follow-ups (lead follow-up date)

| KPI | Definition |
|---|---|
| Due today | `followUpDate` within today (IST) |
| Upcoming | `followUpDate` from 00:00 IST tomorrow onwards |
| Overdue | `followUpDate` before 00:00 IST today and status not `Won Lead` / `Lost Lead` |

## Activities (Phase 2)

Scope: activities **assigned to the signed-in user** (also for admins, on the dashboard).

| KPI | Definition |
|---|---|
| My activities due today | Open, non-note activities with `dueAt` within today (IST) |
| My overdue activities | Open, non-note activities with `dueAt` before 00:00 IST today |
| Upcoming (workspace tab) | Open, non-note activities due from 00:00 IST tomorrow |

Activities with no due date appear only under **All**. Notes never count.

## Quotations (Phase 2)

Scope: admin = all quotations; user = quotations they created.

| KPI | Definition |
|---|---|
| Quotations this month | Sum of stored grand totals (₹, incl. tax) of quotations **created** on or after 00:00 IST on the 1st of the current month; count shown below |
| All quotations | Sum of stored grand totals of every quotation in scope |

These are **quoted values, not revenue**. They use record creation time, not the date typed on the quotation. Revenue KPIs need sales orders/invoices (Phase 4, decision D-05).

## Not shown on purpose

Pipeline value, expected revenue, and win probability need opportunities (Phase 3). No placeholder or estimated values are displayed.
