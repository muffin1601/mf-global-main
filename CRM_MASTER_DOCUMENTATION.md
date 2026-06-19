# MF GLOBAL CRM — Master Reverse-Engineering Document

> **Source of truth:** the codebase at `c:\Users\Admin\Desktop\Sana\CRM` only.
> Every statement below is traced to a file. Items not provable from code are explicitly flagged as **[NOT IN CODE]**, **[DEAD CODE]**, **[PARTIAL]**, or **[STATIC/MOCK]**.
> Stack: **MERN** — MongoDB (Atlas) · Express 5 · React 19 (Vite) · Node.js. No TypeScript, no Better Auth, no payment gateway.

---

# PHASE 1 — SYSTEM ARCHITECTURE

## 1.1 Technology Stack (from `package.json` files)

| Layer | Technology | Evidence |
|---|---|---|
| Frontend | React 19 + Vite 6, react-router-dom v7, Redux Toolkit, axios + native fetch, recharts/chart.js/apexcharts, lucide/react-icons, react-toastify, react-modal, jsPDF + html2pdf.js | `frontend/package.json` |
| Backend | Express **5.1**, Mongoose 8, jsonwebtoken, bcrypt, multer, node-cron, resend, json2csv, csv-parser, moment-timezone, slugify | `backend/package.json` |
| Database | MongoDB Atlas (single connection, `MONGO_URI`) | `backend/server.js:30` |
| Auth | JWT (8h expiry) + bcrypt(cost 10) | `backend/middleware/auth.js`, `backend/routes/login.js` |
| Email | Resend API | `backend/routes/main/emailRoutes.js` |
| Integrations | IndiaMART API, TradeIndia API (cron every 5 min), IP geolocation (ip-api.com) | `backend/cron/*`, `backend/scripts/*`, `backend/routes/main/visitor.js` |

**Not present:** payment gateway, websockets/realtime, message queue, Redis/cache, Better Auth, OAuth, refresh tokens, server-side rendering, Docker/CI config, automated tests.

## 1.2 High-Level Architecture Diagram

```
                          ┌──────────────────────────────────────────────┐
                          │   PUBLIC WEBSITE (marketing) + CRM SPA        │
                          │   React 19 / Vite — single bundle             │
                          │   /            -> Marketing (Mainhome,Blogs)  │
                          │   /crm/*       -> CRM app (ProtectedRoute)    │
                          └───────────────┬──────────────────────────────┘
                                          │ HTTPS (axios + fetch)
                                          │ Authorization: Bearer <JWT>
                                          ▼
        ┌──────────────────────────────────────────────────────────────────────┐
        │                 EXPRESS 5 API  (server.js, port 5010)                 │
        │  CORS allowlist · JSON 50mb · /uploads static                         │
        │  ┌───────────────┐  ┌────────────────┐  ┌─────────────────────────┐   │
        │  │ authenticate  │  │ requireRole(   │  │ multer (disk uploads)   │   │
        │  │ (JWT verify)  │  │   "admin")     │  │ products/blogs/csv      │   │
        │  └───────────────┘  └────────────────┘  └─────────────────────────┘   │
        │  Route groups: quotations, overview, clients/leads, assignment,       │
        │  followup, products, vendors, categories, users/admin, activitylog,   │
        │  dashboard, salesPerformance, blogs, visitors, email                  │
        └───────┬───────────────────────────────────┬──────────────┬───────────┘
                │                                    │              │
                ▼                                    ▼              ▼
       ┌─────────────────┐               ┌────────────────┐  ┌──────────────┐
       │ MongoDB Atlas   │               │ Resend (email) │  │ Local disk   │
       │ (Mongoose 8)    │               │ enquiry fwd    │  │ /uploads     │
       │ 13 live models  │               └────────────────┘  └──────────────┘
                ▲
                │  upsert every 5 min (node-cron)
       ┌────────┴───────────────────────────────────┐
       │  IndiaMART API   ·   TradeIndia API         │  (cron/*, scripts/*)
       │  Web-portal capture webhooks (x-api-key)    │  (routes/leads.js)
       └─────────────────────────────────────────────┘
```

## 1.3 Folder Structure

```
CRM/
├── CRM_Audit_Report.*           # pre-existing audit artifacts (pdf/docx/html/pptx)
├── backend/
│   ├── server.js                # entry: CORS, mongoose.connect, mounts all routes, loads crons
│   ├── connectDB.js             # exports connect/disconnect — UNUSED by server.js (server connects inline)
│   ├── seed.js / seed2.js       # destructive seeders (wipes Users; backfills product.dimension)
│   ├── IncreaseFields.js        # one-off migration (nulls billing/shipping addresses) — destructive
│   ├── deleteclients.js         # deletes ALL clients — destructive standalone script
│   ├── middleware/
│   │   ├── auth.js              # authenticate (JWT)
│   │   └── requireRole.js       # RBAC gate
│   ├── models/                  # 13 live + 2 DEAD (CoachingProduct, PrintkeeCategory)
│   ├── routes/
│   │   ├── main/                # emailRoutes, visitor, blogRoutes (public website)
│   │   ├── Products/            # product, Category, vendor, ProductOverview
│   │   ├── quotation, client, clientwork, leads, assignment-routes, followup,
│   │   │   dashboard, dashboardoverview, admin, login, activitylog,
│   │   │   salesPerformance, filterRoutes, upload
│   │   ├── fetch-client.js      # NOT MOUNTED (legacy, public)
│   │   ├── blogRoutes.js        # NOT MOUNTED (duplicate)
│   │   └── Todo-Performance.js  # NOT MOUNTED (static mock data)
│   ├── cron/                    # indiaMartCron, tradeIndiaCron (both */5 * * * *)
│   ├── scripts/                 # fetchLeadsFromIndiaMart, fetchTradeIndiaLeadsToCRM
│   └── uploads/                 # static-served upload root (products/, blogs/)
└── frontend/
    └── src/
        ├── App.jsx              # all routes
        ├── main.jsx            # BrowserRouter + axios auth interceptor + Redux Provider
        ├── redux/              # authSlice, store
        ├── utils/              # ProtectedRoute, logActivity, 3x quotation PDF generators
        ├── pages/crm/          # CRM screens (+ ProductManage/ subfolder)
        ├── pages/main/         # public website pages (Mainhome, Contact, Blogs)
        ├── components/crm/     # Sidebar, Navbar, Tables, Modals/, Product/, charts
        ├── components/main/    # marketing site sections
        └── landingpage/        # CRM landing (/crm)
```

## 1.4 Request Flow Diagram (authenticated CRM call)

```
User action (React)
   → axios request  ── interceptor (main.jsx) injects  Authorization: Bearer localStorage.token
   → Express CORS check (allowlist)
   → route matched in server.js
   → authenticate  (auth.js): verify JWT → load User(-password) → reject if !enabled
   → [requireRole("admin")]  (admin routes only)
   → [multer]  (upload routes only)
   → handler: Mongoose query/aggregate / insertMany / findByIdAndUpdate
   → res.json(...)
   → React updates state / table / toast
   → logActivity()  → POST /activity/log  (fire-and-forget audit trail)
```

