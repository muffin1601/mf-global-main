// Verifies Prisma migration files against a database's _prisma_migrations ledger. READ-ONLY: runs a single SELECT.
//   node scripts/verify-migration-checksums.mjs                 -> prints local file checksums only
//   VERIFY_DATABASE_URL=postgresql://... node scripts/verify-migration-checksums.mjs
// Exit 1 if any file has CRLF line endings, or (with a URL) any applied migration's checksum differs from its file,
// or a ledger entry has no file. Pending (unapplied) migrations are listed, not treated as errors.
// The connection string is never printed.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const dir = "prisma/migrations";
const files = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "migration.sql")))
  .map((d) => {
    const bytes = readFileSync(join(dir, d.name, "migration.sql"));
    return { name: d.name, checksum: createHash("sha256").update(bytes).digest("hex"), crlf: bytes.includes(0x0d) };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

let failed = false;
for (const f of files) {
  if (f.crlf) { failed = true; console.log(`CRLF   ${f.name}  (fix: git add --renormalize, .gitattributes *.sql eol=lf)`); }
}

const url = process.env.VERIFY_DATABASE_URL;
if (!url) {
  for (const f of files) console.log(`${f.checksum.slice(0, 12)}  ${f.name}`);
} else {
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  const { rows } = await db.query("select migration_name, checksum, finished_at, rolled_back_at from _prisma_migrations order by started_at");
  await db.end();
  const ledger = new Map(rows.map((r) => [r.migration_name, r]));
  for (const f of files) {
    const r = ledger.get(f.name);
    if (!r) console.log(`PENDING   ${f.name}`);
    else if (r.rolled_back_at) console.log(`ROLLEDBK  ${f.name}`);
    else if (r.checksum !== f.checksum) { failed = true; console.log(`MISMATCH  ${f.name}  file ${f.checksum.slice(0, 12)} ledger ${String(r.checksum).slice(0, 12)}`); }
    else console.log(`OK        ${f.name}  ${f.checksum.slice(0, 12)}${r.finished_at ? "" : "  (not finished)"}`);
  }
  for (const name of ledger.keys()) if (!files.some((f) => f.name === name)) { failed = true; console.log(`NOFILE    ${name}  (applied in DB, missing locally)`); }
  if (ledger.has("20261120145700_remove_non_admin_users")) console.log("NOTE      20261120145700 is in this ledger - confirm its checksum is the disable-only version (OK above).");
}
if (failed) process.exitCode = 1;
