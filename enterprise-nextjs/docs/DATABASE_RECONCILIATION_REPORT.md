# Database reconciliation report

Status: **PRE-IMPORT DRY RUN — PRODUCTION WRITE NOT EXECUTED**
Generated: 2026-11-17T07:54:22.962Z

- Source collections: **25**
- Source documents: **13885**
- Accounted by transform or explicit exception: **13885**
- PostgreSQL records written: **0**

## Collection readiness

| Collection | Source | Directly ready | Explicit exceptions | Errors |
|---|---:|---:|---:|---:|
| users | 11 | 11 | 0 | 0 |
| categories | 12 | 12 | 0 | 0 |
| clientdatas | 62 | 62 | 0 | 0 |
| clientpermissions | 9006 | 0 | 9006 | 0 |
| products | 125 | 125 | 0 | 0 |
| quotations | 18 | 18 | 0 | 0 |
| vendors | 3 | 3 | 0 | 0 |
| blogs | 1 | 1 | 0 | 0 |
| comments | 1 | 0 | 1 | 0 |
| careerjobs | 3 | 3 | 0 | 0 |
| careerapplications | 0 | 0 | 0 | 0 |
| companysettings | 1 | 1 | 0 | 0 |
| counters | 12 | 12 | 0 | 0 |
| activitylogs | 4222 | 4222 | 0 | 0 |
| visitors | 408 | 408 | 0 | 0 |
| careerloginattempts | 0 | 0 | 0 | 0 |
| careersessions | 0 | 0 | 0 | 0 |
| careersettings | 0 | 0 | 0 | 0 |
| importhistories | 0 | 0 | 0 | 0 |
| vendoractivities | 0 | 0 | 0 | 0 |
| vendorcategories | 0 | 0 | 0 | 0 |
| vendordocuments | 0 | 0 | 0 | 0 |
| vendorevaluations | 0 | 0 | 0 | 0 |
| vendorimportjobs | 0 | 0 | 0 | 0 |
| vendorproducts | 0 | 0 | 0 | 0 |

## Relationship audit

- clientPermissionDuplicatePairs: **2942**
- clientPermissionOrphanUsers: **5888**
- clientPermissionOrphanClients: **9006**
- embeddedAssignmentOrphanUsers: **0**
- commentOrphanBlogs: **1**
- quotationOrphanUsers: **0**
- productMissingCategoryCodes: **125**
- productOrphanCreators: **0**
- productOrphanUpdaters: **0**
- activityUnknownUserCodes: **25**
- careerApplicationOrphanJobs: **0**

## Duplicate/value findings

- Leads: 3 duplicate non-empty email groups (6 documents) and 2 duplicate non-empty phone groups (4 documents). Records remain distinct; no automatic merge is authorized.
- Client permissions: 2,942 duplicate user/client groups. Every original row is retained in the legacy permission archive; only resolvable effective permissions may be consolidated.
- Products: source product codes and price codes have no duplicate groups; repeated category codes are expected.

## File-reference audit

- activitylogs.details.fileName: 57 sampled local references not found
- clientdatas.fileName: 47 sampled local references not found
- clientdatas.fileName_lc: 47 sampled local references not found
- products.images[].url: 3 sampled local references not found
- products.p_image: 52 sampled local references not found
- products.subImages[].url: 4 sampled local references not found
- The blog media reference is a remote URL and was reachable only as a reference; content download/hash verification is still required.
- Missing local references are blockers for binary migration, but their original database strings remain preserved.

## Authentication migration

- 11 application users require Supabase Auth identities.
- Existing bcrypt hashes are not imported or exposed.
- Prepare identities with administrator-controlled activation or password reset; do not send invitations until separately approved.
- After identity creation, write each Supabase Auth UUID to `User.authUserId` using a reviewed email/legacy-ID mapping.

## Current blockers

1. Resolve whether the 9,006 stale permission rows represent deleted historical clients/users or an incorrectly selected legacy database. They are preserved, but cannot become valid foreign keys.
2. Decide whether the orphan blog comment should remain archive-only or be manually associated after business review.
3. Locate or formally waive missing product/lead/activity file references after backup search and hash inventory.
4. Apply the regenerated Prisma migration only to a non-production Supabase rehearsal database first.
5. Run destination counts, canonical checksums, financial comparisons and application verification after an approved rehearsal import.