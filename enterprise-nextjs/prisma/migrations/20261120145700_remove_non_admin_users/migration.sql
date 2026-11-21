-- Deactivate (do NOT delete) all non-admin users.
--
-- An earlier revision of this migration deleted every role='USER' account together with
-- their quotations and quotation items. It had not been applied to any environment, so it
-- was replaced with this non-destructive version. Employees, quotations, leads, activities
-- and all ownership/financial history are preserved; deactivated users cannot sign in
-- (src/lib/auth/session.ts and api.ts enforce users.enabled, and provisioning bans the
-- matching Supabase identity). Re-enable any account from User Management.
--
-- Idempotent: re-running changes nothing further. Only touches rows that are still enabled.

UPDATE users
SET enabled = false,
    updated_at = now()
WHERE role = 'USER'
  AND enabled = true;