## 1.5 Data Flow Diagram (Lead ingestion → conversion)

```
   IndiaMART API ─┐
   TradeIndia API ─┼─(cron */5)→ upsert ClientData (datatype=IndiaMart/TradeIndia, status="New Lead")
   Web webhooks ───┘   (leads.js, x-api-key)        │
   CSV upload (admin) ─→ validate+dedup → insertMany ┤
   Manual add (FormModal) ─→ POST /add-client ───────┘
                                       │
                                       ▼
                       ClientData (unassigned, assignedTo=[])
                                       │  admin POST /leads/assign
                                       ▼
                       ClientData.assignedTo[{user,permissions}]
                                       │  salesperson edits (EditLeadModal → save-all-updates)
                                       ▼
              callStatus / status / followUpDate(One/Two/Three) updated
                                       │  status="In Progress" (trending) ... "Won Lead"
                                       ▼
              Dashboards aggregate ClientData by status & assignedTo.user.name
```

## 1.6 User Flow Diagram

```
Visitor → /crm/login → POST /login → {token,user} → localStorage + Redux
   ├── role=admin → entrydashboard (all cards) → Lead/User/Product/Quotation management
   └── role=user  → entrydashboard (personal cards) → My Leads / Followups / Quotations
```

---

# PHASE 2 — BUSINESS MODULES

> Only modules proven by code. Marked **[ADMIN]** = admin-gated, **[SHARED]** = admin+user.

| # | Module | Purpose | Main Screens | Key APIs | Collections | Roles |
|---|---|---|---|---|---|---|
| 1 | **Lead Management** | Central record of all sales leads | LeadManagement, New/Assigned/Unassigned/Trending/Converted lead pages, My Leads | `/overview/*`, `/clients/filter`, `/clients/delete`, `/upload-csv` | ClientData | [SHARED]/[ADMIN] |
| 2 | **Lead Assignment** | Assign leads to salespeople w/ per-user view/update/delete perms | AssignModal, FetchReportModal | `/leads/assign`, `/leads/assign/single`, `/leads/remove-assignments`, `/leads/transfer-assignments` | ClientData, User | [ADMIN] |
| 3 | **Follow-up Management** | Track up to 3 follow-up dates + today/upcoming reminders | TodayFollowups, UpcomingFollowups | `/followup/reminder/:userId`, `/followup/update-status/:clientId`, `/overview/user-dashboard-stats` | ClientData | [SHARED] |
| 4 | **User Management** | Admin creates/enables/disables users, resets passwords, views activity | UserManagement, RegisterUser/ChangePassword/ActivityLog modals | `/users/all`, `/admin/register-user`, `/admin/toggle-user/:id/toggle`, `/admin/change-password/:userId`, `/activity/user` | User, ActivityLog, Counter | [ADMIN] |
| 5 | **Product Catalogue** | Maintain products w/ multi-tier pricing, GST, images | ProductPage, AddProduct/EditProduct/Category modals | `/products`, `/products/search`, `/add-product`, `/products/update`, `/products/delete/:id`, `/meta` | ProductData, Category | [ADMIN] |
| 6 | **Category Management** | Product categories (auto cat_id) | AddCategoryModal | `/categories/*` | Category | [ADMIN] |
| 7 | **Vendor Management** | Supplier records (auto v_code) | VendorPage, AddVendor/EditVendor modals | `/vendors`, `/add-vendor`, `/vendors/update`, `/vendors/delete/:id` | VendorData | [ADMIN] |
| 8 | **Quotation Management** | Create/list/delete quotations w/ line items, GST, discount, bank details, PDF | Quotations, CreateQuotation, QuotationEditPage | `/quotations/create`, `/quotations/data/count`, `/quotations/data/user/:userId`, `/quotations/fetch/:id`, `/quotations/delete/:id` | Quotation, User | [SHARED] |
| 9 | **Dashboard & Overview** | KPI cards + per-user stats | Dashboard / Overview | `/overview/counts`, `/overview/user-stats/:username`, `/overview/user-dashboard-stats/:username` | ClientData | [SHARED] |
| 10 | **Sales Performance** | Per-user leads/deals/closed % | SalesPerformance widget | `/sales-performance` | ClientData | [SHARED] |
| 11 | **Activity Log / Audit** | Records user actions | ActivityLogModal | `/activity/log`, `/activity/user` | ActivityLog | [SHARED]/[ADMIN] |
| 12 | **Reporting / CSV Export** | Download lead reports (date-filtered or selected) | DownloadModal, FetchReportModal | `/leads/report/download`, `/leads/report/download-by-leads`, `/clients/report/:userId/download-csv` | ClientData | [SHARED]/[ADMIN] |
| 13 | **CSV Import** | Bulk client import w/ validation+dedup | CsvUploadModal | `/upload-csv` | ClientData | [ADMIN] |
| 14 | **Public Website / Blog** | Marketing site, blog CMS, comments | Mainhome, BlogList/Detail/Form, Contact | `/blogs/*`, `/send-email`, `/visitors/count` | Blog, Comment, Visitor | Public |
| 15 | **Lead Integrations** | Auto-ingest from IndiaMART/TradeIndia/webhooks | (background) | cron jobs, `/coachinpromo/capture-lead`, `/printkee/capture-lead` | ClientData | system/API-key |

**Modules NOT present (despite generic CRM expectation):** Customer Management (separate from leads), Order Management, Inventory, Payments, fine-grained Roles & Permissions UI, Settings, Notifications (push/in-app), Tasks (model `Tasks.js` exists but **[DEAD]** — only used by unmounted `Todo-Performance.js`; the ToDoList UI is client-only/local).

---

# PHASE 3 — DATABASE ANALYSIS

## 3.1 Models (collection-by-collection, from `backend/models/`)

### ClientData → collection `clientdatas` (`ClientData.js`)
The central entity. `{ timestamps: true }`.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| name, company, email, countryCode, phone, contact, location, state, category | String | no | — | identity/segmentation |
| quantity | Number | no | — | |
| requirements, remarks, datatype | String | no | — | datatype ∈ IndiaMart/Offline/TradeIndia/JustDial/WebPortals/Other (enforced only in CSV import) |
| callStatus | String | no | `"Not Called"` | |
| status | String | no | `"New Lead"` | values seen: New Lead, In Progress, Won Lead |
| followUpDate, followUpDateOne/Two/Three, callingdate | Date | no | null | 3-slot follow-up rotation |
| inquiryDate | **String** | no | — | (stored as string, not Date) |
| address | String | no | — | |
| fileName | String | no | null | CSV import source |
| **assignedTo** | Array of `{ user:{_id ObjectId req, name String req}, permissions:{view,update,delete:Bool} }` | — | `[]` | embedded, multi-assignee |
| billingAddress, shippingAddress | addressSchema `{street,city,state,postalCode,country}` (subdoc, _id:false) | no | null | |
| additionalContacts | Array `{name,contact,details}` (_id:false) | — | — | |

