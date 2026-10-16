# Security Audit

Status: **Improved; production review still required**

## Fixed in this audit

- Regular users cannot forge lead ownership during creation.
- Dashboard/client filters use authenticated ObjectId scope for staff.
- Legacy direct client update now requires admin or assigned update permission.
- Sales-performance aggregates no longer disclose all users to staff.
- Staff-directory `/api/users` is now admin-only; non-admin forms no longer request it.
- Quotation fetch/edit/list ownership and admin-only deletion are covered by integration tests.
- Invalid quotation IDs return controlled 400 responses.
- Quotation PDF interpolated text is HTML-escaped.

## Existing safeguards verified

JWT signature/expiry, disabled-account checks, role middleware, login/email/webhook rate limits, Helmet, CORS allowlist, HPP, Mongo sanitization, body limits, vendor permission middleware, upload validation, bank-detail masking and audit redaction.

## Remaining concerns

- JWT is stored in `localStorage`; an XSS would expose it. A secure cookie/CSRF design should be evaluated.
- Generic activity-log details and public blog comments need stricter validation/size/moderation controls.
- No tenant/workspace concept exists; security boundary is role plus assignment/ownership.
- Secrets/configuration and production logs were not opened or copied.
- A full authenticated browser IDOR matrix against staging is **NOT TESTED**.

