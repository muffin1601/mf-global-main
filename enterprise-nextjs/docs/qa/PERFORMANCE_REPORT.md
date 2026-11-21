# Local performance measurements

Embedded PostgreSQL, 50,000 additional synthetic leads inserted inside a rolled-back transaction, one connection, ten warm measurements per query. Times below are PostgreSQL execution time from EXPLAIN ANALYZE.

| Query | Minimum ms | Median ms | Maximum ms |
|---|---|---|---|
| identity | 0.022 | 0.03 | 0.055 |
| pagination | 17.169 | 18.45 | 22.148 |
| contains | 0.052 | 0.06 | 0.096 |

Chromium navigation to network idle across 76 route/role visits took a median of 848.0 ms on the local Next.js dev server. Viewport captures share the same navigation timing. Local development compilation, browser cache and external-request blocking influence these figures. Production p95, concurrent import/export throughput, heap use and cold start remain unmeasured.

[Query timings and plans](../../test-artifacts/database-rehearsal.json)