**Indexes:** none declared (only the default `_id`). **No unique constraint on phone/contact** — uniqueness enforced only in application code (de-dup `$or:[phone,contact]`).

### User → `users` (`User.js`)
| Field | Type | Required | Default |
|---|---|---|---|
| name | String | no | — |
| userId | String | no | auto (pre-save: first-letter + 3-digit seq from Counter per role) |
| username | String | **yes** | — |
| email | String | **yes** | — |
| password | String | **yes** | bcrypt hash |
| location | String | no | — |
| role | String enum `["admin","user"]` | **yes** | — |
| enabled | Boolean | no | `true` |

No timestamps. **username not declared unique** (uniqueness relied on by login `findOne({username})`).

### Counter → `counters` (`Counter.js`)
`{ role: String unique req, seq: Number default 0 }` — sequence generator for `userId`.

### Quotation → `quotations` (`Quote.js`), `{timestamps:true}`
- `user` ObjectId→User **required**
- `party` PartySchema: `name`(req), company, phone, billToAddress, state, pan, `shippingAddresses[ {name,address,state} ]`, selectedShippingAddress
- `items[ ItemSchema ]`: `name`(req), description, hsn, `qty`(req), `price`(req), `discount`(def 0), `tax`(def 0)
- `terms`, `notes` String
- `bankDetails`: accountHolder, accountNumber, ifscCode, bankName, upiId
- `invoiceDetails`: prefix, number, date, validityDays, validityDate, poNo, placeOfSupply
- `summary`: discount, discountType ∈ `%`/`₹`, additionalCharges, applyTCS, autoRoundOff, roundOffSign ∈ `+`/`-`, roundOffAmount, amountReceived, paymentMethod(def "Cash")

### ProductData → `products` (`ProductData.js`), `{timestamps:true}`
- p_code (auto `MF###` pre-save), s_code, p_name, cat_id, p_image, p_description, p_type, p_color, HSN_code, GST_rate(Number), dimension(def "")
- `p_price` priceSchema (_id:false): `price_code`(unique, auto `RS###`), purchase_price, sales_5_50, sales_50_100, sales_100_above, GST_rate(min 0), basic_amount, net_amount

  → **Multi-tier pricing model**: purchase price + 3 quantity-band sales prices.

### Category → `categories` (`Category.js`)
`cat_id`(unique, auto `C<Letter>###`), `name`(required, unique).

### VendorData → `vendors` (`VendorData.js`)
`v_code`(unique, auto `V<Letter>###`), name, contact_name, phone, type, cat_id, `products`[String], addr1, addr2, city, state, pin_code, email.

### ClientPermission → `clientpermissions` (`ClientPermission.js`)
`{ userId→User req, clientId→ClientData req, permissions{view,update,delete} }`, **compound unique index `{userId,clientId}`**. *(Imported in several routes but the live assignment model is the embedded `ClientData.assignedTo`; ClientPermission is largely legacy/parallel — used in `clientwork.js` joins.)*

### ActivityLog → `activitylogs` (`UserActivity.js`)
`userId, name, role, action, timestamp(def now), details(Mixed)`.

### Visitor → `visitors` (`Visitor.js`)
`date`(String unique), count, `visitors[{ip,city,region,device,timestamp}]` — per-day analytics, device-deduped.

### Blog → `blogs` (`blog.js`)
`title`(req), `content`(req), media, author(def "Anonymous"), createdAt.

### Comment → `comments` (`comment.js`)
`blogId`→Blog(req), user(def "Guest"), `text`(req), createdAt.

### DEAD / NON-FUNCTIONAL models
- **Tasks.js** (`Task`): enum status done/pending/not_started — only referenced by unmounted `Todo-Performance.js`. **[DEAD]**
- **UserPerformance.js** (`Sales`): never imported anywhere. **[DEAD]**
- **CoachingProduct.js / PrintkeeCategory.js**: `require("../config/externalDbs")` and `require("../schemas/...")` — **these directories DO NOT EXIST** (verified). Importing either crashes. Never imported. **[DEAD / BROKEN]**

## 3.2 ER Diagram (relationships that exist in code)

```
        ┌──────────┐ 1        * ┌───────────────┐
        │  User    │────────────│  Quotation    │  (Quotation.user → User, required)
        │          │            └───────────────┘
        │ role     │
        └────┬─────┘
             │ embedded ref (assignedTo[].user._id + name, denormalized)
             │ 1..*
             ▼
        ┌──────────────┐ *      1 ┌───────────────┐
        │  ClientData  │──────────│ ClientPermission│ (parallel/legacy perm store)
        │ status       │          └───────────────┘
        │ assignedTo[] │
        └──────────────┘

   ┌──────────┐ cat_id(string, NOT enforced FK) ┌──────────────┐
   │ Category │◄───────────────────────────────│ ProductData  │
   │ cat_id   │◄───────────────────────────────│ VendorData   │
   └──────────┘                                 └──────────────┘
        (cat_id is a loose string key — no Mongoose ref/populate)

   ┌──────┐ 1   * ┌─────────┐      ┌─────────┐      ┌──────────────┐
   │ Blog │───────│ Comment │      │ Visitor │      │ ActivityLog  │  (no refs — userId is a string)
   └──────┘       └─────────┘      └─────────┘      └──────────────┘

   ┌─────────┐ provides seq for User.userId
   │ Counter │──────────────────────────────►
   └─────────┘
```

**Relationship map summary:**
- **Hard refs (ObjectId + populate):** `Quotation.user → User`; `ClientPermission.userId → User`, `.clientId → ClientData`; `Comment.blogId → Blog`.
- **Denormalized/embedded refs:** `ClientData.assignedTo[].user` stores `{_id, name}` copied from User (no live populate of name → stale-name risk).
- **Loose string keys (NOT enforced):** `ProductData.cat_id`, `VendorData.cat_id` → `Category.cat_id`; `ActivityLog.userId` → User.userId/string.

## 3.3 How data moves
Leads enter via 4 channels (manual, CSV, cron integrations, webhooks) → `ClientData` (unassigned) → admin assignment embeds `assignedTo` → salesperson mutates status/callStatus/followUps via `save-all-updates` → dashboards/reports aggregate `ClientData` by `status` and `assignedTo.user.name`. Quotations are an independent document tree keyed only to the creating `User` (not linked to a `ClientData` lead — **no lead↔quotation relationship in the schema**).

---

# PHASE 4 — AUTHENTICATION & RBAC

## 4.1 Roles
**Exactly two roles exist:** `admin` and `user` (enforced by `User.js` role enum). There is **no** Manager / Salesperson / Employee / Customer role in code — "salesperson" = `user`. There is **no customer-facing login** (customers are `ClientData`, not `User`).

