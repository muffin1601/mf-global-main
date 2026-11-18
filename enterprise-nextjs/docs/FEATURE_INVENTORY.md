# Feature inventory

Source of truth: `../backend` and `../frontend`, inspected 2026-11-17. Status values describe this migration only: **implemented**, **foundation**, or **pending**. An item is never considered complete merely because a route renders.

| Domain | Existing feature/workflow | Original evidence | Database/API dependency | Role | Migration status |
|---|---|---|---|---|---|
| Public site | Homepage sections, services, process, categories, testimonials, contact CTA | `frontend/src/pages/main/Mainhome.jsx`, `frontend/src/components/main/*` | contact email | Public | Foundation: redesigned homepage; remaining original content copy pending |
| Public site | Contact form and email delivery | `frontend/src/pages/main/Contact.jsx`, `backend/routes/main/emailRoutes.js` | `POST /api/send-email`, Resend | Public | Implemented DB capture; outbound email pending |
| Blog | List, detail, media, create post, comments | `frontend/src/pages/main/Blog*.jsx`, `backend/routes/main/blogRoutes.js`, `models/blog.js`, `models/comment.js` | blogs/comments, storage | Public/admin | Read pages implemented; authoring/comments pending |
| Careers | Published openings and application form with resume | `frontend/src/pages/main/Careers.jsx`, `backend/routes/main/careersRoutes.js` | jobs, applications, resume storage | Public | Implemented in code; real Supabase Storage verification pending |
| Careers admin | PIN login/session, job CRUD/archive/publish, applications, status/notes, downloads, stats | `CareersAdmin.jsx`, `careersRoutes.js`, career models | career collections | Admin | Pending; Supabase-admin replacement designed |
| Auth | Login, JWT session, enabled-user check, logout | `pages/crm/Login.jsx`, `routes/login.js`, `middleware/auth.js` | User | Admin/user | Supabase login/session implemented; user provisioning/recovery pending |
| Users | List, register, enable/disable, change password, activity | `UserManagement.jsx`, `UserTable.jsx`, `routes/login.js`, `routes/admin.js` | User, UserActivity | Admin | Schema/guard foundation; UI/actions pending |
| Leads | Add/edit/delete, duplicate phone/contact checks, bulk save | lead pages/tables/modals, `routes/client.js` | ClientData | Scoped user/admin | Single create/edit/delete and duplicate enforcement implemented; bulk save pending |
| Leads | Assigned, unassigned, my leads, new, trending, conversions/won | lead pages/tables, `dashboardoverview.js`, `clientwork.js` | ClientData assignments/status | Role-dependent | Dashboard aggregation implemented; dedicated views pending |
| Leads | Assignment, removal and transfer with per-lead permissions | `routes/assignment-routes.js`, `ClientPermission.js` | assignments | Admin | Single assignment/unassignment with permissions implemented; bulk/transfer workflows pending |
| Leads | Advanced exact filters with blank/null semantics | `FilterModal.jsx`, `filterRoutes.js`, normalized fields | ClientData | Scoped user/admin | Pending; semantics require parity tests |
| Follow-ups | Today/upcoming reminders and status updates | follow-up pages, `routes/followup.js` | followUpDate | Scoped user/admin | Dashboard today count implemented; views/actions pending |
| Lead import | CSV sample, preview/map/validate, batched commit, history/report | `LeadImport.jsx`, `routes/leadImport.js`, `ImportHistory.js` | CSV, leads | User/admin | Schema/checkpoint foundation; workflow pending |
| Reports | Assigned/admin CSV exports and selected-lead reports | `clientwork.js`, download/fetch modals | Lead dataset | Scoped user/admin | Pending |
| Dashboard | Role-aware KPIs, recent leads, overview chart, tasks and sales performance | `Dashboard.jsx`, `Overview.jsx`, `ChartOverview.jsx`, `ToDo*`, `SalesPerformance.jsx` | clients/tasks/sales | Scoped user/admin | Four live KPIs + recent table implemented; remaining widgets pending |
| Products | Dashboard, catalogue CRUD, image, archive, code generation, duplicate-safe validation | Product pages/components, `routes/Products/*`, `ProductData.js` | Product, Category, storage | Admin | Read catalogue + relational schema implemented; actions/dashboard pending |
| Categories | Category CRUD and generated codes | `routes/Products/Category.js`, `Category.js` | Category | Admin | Schema implemented; actions pending |
| Legacy vendors | Simple add/list/edit/delete vendor | `ProductManage/VendorPage.jsx`, `routes/Products/vendor.js` | legacy vendor model | Admin | Superseded by active vendor-management module; data mapping required |
| Vendors | Paginated search/filter/sort, summary/meta, duplicate check, status, archive/restore/delete/audit | `VendorManage/*`, `routes/Vendors/vendors.js` | VendorData | Capability RBAC | Read list + full relational core implemented; actions pending |
| Vendor contacts | Contact CRUD, primary contact, address CRUD | `VendorContactsTab.jsx`, `vendorContacts.js` | embedded contacts/addresses | view/edit | Relational schema implemented; UI/actions pending |
| Vendor categories | List/create/edit/delete | `VendorCategories.jsx`, `vendorCategories.js` | VendorCategory | manage_categories | Schema implemented; UI/actions pending |
| Vendor products | Supply join, pricing, tiers, MOQ, lead time, effective periods, preferred flag | `VendorProductsTab.jsx`, `vendorProducts.js` | VendorProduct/Product | view/edit | Schema implemented; UI/actions pending |
| Vendor documents | Protected upload/download, metadata, archive/delete, expiry | `VendorDocumentsTab.jsx`, `vendorDocuments.js` | VendorDocument, files | documents/view | Supabase storage design + schema; workflow pending |
| Vendor performance | Six-criterion evaluation, leaderboard, delete | `VendorPerformanceBoard.jsx`, `vendorPerformance.js` | VendorEvaluation | performance/view | Schema implemented; board/actions pending |
| Vendor import/export | Upload/map/validate/commit/report/template/export | `VendorImportModal.jsx`, `vendorImportExport.js` | import job/CSV | import/export | Schema/checkpoints implemented; workflow pending |
| Quotations | List/create/edit, client/additional contacts, shipping, item search/add, calculations, taxes/discounts/rounding, PDF | quotation pages/components/utils, `routes/quotation.js`, `Quote.js` | Quote/Product/Client | Scoped user/admin | Real read list + normalized schema; authoring/PDF pending |
| External leads | CoachingPromo and Printkee webhook capture | `routes/leads.js`, external schemas | external Mongo databases | Rate-limited public webhook | Pending; secrets/signature strategy required |
| Integrations | IndiaMART and TradeIndia scheduled lead ingestion | `cron/*`, `scripts/fetch*` | partner APIs | System | Pending; Vercel Cron design required |
| Visitors | Daily unique visitor count and metadata | `routes/main/visitor.js`, `Visitor.js` | Visitor | Public/admin | Relational schema implemented; endpoint pending |
| Activity | User activity recording/list | `logActivity.jsx`, `activitylog.js`, `UserActivity.js` | ActivityLog | Auth/admin | Schema implemented; service/UI pending |

## Explicit exclusions found in source

Commented navigation entries (settings, opportunities, reports) are not active features and are not invented here. No implemented purchase-order or inventory model/route exists in the authoritative source despite mentions in historical reports; these are not parity requirements unless source is later supplied.
