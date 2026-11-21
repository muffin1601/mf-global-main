// Endpoint contract sweep against the isolated E2E stack (node scripts/e2e/start-stack.mjs).
// For every HTTP handler: anonymous access, employee (USER) access to admin-only handlers, malformed JSON bodies,
// and non-existent / malformed ids. Invariants: protected handlers deny (401/403), admin-only handlers return 403
// to employees, hostile input yields a 4xx and NEVER a 5xx. Only bogus ids are sent to DELETE/PUT, so no seeded
// record is changed. Results: test-artifacts/endpoint-contract.json
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { chromium, request as pwRequest } from "playwright-core";
import pg from "pg";

const base = "http://localhost:3100";
const db = new pg.Client({ connectionString: "postgresql://postgres:e2e@127.0.0.1:54340/crm_e2e" });
await db.connect();
const { rows: [ids] } = await db.query("select (select id from vendors limit 1) vendor,(select id from blog_posts limit 1) blog");

const MISSING = randomUUID();
// auth: public | user (any signed-in) | admin | careers (careers-admin PIN session) | apikey | cron
const E = [
  ["POST", "/api/activity/log", "user"],
  ["GET", "/api/blogs", "public"],
  ["GET", "/api/blogs/{blog}", "public"],
  ["GET", "/api/blogs/comments/{blog}", "public"],
  ["POST", "/api/blogs/comments", "public"],
  ["POST", "/api/blogs/post-blogs", "admin"],
  ["GET", "/api/careers/admin/applications", "careers"],
  ["GET", "/api/careers/admin/applications/{id}", "careers"],
  ["PATCH", "/api/careers/admin/applications/{id}", "careers"],
  ["DELETE", "/api/careers/admin/applications/{id}", "careers"],
  ["GET", "/api/careers/admin/applications/{id}/resume", "careers"],
  ["POST", "/api/careers/admin/change-pin", "careers"],
  ["GET", "/api/careers/admin/export", "careers"],
  ["GET", "/api/careers/admin/jobs", "careers"],
  ["POST", "/api/careers/admin/jobs", "careers"],
  ["PUT", "/api/careers/admin/jobs/{id}", "careers"],
  ["DELETE", "/api/careers/admin/jobs/{id}", "careers"],
  ["GET", "/api/careers/admin/stats", "careers"],
  ["GET", "/api/careers/admin/session", "careers"],
  ["POST", "/api/careers/admin/login", "careers"], // wrong/missing PIN must be 401
  ["POST", "/api/careers/apply", "public"],
  ["GET", "/api/careers/jobs", "public"],
  ["GET", "/api/careers/jobs/{id}", "public"],
  ["GET", "/api/categories", "user"],
  ["POST", "/api/categories", "admin"],
  ["PUT", "/api/categories/{id}", "admin"],
  ["DELETE", "/api/categories/{id}", "admin"],
  ["POST", "/api/coachinpromo/capture-lead", "apikey"],
  ["POST", "/api/giftaguru/capture-lead", "apikey"],
  ["POST", "/api/printkee/capture-lead", "apikey"],
  ["POST", "/api/contact", "public"],
  ["POST", "/api/send-email", "public"],
  ["GET", "/api/cron/tradeindia", "cron"],
  ["GET", "/api/health", "public"],
  ["POST", "/api/lead-import/check", "user"],
  ["GET", "/api/lead-import/history", "user"],
  ["POST", "/api/lead-import/jobs", "user"],
  ["POST", "/api/lead-import/jobs/{id}/batch", "user"],
  ["GET", "/api/lead-import/report/{id}", "user"],
  ["GET", "/api/lead-import/sample", "user"],
  ["GET", "/api/leads/export", "user"],
  ["GET", "/api/products", "user"],
  ["POST", "/api/products", "admin"],
  ["GET", "/api/products/{id}", "user"],
  ["PUT", "/api/products/{id}", "admin"],
  ["DELETE", "/api/products/{id}", "admin"],
  ["GET", "/api/products/code-preview", "user"],
  ["GET", "/api/products/search", "user"],
  ["GET", "/api/quotations/{id}/pdf", "user"],
  ["GET", "/api/quotations/clients", "user"],
  ["GET", "/api/reports/lead-insertion/export", "user"],
  ["GET", "/api/search", "user"],
  ["GET", "/api/vendors", "user"],
  ["GET", "/api/vendors/{id}/audit", "user"],
  ["GET", "/api/vendors/{vendor}/documents", "user"],
  ["POST", "/api/vendors/{vendor}/documents", "user"],
  ["GET", "/api/vendors/{vendor}/documents/{id}/file", "user"],
  ["PUT", "/api/vendors/{vendor}/documents/{id}/file", "user"],
  ["GET", "/api/vendors/export", "user"],
  ["GET", "/api/vendors/import/{id}/report", "user"],
  ["GET", "/api/vendors/import/template", "user"],
  ["POST", "/api/vendors/import/upload", "user"],
];