## 4.2 Login flow (`routes/login.js POST /api/login` + `pages/crm/Login.jsx`)
```
Login.jsx  → fetch POST /login {username,password}
   → User.findOne({username})            (401 if none)
   → if !user.enabled → 403 "Account is disabled"
   → bcrypt.compare(password, hash)      (401 if mismatch)
   → jwt.sign({id, role}, JWT_SECRET, {expiresIn:"8h"})
   → return {token, user(safe, no password)}
Login.jsx  → localStorage.token = token; localStorage.user = JSON(user)
           → dispatch loginSuccess(user)  → navigate /crm/entrydashboard
```
- **No registration / self-signup.** Users are created only by admin (`POST /admin/register-user`) or `seed.js`.
- **No password reset email flow** — only admin `PUT /admin/change-password/:userId`.
- **Session = stateless JWT in localStorage** (no server session store, no refresh token, no logout invalidation server-side). Logout just clears localStorage + Redux.

## 4.3 JWT flow
- Payload: `{ id, role }`, expiry **8h** (`login.js`).
- Verified by `middleware/auth.js`: parses `Bearer`, `jwt.verify`, `User.findById(id).select("-password")`, rejects disabled users (403), attaches **full user doc** as `req.user`.
- Frontend: axios interceptor (`main.jsx`) attaches token to every axios call; native `fetch` calls set header manually.

**Better Auth:** **[NOT IN CODE]** — the prompt asked about "Better Auth flow"; this app uses hand-rolled JWT, not Better Auth.

## 4.4 Route protection
- **Backend:** `authenticate` then optionally `requireRole("admin")`. `requireRole` (`requireRole.js`) is variadic but **every call site passes only `"admin"`**.
- **Frontend:** `utils/ProtectedRoute.jsx` — client-side only: checks `state.auth.isLoggedIn` (→ `/crm/login`) and optional `role` prop against `user.role` (→ `/crm`). **No server validation of the role gate beyond each page's `GET /dashboard` token check.**

## 4.5 Middleware chain
```
admin route:  CORS → authenticate → requireRole("admin") → [multer] → handler
user route:   CORS → authenticate → handler
webhook:      CORS → x-api-key check (inline) → handler
public:       CORS → handler   (login, send-email, blogs, visitors, fetch-client)
```

## 4.6 Permission Matrix (verified per route, all admin-gates = `requireRole("admin")`)

| Capability | admin | user (salesperson) | public/API-key |
|---|:--:|:--:|:--:|
| Login | ✅ | ✅ | — |
| View own dashboard / My Leads / My Followups | ✅ | ✅ | — |
| View ALL leads / assigned / unassigned / new / trending / converted | ✅ | ❌ | — |
| Filter all/unassigned leads | ✅ | ❌ | — |
| Filter own assigned leads | ✅ | ✅ (own name only) | — |
| Assign / transfer / remove assignments | ✅ | ❌ | — |
| Create/edit/delete client, save-all-updates | ✅ | ✅ ⚠️(see rules) | — |
| Delete clients (bulk) | ✅ | ❌ | — |
| CSV import | ✅ | ❌ | — |
| CSV export (download report) | ✅ | ✅ (by-leads) | — |
| Product/Category/Vendor CRUD | ✅ | ❌ | — |
| Quotation create / fetch / list-own | ✅ | ✅ | — |
| Quotation delete / data/count(all) | ✅ | ❌ | — |
| User mgmt (register/toggle/change-pw/activity) | ✅ | ❌ | — |
| Lead capture webhook | — | — | ✅ x-api-key |
| Send enquiry email / blogs / visitor count | — | — | ✅ public |

⚠️ **Authorization gaps (verified):** several mutating/reading endpoints require only `authenticate` with **no ownership/role check**: `POST /save-all-updates` (mass edit, no admin gate), `PUT /clients/:id`, `PUT /followup/update-status/:clientId`, `GET /followup/reminder/:userId`, `GET /quotations/data/user/:userId`, `GET /quotations/fetch/:id`, `GET /overview/user-stats/:username`. Any logged-in user can act on others' data via these.

⚠️ **Likely-broken guards:** `routes/dashboardoverview.js` and `routes/Products/Category.js` apply `requireRole("admin")` but rely on a router-level `router.use(authenticate)` (present in both files) to set `req.user` — verified they DO call `router.use(authenticate)` first, so these work. (The risk exists only where `authenticate` is omitted — none found in the final mounting.)

---

# PHASE 5 — FEATURE INVENTORY

