// Dev helper: migrate once into a disposable DB and print distinct failure causes.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startTestDatabase } from "./test-db.mjs";
const dir = mkdtempSync(join(tmpdir(), "crm-once-"));
const { server, url } = await startTestDatabase();
try {
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, MIGRATION_REPORT_DIR: dir, IP_HASH_SALT: "rehearsal-salt-rehearsal-salt-rehearsal-salt" };
  delete env.ALLOW_PRODUCTION_WRITE;
  spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/migrate-mongodb/index.ts", "--apply"], { env, encoding: "utf8", maxBuffer: 1 << 28 });
  const report = JSON.parse(readFileSync(join(dir, readdirSync(dir).sort().at(-1)), "utf8"));
  const groups = {};
  for (const f of report.findings.filter((x) => x.level === "error")) { const k = `${f.collection} | ${f.code} | ${(f.message ?? "").slice(-300)}`; groups[k] = (groups[k] ?? 0) + 1; }
  console.log(Object.entries(groups).map(([k, n]) => `${n}x ${k}`).join("\n") || "no error findings");
  console.log("accounted", report.totalAccountedDocuments, "of", report.totalSourceDocuments);
} finally { await server.stop(); }
process.exit(0);
