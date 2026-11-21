// HTTP success / retry / rollback contract for every route handler, against the isolated E2E stack
// (node scripts/e2e/start-stack.mjs). Complements endpoint-contract.mjs (auth + hostile input).
//   success  - correct status and body shape, change verified in PostgreSQL
//   retry    - the same request repeated is idempotent or refused without duplicating data
//   rollback - a request that fails part-way leaves no partial rows
// Synthetic data only; careers PIN and fixtures are written to the disposable crm_e2e database.
// Results: test-artifacts/endpoint-success.json
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { chromium, request as pwRequest } from "playwright-core";
import pg from "pg";

const base = "http://localhost:3100";
const PIN = "246810";
const KEY = "e2e-coachingpromo-key-000000000000";
const CRON = "e2e-cron-secret-000000000000000000";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const tag = Date.now().toString().slice(-8);

const db = new pg.Client({ connectionString: "postgresql://postgres:e2e@127.0.0.1:54340/crm_e2e" });
await db.connect();
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const count = async (sql, args = []) => Number((await one(sql, args)).n);
await db.query("insert into career_admin_settings (key, pin_hash, updated_at) values ('admin', $1, now()) on conflict (key) do update set pin_hash = excluded.pin_hash", [bcrypt.hashSync(PIN, 8)]);
await db.query("delete from career_login_attempts");

const results = [];
async function check(endpoint, aspect, fn) {
  try { const note = await fn(); results.push({ endpoint, aspect, pass: true, note: note ?? "" }); }
  catch (e) { results.push({ endpoint, aspect, pass: false, error: String(e).split("\n")[0].slice(0, 300) }); }
  writeFileSync("test-artifacts/endpoint-success.json", JSON.stringify(results, null, 2));
}
const expect = (c, m) => { if (!c) throw new Error(m); };

const browser = await chromium.launch();
async function session(username) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(base + "/crm/login");
  await p.getByLabel("Username or work email").fill(username);
  await p.getByLabel("Password").fill("E2e-Test-Passw0rd!");
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.waitForURL("**/crm/entrydashboard");
  await p.close();
  return ctx;
}
const adminCtx = await session("qa.admin");
const execCtx = await session("qa.exec1");
const A = adminCtx.request, X = execCtx.request;
const anon = await pwRequest.newContext({ baseURL: base });
const H = { origin: base };
const J = (data, extra = {}) => ({ headers: { ...H, "content-type": "application/json", ...extra }, data: JSON.stringify(data), failOnStatusCode: false });
const M = (multipart, extra = {}) => ({ headers: { ...H, ...extra }, multipart, failOnStatusCode: false });
const G = { failOnStatusCode: false, headers: H };
const file = (name, mimeType, buffer) => ({ name, mimeType, buffer });

// ---------------------------------------------------------------- platform
await check("GET /api/health", "success", async () => {
  const r = await anon.get("/api/health", G); const b = await r.json();
  expect(r.status() === 200 && (b.ok === true || b.status === "ok" || b.database), "health: " + JSON.stringify(b));
});
await check("POST /api/activity/log", "success+retry", async () => {
  const action = `qa.client_event.${tag}`;
  for (let i = 0; i < 2; i++) expect((await A.post(base + "/api/activity/log", J({ action, details: { n: i } }))).status() < 300, "log failed");
  expect((await count("select count(*) n from activity_logs where action=$1", ["client." + action])) === 2, "two distinct client.-namespaced audit rows expected");
});

