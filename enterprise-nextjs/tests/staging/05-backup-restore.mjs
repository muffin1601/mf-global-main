// Backup/restore rehearsal check (READ-ONLY on both databases): row counts and integrity queries must match between
// the source staging database and the copy restored from its backup.
import pg from "pg";
import { guard, hostOf, reporter, expect } from "./guard.mjs";

guard(["SOURCE_DATABASE_URL", "RESTORED_DATABASE_URL"]);
if (hostOf(process.env.SOURCE_DATABASE_URL) === hostOf(process.env.RESTORED_DATABASE_URL) && process.env.SOURCE_DATABASE_URL === process.env.RESTORED_DATABASE_URL) {
  console.error("Source and restored URLs are identical - point RESTORED_DATABASE_URL at the restored copy."); process.exit(2);
}
const TABLES = ["users", "leads", "lead_assignments", "lead_assignment_events", "activities", "quotations", "quotation_items", "products", "product_prices", "categories", "vendors", "vendor_contacts", "vendor_documents", "activity_logs", "career_jobs", "career_applications", "_prisma_migrations"];
const INTEGRITY = {
  orphan_quotation_items: "select count(*) n from quotation_items i left join quotations q on q.id=i.quotation_id where q.id is null",
  orphan_quotations: "select count(*) n from quotations q left join users u on u.id=q.user_id where u.id is null",
  orphan_assignments: "select count(*) n from lead_assignments a left join users u on u.id=a.user_id left join leads l on l.id=a.lead_id where u.id is null or l.id is null",
  invalid_constraints: "select count(*) n from pg_constraint where not convalidated",
  quotation_total_sum: "select coalesce(sum(grand_total),0)::text n from quotations",
  latest_migration: "select max(migration_name) n from _prisma_migrations where rolled_back_at is null",
};
async function snapshot(url) {
  const c = new pg.Client({ connectionString: url }); await c.connect();
  await c.query("set default_transaction_read_only = on");
  const out = {};
  for (const t of TABLES) out[`rows.${t}`] = (await c.query(`select count(*)::text n from "${t}"`).catch(() => ({ rows: [{ n: "missing" }] }))).rows[0].n;
  for (const [k, q] of Object.entries(INTEGRITY)) out[`check.${k}`] = String((await c.query(q)).rows[0].n);
  await c.end(); return out;
}
const r = reporter("restore");
const t0 = Date.now();
const [src, dst] = await Promise.all([snapshot(process.env.SOURCE_DATABASE_URL), snapshot(process.env.RESTORED_DATABASE_URL)]);
for (const key of Object.keys(src)) {
  await r.check(key, async () => { expect(src[key] === dst[key], `source ${src[key]} vs restored ${dst[key]}`); return src[key]; });
}
for (const k of ["orphan_quotation_items", "orphan_quotations", "orphan_assignments", "invalid_constraints"]) {
  await r.check(`restored ${k} is zero`, async () => expect(dst[`check.${k}`] === "0", dst[`check.${k}`]));
}
console.log(`compared in ${Date.now() - t0} ms; record the restore duration and recovery point in the release notes.`);
r.done();
