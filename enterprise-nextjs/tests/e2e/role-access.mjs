// Role × page access matrix + authentication failure paths, against the isolated E2E stack.
// For every CRM page and each of anonymous / admin / employee: final URL, HTTP status, uncaught page errors and
// the Next.js error boundary. Employees must be bounced from admin-only pages and must only see their own leads
// on scoped lists (verified against SQL). Results: test-artifacts/role-access.json
import { writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import pg from "pg";

const base = "http://localhost:3100";
const db = new pg.Client({ connectionString: "postgresql://postgres:e2e@127.0.0.1:54340/crm_e2e" });
await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const [{ exec1, exec2 }] = await q("select (select id from users where username='qa.exec1') exec1,(select id from users where username='qa.exec2') exec2");
const [foreignLead] = await q("select l.id from leads l where not exists (select 1 from lead_assignments a where a.lead_id=l.id and a.user_id=$1) limit 1", [exec1]);
const [ownLead] = await q("select lead_id id from lead_assignments where user_id=$1 limit 1", [exec1]);
const [vendor] = await q("select id from vendors limit 1");
const [foreignQuote] = await q("select id from quotations where user_id<>$1 limit 1", [exec1]);

const ADMIN_ONLY = ["/crm/activity-log", "/crm/user-management", "/crm/vendors/performance", "/crm/unassigned-leads", "/crm/assigned-leads", "/crm/new-leads", "/crm/trending-leads", "/crm/won-leads"];
const PAGES = [
  "/crm", "/crm/entrydashboard", "/crm/activities", "/crm/activity-log", "/crm/assigned-leads", "/crm/conversions", "/crm/import-leads",
  "/crm/lead-management", "/crm/my-leads", "/crm/my-trending-leads", "/crm/new-leads", "/crm/product-dashboard", "/crm/product-management",
  "/crm/quotations", "/crm/quotations/create", "/crm/reports/lead-insertion", "/crm/today-followups", "/crm/trending-leads",
  "/crm/unassigned-leads", "/crm/upcoming-followups", "/crm/user-management", "/crm/vendors", "/crm/vendors/active", "/crm/vendors/categories",
  "/crm/vendors/import", "/crm/vendors/inactive", "/crm/vendors/pending", "/crm/vendors/performance", "/crm/vendors/settings", "/crm/won-leads",
  ...(vendor ? ["/crm/vendors/" + vendor.id] : []), ...(ownLead ? ["/crm/lead-management/" + ownLead.id] : []),
];

const results = [];
const browser = await chromium.launch();
const add = (r) => results.push(r);

async function session(username) {
  const ctx = await browser.newContext();
  await ctx.route("**/*", (r) => (["localhost", "127.0.0.1"].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  if (username) {
    await page.goto(base + "/crm/login");
    await page.getByLabel("Username or work email").fill(username);
    await page.getByLabel("Password").fill("E2e-Test-Passw0rd!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/crm/entrydashboard");
  }
  return { ctx, page };
}

async function visit(page, path) {
  const errors = [];
  const onErr = (e) => errors.push(String(e).slice(0, 200));
  page.on("pageerror", onErr);
  const resp = await page.goto(base + path, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  page.off("pageerror", onErr);
  const url = new URL(page.url());
  const boundary = await page.getByText(/Application error|Something went wrong|Unhandled Runtime Error/i).count();
  return { status: resp?.status() ?? 0, final: url.pathname + url.search, errors, boundary };
}

// ---- anonymous
{
  const { ctx, page } = await session(null);
  for (const path of PAGES) {
    const v = await visit(page, path);
    add({ role: "anonymous", path, ...v, check: "redirected to login", pass: v.final.startsWith("/crm/login") && v.status < 500 });
  }
  await ctx.close();
}

// ---- admin
{
  const { ctx, page } = await session("qa.admin");
  for (const path of PAGES) {
    const v = await visit(page, path);
    add({ role: "admin", path, ...v, check: "renders without error", pass: v.status < 400 && !v.final.startsWith("/crm/login") && !v.final.includes("error=") && v.errors.length === 0 && v.boundary === 0 });
  }
  await ctx.close();
}

// ---- employee
{
  const { ctx, page } = await session("qa.exec1");
  for (const path of PAGES) {
    const v = await visit(page, path);
    if (ADMIN_ONLY.includes(path)) {
      add({ role: "employee", path, ...v, check: "admin-only page refused", pass: !v.final.startsWith(path) || v.status === 404 || v.status === 403 });
    } else {
      add({ role: "employee", path, ...v, check: "renders without error", pass: v.status < 400 && !v.final.startsWith("/crm/login") && v.errors.length === 0 && v.boundary === 0 });
    }
  }
  if (foreignLead) {
    const v = await visit(page, "/crm/lead-management/" + foreignLead.id);
    const leaked = await page.getByText(/E2E Lead \d+/).count();
    add({ role: "employee", path: "/crm/lead-management/<unassigned lead>", ...v, check: "foreign lead detail refused", pass: (v.status === 404 || !v.final.startsWith("/crm/lead-management/" + foreignLead.id)) || leaked === 0 });
  }
  if (foreignQuote) {
    const v = await visit(page, `/crm/quotations/${foreignQuote.id}/edit`);
    add({ role: "employee", path: "/crm/quotations/<foreign>/edit", ...v, check: "foreign quotation edit refused", pass: v.status === 404 || v.status === 403 || !v.final.startsWith(`/crm/quotations/${foreignQuote.id}`) });
    const pdf = await ctx.request.get(`${base}/api/quotations/${foreignQuote.id}/pdf`, { failOnStatusCode: false });
    add({ role: "employee", path: "/api/quotations/<foreign>/pdf", status: pdf.status(), check: "foreign quotation PDF refused", pass: [403, 404].includes(pdf.status()) });
  }
  // Scoped list: my-leads must show exactly the employee's assigned leads.
  const [{ n }] = await q("select count(distinct lead_id)::int n from lead_assignments where user_id=$1", [exec1]);
  await visit(page, "/crm/my-leads?pageSize=200");
  const rows = await page.locator("table tbody tr").count();
  add({ role: "employee", path: "/crm/my-leads", check: `row count equals SQL (${n})`, observed: rows, pass: rows === n });
  // Export must be scoped too.
  const exp = await ctx.request.get(base + "/api/leads/export", { failOnStatusCode: false });
  const exportRows = Number(exp.headers()["x-row-count"] ?? -1);
  const [{ v: visible }] = await q("select count(distinct lead_id)::int v from lead_assignments where user_id=$1 and can_view", [exec1]);
  add({ role: "employee", path: "/api/leads/export", check: `export scoped to own leads (${visible})`, status: exp.status(), observed: exportRows, pass: exp.status() === 200 && exportRows === visible });
  await ctx.close();
}

// ---- authentication failure paths
{
  const { ctx, page } = await session(null);
  const attempt = async (u, p) => {
    await page.goto(base + "/crm/login");
    await page.getByLabel("Username or work email").fill(u);
    await page.getByLabel("Password").fill(p);
    await page.getByRole("button", { name: "Sign in" }).click();
    // Next.js's route announcer also has role=alert, so target the form's own error paragraph.
    const alert = page.locator("form p.error[role=alert]");
    await alert.waitFor({ timeout: 10000 }).catch(() => {});
    return { url: new URL(page.url()).pathname, text: (await alert.allInnerTexts()).join(" ") };
  };
  const wrong = await attempt("qa.admin", "wrong-password-xx");
  add({ role: "anonymous", path: "/crm/login", check: "wrong password shows generic error", observed: wrong.text, pass: wrong.url === "/crm/login" && /incorrect/i.test(wrong.text) });
  const unknown = await attempt("nobody.here", "whatever-123456");
  add({ role: "anonymous", path: "/crm/login", check: "unknown user shows the same generic error", observed: unknown.text, pass: unknown.text === wrong.text });
  const disabled = await attempt("qa.disabled", "E2e-Test-Passw0rd!");
  add({ role: "anonymous", path: "/crm/login", check: "disabled employee cannot sign in", observed: disabled.text, pass: disabled.url === "/crm/login" && /disabled/i.test(disabled.text) });
  await page.goto(base + "/crm/login");
  await page.getByRole("button", { name: "Sign in" }).click();
  add({ role: "anonymous", path: "/crm/login", check: "empty submit stays on login", pass: new URL(page.url()).pathname === "/crm/login" });
  await ctx.close();
}

await browser.close();
await db.end();
writeFileSync("test-artifacts/role-access.json", JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
console.log(`role access: ${results.length - failed.length}/${results.length} passed`);
for (const f of failed) console.log("FAIL", f.role, f.path, "—", f.check, JSON.stringify({ status: f.status, final: f.final, errors: f.errors, observed: f.observed }));
if (failed.length) process.exitCode = 1;
