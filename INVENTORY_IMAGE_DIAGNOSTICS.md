# Inventory Image Diagnostics

Diagnostic date: 2026-10-22

## Verified architecture and URL rule

Upload flow: authenticated admin multipart upload → Multer 5 MB/single-file gate → byte-signature verification → UUID filename → `backend/uploads/products` → relative DB reference `/uploads/products/<name>` → Express `/uploads` static middleware → shared frontend resolver.

Frontend resolution is now:

1. Preserve an existing absolute HTTP(S), protocol-relative, or data URL.
2. Prefix a relative reference with `VITE_IMAGE_URL` when configured.
3. Otherwise use the origin of `VITE_API_URL`.

## Root cause

The former Multer destination and deletion logic were relative to `process.cwd()`, while static serving was anchored to `backend/server.js`. Starting with `node backend/server.js` from the repository root therefore wrote to `CRM/uploads/products` but served `CRM/backend/uploads/products`. In addition, local disk is not durable across ephemeral deployments or shared between clustered/multi-host instances.

## Read-only integrity result

Command: `cd backend && npm.cmd run diagnose:product-images`

| Check | Result |
|---|---:|
| Product documents with image references | 32 |
| Files in canonical product upload directory | 0 |
| Missing referenced local files | 31 |
| Malformed/noncanonical references | 1 |
| Orphan files | 0 |
| Duplicate references | 0 |
| Remote URLs requiring network check | 0 |

The malformed record points to `/assets/products/polo/classic-white (2).webp`; that asset was not found in the repository. Sample and full-name searches found none of the missing referenced files elsewhere in the workspace.

## Safe recovery plan

1. Snapshot database and all deployment upload volumes.
2. Search prior releases, VM disks, container volumes, object-storage buckets, and backups for exact basenames reported by the diagnostic.
3. Restore into a staging copy of `backend/uploads/products` without changing DB references.
4. Re-run diagnostics and compare SHA-256 hashes against the backup manifest where available.
5. Verify list, details, edit preview, quotation selector, and PDF rendering through authenticated browser tests.
6. Promote the recovered volume atomically; retain rollback snapshot.
7. For files that cannot be recovered, obtain a replacement from the product owner and use explicit product edit. Do not auto-delete or auto-repoint records.

## Durable storage recommendation

Local disk is acceptable only for a single persistent host with backed-up storage. For ephemeral/multi-instance deployment, move media to durable object storage/CDN behind a storage adapter. Preserve current relative references during transition (proxy old paths or migrate with a manifest), copy before switching reads, verify object count/hash/content type, support dual-read during rollout, and retain rollback to the original volume. No provider migration was performed.
