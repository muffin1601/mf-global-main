# Inventory & Product Fix Report

Date: 2026-10-22

## Implemented fixes

| Change | Before | After |
|---|---|---|
| Canonical media storage | Relative `uploads/products` depended on launch directory and could differ from the served folder. | New images always write to `backend/uploads/products`, the directory served by Express. Missing directories are created safely. |
| Image trust boundary | Extension and request MIME only. | Extension/MIME allowlist plus file-signature verification; canonical extension is derived from content. |
| Image lifecycle | Old image deleted before DB success; failed writes could leave inconsistent files. | New file is cleaned up on failure; old file is deleted only after successful replacement. Removal and replacement cannot traverse directories. |
| URL resolution | Several components manually prefixed `VITE_IMAGE_URL`; missing configuration generated frontend-origin 404s. | All changed screens use `resolveProductImageUrl`; it prefers `VITE_IMAGE_URL` and otherwise derives the origin from `VITE_API_URL`. |
| Product lifecycle | Hard delete removed product and media. | Existing endpoint now archives, records actor/time, preserves image/history, and excludes archived rows from active lists/selectors. |
| Concurrent editing | Last write silently won. | Edit submits `__v`; stale versions return HTTP 409. |
| Validation | Duplicate style/SKU codes and forged image content were accepted. | Case-insensitive duplicate checks and signature validation return controlled 4xx errors. |
| Auditability | Product CRUD had no audit records. | Create, update, and archive write actor/action/product metadata to existing ActivityLog. |
| List/search | No status filter; search unbounded; dimension regex unescaped. | Status filter, 50-result search cap, escaped input, and accessible image alt text/lazy loading. |
| Dashboard count | Counted only the current product page. | Uses the API's authoritative `total`. |

## Files changed

- `backend/models/ProductData.js`
- `backend/package.json`
- `backend/routes/Products/product.js`
- `backend/scripts/diagnoseProductImages.js`
- `backend/tests/productApi.test.js`
- `backend/tests/productImages.test.js`
- `backend/utils/productImages.js`
- `frontend/src/components/crm/Modals/EditProductModal.jsx`
- `frontend/src/components/crm/Modals/SearchProductModal.jsx`
- `frontend/src/components/crm/Product/ProductOverview.jsx`
- `frontend/src/components/crm/Product/ProductsTable.jsx`
- `frontend/src/utils/productImage.js`
- `frontend/src/utils/productImage.test.js`
- The five root-level inventory reports created by this audit.

## Migration and rollout requirements

1. Back up MongoDB and the current upload volume before rollout.
2. Recover the 31 missing image files from a known-good backup or original source, preserving their referenced basenames, or re-upload explicitly through product edit. Do not rewrite DB references until file integrity is verified.
3. Mount durable shared storage at `backend/uploads` (or bind that path to persistent storage) before deploying more than one instance. Object-storage migration is recommended long term but was not silently introduced.
4. Build the `{status: 1, updatedAt: -1}` index during a controlled window and inspect for resource impact.
5. Configure `VITE_API_URL`. `VITE_IMAGE_URL` is optional when media uses the API origin; set it explicitly when a CDN/media origin is used.
6. Do not add a unique SKU index until a read-only duplicate report has been reviewed and a normalization/business-scope rule approved.

No destructive migration, product-ID change, stock mutation, image-reference rewrite, or deployment was performed.