| Feature | Location | Workflow | APIs | Models | Components |
|---|---|---|---|---|---|
| Manual lead creation | `Modals/FormModal.jsx` | dup-check phone+contact → add | `/check-duplicate-phone`, `/check-duplicate-contact`, `/clients/meta`, `/users`, `/add-client` | ClientData | FormModal, LeadTable |
| CSV bulk import | `Modals/CsvUploadModal.jsx`, `routes/upload.js` | header validate → row validate → dedup(DB+in-file) → insertMany | `/upload-csv` | ClientData | CsvUploadModal |
| Lead assignment (bulk/single) | `Modals/AssignModal.jsx`, `assignment-routes.js` | select leads+users+perms → merge assignees | `/leads/assign`, `/leads/assign/single` | ClientData, User | AssignModal |
| Lead transfer | `AssignedLeadsTable`, `FetchReportModal` | pick newUserName → overwrite all assignees | `/leads/transfer-assignments` | ClientData, User | FetchReportModal |
| Remove assignment | `AssignedLeadsTable` | set assignedTo=[] | `/leads/remove-assignments` | ClientData | — |
| Lead edit / status / followup | `Modals/EditLeadModal.jsx` | edit fields, callStatus rules, followup rotation | `/save-all-updates`, `/leads/assign/single`, `/users` | ClientData | EditLeadModal, AdditionalContactsModal |
| Bulk field update | `Modals/BulkUpdateModal.jsx` | set category/location on filtered set | `/save-all-updates` | ClientData | BulkUpdateModal |
| Lead filtering | `Modals/FilterModal`, `UserFilterModal` | chip filters → query | `/clients/filter`, `/clients/unassigned/filter`, `/clients/assigned/:name/filter`, `/clients/meta` | ClientData | ChipSelect |
| Follow-up reminders | `TodayFollowupsTable`, `UpcomingFollowupsTable` | today / upcoming buckets | `/overview/user-dashboard-stats/:name`, `/followup/reminder/:userId` | ClientData | followup tables |
| Lead conversion tracking | status="Won Lead" | aggregated in overview | `/overview/converted-clients`, `/overview/counts` | ClientData | ConvertedLeadsTable |
| Trending leads | status="In Progress" | aggregated | `/overview/trending-leads`, `/overview/user-dashboard-stats` | ClientData | TrendingLeadsTable, MyTrendingLeads |
| CSV report export | `Modals/DownloadModal`, `clientwork.js` | date/type or selected-leads → blob csv | `/leads/report/download`, `/leads/report/download-by-leads`, `/clients/report/:userId/download-csv` | ClientData | DownloadModal |
| Product create/edit/delete | `Product/AddProductModal`, `EditProductModal`, `product.js` | image upload + JSON price | `/add-product`, `/products/update`, `/products/delete/:id`, `/products/meta` | ProductData, Category | ProductsTable |
| Product search | `Modals/SearchProductModal` | regex across fields | `/products/search?query=` | ProductData | SearchProductModal |
| Category CRUD | `Product/AddCategoryModal` | add/update w/ dup guard | `/categories/*` | Category | — |
| Vendor CRUD | `Product/AddVendorModal`, `EditVendorModal` | add/update/delete | `/add-vendor`, `/vendors/update`, `/vendors/delete/:id`, `/vendors` | VendorData | VendorsTable |
| Quotation create | `Product/QuotationCreate.jsx` | build party+items+summary → compute totals → POST | `/quotations/create` | Quotation | QuotationCreate, AddItemModal, AddClientModal, ShipToModal |
| Quotation edit | `Product/QuotationEdit.jsx` | load by id → **re-POST create** (no update endpoint) | `/quotations/fetch/:id`, `/quotations/create` | Quotation | — |
| Quotation list/delete | `Product/QuotationTable.jsx` | admin=all, user=own | `/quotations/data/count`, `/quotations/data/user/:userId`, `/quotations/delete/:id` | Quotation | QuotationTable |
| Quotation PDF | `utils/generateQuotationPDF.jsx` (+2 legacy) | html2pdf render | (client only) | — | — |
| User register/toggle/change-pw | `Modals/RegisterUserModal`, `ChangePasswordModal` | admin manage users | `/admin/register-user`, `/admin/toggle-user/:id/toggle`, `/admin/change-password/:userId` | User, Counter | UserTable |
| Activity log view | `Modals/ActivityLogModal` | search by name/userId | `/activity/user`, `/activity/log` | ActivityLog | ActivityLogModal |
| Dashboard KPIs | `components/crm/Overview.jsx` | counts + per-user stats | `/overview/counts`, `/overview/user-stats/:name` | ClientData | Overview, animated cards |
| Sales performance | `components/crm/SalesPerformance.jsx` | aggregate deals/leads | `/sales-performance` | ClientData | SalesPerformance |
| Public enquiry email | `pages/main/Contact.jsx` | form → Resend forward | `/send-email` | — | ContactUs |
| Blog CMS | `pages/main/BlogList/BlogForm/BlogDetail` | post/list/comment | `/blogs/*` | Blog, Comment | CommentSection |
| Visitor analytics | `routes/main/visitor.js` | per-day device-deduped count | `/visitors/count` | Visitor | — |
| Lead webhooks | `routes/leads.js` | x-api-key → insert lead | `/coachinpromo/capture-lead`, `/printkee/capture-lead` | ClientData | — |
| Integration crons | `cron/*`, `scripts/*` | every 5 min upsert | (external APIs) | ClientData | — |

### Partial / Incomplete features (flagged)
- **[PARTIAL] Quotation editing** — `QuotationEdit` POSTs to `/quotations/create`, creating a NEW record each edit; there is no update endpoint. `EditQuotation.jsx` and `QuotationModal.jsx` are empty/commented dead files.
- **[STATIC/MOCK] Dashboard charts** — `ChartOverview`, `SalesOverviewChart`, `OrderStatistics`, `TopSellingCategories`, and SalesPerformance period filter render hardcoded data (SalesPerformance calls the API but ignores the selected period).
- **[PARTIAL] ClientPermission model** vs embedded `assignedTo` — two parallel permission stores; embedded is authoritative.
- **[DEAD] Tasks/ToDoList** — ToDoList UI is client-only local state; Task model unused.
- **[DEAD] Routes** — `Todo-Performance.js`, root `blogRoutes.js`, `fetch-client.js` not mounted.

---

# PHASE 6 — WORKFLOW MAPPING

### Lead Lifecycle
```
Lead enters (manual / CSV / IndiaMART / TradeIndia / webhook)
        │  status="New Lead", callStatus="Not Called", assignedTo=[]
        ▼
Unassigned pool  ──(admin: POST /leads/assign)──►  Assigned (assignedTo[{user,perms}])
        ▼
Salesperson works lead (EditLeadModal → save-all-updates)
   callStatus: Not Called → Ring (sets inquiryDate=today) / Follow-up Required (sets followUpDate=+2d)
   followUpDate rotation: One → Two → Three → overwrite oldest
        ▼
status transitions (set verbatim, NO state machine):
   "New Lead" ──► "In Progress" (trending) ──► "Won Lead" (converted)
        ▼
Reporting / dashboards aggregate by status + assignedTo.user.name
```
**Note:** status is set verbatim anywhere; there is **no enforced state machine** — any value can be written. "Lost" status is **[NOT IN CODE]** (only New Lead / In Progress / Won Lead are produced).

### Quotation Lifecycle
```
Create (party + items) → compute per-item amount/discount%/tax%/total
   → summary discount(%/₹) + additionalCharges ± roundOff − amountReceived
   → POST /quotations/create (stored verbatim — NO server recompute)
   → list (admin: all / user: own) → PDF (html2pdf) → delete (admin)
   Edit = create new record (no update path)
```

### User Lifecycle
```
Admin POST /admin/register-user → bcrypt hash → Counter assigns userId
   → enabled=true → user logs in
   → admin toggle-user flips enabled (disabled users blocked at login + authenticate)
   → admin change-password resets hash
```

### Follow-up Lifecycle
```
callStatus="Follow-up Required" → followUpDate=+2 days (EditLeadModal rule)
   → 3-slot rotation (One/Two/Three) on save-all-updates
   → today bucket  → TodayFollowups / /followup/reminder
   → future bucket → UpcomingFollowups
```

### Customer / Order / Payment Lifecycle — **[NOT IN CODE]**
No separate Customer entity, no Order model, no Payment processing. (Quotation `summary.amountReceived`/`paymentMethod` are recorded fields only — no transaction processing.)

---

# PHASE 7 — FRONTEND ANALYSIS

## 7.1 Route table (`App.jsx`)
Public: `/`, `/contact`, `/blogs`, `/blogs/new`, `/blogs/:id`, `/crm` (landing), `/crm/login`.
Protected (role in brackets): `/crm/entrydashboard`[user,admin], `/crm/lead-management`[user,admin], `/crm/unassigned-leads`[admin], `/crm/new-leads`[admin], `/crm/user-management`[admin], `/crm/assigned-leads`[admin], `/crm/trending-leads`[admin], `/crm/my-trending-leads`[admin,user], `/crm/my-leads`[admin,user], `/crm/conversions`[user,admin], `/crm/today-followups`[user,admin], `/crm/upcoming-followups`[user,admin], `/crm/won-leads`[admin], `/crm/product-dashboard`[admin], `/crm/product-management`[admin], `/crm/vendor-management`[admin], `/crm/quotations`[user,admin], `/crm/quotations/create`[user,admin], `/crm/quotations/edit/:id`[user,admin].

