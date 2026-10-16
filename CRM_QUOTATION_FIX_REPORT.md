# Quotation Fix Report

Status: **PASS for implemented create/read/update/delete/list/calculation flows; PARTIAL overall lifecycle**

## Fixed

| Problem | Root cause | Solution | Test result |
|---|---|---|---|
| PDF totals differed from saved quotation | Browser PDF recalculated and ignored line discounts, summary discount, charges and round-off | Generate from persisted server response and use server `totals` | PASS (unit/integration/build); visual PDF QA NOT TESTED |
| PDF could show stale number | UI generated from editable hardcoded form number while server issued another number | PDF now uses saved response | PASS |
| Preview produced NaN while fields were blank | Direct `parseFloat` arithmetic | Added finite/clamped preview calculator mirroring server rules | PASS |
| First concurrent creations could race seeding invoice counter | Competing counter upserts could throw duplicate-key | Losing initializer safely continues to atomic increment | PASS, 12 concurrent creates |
| Invalid fetch/delete IDs became 500 | Missing ObjectId validation | Return 400 before querying | PASS |
| User content inserted into PDF HTML | Raw template interpolation | HTML escaping added | Build PASS |

## Existing workflow verified

- Create with authenticated owner, required party and items.
- Server-authoritative line/summary calculations and two-decimal rounding.
- Atomic quotation numbers.
- Owner/admin fetch and update; admin-only delete/global list.
- Update happens in place and preserves owner and issued number.
- Paginated lists.

## Not implemented in source

Draft/sent/accepted/rejected/expired status, email/send/share workflow, duplication, attachments, server-generated PDF endpoint, invoice conversion, and PO conversion do not exist. They are **NOT TESTED** and were not invented during stabilization.

