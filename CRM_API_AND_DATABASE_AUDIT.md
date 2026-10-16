# API and Database Audit

## Confirmed data layer

MongoDB/Mongoose models cover users, clients, client permissions, quotations, products/categories, vendors and vendor submodules, imports, activity, visitors, blogs/comments, tasks and counters. Relationships are mostly embedded or loose; quotations reference users and vendor v2 has explicit supporting collections.

## Reliability findings

- Request authentication is database-backed on every protected call and disabled accounts are rejected.
- Lead and quotation paths now return persisted entities and enforce owner scope.
- Quotation money is computed server-side; client totals are ignored.
- Pagination is bounded to 200 for shared helpers.
- Existing lead normalized fields and indexes support common status/assignment/filter queries.
- Health/readiness probes, compression, body limits, Helmet, CORS allowlist, query/body sanitization and graceful shutdown exist.

## Remaining risks

- Client phone/contact fields are indexed but not unique; concurrent duplicate inserts remain possible.
- Multi-document assignment compatibility writes are not consistently transactional.
- Some legacy models/routes are unmounted (`fetch-client.js`, `Todo-Performance.js`, duplicate root blog route) and should be removed only after usage confirmation.
- Local uploads are not safe for multi-host/ephemeral deployments.
- Schema validation is permissive in older lead/product routes.
- No production `explain()` plans or live index inventory were run; production data was intentionally untouched.