## 7.2 Navigation
- **Sidebar** (`Sidebar.jsx`): Lead Management dashboard (all), Product Management (admin only), User Management (admin), Quotations (all). Reads `user` from localStorage.
- **Overview cards** (`Overview.jsx`) are the real navigation hub — cards filtered by `card.role === user.role`; admin sees Total/Conversion/Assigned/Unassigned/New/Trending; user sees My Leads/Conversions/Today+Upcoming Followups/My Trending. Many routes are reachable only via these cards.
- **Navbar**: profile dropdown, "Manage Users" (admin), Logout (clears session + logs activity).

## 7.3 Page wrappers
Every CRM page renders `Sidebar + Navbar + <one table/widget>` and independently fires `GET /dashboard` with the Bearer token on mount as a server token check (redirects to login on failure).

## 7.4 State management (Redux — `redux/`)
```
store = { auth: { isLoggedIn: !!localStorage.user, user: parsed localStorage.user | null } }
```
Single `auth` slice. **Token lives only in `localStorage.token`** (not Redux); user duplicated in Redux + localStorage. `loginSuccess(user)` writes user; `logout()` clears both. (Quirk: token is written by `Login.jsx`, not by the slice.)

## 7.5 Reusable components
Tables (LeadTable + 9 variants — all 5/page client pagination, View/Edit/Delete/Download row actions), Modals (`Modals/`: Form, Edit, Assign, Filter, UserFilter, BulkUpdate, Download, FetchReport, SearchProduct, Csv, Confirm, Lead, AdditionalContacts, ChipSelect, Register/ChangePassword/ActivityLog), Product modals (Add/Edit Product, Category, Vendor, AddItem, AddClient, ShipTo). Charts via recharts/chart.js/apexcharts (several static).

## 7.6 HTTP clients
Mixed: axios (with global auth interceptor) + native `fetch` (manual headers on Login, page auth-checks, some modals).

---

# PHASE 8 — API CATALOG

> Base path `/api`. Auth column: **JWT** = `authenticate`; **ADMIN** = `authenticate + requireRole("admin")`; **KEY** = `x-api-key`; **PUB** = none. Full per-route detail (request/response/business logic) is captured in §11 rules and §5 features; the catalog is grouped by file.

### quotation.js (`/api/quotations`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /create | JWT | create quote for req.user._id (validates party + non-empty items; stored verbatim) |
| GET | /data/count | ADMIN | all quotes + count, populate user name/username |
| GET | /data/user/:userId | JWT⚠ | quotes by user (no ownership check) |
| DELETE | /delete/:id | ADMIN | delete quote |
| GET | /fetch/:id | JWT⚠ | single quote (no ownership check) |

### login.js (`/api`)
| GET | /users | JWT | active role=user (assignment dropdown) |
| GET | /users/all | ADMIN | all users |
| POST | /login | PUB | issue JWT 8h |
| PUT | /admin/change-password/:userId | ADMIN | reset password |

### admin.js (`/api`)
| GET | /activity/user | ADMIN | search activity by name/userId |
| PATCH | /admin/toggle-user/:id/toggle | ADMIN | flip enabled (⚠ returns hash, no 404 guard) |
| POST | /admin/register-user | ADMIN | create user (⚠ returns hash) |

### activitylog.js (`/api`)
| POST | /activity/log | JWT (admin or self) | record action |

### dashboard.js / dashboardoverview.js
| GET | /dashboard | JWT | own profile |
| GET | /overview/counts | JWT | 6 KPI counts |
| GET | /overview/user-stats/:username | JWT⚠ | per-user counts + conversionRate% |
| GET | /overview/user-dashboard-stats/:username | JWT (admin or self) | personal lead buckets |
| GET | /overview/all-clients | ADMIN | all |
| GET | /overview/converted-clients | ADMIN | status Won Lead |
| GET | /overview/trending-leads | ADMIN | status In Progress |
| GET | /overview/assigned-clients | ADMIN | assignedTo.0 exists |
| GET | /overview/unassigned-clients | ADMIN | unassigned |
| GET | /overview/new-clients | ADMIN | last 24h |

### salesPerformance.js
| GET | /sales-performance | JWT | aggregate deals/leads/closed% per user (change hardcoded "neutral") |

### client.js (`/api`)
| POST | /add-client | JWT | create (dup phone/contact → 400) |
| GET | /check-duplicate-phone | JWT | dup check |
| GET | /check-duplicate-contact | JWT | dup check |
| POST | /clients/delete | ADMIN | bulk delete by ids |
| POST | /save-all-updates | JWT⚠ | batch update (followup rotation, assignedTo rebuild, billing synth) — **no admin gate** |

### clientwork.js (`/api`)
| GET | /clients/assigned/:userId | JWT (own/admin) | assigned via ClientPermission join |
| GET | /clients/assigned/:userId/filtered | JWT (own/admin) | + in-memory filters |
| PUT | /clients/:id | JWT⚠ | update subset fields |
| GET | /clients/report/:userId/download-csv | JWT (own/admin) | CSV by followUpDate range |
| POST | /leads/report/download | ADMIN | CSV (followUpDate/createdAt date filter) |
| POST | /leads/report/download-by-leads | JWT | CSV of selected leads |

### assignment-routes.js (`/api`)
| POST | /leads/assign | ADMIN | bulk assign (merge) |
| POST | /leads/assign/single | ADMIN | single assign |
| POST | /leads/remove-assignments | ADMIN | clear assignees |
| POST | /leads/transfer-assignments | ADMIN | overwrite to one user (perms view/update:true, delete:false) |
| GET | /clients/meta | ADMIN | distinct facets |
| GET | /clients/assigned/:username/meta | JWT (own/admin) | distinct over assigned |
| GET | /clients/unassigned/meta | ADMIN | distinct unassigned |

### followup.js (`/api`)
| GET | /followup/reminder/:userId | JWT⚠ | today's follow-ups |
| PUT | /followup/update-status/:clientId | JWT⚠ | set status verbatim |

### filterRoutes.js (`/api`)
| POST | /clients/filter | ADMIN | multi-field filter all |
| POST | /clients/assigned/:userName/filter | JWT (own/admin) | filter own assigned |
| POST | /clients/unassigned/filter | ADMIN | filter unassigned |

### upload.js (`/api`)
| POST | /upload-csv | ADMIN + multer(file) | bulk import w/ validation+dedup |

### leads.js (`/api`)
| POST | /coachinpromo/capture-lead | KEY | webhook lead (datatype WebPortals) |
| POST | /printkee/capture-lead | KEY | webhook lead (reuses same key) |

### Products/product.js (`/api`)
| POST | /add-product | ADMIN + multer(p_image) | create (p_price JSON.parsed) |
| GET | /meta | JWT | category dropdown |
| GET | /products | JWT | all products |
| GET | /products/search | JWT | regex search |
| POST | /products/update | ADMIN + multer | update (preserves price_code, unlinks old image) |
| DELETE | /products/delete/:id | ADMIN | delete + unlink image |

