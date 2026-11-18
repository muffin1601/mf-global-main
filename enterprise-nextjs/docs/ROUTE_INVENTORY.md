# Route inventory

## Existing public routes

- `/`, `/contact`, `/blogs`, `/blogs/new`, `/blogs/:id`, `/careers`, `/careers/admin`

## Existing CRM routes

- `/crm`, `/crm/login`, `/crm/entrydashboard`, `/crm/lead-management`, `/crm/import-leads`
- `/crm/unassigned-leads`, `/crm/new-leads`, `/crm/user-management`, `/crm/assigned-leads`
- `/crm/trending-leads`, `/crm/my-trending-leads`, `/crm/my-leads`, `/crm/conversions`
- `/crm/today-followups`, `/crm/upcoming-followups`, `/crm/won-leads`
- `/crm/product-dashboard`, `/crm/product-management`, `/crm/vendor-management`
- `/crm/vendors`, `/crm/vendors/active`, `/crm/vendors/pending`, `/crm/vendors/inactive`
- `/crm/vendors/categories`, `/crm/vendors/performance`, `/crm/vendors/settings`, `/crm/vendors/:id`
- `/crm/quotations`, `/crm/quotations/create`, `/crm/quotations/edit/:id`

## New route policy

Public indexed URLs are preserved except blog detail moves from an opaque Mongo ID to `/blogs/[slug]`; migration must install permanent redirects from known legacy IDs. CRM URLs remain unchanged and are `noindex`. Current implementation covers `/`, `/contact`, `/blogs`, `/blogs/[slug]`, `/careers`, `/crm/login`, `/crm/entrydashboard`, `/crm/lead-management`, `/crm/product-management`, `/crm/vendors`, and `/crm/quotations`. Remaining routes are tracked as pending in `MIGRATION_PROGRESS.md`.
