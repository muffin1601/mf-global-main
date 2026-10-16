# Dashboard Data Audit

Status: **PASS for repaired lead scopes; PARTIAL overall**

- Admin counts use global records and a five-minute in-process cache.
- User counts now use authenticated `assignedTo.user._id`; global totals are no longer exposed to staff.
- New client creation clears the admin counts cache.
- My Leads, conversions, trends and follow-ups share the authenticated owner scope.
- Sales performance now returns global aggregation only to admins and the current user's row to staff.
- New creation triggers table refresh without a hard reload.

Known limitations:

- PM2 workers have independent in-memory caches; Redis or cache versioning is required for strict cross-worker immediacy.
- `user-dashboard-stats` returns complete arrays and is not server-paginated. Admin lead lists are paginated and were tested with 105 rows.
- No quotation or PO widgets exist on the current dashboard.
- Browser-level rendering and time-zone boundary tests remain **NOT TESTED**.
