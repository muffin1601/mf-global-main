# MongoDB to PostgreSQL mapping

| Mongo model/collection | PostgreSQL model(s) | Mapping notes |
|---|---|---|
| User | User | Supabase `auth.users.id` is linked by `authUserId`; legacy password hashes are never copied into public tables. |
| ClientData | Lead, LeadAssignment | Embedded assignees become join rows; original creator is retained; address/contact snapshots remain JSON to avoid data loss. |
| ClientPermission | LeadPermission | Unique user/lead permission tuple. |
| ImportHistory | LeadImportJob, LeadImportRow | Report array becomes child rows; retry key supports idempotency. |
| Category | Category | `cat_id` retained as unique code. |
| ProductData | Product, ProductPrice | Price object is one-to-one; images move to private/public storage by classification. |
| Quote | Quotation, QuotationItem | Items normalized; party, bank, and invoice snapshots remain JSON because they are immutable document snapshots. |
| VendorData | Vendor, VendorContact, VendorAddress | Embedded contacts/addresses normalized; bank/custom data retained as JSON with permission-gated reads. |
| VendorCategory | VendorCategory | Unique names retained. |
| VendorProduct | VendorProduct, VendorPriceTier | Many-to-many supply relation with effective pricing windows. |
| VendorActivity | VendorActivity | Actor relation retained. |
| VendorDocument | VendorDocument | Binary files migrate to Supabase Storage; only protected paths are stored. |
| VendorEvaluation | VendorEvaluation | Stored overall score is reconciled against the six-criterion mean. |
| VendorImportJob | VendorImportJob, VendorImportRow | Embedded reports normalized and retry key added. |
| blog/comment | BlogPost, BlogComment | Stable slug is added; legacy ID remains unique for redirects. |
| CareerJob/Application | CareerJob, CareerApplication | Resume Buffer migrates to private storage. |
| CareerSession/LoginAttempt/Settings | Not migrated | Replaced by Supabase Auth and standard admin authorization; legacy PIN secrets are intentionally not retained. |
| Visitor | VisitorDay, VisitorEvent | IP is irreversibly hashed before insertion. |
| UserActivity | ActivityLog | Mixed details retained as JSON. |
| Tasks/UserPerformance | Pending schema refinement | Exact active UI usage and field semantics must be finalized before migration. |
| Counter | Not required | PostgreSQL sequences/transactions replace application counters. |
| External Printkee/CoachingPromo models | Integration boundary | External source data is not bulk-copied without separate owner approval. |

Every migrated row records its legacy ID. `MigrationCheckpoint` stores source hashes and outcomes. Orphans and duplicates go to reconciliation reports; they are not silently dropped.
