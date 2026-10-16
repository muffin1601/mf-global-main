# CRM Module Inventory

Audit date: 2026-10-16. Source inspected directly; generated dependencies and build output excluded.

| Module | Frontend | Backend / service | Data model | Access | Automated coverage | Status / observed defects |
|---|---|---|---|---|---|---|
| Public website | `/`, `/contact` and landing components | `POST /api/send-email`, visitor APIs | `Visitor` | Public, rate-limited email | None | Present; external email delivery not exercised. |
| Blogs/comments | `/blogs`, `/blogs/:id`, `/blogs/new` | `/api/blogs/*` | `blog`, `comment` | Reads/comments public; blog create admin | None | Present. Public comments need moderation/abuse controls review. |
| Authentication | `/crm/login`, `ProtectedRoute` | `POST /api/login`, `middleware/auth.js` | `User`, `Counter` | Public login; JWT thereafter | Indirect API tests | Password excluded from responses; JWT expires in 8h. No refresh-token flow. |
| User administration | `/crm/user-management` | `/api/users/all`, register/toggle/password APIs | `User` | Admin | Indirect | Staff directory endpoint was restricted to admin in this audit. |
| Dashboard | `/crm/entrydashboard`, `Overview`, charts | `/api/dashboard`, `/api/overview/*`, `/api/sales-performance` | `ClientData`, `User` | Admin global; user own scope | `clientVisibility.test.js` | Fixed creator visibility, stale count cache, and cross-user aggregate leakage. |
| Leads/clients | Lead Management, My Leads, new/assigned/unassigned/converted/trending pages | client, clientwork, filter, assignment routes | `ClientData`, `ClientPermission` | Admin global; user assigned scope | New visibility tests plus legacy tests | Fixed missing creator assignment, immediate list refresh, creator audit field, and one IDOR update path. |
| Lead import/export | `/crm/import-leads`, CSV modals | upload, lead-import, report endpoints | `ImportHistory`, `ClientData` | Authenticated; some global actions admin | Existing legacy tests only | Present. Production-file/data testing not performed. |
| Follow-ups | today/upcoming pages | `/api/followup/*`, dashboard facets | `ClientData` | Admin or assignee | Indirect visibility tests | Server checks assignment on status update. |
| Assignments | assignment/filter modals | `/api/leads/assign*`, transfer/remove | `ClientData`, `ClientPermission` | Admin for mutations | Legacy route tests | Bulk functionality present; transactionality across compatibility collections remains a review item. |
| Activity log | UI activity modal/log helper | `/api/activity/log`, admin activity route | `UserActivity` | Auth write; admin read | Vendor audit tests | Present. Generic client activity payload is caller-supplied and should get a stricter schema. |
| Products/categories | `/crm/product-dashboard`, `/crm/product-management` | product/category/product-overview routes | `ProductData`, `Category`, `PrintkeeCategory`, `CoachingProduct` | Admin mutation; authenticated reads | Product-code and route tests | Present. Product image uploads use local disk. |
| Legacy vendor master | `/crm/vendor-management` | `/api/vendors*` | `VendorData` | Admin mutation | Legacy vendor tests | Retained for compatibility. |
| Vendor management v2 | `/crm/vendors*` | `/api/vendor-management/*` | Vendor, category, product, document, activity, evaluation, import-job models | Permission middleware; performance/admin restrictions | Extensive 123-test vendor suite | Functional and best-covered module. Local document storage needs shared storage in multi-host deployments. |
| Quotations | list/create/edit routes | `/api/quotations/*`, calculation and invoice-number services | `Quote`, `Counter`, `User` | Owner or admin; delete admin | `quotationApi.test.js`, frontend calculation tests | Fixed PDF/server total drift, stale number in PDF, NaN preview, invalid-ID handling, and first-counter concurrency race. No status/send/duplicate/convert workflow exists. |
| Quotation PDF | Browser download from create/edit | Client-side `html2pdf.js` | Quotation snapshot | Requires authorized create/fetch first | Build + calculation tests; visual browser test not run | Fixed discounts/charges/server totals and HTML escaping. Multi-page visual QA remains NOT TESTED. |
| Purchase Orders | None | None | None | N/A | None | **NOT IMPLEMENTED**. No customer/supplier PO or quotation-to-PO workflow exists. |
| Tasks/to-do | Dashboard `ToDoList` | No mounted task router (`Todo-Performance.js` is unmounted) | `Tasks`, `UserPerformance` | UI only/static/partial | None | Partial/dead backend implementation. |
| Scheduled lead ingestion | No direct page | IndiaMART/TradeIndia cron/scripts | `ClientData` | Process-level | None | Cron runs only on PM2 instance 0; IndiaMART is opt-in. External APIs not tested. |
| Redux/state | Authentication only | N/A | localStorage JWT/user | Client route guard plus server auth | Frontend tests | No lead/query cache; tables use component state and explicit refresh. |

## Architecture confirmed

- React 19 + Vite SPA; Axios; Redux Toolkit only for authentication.
- Express 5 CommonJS API; MongoDB/Mongoose.
- PM2 cluster configuration in `backend/ecosystem.config.cjs`.
- JWT authentication; roles are exactly `admin` and `user`.
- Resend email, local-disk uploads, node-cron ingestion.
- No React Query, SQL database, tenant/workspace model, PO model, invoice module, payment module, or deployment automation was found.

