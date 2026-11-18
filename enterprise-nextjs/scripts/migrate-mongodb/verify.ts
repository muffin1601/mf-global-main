// Field-level reconciliation: MongoDB (read-only) vs PostgreSQL. Exits non-zero on ANY mismatch.
// Usage (rehearsal): DATABASE_URL=<isolated db> npx tsx scripts/migrate-mongodb/verify.ts
import "dotenv/config";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { MongoClient, ObjectId, type Document } from "mongodb";
import pg from "pg";
import { legacyQuotationTotals } from "./lib";

const mongoUri = process.env.LEGACY_MONGODB_URI;
const dbName = process.env.LEGACY_MONGODB_DATABASE;
const pgUrl = process.env.DATABASE_URL;
if (!mongoUri || !dbName || !pgUrl) throw new Error("Missing LEGACY_MONGODB_URI, LEGACY_MONGODB_DATABASE or DATABASE_URL");

type Check = { name: string; ok: boolean; expected?: unknown; actual?: unknown; detail?: string };
const checks: Check[] = [];
const record = (name: string, ok: boolean, expected?: unknown, actual?: unknown, detail?: string) => { checks.push({ name, ok, expected, actual, detail }); };
const eq = (name: string, expected: unknown, actual: unknown) => record(name, JSON.stringify(expected) === JSON.stringify(actual), expected, actual);
const hex = (v: unknown) => (v instanceof ObjectId ? v.toHexString() : String(v ?? ""));
const ms = (v: unknown) => (v instanceof Date ? v.getTime() : v == null ? null : new Date(v as string).getTime());
const norm = (v: unknown) => (v === undefined || v === "" ? null : v);

