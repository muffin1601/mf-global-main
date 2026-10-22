# Inventory & Product Audit Report

Audit date: 2026-10-22. Findings below are based on inspected source, isolated automated tests, a production build, and a read-only query of the configured MongoDB database.

## Architecture map

| Area | Verified implementation |
|---|---|
| Frontend | React 19/Vite SPA. Product management is implemented by `ProductsTable`, `AddProductModal`, and `EditProductModal`; quotations use `AddItemModal` and `ProductThumb`. |
| API | Express 5. Product endpoints are in `backend/routes/Products/product.js`, mounted below `/api`. Mutations require JWT authentication and the `admin` role; reads require authentication. |
| Database | MongoDB/Mongoose. `ProductData` embeds prices and stores category IDs as strings. `Category` is a separate collection. `VendorProduct` references Product by ObjectId. |
| Images | Product documents store a public relative URL such as `/uploads/products/<file>`. Express serves `backend/uploads` at `/uploads`. New files are now written to the matching canonical directory. |
| Quotations | Quotation line items are snapshots (name, image, quantity, price, tax, etc.), not live Product references. Catalog edits therefore do not rewrite existing quotation amounts. |
| Deployment | PM2 cluster configuration; local disk uploads; no shared object storage or automated deployment pipeline found. |
| Inventory | No stock balance, warehouse, stock movement, reservation, receipt, return, or reconciliation model/API exists. Dashboard stock values are placeholders because the API returns no inventory statistics. |
| Purchase orders/invoices | No Purchase Order or Invoice module exists. A quotation's `poNo` is only a reference string. |

## Prioritized verified defects

| Priority | Defect and evidence | Root cause / affected files | Disposition |
|---|---|---|---|
| P1 | Existing product images do not display. Read-only diagnostic: 32 references, 31 missing files, 1 malformed legacy path, 0 local product files. | Upload destination used `process.cwd()` while static serving used `backend/uploads`; deployments also retained DB paths without durable media. `product.js`, `server.js`. | New upload path fixed. Existing missing bytes require backup/source recovery and were not fabricated. |
| P1 | A file renamed `.png` could pass upload checks. | Only extension and caller-provided MIME were checked. | Fixed with PNG/JPEG/GIF/WebP signature inspection. |
| P1 | Replacing an image deleted the old file before the database update completed; failed creates/updates could orphan new files. | Non-atomic ordering in `product.js`. | Fixed by saving the new file, committing the document, then removing the old file; failure cleans up the new file. |
| P1 | Edit preview and search-card images had separate URL concatenation logic and failed when `VITE_IMAGE_URL` was absent or had unexpected slash handling. | `EditProductModal.jsx`, `SearchProductModal.jsx`, `productImage.js`. | Fixed through shared URL resolution with API-origin fallback. |
| P1 | Product deletion physically removed the product and image when no vendor row existed, risking historical loss. | `DELETE /api/products/delete/:id`. | Converted to audited archival. Image and master record are retained. |
| P1 | Concurrent editors silently overwrote one another. | Update matched only `_id`. | Fixed with `__v` optimistic version matching; stale updates return 409. |
| P1 | Duplicate style/SKU codes were accepted. | No application validation or safe production uniqueness migration. | Case-insensitive create/update checks added. A race-proof unique normalized index remains a migration item because existing duplicates were not destructively altered. |
| P2 | Product search was unbounded and one field used an unescaped regex. | `/products/search`. | Regex escaped and results capped at 50. |
| P2 | Dashboard total used current page length (maximum 50), not API total. | `ProductOverview.jsx`. | Fixed to request one row and use `total`. |
| P2 | No active/inactive/archived UI filter. | `ProductsTable.jsx`. | Added server/UI status filtering and status display. |
| P0/P1 | Auditable, concurrency-safe inventory is absent, so stock acceptance criteria cannot be met. | No inventory schema/routes/services. | Not invented without business rules. Production inventory release is blocked. |
| P2 | Product bulk import/export/edit is absent. | No product bulk endpoints or UI. | Not implemented in this stabilization pass. |

## Database and performance risks

- Money and tax values use JavaScript/Mongo `Number`, not Decimal128. Net price is rounded to two decimals, but the wider financial model still needs an approved precision migration.
- `cat_id` is a string rather than a foreign-key-like ObjectId reference. Application validation now verifies categories on create/edit, but legacy orphan detection remains needed.
- Unanchored multi-field regex search will scan at scale; no 10,000-product query-plan benchmark was run.
- Product status and audit-user fields are backward-compatible additions. Legacy rows are treated as active via `{status: {$ne: "archived"}}`. Production index creation should be controlled and observed.
- Product audit entries use the existing ActivityLog and are best-effort, not in the same MongoDB transaction as the product write.

## Security assessment

- Verified backend enforcement: authenticated reads; admin-only create, update, and archive.
- Upload size remains capped at 5 MB and one file; allowed MIME, extension, and byte signature must agree.
- Generated names use UUIDs; stored-path deletion rejects traversal and paths outside the product upload directory.
- Static product images are public. This matches current catalog behavior; no private-product classification exists.
- JWTs remain in browser localStorage, an existing application-wide XSS exposure documented in `CRM_SECURITY_AUDIT.md`.

## Integration risk

- Quotation selection now excludes archived products and reuses the shared image renderer. Existing quotation snapshots retain their recorded data.
- Vendor product links remain valid because archival retains Product documents.
- PO, invoice, stock receipt/deduction, return, dashboard stock, and reporting integrations are NOT IMPLEMENTED/NOT TESTED.