### Products/Category.js (`/api/categories`) — router.use(authenticate)
| POST /add | ADMIN | GET / | JWT | GET /:id | JWT | PUT /update/:id | ADMIN | DELETE /delete/:id | ADMIN |

### Products/vendor.js (`/api`)
| POST /add-vendor | ADMIN | GET /vendors | JWT | DELETE /vendors/delete/:id | ADMIN | POST /vendors/update | ADMIN |

### Products/ProductOverview.js (`/api/products`) — router.use(authenticate)
| GET /meta | JWT | duplicate category dropdown |

### main/emailRoutes.js (`/api`)
| POST | /send-email | PUB | Resend enquiry → sales@mfglobalservices.com |

### main/visitor.js (`/api/visitors`)
| GET | /count | PUB | per-day device-deduped visitor count + geo |

### main/blogRoutes.js (`/api/blogs`) — no auth
| GET / | GET /:id | POST /post-blogs (multer media) | GET /comments/:blogId | POST /comments | all PUB |

**Common errors returned:** 400 (validation/duplicate), 401 (no/invalid token / bad credentials), 403 (disabled account / access denied / bad api-key / CORS), 404 (not found), 500 (server / JWT not configured / malformed JSON.parse).

---

# PHASE 9 — DASHBOARD & REPORTING

| Metric | Endpoint / file | Calculation (traced) |
|---|---|---|
| Total Clients | `/overview/counts` | `countDocuments({})` |
| New Clients | `/overview/counts` | `createdAt >= startOfToday` |
| Assigned | `/overview/counts` | `assignedTo.0 exists` |
| Unassigned | `/overview/counts` | `$or` of assignedTo empty/missing |
| Converted | `/overview/counts` | `status="Won Lead"` |
| Trending | `/overview/counts` | `status="In Progress"` |
| Conversion Rate (per user) | `/overview/user-stats/:username` | `(conversions/leads)*100`, 2 dp, returned as `%` string |
| My Leads / Conversions / Trending / Today's & Upcoming Followups | `/overview/user-dashboard-stats/:username` | filter `assignedTo.user.name == username`, bucket by status + followUpDate today/future |
| Sales Performance (deals/leads/closed%) | `/sales-performance` | aggregate `$unwind assignedTo` → group by user → `deals=$cond(status="Won Lead")`, `closedPercentage=(deals/leads)*100`; `change` hardcoded `"neutral"` |
| Visitor count | `/visitors/count` | sum of per-day `count`, device-deduped |

**[STATIC/MOCK]:** ChartOverview, SalesOverviewChart, OrderStatistics, TopSellingCategories render hardcoded arrays; the SalesPerformance period selector is not sent to the API. These are **not real analytics**.

---

# PHASE 10 — USER JOURNEYS

**Admin Journey:** Login → entrydashboard (full KPI cards) → manage leads (view all / assign / transfer / import CSV / filter / delete) → manage users (create/disable/reset-pw/audit) → manage products/categories/vendors → create/list/delete quotations → export reports. Entry `/crm/login`; outcome: full operational control.

**Salesperson (user) Journey:** Login → entrydashboard (personal cards) → My Leads → open lead (EditLeadModal) → set callStatus/status/followUp → Today/Upcoming Followups → mark Won → create quotation → download own report. Cannot view all leads, assign, or manage users/products.

**Manager Journey:** **[NOT IN CODE]** — no manager role; managerial oversight = admin.

**Customer Journey:** **[NOT IN CODE]** — no customer login. Public visitors: browse marketing site/blogs, submit enquiry (`/send-email`) which lands as nothing in CRM directly (email only) OR via web-portal webhooks becomes a `ClientData` lead.

---

# PHASE 11 — BUSINESS RULES (extracted, with location)

| Rule | Location | Impact |
|---|---|---|
| Duplicate lead blocked by phone OR contact | `client.js add-client`, `upload.js`, scripts | prevents duplicate leads |
| CSV phone must match `^[6-9][0-9]{9}$` | `upload.js` | rejects invalid Indian mobiles |
| CSV field max-lengths (category/location/state ≤15, company ≤50) & datatype enum | `upload.js` | data hygiene |
| CSV in-file + DB dedup with skip reasons | `upload.js` | reports skipped rows |
| callStatus "Ring" → inquiryDate = today | `EditLeadModal.jsx` | auto-stamps contact date |
| callStatus "Follow-up Required" → followUpDate = +2 days | `EditLeadModal.jsx` | default follow-up SLA = 2 days |
| Follow-up 3-slot rotation (One→Two→Three→overwrite oldest) | `client.js save-all-updates` | keeps last 3 follow-ups |
| Billing address synthesized from fields | `client.js save-all-updates` | auto-fills billing |
| Only admin may assign/transfer/remove | `assignment-routes.js` | assignment authority |
| Assign = merge with existing assignees (Map by user._id) | `assignment-routes.js` | preserves multi-assignment |
| Transfer = overwrite to single user, perms {view:T,update:T,delete:F} | `assignment-routes.js` | hardcoded transfer perms |
| Status buckets: New Lead / In Progress(trending) / Won Lead(converted) | `dashboardoverview.js` | drives all dashboards |
| No status state machine — any value writable | `followup.js update-status`, `save-all-updates` | integrity risk |
| Quotation per-item: amount=qty*price; discount & tax are **percent**; total=taxable+tax | `QuotationCreate.jsx` | pricing engine (client-side) |
| Quotation summary: discount %/₹, additionalCharges, optional roundOff, balance=final−received | `QuotationCreate.jsx` + `Quote.js` summary | quote totals |
| Server stores quotation verbatim (no recompute) | `quotation.js create` | trusts client math |
| Product code auto `MF###`; price_code `RS###`; preserved on update | `ProductData.js`, `product.js` | stable SKU/price IDs |
| Product multi-tier pricing (purchase + 3 qty bands) + GST | `ProductData.js` priceSchema | pricing catalogue |
| Category/Vendor auto-codes `C<L>###` / `V<L>###` | `Category.js`, `VendorData.js` | master-data IDs |
| userId auto `<NameInitial><3-digit seq>` per role via Counter | `User.js` | user numbering |
| Disabled user blocked at login AND on every request | `login.js`, `auth.js` | account suspension |
| JWT expiry 8h, payload {id,role} | `login.js` | session length |
| Webhook auth via shared `COACHINGPROMO_API_KEY` (printkee reuses it) | `leads.js` | weak key separation |
| Visitor deduped by device per day | `visitor.js` | analytics accuracy |
| **No discount/tax/pricing computed server-side anywhere** | (absence) | client fully trusted for money math |

---

# PHASE 12 — DEPENDENCY MAP

