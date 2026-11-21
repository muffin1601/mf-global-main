# Module inventory

| Functional area | Surface | Vitest passes¹ | Layout checks | Remaining verification |
|---|---|---|---|---|
| Authentication and users | Login, recovery, callback, sign-out, employee administration | 31 | 25 | Hosted identity, email changes, recovery links and disabled sessions |
| Dashboard | Overview, entry dashboard, employee metrics | 11 | 20 | Independent reconciliation against a production-like snapshot |
| Leads and assignments | Lead presets, create, edit, ownership, transfers, record detail, tags | 40 | 100 | Every filter combination, concurrent bulk operations and record updates |
| Activities and follow-ups | Timeline, logged calls, notes, tasks, scheduling and completion | 10 | 30 | All calendar boundaries and reminder delivery |
| Imports and exports | Lead CSV preview, batches, history, retry, templates, downloads | 26 | 10 | Large end-to-end browser imports and slow upload recovery |
| Reports | Lead insertion report with CSV, XLSX and PDF | 20 | 10 | Every date, variant and export under each role |
| Product catalog | Categories, items, prices, images, product dashboard | 39 | 20 | Hosted storage lifecycle and historical product references |
| Vendors | Directory, contacts, bank details, archive, blacklist, documents, import, performance | 97 | 90 | Hosted attachments, all modals and complete role-by-action grid |
| Quotations | Client/product selection, line calculations, numbering, editing, PDF | 17 | 30 | Complete approval/revision requirements and all rounding combinations |
| Global search and saved views | Command palette, saved list configuration | 12 | 0 | Keyboard flow and persisted preference combinations |
| Audit history | Activity log and entity changes | 10 | 10 | Source-by-source completeness and production retention |
| Inbound integrations | Capture endpoints and trade-platform jobs | 23 | 0 | Provider sandbox callbacks, scheduling, retry and delivery |
| Careers | Public jobs, applications, resume uploads, administrative portal | 0 | 10 | Admin session, real storage and notification sandbox |
| Marketing and blogs | Home, contact, blogs and blog comments | 0 | 25 | Embedded assets and mail sandbox |
| Platform and migration | Health, schema, migration, storage policy and dependencies | 77 | 0 | Restore rehearsal and shared migration ledger |

¹ Each Vitest case is counted once by its suite file. Cross-cutting tests are grouped under platform. A zero means no passing case assigned to that group in this count.

The Prisma role enum defines ADMIN and USER. Vendor and CRM grants are in [the permission definitions](../../src/lib/permissions/index.ts). Additional people, companies and contact details appear within leads, vendors and quotations. The [feature gap analysis](../enterprise/FEATURE_GAP_ANALYSIS.md) describes absent pipeline, order, invoicing and payment modules.

## Application jobs and integrations

- src/server/integrations/common.ts
- src/server/integrations/cron.ts
- src/server/integrations/indiamart.ts
- src/server/integrations/tradeindia.ts
- src/server/integrations/webhooks.ts

The preserved Express scheduler sources are indiaMartCron.js, tradeIndiaCron.js. The Next.js deployment manifest currently lists zero cron registrations.
