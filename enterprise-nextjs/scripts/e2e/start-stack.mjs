// Starts a fully isolated E2E stack: embedded PostgreSQL (crm_e2e) + fake Supabase + `next dev`.
// Every connection string and key is overridden in the child process, so the real .env (which points at the
// live Supabase project) is never used: Next.js gives existing process.env values priority over .env files.
// Usage: node scripts/e2e/start-stack.mjs   (Ctrl+C stops everything and deletes the database)
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const DB_PORT = Number(process.env.E2E_DB_PORT ?? 54340);
const AUTH_PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54321);
const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3100);
const DB_URL = `postgresql://postgres:e2e@127.0.0.1:${DB_PORT}/crm_e2e`;
const work = mkdtempSync(join(tmpdir(), "crm-e2e-"));
const usersFile = join(work, "auth-users.json");
mkdirSync(resolve("test-artifacts"), { recursive: true });
const idsFile = resolve("test-artifacts/e2e-ids.json");

const childEnv = {
  ...process.env,
  NODE_ENV: "development",
  DATABASE_URL: DB_URL,
  DIRECT_URL: DB_URL,
  NEXT_PUBLIC_APP_URL: `http://localhost:${APP_PORT}`,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${AUTH_PORT}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_fake",
  SUPABASE_SECRET_KEY: "sb_secret_e2e_fake",
  // Outbound integrations are neutralised with non-working placeholder values (a key present in
  // process.env stops Next from loading the real one from .env).
  INTEGRATIONS_ENABLED: "false",
  ENABLE_INDIAMART_SYNC: "false",
  RESEND_API_KEY: "re_e2e_disabled_placeholder",
  CONTACT_EMAIL_TO: "qa-sink@example.test",
  CONTACT_EMAIL_FROM: "qa@example.test",
  CAREERS_NOTIFICATION_EMAILS: "qa-sink@example.test",
  CAREERS_NOTIFICATION_FROM: "qa@example.test",
  COACHINGPROMO_API_KEY: "e2e-coachingpromo-key-000000000000",
  TRADEINDIA_USERID: "e2e", TRADEINDIA_PROFILE_ID: "e2e", TRADEINDIA_KEY: "e2e-disabled",
  INDIAMART_API_KEY: "e2e-disabled",
  LEGACY_MONGODB_URI: "mongodb://127.0.0.1:1/none",
  IP_HASH_SALT: "e2e-salt-e2e-salt-e2e-salt-e2e-salt-e2e",
  CRON_SECRET: "e2e-cron-secret-000000000000000000",
  E2E_USERS_FILE: usersFile,
  E2E_IDS_FILE: idsFile,
  FAKE_SUPABASE_PORT: String(AUTH_PORT),
  NEXT_DIST_DIR: ".next-e2e",
};

const db = new EmbeddedPostgres({ databaseDir: join(work, "pg"), user: "postgres", password: "e2e", port: DB_PORT, persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"], onLog: () => {}, onError: () => {} });
await db.initialise();
await db.start();
await db.createDatabase("crm_e2e");
const admin = new pg.Client({ connectionString: DB_URL });
await admin.connect();
await admin.query(`do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;`);
await admin.end();
execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: childEnv, stdio: "inherit" });
const sec = new pg.Client({ connectionString: DB_URL });
await sec.connect();
await sec.query(readFileSync("supabase/storage-and-database-security.sql", "utf8"));
await sec.end();
execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/e2e/seed.ts"], { env: childEnv, stdio: "inherit" });

const children = [];
children.push(spawn(process.execPath, ["scripts/e2e/fake-supabase.mjs"], { env: childEnv, stdio: "inherit" }));
children.push(spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(APP_PORT)], { env: childEnv, stdio: "inherit" }));
writeFileSync(resolve("test-artifacts/e2e-stack.json"), JSON.stringify({ app: `http://localhost:${APP_PORT}`, db: DB_URL.replace(":e2e@", ":***@") }, null, 2));

const stop = async () => {
  for (const c of children) c.kill();
  await db.stop().catch(() => undefined);
  rmSync(work, { recursive: true, force: true });
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