async function main() {
  const mongo = new MongoClient(mongoUri!, { readPreference: "secondaryPreferred", serverSelectionTimeoutMS: 15_000 });
  await mongo.connect();
  const db = mongo.db(dbName);
  const sql = new pg.Client({ connectionString: pgUrl });
  await sql.connect();
  await sql.query("SET default_transaction_read_only = on");
  const q = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => (await sql.query(text, params)).rows as T[];
  const count = async (table: string, where = "true") => Number((await q<{ n: string }>(`select count(*)::text n from ${table} where ${where}`))[0]!.n);

  // ---- 1. counts per collection -------------------------------------------------------
  const src = async (c: string) => db.collection(c).countDocuments({});
  const permSrc = await src("clientpermissions");
  const orphans = async (c: string) => count("legacy_orphan_records", `collection='${c}'`);
  eq("users", await src("users"), await count("users", "legacy_id is not null"));
  eq("categories", await src("categories"), await count("categories", "legacy_id is not null"));
  eq("clientdatas -> leads", await src("clientdatas"), await count("leads", "legacy_id is not null"));
  eq("clientpermissions (resolved + parked)", permSrc, (await count("lead_permissions", "legacy_id is not null")) + (await count("legacy_client_permissions", "not (user_resolved and client_resolved)")));
  eq("clientpermissions all preserved in legacy table", permSrc, await count("legacy_client_permissions"));
  eq("products", await src("products"), await count("products", "legacy_id is not null"));
  eq("quotations (+orphans)", await src("quotations"), (await count("quotations", "legacy_id is not null")) + (await orphans("quotations")));
  eq("vendors", await src("vendors"), await count("vendors", "legacy_id is not null"));
  eq("activitylogs", await src("activitylogs"), await count("activity_logs", "legacy_id is not null"));
  eq("visitors", await src("visitors"), await count("visitor_days", "legacy_id is not null"));
  eq("blogs", await src("blogs"), await count("blog_posts", "legacy_id is not null"));
  eq("comments (+orphans)", await src("comments"), (await count("blog_comments", "legacy_id is not null")) + (await orphans("comments")));
  eq("careerjobs", await src("careerjobs"), await count("career_jobs", "legacy_id is not null"));
  eq("careerapplications (+orphans)", await src("careerapplications"), (await count("career_applications", "legacy_id is not null")) + (await orphans("careerapplications")));
  eq("companysettings", await src("companysettings"), await count("company_settings", "legacy_id is not null"));
  eq("counters", await src("counters"), await count("legacy_counters", "legacy_id is not null"));

  // ---- 2. users, field by field --------------------------------------------------------
  const pgUsers = new Map((await q<Record<string, unknown>>("select legacy_id, user_id, name, username, email, location, role, enabled from users where legacy_id is not null")).map((r) => [String(r.legacy_id), r]));
  let userMismatch = 0;
  for await (const u of db.collection("users").find({})) {
    const r = pgUsers.get(hex(u._id));
    const want = { user_id: u.userId, name: u.name ?? u.username, username: String(u.username).toLowerCase(), email: String(u.email).toLowerCase(), location: norm(u.location), role: u.role === "admin" ? "ADMIN" : "USER", enabled: u.enabled !== false };
    const got = r && { user_id: r.user_id, name: r.name, username: r.username, email: r.email, location: r.location, role: r.role, enabled: r.enabled };
    if (JSON.stringify(want) !== JSON.stringify(got)) userMismatch++;
  }
  eq("users: field-level mismatches", 0, userMismatch);
  record("users: no password column exists in PostgreSQL", (await q("select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name ilike '%password%'")).length === 0);

  // ---- 3. leads, field by field (all rows) + assignments + timestamps ----------------
  const pgLeads = new Map((await q<Record<string, unknown>>(`select legacy_id, name, company, email, phone, contact, location, state, category, quantity::float8 quantity, requirements, remarks, data_type, call_status, status,
      (extract(epoch from follow_up_date)*1000)::float8 f0, (extract(epoch from follow_up_date_one)*1000)::float8 f1, (extract(epoch from follow_up_date_two)*1000)::float8 f2, (extract(epoch from follow_up_date_three)*1000)::float8 f3,
      inquiry_date, address, file_name, (extract(epoch from created_at)*1000)::float8 created_ms, (extract(epoch from updated_at)*1000)::float8 updated_ms, source, source_inferred, initial_status, created_by_id
      from leads where legacy_id is not null`)).map((r) => [String(r.legacy_id), r]));
  const pgAssign = new Map<string, string[]>();
  for (const r of await q<{ legacy_id: string; ulegacy: string; v: boolean; u: boolean; d: boolean }>(`select l.legacy_id, u.legacy_id ulegacy, a.can_view v, a.can_update u, a.can_delete d from lead_assignments a join leads l on l.id=a.lead_id join users u on u.id=a.user_id where l.legacy_id is not null`)) {
    const list = pgAssign.get(r.legacy_id) ?? []; list.push(`${r.ulegacy}:${+r.v}${+r.u}${+r.d}`); pgAssign.set(r.legacy_id, list);
  }
  let leadMismatch = 0, assignMismatch = 0, tsMismatch = 0; const examples: string[] = [];
  const mongoDays = new Map<string, number>();
  for await (const d of db.collection("clientdatas").find({})) {
    const id = hex(d._id); const r = pgLeads.get(id);
    if (!r) { leadMismatch++; examples.push(`missing ${id}`); continue; }
    const want = [d.name, d.company, d.email, d.phone, d.contact, d.location, d.state, d.category, d.quantity, d.requirements, d.remarks, d.datatype, d.callStatus ?? "Not Called", d.status ?? "New Lead", ms(d.followUpDate), ms(d.followUpDateOne), ms(d.followUpDateTwo), ms(d.followUpDateThree), d.inquiryDate, d.address, d.fileName].map(norm);
    const got = [r.name, r.company, r.email, r.phone, r.contact, r.location, r.state, r.category, r.quantity, r.requirements, r.remarks, r.data_type, r.call_status, r.status, r.f0, r.f1, r.f2, r.f3, r.inquiry_date, r.address, r.file_name].map(norm);
    if (JSON.stringify(want) !== JSON.stringify(got)) { leadMismatch++; if (examples.length < 5) examples.push(`${id}: ${want.map((w, i) => (w !== got[i] ? i : "")).filter(String).join(",")}`); }
    const createdWant = ms(d.createdAt) ?? (d._id as ObjectId).getTimestamp().getTime();
    if (createdWant !== r.created_ms || (ms(d.updatedAt) ?? createdWant) !== r.updated_ms) tsMismatch++;
    const aWant = (Array.isArray(d.assignedTo) ? d.assignedTo : []).map((a: Document) => `${hex(a?.user?._id)}:${+Boolean(a.permissions?.view)}${+Boolean(a.permissions?.update)}${+Boolean(a.permissions?.delete)}`).sort();
    if (JSON.stringify(aWant) !== JSON.stringify((pgAssign.get(id) ?? []).sort())) assignMismatch++;
    const day = new Date(createdWant + 330 * 60_000).toISOString().slice(0, 10); mongoDays.set(day, (mongoDays.get(day) ?? 0) + 1);
    if (!r.source || r.source_inferred !== true || r.initial_status !== null) { leadMismatch++; examples.push(`${id}: source attribution missing`); }
  }
  record("leads: field-level mismatches (all rows)", leadMismatch === 0, 0, leadMismatch, examples.join(" | "));
  eq("leads: assignment mismatches (user + view/update/delete)", 0, assignMismatch);
  eq("leads: createdAt/updatedAt exact (ms) mismatches", 0, tsMismatch);
  const pgDays = Object.fromEntries((await q<{ d: string; n: string }>(`select to_char((created_at at time zone 'UTC') at time zone 'Asia/Kolkata','YYYY-MM-DD') d, count(*)::text n from leads where legacy_id is not null group by 1 order by 1`)).map((r) => [r.d, Number(r.n)]));
  eq("leads: per-IST-day insertion counts (Mongo vs PostgreSQL)", Object.fromEntries([...mongoDays].sort()), pgDays);
  eq("leads: none dated at the epoch or at migration time", 0, await count("leads", "legacy_id is not null and (created_at < '2000-01-01' or created_at > now() - interval '1 minute')"));

  // ---- 4. products, categories, quotations ---------------------------------------------
  const catIds = new Set((await db.collection("categories").find({}).project({ _id: 1 }).toArray()).map((c) => hex(c._id)));
  const resolvable = (await db.collection("products").find({}).project({ cat_id: 1 }).toArray()).filter((p) => catIds.has(String(p.cat_id ?? ""))).length;
  eq("products: category linked for every resolvable cat_id", resolvable, await count("products", "legacy_id is not null and category_id is not null"));
  eq("products: p_price rows", await db.collection("products").countDocuments({ p_price: { $exists: true, $ne: null } }), await count("product_prices"));
  eq("products: product codes preserved", (await db.collection("products").distinct("p_code")).filter(Boolean).length, await count("products", "p_code is not null and legacy_id is not null"));
  const pgQuotes = new Map((await q<Record<string, unknown>>("select legacy_id, subtotal::float8 subtotal, tax::float8 tax, discount::float8 discount, round_off::float8 round_off, grand_total::float8 grand_total, (select count(*) from quotation_items i where i.quotation_id=quotations.id)::int items, invoice_details from quotations where legacy_id is not null")).map((r) => [String(r.legacy_id), r]));
  const merncalc = createRequire(import.meta.url)("../../../backend/utils/quotationCalc.js") as { calculateQuotationTotals: (i: unknown[], s: unknown) => { subtotal: number; totalTax: number; totalDiscount: number; roundOff: number; grandTotal: number } };
  let quoteMismatch = 0, itemMismatch = 0, invoiceMismatch = 0;
  for await (const d of db.collection("quotations").find({})) {
    const r = pgQuotes.get(hex(d._id)); if (!r) continue; // parked as orphan: counted above
    const o = merncalc.calculateQuotationTotals(d.items ?? [], d.summary ?? {});
    if ([o.subtotal, o.totalTax, o.totalDiscount, o.roundOff, o.grandTotal].join() !== [r.subtotal, r.tax, r.discount, r.round_off, r.grand_total].join()) quoteMismatch++;
    if ((d.items ?? []).length !== r.items) itemMismatch++;
    const inv = r.invoice_details as Document; if (String(inv?.number ?? "") !== String(d.invoiceDetails?.number ?? "") || String(inv?.prefix ?? "") !== String(d.invoiceDetails?.prefix ?? "")) invoiceMismatch++;
  }
  eq("quotations: totals vs the MERN calculator (mismatches)", 0, quoteMismatch);
  eq("quotations: line-item counts (mismatches)", 0, itemMismatch);
  eq("quotations: invoice numbers preserved (mismatches)", 0, invoiceMismatch);

  // ---- 5. activity logs, vendors, referential integrity ---------------------------------
  eq("activity logs: actor identity kept for every row", 0, await count("activity_logs", "legacy_id is not null and actor_user_code is null and user_id is null and actor_name is null"));
  eq("vendors: legacy documents preserved", await src("vendors"), await count("vendors", "legacy_data is not null"));
  eq("referential integrity: lead_assignments without lead/user", 0, await count("lead_assignments a", "not exists (select 1 from leads l where l.id=a.lead_id) or not exists (select 1 from users u where u.id=a.user_id)"));
  eq("referential integrity: duplicate legacy ids in leads", 0, (await q("select legacy_id from leads where legacy_id is not null group by 1 having count(*)>1")).length);
  eq("migration checkpoints: no failed rows", 0, await count("migration_checkpoints", "status not in ('completed','exception')"));

  // ---- report --------------------------------------------------------------------------
  const failed = checks.filter((c) => !c.ok);
  const out = resolve(process.env.MIGRATION_REPORT_DIR ?? "./migration-reports", `verification-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await mkdir(resolve(out, ".."), { recursive: true });
  await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), target: new URL(pgUrl!).hostname, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));
  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.ok ? "" : `  expected=${JSON.stringify(c.expected)} actual=${JSON.stringify(c.actual)} ${c.detail ?? ""}`}`);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed -> ${out}`);
  void legacyQuotationTotals;
  await sql.end(); await mongo.close();
  if (failed.length) process.exitCode = 1;
}
main().catch((e) => { console.error("verify failed:", String(e?.message ?? e).replace(/\/\/[^@\s]*@/g, "//***@")); process.exit(2); });
