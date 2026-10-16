# Client Visibility Root Cause

Status: **PASS (automated integration scope)**

## Problem

A regular user could submit a new lead and receive success, but the record did not appear under My Leads or the user's dashboard statistics.

## Root cause

`FormModal` initialized `assignedTo` as an empty array and disabled assignment for non-admins. `POST /api/add-client` trusted that body and saved an unassigned record. Every user-specific dashboard/list query selects records by `assignedTo`, so the database write succeeded while subsequent reads correctly excluded it. The form also did not notify its parent to refresh, and the global count cache was not cleared.

## Code-level solution

- `backend/routes/client.js`: regular-user ownership is now assigned from authenticated `req.user`, never the request body; admins retain assigned/unassigned behavior; the response includes the saved client; count cache is invalidated.
- `backend/models/ClientData.js`: optional immutable-at-creation `createdBy` audit reference added without invalidating legacy rows.
- `backend/routes/dashboardoverview.js`: regular-user counts and lists use authenticated ObjectId ownership, not a caller-controlled name; only admins use the global cache.
- `FormModal.jsx` and parent tables: successful creation closes the form and refreshes the current list immediately; non-admin role is no longer accidentally defaulted to admin.

## Verification

`backend/tests/clientVisibility.test.js` verifies persistence, createdBy, forced self-assignment, immediate retrieval, dashboard statistics, another user's isolation, admin unassigned creation, 105-record pagination, and ten concurrent creations. Result: **PASS**.

Refresh and re-login persistence are represented by independent authenticated requests to the persisted in-memory database. A real browser/session test against staging is **NOT TESTED** because no staging credentials or isolated staging database were supplied.

## Remaining limitation

Phone/contact duplicate prevention is check-then-insert and does not have a unique database constraint. A unique index cannot be safely added until production duplicates are diagnosed and resolved.