const fill = (p, id) => p.replace("{blog}", ids.blog ?? MISSING).replace("{vendor}", ids.vendor ?? MISSING).replace("{id}", id);
const isWrite = (m) => m !== "GET";

async function login(username) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(base + "/crm/login");
  await page.getByLabel("Username or work email").fill(username);
  await page.getByLabel("Password").fill("E2e-Test-Passw0rd!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/crm/entrydashboard");
  return { browser, req: ctx.request };
}

const anon = await pwRequest.newContext();
const admin = await login("qa.admin");
const exec = await login("qa.exec1");
const results = [];
const send = async (req, method, url, body) => {
  const opts = { method, failOnStatusCode: false, maxRedirects: 0, headers: { "content-type": "application/json", origin: base } };
  if (body !== undefined) opts.data = body;
  const r = await req.fetch(base + url, opts);
  return r.status();
};
const record = (method, path, check, status, pass, expected) => results.push({ endpoint: `${method} ${path}`, check, status, expected, pass });

for (const [method, path, auth] of E) {
  const url = fill(path, MISSING);
  // 1. anonymous
  const s1 = await send(anon, method, url, isWrite(method) ? "{}" : undefined);
  if (["user", "admin", "careers", "apikey", "cron"].includes(auth)) record(method, path, "anonymous denied", s1, [401, 403].includes(s1), "401/403");
  else record(method, path, "public reachable, no 5xx", s1, s1 < 500 && s1 !== 401, "<500, not 401");
  // 2. employee on admin-only
  if (auth === "admin") {
    const s2 = await send(exec.req, method, url, isWrite(method) ? "{}" : undefined);
    record(method, path, "employee forbidden", s2, s2 === 403, "403");
  }
  if (["user", "admin"].includes(auth)) {
    // 3. malformed JSON body as admin
    if (isWrite(method)) {
      const s3 = await send(admin.req, method, url, "{not json");
      record(method, path, "malformed body rejected", s3, s3 >= 400 && s3 < 500, "4xx");
    }
    // 4. bogus ids as admin
    if (path.includes("{id}")) {
      const s4 = await send(admin.req, method, url, isWrite(method) ? "{}" : undefined);
      record(method, path, "missing id → 4xx", s4, s4 >= 400 && s4 < 500, "4xx");
      const s5 = await send(admin.req, method, fill(path, "not-a-uuid"), isWrite(method) ? "{}" : undefined);
      record(method, path, "malformed id → 4xx", s5, s5 >= 400 && s5 < 500, "4xx");
    }
  }
}

// Spot checks with semantic expectations.
for (const path of ["/api/contact", "/api/send-email", "/api/blogs/comments", "/api/careers/apply"]) {
  const s = await send(anon, "POST", path, "{not json");
  record("POST", path, "anonymous malformed body → 4xx", s, s >= 400 && s < 500, "4xx");
}
const blank = await send(anon, "POST", "/api/send-email", "{}");
record("POST", "/api/send-email", "blank enquiry rejected", blank, blank === 400, "400");
const blankContact = await send(anon, "POST", "/api/contact", "{}");
record("POST", "/api/contact", "blank enquiry rejected", blankContact, blankContact === 400, "400");
const crossOrigin = await admin.req.fetch(base + "/api/activity/log", { method: "POST", failOnStatusCode: false, headers: { "content-type": "application/json", origin: "https://evil.example" }, data: "{}" });
record("POST", "/api/activity/log", "cross-origin write refused", crossOrigin.status(), crossOrigin.status() >= 400 && crossOrigin.status() < 500, "4xx");

writeFileSync("test-artifacts/endpoint-contract.json", JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
console.log(`endpoint contract: ${results.length - failed.length}/${results.length} passed`);
for (const f of failed) console.log(`FAIL ${f.endpoint} — ${f.check}: got ${f.status}, expected ${f.expected}`);
await admin.browser.close();
await exec.browser.close();
await anon.dispose();
await db.end();
if (failed.length) process.exitCode = 1;