**Backend (why each):** express(server), mongoose(ODM), jsonwebtoken(JWT auth), bcrypt(password hash), multer(file uploads), node-cron(integration scheduling), resend(enquiry email), json2csv(report export), csv-parser(CSV import), moment-timezone(TradeIndia IST dates), slugify(installed, **unused in routes seen**), cors, dotenv, axios(call IndiaMART/TradeIndia/geo-IP). `react-chartjs-2`/`recharts` listed in backend package.json are **misplaced** (frontend libs, unused server-side).

**Frontend (why each):** react/react-dom 19, react-router-dom v7(routing), @reduxjs/toolkit + react-redux(auth state), axios(API w/ interceptor), chart.js/react-chartjs-2/recharts/react-apexcharts(charts — multiple overlapping), jspdf/jspdf-autotable/html2pdf.js(3 quotation PDF paths), lucide-react/react-icons(icons), react-modal(modals), react-toastify(notifications), swiper(carousels on marketing site).

**Database:** MongoDB Atlas (cloud), single connection string in `MONGO_URI`.

**Third-party services:** IndiaMART CRM API, TradeIndia inquiry API, Resend (email), ip-api.com (geolocation). No payment/SMS/storage SaaS.

---

# PHASE 13 — EXECUTIVE MASTER SUMMARY

### 1. System Overview
A MERN CRM for **MF Global Services**, combining a public marketing website (blogs, enquiry form, visitor analytics) with an internal sales-lead CRM. Leads flow in from IndiaMART, TradeIndia, web-portal webhooks, CSV import, and manual entry into a single `ClientData` collection; admins assign them to salespeople, who progress them through New Lead → In Progress → Won Lead, schedule follow-ups, and generate quotations with multi-tier-priced products. Two roles only: **admin** and **user**.

### 2. Modules Overview
15 functional modules (Phase 2): Lead Mgmt, Assignment, Follow-ups, User Mgmt, Product Catalogue, Categories, Vendors, Quotations, Dashboard, Sales Performance, Activity Log, Reporting/CSV export, CSV import, Public Website/Blog, Integrations.

### 3. Feature Matrix — see Phase 5 (≈30 features; 5 partial/static, several dead).

### 4. Workflow Matrix — Lead, Quotation, User, Follow-up lifecycles implemented; Customer/Order/Payment lifecycles absent (Phase 6).

### 5. Database Relationships — 13 live collections; hard refs only on Quotation→User, ClientPermission→User/ClientData, Comment→Blog; everything else denormalized or loose string keys (Phase 3).

### 6. User Roles — admin (full), user/salesperson (own data + quotations). No manager/customer (Phase 4).

### 7. API Catalog — ~60 endpoints across 24 route files; 3 route files unmounted (Phase 8).

### 8. Business Rules — see Phase 11.

### 9. Architecture Summary — React SPA ↔ Express 5 monolith ↔ MongoDB Atlas; stateless JWT in localStorage; cron-driven ingestion; Resend email; local-disk uploads (Phase 1).

### 10. Missing Documentation / Gaps Found
- No README of substance (`README.md` is a stub), no `.env.example`, no API docs, no test suite, no CI/Docker.
- `connectDB.js` exists but unused (server connects inline).
- Two non-existent dirs referenced (`config/externalDbs`, `schemas/`) by dead models.

### 11. Technical Debt Found
- **3 unmounted/dead route files** (`Todo-Performance.js`, root `blogRoutes.js`, `fetch-client.js`) and **4 dead models** (Tasks, Sales/UserPerformance, CoachingProduct, PrintkeeCategory — last two crash on import).
- **3 competing quotation PDF generators** with inconsistent tax/discount math; `QuotationTable` grand-total formula diverges from the create-form math (listed totals can mismatch saved totals).
- **Quotation "edit" creates a new record** — no update endpoint; orphaned drafts accumulate.
- **Parallel permission stores** (embedded `assignedTo` vs `ClientPermission`).
- **Static/mock charts** masquerading as analytics.
- Mixed HTTP clients (axios + fetch); duplicate `/meta` endpoints; misplaced frontend deps in backend `package.json`.
- TradeIndia script opens a new Mongo connection every 5 min without closing.

### 12. Scalability Concerns
- **No pagination on any list endpoint** — every leads/products/quotations list returns the full collection; will not scale past low-thousands of records.
- **No DB indexes** beyond `_id`/unique-code fields — filters/aggregations do collection scans; `ClientData` has no index on `status`, `assignedTo.user.name`, `phone`, `contact`, `followUpDate` despite being queried on all of them.
- Single Express instance, single Mongo connection, no caching/queue; cron + request load share one process.
- Client-side 5/page pagination over fully-downloaded datasets (heavy payloads).
- Denormalized `assignedTo.user.name` → renames go stale across all leads.

### 13. Security Concerns
- **Live secrets in `backend/.env`** on disk (Mongo creds incl. embedded `sana38790:sana38790`, JWT secret, IndiaMART/TradeIndia/Resend keys) — gitignored but present in working tree.
- **Authorization gaps:** `save-all-updates` (mass edit) and several read/write endpoints require only `authenticate`, no ownership/role check — any user can read/modify others' data (Phase 4.6 ⚠).
- **Endpoints return password hashes** (`register-user`, `toggle-user`).
- **Public, unauthenticated** write endpoints: all blog routes (anyone can post blogs/comments), `send-email`, visitor count, `fetch-client` filter (if ever mounted).
- **Webhook key reuse** — printkee reuses `COACHINGPROMO_API_KEY`.
- **Client-side-only role gating** + non-httpOnly localStorage JWT (XSS-exposed); no refresh/rotation, no server-side logout.
- `JSON.parse(p_price)` unguarded → 500 on malformed input; `toggle-user` lacks not-found guard.
- Quotation money math fully client-trusted (no server recompute) — tamperable totals.

### 14. Improvement Opportunities
1. Add pagination + indexes on `ClientData` (status, assignedTo.user.name, phone, contact, followUpDate).
2. Enforce ownership/role on `save-all-updates`, `/clients/:id`, `followup/*`, `quotations/*`.
3. Strip passwords from all user responses; add not-found guards.
4. Auth the blog/CMS write routes; rotate the on-disk secrets; move JWT to httpOnly cookie + refresh tokens.
5. Add a real quotation update endpoint and consolidate to one PDF generator + one totals formula; recompute totals server-side.
6. Implement a real status state machine (incl. a "Lost" terminal state) and replace static charts with real aggregations.
7. Delete dead code (3 routes, 4 models, EditQuotation/QuotationModal); fix or remove the external-DB models.
8. Add `.env.example`, README, tests, and CI; deduplicate `/meta` and the chart libraries; close TradeIndia's per-run Mongo connection.

---

*End of master document. Every module, model, route, and rule above is traced to a specific file in `c:\Users\Admin\Desktop\Sana\CRM`. Items absent from the codebase are explicitly marked [NOT IN CODE]; non-functional code is marked [DEAD]/[BROKEN]; incomplete features [PARTIAL]; mock UI [STATIC/MOCK].*
