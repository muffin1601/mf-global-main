# MongoDB to Supabase execution plan

Status: **prepared, dry-run verified, production execution not authorized**. Run commands from `enterprise-nextjs` in PowerShell. Never paste credentials into logs or commit `.env`.

## Gate 1 — backup and freeze preparation

1. Install MongoDB Database Tools on the controlled migration host and confirm `mongodump --version`.
2. Load the legacy URI privately, create an encrypted backup destination, and run:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $env:TEMP "mf-global-mongodb-$stamp.archive.gz"
mongodump --uri $env:LEGACY_MONGODB_URI --archive=$backup --gzip
Get-FileHash $backup -Algorithm SHA256
```

3. Copy the archive and checksum to approved encrypted backup storage. Test restoration into an isolated MongoDB instance with `mongorestore --archive=... --gzip`.
4. Record source database name, collection counts, backup checksum, operator, and timestamps. A successful, restorable backup is a hard gate.

## Gate 2 — non-production rehearsal

Use a separate Supabase rehearsal project with the same region and configuration as production.

```powershell
npm ci
npm exec prisma validate
npm run prisma:generate
npm run migrate:mongo:inventory
npm run migrate:mongo:audit-relations
npm run migrate:mongo:dry-run
npm run migrate:mongo:docs
npm run prisma:migrate:deploy
npm run migrate:mongo:apply
```

The last two commands write to the configured PostgreSQL database and require a reviewed rehearsal `.env`. Re-run `migrate:mongo:apply` to prove checkpoint/idempotency behavior. Verify destination counts, canonical hashes, quotation totals, assignments, permissions, dates, JSON snapshots, visitor HMACs, and file/storage hashes.

## Gate 3 — resolve or sign off exceptions

- Determine why all 9,006 legacy client-permission rows reference absent current clients and 5,888 also reference absent users. Keep every row in `LegacyClientPermission`; create effective permissions only where both sides resolve.
- Decide whether the one orphan blog comment remains archive-only or receives a reviewed association.
- Review 125 products whose category code has no category row and 25 activity logs whose actor code is absent. Source codes remain preserved.
- Locate, back up, upload, and hash-verify missing local file references, or obtain a written waiver. Never silently discard a reference.
- Review duplicate lead emails/phones without automatically merging distinct documents.

## Gate 4 — production cutover

Required approvals: backup/restore evidence, rehearsal reconciliation, exception sign-off, Supabase schema/security review, business acceptance, rollback owner, maintenance window, and explicit authorization to write production.

1. Announce the maintenance window and stop all legacy application writes.
2. Take a final MongoDB archive and checksum.
3. Run inventory, relationship audit, and dry-run again. Compare counts with the approved baseline.
4. Update only approved production secrets in the controlled environment.
5. With explicit approval, execute exactly:

```powershell
npm run prisma:migrate:deploy
npm run migrate:mongo:apply
```

6. Run destination reconciliation and acceptance tests before enabling traffic.
7. Create 11 Supabase Auth identities through the approved administrator activation/reset flow, then link reviewed Auth UUIDs to application users. Do not copy bcrypt hashes or send invitations without separate approval.

## Rollback

Before traffic is enabled, rollback means keeping the legacy system read-only, disabling the new application, and recreating the Supabase database from the pre-import baseline. Do not attempt ad-hoc reverse transformations. If traffic has already been enabled, stop writes immediately, preserve both databases and logs, and invoke the approved incident/data-reconciliation procedure before choosing a system of record.

The runner is batch-based, transactional, checkpointed, and idempotent, but those properties do not replace backups or an approved rollback decision.
