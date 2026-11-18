// Isolated, disposable PostgreSQL for verification. NEVER connects to Supabase.
// Usage: node scripts/test-db.mjs up    -> start, migrate, print DATABASE_URL (port 54330)
//        node scripts/test-db.mjs down  -> stop
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { execFileSync } from "node:child_process";
import { rmSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";

// A free port per run, so several test runs (or agents) can execute concurrently.
function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => { const { port } = probe.address(); probe.close(() => resolvePort(port)); });
  });
}


export async function startTestDatabase() {
  const port = process.env.TEST_DB_PORT ? Number(process.env.TEST_DB_PORT) : await freePort();
  process.env.TEST_DB_PORT = String(port);
  const TEST_URL = `postgresql://postgres:test@127.0.0.1:${port}/crm_test`;
  const dir = mkdtempSync(join(tmpdir(), "crm-pgtest-"));
  const server = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "test", port, persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"], onLog: () => {}, onError: () => {} });
  await server.initialise();
  await server.start();
  await server.createDatabase("crm_test");
  const admin = new pg.Client({ connectionString: TEST_URL });
  await admin.connect();
  // Stand-ins for the Supabase roles/schemas the security SQL refers to.
  await admin.query(`do $$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  end $$;`);
  await admin.end();
  const env = { ...process.env, DIRECT_URL: TEST_URL, DATABASE_URL: TEST_URL };
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "pipe" });
  const sec = new pg.Client({ connectionString: TEST_URL });
  await sec.connect();
  await sec.query(readFileSync("supabase/storage-and-database-security.sql", "utf8"));
  await sec.end();
  return { server: { stop: async () => { await server.stop(); rmSync(dir, { recursive: true, force: true }); } }, url: TEST_URL };
}

if (process.argv[1]?.endsWith("test-db.mjs")) {
  const cmd = process.argv[2];
  if (cmd === "up") {
    const { server, url } = await startTestDatabase();
    console.log("ready:", url.replace(/:test@/, ":***@"));
    process.on("SIGINT", async () => { await server.stop(); process.exit(0); });
    setInterval(() => {}, 1 << 30);
  }
}
