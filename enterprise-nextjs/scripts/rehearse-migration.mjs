// Rehearses the FULL MongoDB -> PostgreSQL migration against a DISPOSABLE local database.
// MongoDB is only read. Supabase is never contacted. Steps:
//   1 start embedded Postgres + apply all migrations + security SQL
//   2 migrate (apply)            3 verify field-by-field
//   4 migrate again (idempotency) 5 verify again, assert nothing changed
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { startTestDatabase } from "./test-db.mjs";

const reportDir = mkdtempSync(join(tmpdir(), "crm-rehearsal-"));
const { server, url } = await startTestDatabase();
const env = {
  ...process.env,
  DATABASE_URL: url, DIRECT_URL: url, MIGRATION_REPORT_DIR: reportDir,
  IP_HASH_SALT: "rehearsal-salt-rehearsal-salt-rehearsal-salt",
};
delete env.ALLOW_PRODUCTION_WRITE;
const run = (label, script) => {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", script, ...(script.endsWith("index.ts") ? ["--apply"] : [])], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const text = (r.stdout ?? "") + (r.stderr ?? "");
  console.log(text.split("\n").filter((l) => /PASS|FAIL|checks passed|verify failed|Error|source=|errors|findings|totalSource|totalAccounted/.test(l)).slice(0, 120).join("\n"));
  return r.status;
};
const snapshot = async () => {
  const c = new pg.Client({ connectionString: url }); await c.connect();
  const tables = (await c.query("select tablename from pg_tables where schemaname='public' and tablename <> '_prisma_migrations' order by 1")).rows.map((r) => r.tablename);
  const out = {}; for (const t of tables) out[t] = Number((await c.query(`select count(*)::int n from "${t}"`)).rows[0].n);
  await c.end(); return out;
};

let code = 0;
try {
  code ||= run("1. migrate (apply) into isolated database", "scripts/migrate-mongodb/index.ts") ?? 1;
  const first = await snapshot();
  code ||= run("2. verify (field-level)", "scripts/migrate-mongodb/verify.ts") ?? 1;
  const second = (run("3. migrate again (idempotency)", "scripts/migrate-mongodb/index.ts"), await snapshot());
  const changed = Object.keys(first).filter((t) => first[t] !== second[t]);
  console.log(`\nIdempotency: ${changed.length === 0 ? "PASS - no table changed on re-run" : "FAIL - changed: " + changed.join(", ")}`);
  if (changed.length) code ||= 1;
  code ||= run("4. verify again", "scripts/migrate-mongodb/verify.ts") ?? 1;
  const tableList = Object.entries(second).filter(([, n]) => n > 0).map(([t, n]) => `${t}=${n}`).join(", ");
  console.log(`\nRows per table after migration: ${tableList}`);
  const reports = readdirSync(reportDir).sort();
  console.log(`Reports written to temp dir: ${reports.length} file(s). Latest: ${reports.at(-1)}`);
  if (process.env.KEEP_REPORTS) console.log(readFileSync(join(reportDir, reports.at(-1)), "utf8").slice(0, 300));
} finally {
  await server.stop();
}
process.exit(code ? 1 : 0);