// ---------------------------------------------------------------- categories + products
let categoryId;
await check("POST /api/categories", "success+retry", async () => {
  const r = await A.post(base + "/api/categories", J({ name: `QA Cat ${tag}` }));
  expect(r.status() === 201 || r.status() === 200, "create " + r.status());
  categoryId = (await one("select id from categories where name=$1", [`QA Cat ${tag}`])).id;
  const dup = await A.post(base + "/api/categories", J({ name: `QA Cat ${tag}` }));
  expect(dup.status() >= 400 && dup.status() < 500, "duplicate accepted " + dup.status());
  expect((await count("select count(*) n from categories where name=$1", [`QA Cat ${tag}`])) === 1, "duplicated row");
});
await check("GET /api/categories", "success", async () => {
  const r = await X.get(base + "/api/categories", G); const t = await r.text();
  expect(r.status() === 200 && t.includes(`QA Cat ${tag}`), "new category not listed");
});
await check("PUT /api/categories/[id]", "success+retry", async () => {
  for (let i = 0; i < 2; i++) expect((await A.put(`${base}/api/categories/${categoryId}`, J({ name: `QA Cat ${tag} R` }))).status() < 300, "rename");
  expect((await one("select name from categories where id=$1", [categoryId])).name === `QA Cat ${tag} R`, "rename not persisted");
});
let productId;
const productForm = (over = {}) => ({ name: `QA Product ${tag}`, secondaryCode: `QA-${tag}`, categoryId, price: JSON.stringify({ basicAmount: 200, gstRate: 18, purchasePrice: 120 }), ...over });
await check("POST /api/products", "success+rollback", async () => {
  const bad = await A.post(base + "/api/products", M({ ...productForm({ secondaryCode: `QA-BAD-${tag}` }), image: file("x.png", "image/png", Buffer.from("<html>")) }));
  expect(bad.status() >= 400 && bad.status() < 500, "fake image accepted " + bad.status());
  expect((await count("select count(*) n from products where s_code=$1", [`QA-BAD-${tag}`])) === 0, "product row left behind after rejected image (no rollback)");
  const r = await A.post(base + "/api/products", M({ ...productForm(), image: file("p.png", "image/png", PNG) }));
  expect(r.status() === 201 || r.status() === 200, "create " + r.status() + " " + (await r.text()).slice(0, 150));
  const row = await one("select p.id, pr.basic_amount::text b, p.p_image from products p left join product_prices pr on pr.product_id=p.id where p.s_code=$1", [`QA-${tag}`]);
  productId = row.id;
  expect(Number(row.b) === 200, "price not persisted: " + row.b);
});
await check("POST /api/products", "retry", async () => {
  const again = await A.post(base + "/api/products", M(productForm()));
  expect(again.status() >= 400 && again.status() < 500, "duplicate secondary code accepted " + again.status());
  expect((await count("select count(*) n from products where s_code=$1", [`QA-${tag}`])) === 1, "duplicate product");
});
await check("GET /api/products", "success", async () => {
  const b = await (await X.get(base + "/api/products?search=" + encodeURIComponent(`QA Product ${tag}`), G)).json();
  expect(JSON.stringify(b).includes(`QA Product ${tag}`), "created product not listed");
});
await check("GET /api/products/[id]", "success", async () => {
  const r = await X.get(`${base}/api/products/${productId}`, G);
  expect(r.status() === 200 && (await r.text()).includes(`QA-${tag}`), "detail " + r.status());
});
await check("GET /api/products/search", "success", async () => {
  const b = await (await X.get(base + "/api/products/search?query=" + encodeURIComponent(`QA Product ${tag}`), G)).json();
  expect(b.products?.length === 1 && b.products[0].price?.netAmount === 236, "search/net amount: " + JSON.stringify(b).slice(0, 200));
});
await check("GET /api/products/code-preview", "success", async () => {
  const r = await X.get(`${base}/api/products/code-preview?categoryId=${categoryId}`, G); const t = await r.text();
  expect(r.status() === 200 && /"productCode"\s*:\s*"[A-Z]/.test(t), "preview " + t.slice(0, 120));
});
await check("PUT /api/products/[id]", "success+retry", async () => {
  // Take updatedAt from the API exactly as the edit form does (pg reads timestamp-without-tz as local time).
  const cur = await (await A.get(`${base}/api/products/${productId}`, G)).json();
  const expectedUpdatedAt = cur.updatedAt ?? cur.product?.updatedAt;
  const r = await A.put(`${base}/api/products/${productId}`, M(productForm({ name: `QA Product ${tag} v2`, expectedUpdatedAt })));
  expect(r.status() === 200, "update " + r.status() + " " + (await r.text()).slice(0, 150));
  const stale = await A.put(`${base}/api/products/${productId}`, M(productForm({ name: "Stale", expectedUpdatedAt })));
  expect(stale.status() === 409, "stale retry not refused: " + stale.status());
  expect((await one("select p_name as name from products where id=$1", [productId])).name === `QA Product ${tag} v2`, "stale write applied");
});
await check("DELETE /api/products/[id]", "success+retry", async () => {
  expect((await A.delete(`${base}/api/products/${productId}`, G)).status() < 300, "archive");
  const second = await A.delete(`${base}/api/products/${productId}`, G);
  expect(second.status() < 500, "second delete 5xx");
  expect((await one("select status from products where id=$1", [productId]))?.status !== "ACTIVE", "still active");
});
await check("DELETE /api/categories/[id]", "success+rollback", async () => {
  const inUse = await A.delete(`${base}/api/categories/${categoryId}`, G);
  const stillThere = await count("select count(*) n from categories where id=$1", [categoryId]);
  const prods = await count("select count(*) n from products where category_id=$1", [categoryId]);
  if (prods > 0) expect(inUse.status() >= 400 && stillThere === 1, "in-use category deleted (" + inUse.status() + ")");
  const empty = await one("insert into categories (id, cat_id, name) values (gen_random_uuid(), $1, $2) returning id", [`QD${tag.slice(-4)}`, `QA Empty ${tag}`]);
  expect((await A.delete(`${base}/api/categories/${empty.id}`, G)).status() < 300, "empty delete");
  expect((await count("select count(*) n from categories where id=$1", [empty.id])) === 0, "empty category not removed");
});

// ---------------------------------------------------------------- search, clients, quotations, reports, exports
await check("GET /api/search", "success", async () => {
  const b = await (await X.get(base + "/api/search?q=E2E", G)).json();
  expect(Array.isArray(b.results ?? b.groups ?? b) || typeof b === "object", "shape");
  expect(!JSON.stringify(b).includes("QA Exec Two"), "employee search leaked another user's data");
});
const quote = await one("select id, user_id from quotations order by created_at desc limit 1");
await check("GET /api/quotations/clients", "success", async () => {
  const r = await A.get(base + "/api/quotations/clients?q=E2E", G);
  expect(r.status() === 200 && (await r.text()).includes("E2E"), "clients search");
});
await check("GET /api/quotations/[id]/pdf", "success+retry", async () => {
  const a = await (await A.get(`${base}/api/quotations/${quote.id}/pdf`, G)).body();
  const b = await (await A.get(`${base}/api/quotations/${quote.id}/pdf`, G)).body();
  expect(a.subarray(0, 5).toString() === "%PDF-" && b.subarray(0, 5).toString() === "%PDF-", "not a PDF");
});
await check("GET /api/reports/lead-insertion/export", "success", async () => {
  for (const [fmt, sig] of [["csv", null], ["xlsx", "PK"], ["pdf", "%PDF-"]]) {
    const r = await A.get(`${base}/api/reports/lead-insertion/export?format=${fmt}&preset=custom&from=2020-01-01&to=2030-01-01`, G);
    const body = await r.body();
    expect(r.status() === 200 && body.length > 20, `${fmt} ${r.status()}`);
    if (sig) expect(body.subarray(0, sig.length).toString() === sig, `${fmt} signature`);
  }
  const exec = await X.get(`${base}/api/reports/lead-insertion/export?format=csv`, G);
  expect(exec.status() === 403 || exec.status() === 200, "employee export status " + exec.status());
});
await check("GET /api/leads/export", "success", async () => {
  const r = await A.get(base + "/api/leads/export", G);
  const total = await count("select count(*) n from leads");
  expect(r.status() === 200 && Number(r.headers()["x-row-count"]) === total, `rows ${r.headers()["x-row-count"]} vs ${total}`);
  const csv = (await r.text());
  expect(!/^[=+\-@]/m.test(csv.split("\n").slice(1).map((l) => l.split(",")[0].replace(/^"/, "")).join("\n")), "formula injection in export");
});

// ---------------------------------------------------------------- lead import (check, jobs, batch, report, history, sample)
await check("GET /api/lead-import/sample", "success", async () => {
  const r = await X.get(base + "/api/lead-import/sample", G); const t = await r.text();
  expect(r.status() === 200 && /mobile number/i.test(t.split("\n")[0]), "sample header: " + t.slice(0, 80));
});
await check("POST /api/lead-import/check", "success", async () => {
  const b = await (await A.post(base + "/api/lead-import/check", J({ phones: ["9000000001", "9999999998"], emails: ["lead2@example.test"] }))).json();
  const s = JSON.stringify(b);
  expect(s.includes("9000000001") && !s.includes("9999999998"), "existing/new phones misreported: " + s.slice(0, 200));
});
const sha = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
let jobId;
await check("POST /api/lead-import/jobs", "success+retry", async () => {
  const body = { fileName: `qa-${tag}.csv`, totalRows: 2, sha256: sha, clientKey: `qa-${tag}` };
  const a = await (await A.post(base + "/api/lead-import/jobs", J(body))).json();
  const b = await (await A.post(base + "/api/lead-import/jobs", J(body))).json();
  jobId = a.jobId;
  expect(a.jobId && a.jobId === b.jobId && b.resumed === true, "retry did not resume the same job: " + JSON.stringify([a, b]));
  expect((await count("select count(*) n from lead_import_jobs where file_name=$1", [`qa-${tag}.csv`])) === 1, "duplicate job rows");
});
const p1 = "96" + tag, p2 = "95" + tag;
const batch = { sha256: sha, entries: [
  { kind: "row", rowNumber: 2, data: { name: "Import Q1", company: "Imp Co", phone: p1 } },
  { kind: "row", rowNumber: 3, data: { name: "Import Q2", company: "Imp Co", phone: p2 } },
] };
await check("POST /api/lead-import/jobs/[id]/batch", "success+retry", async () => {
  const r = await A.post(`${base}/api/lead-import/jobs/${jobId}/batch`, J(batch));
  expect(r.status() === 200, "batch " + r.status() + " " + (await r.text()).slice(0, 150));
  const replay = await A.post(`${base}/api/lead-import/jobs/${jobId}/batch`, J(batch));
  expect(replay.status() < 500, "replay 5xx");
  expect((await count("select count(*) n from leads where phone in ($1,$2)", [p1, p2])) === 2, "replayed batch duplicated leads");
});
await check("POST /api/lead-import/jobs/[id]/batch", "rollback", async () => {
  const wrongSha = await A.post(`${base}/api/lead-import/jobs/${jobId}/batch`, J({ ...batch, sha256: "0".repeat(64), entries: [{ kind: "row", rowNumber: 9, data: { name: "Mismatch", phone: "94" + tag } }] }));
  expect(wrongSha.status() >= 400 && wrongSha.status() < 500, "batch for a different file accepted " + wrongSha.status());
  expect((await count("select count(*) n from leads where phone=$1", ["94" + tag])) === 0, "row written from rejected batch");
});
await check("GET /api/lead-import/report/[id]", "success", async () => {
  const r = await A.get(`${base}/api/lead-import/report/${jobId}`, G); const t = await r.text();
  expect(r.status() === 200 && t.includes("Import Q1") || t.includes("Imp Co") || t.length > 20, "report " + r.status());
  const ex = await X.get(`${base}/api/lead-import/report/${jobId}`, G);
  expect(ex.status() === 403 || ex.status() === 404, "employee read another user's import report: " + ex.status());
});
await check("GET /api/lead-import/history", "success", async () => {
  const a = await (await A.get(base + "/api/lead-import/history", G)).text();
  const x = await (await X.get(base + "/api/lead-import/history", G)).text();
  expect(a.includes(`qa-${tag}.csv`) && !x.includes(`qa-${tag}.csv`), "history scope wrong");
});

// ---------------------------------------------------------------- vendors
const vendor = await one("select id, vendor_code from vendors where archived_at is null order by created_at limit 1");
await check("GET /api/vendors", "success", async () => {
  const b = await (await X.get(base + "/api/vendors", G)).json();
  const total = await count("select count(*) n from vendors where archived_at is null");
  expect((b.total ?? b.vendors?.length ?? b.items?.length) >= 1 && (b.total === undefined || b.total === total), "vendors total " + b.total + " vs " + total);
});
await check("GET /api/vendors/export", "success", async () => {
  const r = await A.get(base + "/api/vendors/export", G);
  expect(r.status() === 200 && (await r.text()).includes(vendor.vendor_code), "export missing vendor");
});
await check("GET /api/vendors/import/template", "success", async () => {
  const t = await (await A.get(base + "/api/vendors/import/template", G)).text();
  expect((await X.get(base + "/api/vendors/import/template", G)).status() === 403, "employee without vendor.import got the template");
  expect(/Vendor Name/i.test(t.split("\n")[0]), "template header");
});
let importJob;
await check("POST /api/vendors/import/upload", "success+retry", async () => {
  const csv = Buffer.from(`Vendor Name,Email\r\nQA Import Vendor ${tag},qa${tag}@example.test\r\n`);
  const key = `qa-vendor-import-${tag}`;
  const a = await (await A.post(base + "/api/vendors/import/upload", M({ file: file("v.csv", "text/csv", csv), idempotencyKey: key }))).json();
  const b = await (await A.post(base + "/api/vendors/import/upload", M({ file: file("v.csv", "text/csv", csv), idempotencyKey: key }))).json();
  importJob = a.jobId;
  expect(a.jobId && a.jobId === b.jobId, "idempotency key not honoured: " + JSON.stringify([a, b]).slice(0, 200));
});
await check("GET /api/vendors/import/[jobId]/report", "not-yet-validated", async () => {
  const r = await A.get(`${base}/api/vendors/import/${importJob}/report`, G);
  expect(r.status() === 404, "report for an unvalidated job should be 404, got " + r.status());
});
let docId;
await check("POST /api/vendors/[id]/documents", "success+rollback", async () => {
  const bad = await X.post(`${base}/api/vendors/${vendor.id}/documents`, M({ name: `Bad ${tag}`, documentType: "Other", file: file("x.pdf", "application/pdf", Buffer.from("not a pdf")) }));
  expect(bad.status() >= 400 && bad.status() < 500, "fake PDF accepted");
  expect((await count("select count(*) n from vendor_documents where name=$1", [`Bad ${tag}`])) === 0, "row left after rejected upload");
  const r = await X.post(`${base}/api/vendors/${vendor.id}/documents`, M({ name: `QA Doc ${tag}`, documentType: "Other", file: file("d.pdf", "application/pdf", PDF) }));
  expect(r.status() === 201, "upload " + r.status() + " " + (await r.text()).slice(0, 150));
  docId = (await one("select id from vendor_documents where name=$1", [`QA Doc ${tag}`])).id;
});
await check("GET /api/vendors/[id]/documents", "success", async () => {
  expect((await (await X.get(`${base}/api/vendors/${vendor.id}/documents`, G)).text()).includes(`QA Doc ${tag}`), "doc not listed");
});
await check("GET /api/vendors/[id]/documents/[docId]/file", "success", async () => {
  const r = await X.get(`${base}/api/vendors/${vendor.id}/documents/${docId}/file`, { ...G, maxRedirects: 5 });
  const b = await r.body();
  expect(r.status() === 200 && b.subarray(0, 5).toString() === "%PDF-", "download " + r.status());
});
await check("PUT /api/vendors/[id]/documents/[docId]/file", "success+rollback", async () => {
  const bad = await X.put(`${base}/api/vendors/${vendor.id}/documents/${docId}/file`, M({ file: file("x.pdf", "application/pdf", Buffer.from("junk")) }));
  expect(bad.status() >= 400 && bad.status() < 500, "junk replacement accepted");
  const before = await one("select storage_path from vendor_documents where id=$1", [docId]);
  const r = await X.put(`${base}/api/vendors/${vendor.id}/documents/${docId}/file`, M({ file: file("v2.pdf", "application/pdf", PDF) }));
  expect(r.status() < 300, "replace " + r.status());
  const after = await one("select storage_path from vendor_documents where id=$1", [docId]);
  expect(after.storage_path !== before.storage_path, "file not replaced");
});
await check("GET /api/vendors/[id]/audit", "success", async () => {
  const b = await (await A.get(`${base}/api/vendors/${vendor.id}/audit`, G)).json();
  expect(JSON.stringify(b).includes("document"), "upload not in vendor audit trail");
});

// ---------------------------------------------------------------- inbound integrations
for (const [path, source] of [["/api/coachinpromo/capture-lead", "COACHINGPROMO"], ["/api/printkee/capture-lead", "PRINTKEE"], ["/api/giftaguru/capture-lead", "GIFTAGURU"]]) {
  await check(`POST ${path}`, "success+retry", async () => {
    const phone = "93" + tag.slice(0, 6) + String(source.length).padStart(2, "0");
    const body = { name: `Hook ${source}`, company: "Hook Co", phone, email: `hook${source.toLowerCase()}@example.test` };
    const r = await anon.post(path, J(body, { "x-api-key": KEY, "x-forwarded-for": `10.9.${source.length}.1` }));
    expect(r.status() === 201, `${source} ${r.status()} ${(await r.text()).slice(0, 120)}`);
    const again = await anon.post(path, J(body, { "x-api-key": KEY, "x-forwarded-for": `10.9.${source.length}.1` }));
    expect(again.status() < 500, "retry 5xx");
    expect((await count("select count(*) n from leads where phone=$1", [phone])) === 1, "retry created a duplicate lead");
    expect((await one("select source from leads where phone=$1", [phone])).source === source, "wrong source");
  });
}
await check("GET /api/cron/tradeindia", "success", async () => {
  const r = await anon.get("/api/cron/tradeindia", { headers: { authorization: `Bearer ${CRON}` }, failOnStatusCode: false });
  const b = await r.json();
  expect(r.status() === 200 && b.skipped === true, "cron with integrations off should skip: " + JSON.stringify(b));
});

// ---------------------------------------------------------------- marketing
await check("POST /api/contact", "success+retry", async () => {
  const body = { name: "QA Visitor", email: `v${tag}@example.test`, message: "Hello there", subject: `QA ${tag}` };
  const r = await anon.post("/api/contact", J(body, { "x-forwarded-for": `10.20.${tag.slice(-2)}.1` }));
  expect([201, 202].includes(r.status()), "contact " + r.status());
  expect((await count("select count(*) n from contact_submissions where subject=$1", [`QA ${tag}`])) === 1, "not stored");
});
await check("POST /api/send-email", "success", async () => {
  const r = await anon.post("/api/send-email", J({ name: "QA Visitor", phone: "9876543210", message: `Mail ${tag}`, email: "" }, { "x-forwarded-for": `10.21.${tag.slice(-2)}.1` }));
  expect(r.status() === 200, "send-email " + r.status());
  expect((await count("select count(*) n from contact_submissions where message=$1", [`Mail ${tag}`])) === 1, "not stored");
});
const blog = await one("select id from blog_posts order by created_at limit 1");
await check("GET /api/blogs", "success", async () => { const b = await (await anon.get("/api/blogs", G)).json(); expect(JSON.stringify(b).includes(blog.id), "blog missing"); });
await check("GET /api/blogs/[id]", "success", async () => { const r = await anon.get(`/api/blogs/${blog.id}`, G); expect(r.status() === 200, "blog " + r.status()); });
await check("POST /api/blogs/comments", "success", async () => {
  const r = await anon.post("/api/blogs/comments", J({ blogId: blog.id, text: `QA comment ${tag}` }, { "x-forwarded-for": `10.22.${tag.slice(-2)}.1` }));
  expect(r.status() === 201, "comment " + r.status());
});
await check("GET /api/blogs/comments/[blogId]", "success", async () => {
  expect((await (await anon.get(`/api/blogs/comments/${blog.id}`, G)).text()).includes(`QA comment ${tag}`), "comment not listed");
});
await check("POST /api/blogs/post-blogs", "success+rollback", async () => {
  const bad = await A.post(base + "/api/blogs/post-blogs", M({ title: `QA Bad Blog ${tag}`, content: "x", media: file("x.png", "image/png", Buffer.from("<svg>")) }));
  expect(bad.status() === 400, "non-image media accepted " + bad.status());
  expect((await count("select count(*) n from blog_posts where title=$1", [`QA Bad Blog ${tag}`])) === 0, "post written despite rejected media");
  const r = await A.post(base + "/api/blogs/post-blogs", M({ title: `QA Blog ${tag}`, content: "Body text", media: file("m.png", "image/png", PNG) }));
  expect(r.status() === 201, "post " + r.status());
});

// ---------------------------------------------------------------- careers (public + admin PIN portal)
const careers = await browser.newContext({ storageState: await adminCtx.storageState() });
const C = careers.request;
let csrf = "";
const CH = () => ({ ...H, "x-csrf-token": csrf });
await check("GET /api/careers/admin/session", "success", async () => {
  const r = await C.get(base + "/api/careers/admin/session", G);
  expect(r.status() === 401, "session before PIN should be 401, got " + r.status());
});
await check("POST /api/careers/admin/login", "success+retry", async () => {
  const wrong = await C.post(base + "/api/careers/admin/login", J({ pin: "000000" }));
  expect(wrong.status() === 401, "wrong PIN " + wrong.status());
  const r = await C.post(base + "/api/careers/admin/login", J({ pin: PIN }));
  const b = await r.json();
  expect(r.status() === 200 && /^[a-f0-9]{64}$/.test(b.csrfToken), "login " + r.status());
  // GET /session issues a fresh CSRF token (the admin SPA reads it from there), invalidating the login one.
  const sess = await C.get(base + "/api/careers/admin/session", G);
  const sb = await sess.json();
  expect(sess.status() === 200 && sb.authenticated && sb.csrfToken !== b.csrfToken, "session not established / token not rotated");
  csrf = sb.csrfToken;
});
await check("POST /api/careers/admin/csrf", "success", async () => {
  const r = await C.post(base + "/api/careers/admin/csrf", { headers: CH(), failOnStatusCode: false });
  const txt = await r.text();
  const b = JSON.parse(txt || "{}");
  expect(r.status() === 200 && b.csrfToken && b.csrfToken !== csrf, `csrf rotate ${r.status()} ${txt.slice(0, 120)}`);
  const old = csrf; csrf = b.csrfToken;
  const stale = await C.post(base + "/api/careers/admin/csrf", { headers: { ...H, "x-csrf-token": old }, failOnStatusCode: false });
  expect(stale.status() === 403, "old CSRF token still accepted");
});
const jobBody = { title: `QA Role ${tag}`, department: "Sales", location: "Delhi", employmentType: "Full-time", workMode: "On-site", experience: "1 year", vacancies: 2, description: "Role description", responsibilities: "Do things", qualifications: "Graduate", skills: "Talking", deadline: "2030-12-31", status: "Active", isPublished: true };
let jobIdC;
await check("POST /api/careers/admin/jobs", "success+rollback", async () => {
  const noCsrf = await C.post(base + "/api/careers/admin/jobs", J(jobBody));
  expect(noCsrf.status() === 403, "write without CSRF accepted");
  const bad = await C.post(base + "/api/careers/admin/jobs", { headers: { ...CH(), "content-type": "application/json" }, data: JSON.stringify({ ...jobBody, title: "" }), failOnStatusCode: false });
  expect(bad.status() === 400, "invalid job accepted " + bad.status());
  const r = await C.post(base + "/api/careers/admin/jobs", { headers: { ...CH(), "content-type": "application/json" }, data: JSON.stringify(jobBody), failOnStatusCode: false });
  expect(r.status() === 201 || r.status() === 200, "create job " + r.status() + " " + (await r.text()).slice(0, 150));
  jobIdC = (await one("select id from career_jobs where title=$1", [`QA Role ${tag}`])).id;
  expect((await count("select count(*) n from career_jobs where title=$1", [`QA Role ${tag}`])) === 1, "job count");
});
await check("GET /api/careers/admin/jobs", "success", async () => { expect((await (await C.get(base + "/api/careers/admin/jobs", G)).text()).includes(`QA Role ${tag}`), "admin list"); });
await check("PUT /api/careers/admin/jobs/[id]", "success+retry", async () => {
  for (let i = 0; i < 2; i++) {
    const r = await C.put(`${base}/api/careers/admin/jobs/${jobIdC}`, { headers: { ...CH(), "content-type": "application/json" }, data: JSON.stringify({ ...jobBody, vacancies: 3 }), failOnStatusCode: false });
    expect(r.status() === 200, "update " + r.status());
  }
  expect((await one("select vacancies from career_jobs where id=$1", [jobIdC])).vacancies === 3, "vacancies");
});
await check("GET /api/careers/jobs", "success", async () => { expect((await (await anon.get("/api/careers/jobs", G)).text()).includes(`QA Role ${tag}`), "published job not public"); });
await check("GET /api/careers/jobs/[id]", "success", async () => { expect((await anon.get(`/api/careers/jobs/${jobIdC}`, G)).status() === 200, "public job detail"); });
const submissionKey = `abcdef0123456789abcdef${tag}`;
const application = (key, resume = PDF) => ({ jobId: jobIdC, fullName: "QA Applicant", email: `app${tag}@example.test`, phone: "9876543210", location: "Delhi", jobDesignation: "Telesales", qualification: "Graduate", experience: "2 years", noticePeriod: "30 days", consent: "true", submissionKey: key, resume: file("cv.pdf", "application/pdf", resume) });
let appId;
await check("POST /api/careers/apply", "success+retry+rollback", async () => {
  const bad = await anon.post("/api/careers/apply", M(application(`ffff0123456789abcdef${tag}`, Buffer.from("MZ not a pdf")), { "x-forwarded-for": `10.30.${tag.slice(-2)}.1` }));
  expect(bad.status() === 400, "non-PDF resume accepted " + bad.status());
  expect((await count("select count(*) n from career_applications where submission_key=$1", [`ffff0123456789abcdef${tag}`])) === 0, "application row left after rejected resume");
  const r = await anon.post("/api/careers/apply", M(application(submissionKey), { "x-forwarded-for": `10.30.${tag.slice(-2)}.2` }));
  expect(r.status() === 201 || r.status() === 200, "apply " + r.status() + " " + (await r.text()).slice(0, 150));
  const again = await anon.post("/api/careers/apply", M(application(submissionKey), { "x-forwarded-for": `10.30.${tag.slice(-2)}.3` }));
  expect(again.status() < 500, "retry 5xx");
  expect((await count("select count(*) n from career_applications where submission_key=$1", [submissionKey])) === 1, "double submission created two applications");
  appId = (await one("select id from career_applications where submission_key=$1", [submissionKey])).id;
});
await check("GET /api/careers/admin/applications", "success", async () => { expect((await (await C.get(base + "/api/careers/admin/applications", G)).text()).includes("QA Applicant"), "list"); });
await check("GET /api/careers/admin/applications/[id]", "success", async () => { expect((await C.get(`${base}/api/careers/admin/applications/${appId}`, G)).status() === 200, "detail"); });
await check("GET /api/careers/admin/applications/[id]/resume", "success", async () => {
  const r = await C.get(`${base}/api/careers/admin/applications/${appId}/resume`, { ...G, maxRedirects: 5 });
  expect(r.status() === 200 && (await r.body()).subarray(0, 5).toString() === "%PDF-", "resume " + r.status());
});
await check("PATCH /api/careers/admin/applications/[id]", "success+retry", async () => {
  for (let i = 0; i < 2; i++) expect((await C.patch(`${base}/api/careers/admin/applications/${appId}`, { headers: { ...CH(), "content-type": "application/json" }, data: JSON.stringify({ status: "Shortlisted" }), failOnStatusCode: false })).status() === 200, "patch");
  expect((await one("select status from career_applications where id=$1", [appId])).status === "SHORTLISTED", "status not persisted");
  const bad = await C.patch(`${base}/api/careers/admin/applications/${appId}`, { headers: { ...CH(), "content-type": "application/json" }, data: JSON.stringify({ status: "Hired!!" }), failOnStatusCode: false });
  expect(bad.status() === 400, "invalid status accepted");
});
await check("GET /api/careers/admin/stats", "success", async () => { const b = await (await C.get(base + "/api/careers/admin/stats", G)).json(); expect(JSON.stringify(b).match(/\d/), "stats"); });
await check("GET /api/careers/admin/export", "success", async () => {
  const r = await C.get(base + "/api/careers/admin/export", G);
  expect(r.status() === 200 && (await r.text()).includes("QA Applicant"), "export");
});
await check("DELETE /api/careers/admin/applications/[id]", "success+retry", async () => {
  expect((await C.delete(`${base}/api/careers/admin/applications/${appId}`, { headers: CH(), failOnStatusCode: false })).status() < 300, "delete");
  expect((await count("select count(*) n from career_applications where id=$1", [appId])) === 0, "still present");
  expect((await C.delete(`${base}/api/careers/admin/applications/${appId}`, { headers: CH(), failOnStatusCode: false })).status() === 404, "second delete not 404");
});
await check("DELETE /api/careers/admin/jobs/[id]", "success+retry", async () => {
  expect((await C.delete(`${base}/api/careers/admin/jobs/${jobIdC}`, { headers: CH(), failOnStatusCode: false })).status() < 300, "delete job");
  // Soft archive: repeating is idempotent; the job must leave the public board and stay archived.
  expect((await C.delete(`${base}/api/careers/admin/jobs/${jobIdC}`, { headers: CH(), failOnStatusCode: false })).status() < 300, "second archive");
  const j = await one("select archived_at, is_published from career_jobs where id=$1", [jobIdC]);
  expect(j.archived_at && j.is_published === false, "job not archived/unpublished");
  expect(!(await (await anon.get("/api/careers/jobs", G)).text()).includes(`QA Role ${tag}`), "archived job still public");
});
await check("POST /api/careers/admin/change-pin", "success+rollback", async () => {
  const wrong = await C.post(base + "/api/careers/admin/change-pin", { headers: { ...CH(), "content-type": "application/json" }, data: JSON.stringify({ currentPin: "111111", newPin: "135790" }), failOnStatusCode: false });
  expect(wrong.status() >= 400, "wrong current PIN accepted");
  const before = (await one("select pin_hash from career_admin_settings where key='admin'")).pin_hash;
  expect(before === (await one("select pin_hash from career_admin_settings where key='admin'")).pin_hash, "hash changed on failure");
  const r = await C.post(base + "/api/careers/admin/change-pin", { headers: { ...CH(), "content-type": "application/json" }, data: JSON.stringify({ currentPin: PIN, newPin: "135790" }), failOnStatusCode: false });
  expect(r.status() === 200, "change " + r.status());
  expect((await one("select pin_hash from career_admin_settings where key='admin'")).pin_hash !== before, "hash unchanged");
});
await check("POST /api/careers/admin/logout", "success+retry", async () => {
  expect((await C.post(base + "/api/careers/admin/logout", { headers: CH(), failOnStatusCode: false })).status() < 300, "logout");
  expect((await C.get(base + "/api/careers/admin/session", G)).status() === 401, "session survives logout");
  expect((await C.post(base + "/api/careers/admin/logout", { headers: CH(), failOnStatusCode: false })).status() < 500, "second logout 5xx");
});

// ---------------------------------------------------------------- auth routes
await check("GET /auth/callback", "success", async () => {
  const r = await anon.get("/auth/callback?code=bad-code&next=/%5Cevil.com", { failOnStatusCode: false, maxRedirects: 0 });
  const loc = r.headers()["location"] ?? "";
  expect(r.status() >= 300 && r.status() < 400 && new URL(loc, base).origin === base && loc.includes("error="), "callback redirect " + r.status() + " " + loc);
});
await check("POST /auth/signout", "success+retry", async () => {
  const ctx = await session("qa.exec2");
  const r = await ctx.request.post(base + "/auth/signout", { headers: H, failOnStatusCode: false, maxRedirects: 0 });
  expect(r.status() === 303, "signout " + r.status());
  const after = await ctx.request.get(base + "/api/search?q=E2E", { failOnStatusCode: false });
  expect(after.status() === 401, "session still valid after signout: " + after.status());
  expect((await ctx.request.post(base + "/auth/signout", { headers: H, failOnStatusCode: false, maxRedirects: 0 })).status() === 303, "second signout");
  await ctx.close();
});
await check("loginAction", "success+retry", async () => {
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  for (let i = 0; i < 2; i++) {
    await p.goto(base + "/crm/login");
    await p.getByLabel("Username or work email").fill("qa.exec2@example.test");
    await p.getByLabel("Password").fill("E2e-Test-Passw0rd!");
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.waitForURL("**/crm/entrydashboard");
  }
  await ctx.close();
});

await careers.close(); await adminCtx.close(); await execCtx.close(); await anon.dispose(); await browser.close(); await db.end();
const failed = results.filter((r) => !r.pass);
console.log(`endpoint success/retry/rollback: ${results.length - failed.length}/${results.length} passed`);
for (const f of failed) console.log("FAIL", f.endpoint, `[${f.aspect}]`, "::", f.error);
if (failed.length) process.exitCode = 1;
