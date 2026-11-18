import { startTestDatabase } from "./test-db.mjs";
import pg from "pg";
const { server, url } = await startTestDatabase();
const c = new pg.Client({ connectionString: url });
await c.connect();
const q = async (s) => (await c.query(s)).rows;
console.log("tables:", (await q("select count(*)::int n from pg_tables where schemaname='public'"))[0].n,
  "| without RLS:", (await q("select count(*)::int n from pg_tables where schemaname='public' and not rowsecurity"))[0].n);
console.log((await q("select migration_name, finished_at is not null ok from _prisma_migrations order by started_at")).map(r => `${r.migration_name}: ${r.ok}`).join("\n"));
console.log("anon/authenticated grants:", JSON.stringify(await q("select grantee, count(*)::int n from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') group by 1")));
await c.query("insert into leads(id,created_at,updated_at) values (gen_random_uuid(),'2026-01-01T00:00:00Z',now())");
try { await c.query("update leads set created_at=now()"); console.log("TRIGGER FAIL: created_at update was allowed"); }
catch (e) { console.log("trigger blocks created_at change:", e.message); }
await c.query("update leads set status='In Progress'");
console.log("other lead updates still allowed: ok");
await c.end(); await server.stop();
