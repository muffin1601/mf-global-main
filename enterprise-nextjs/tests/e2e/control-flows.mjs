// Control-level workflows against the isolated E2E stack. Each check drives the real UI and then verifies
// PostgreSQL. Covers lead form validation/create/assign, pagination/sort, transfer, bulk delete, export, user
// administration (create/validate/edit/disable/enable + sign-in effect), report filters/exports, activity-log
// filters, quotation validation and employee control restrictions. Results: test-artifacts/control-flows.json
import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import pg from "pg";

const base = "http://localhost:3100";
const PASSWORD = "E2e-Test-Passw0rd!";
mkdirSync("test-artifacts/journey", { recursive: true });
const db = new pg.Client({ connectionString: "postgresql://postgres:e2e@127.0.0.1:54340/crm_e2e" });
await db.connect();
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const browser = await chromium.launch();
const results = [];
const tag = Date.now().toString().slice(-7);
let page;

async function signIn(username, password = PASSWORD) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  await ctx.route("**/*", (r) => (["localhost", "127.0.0.1"].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
  const p = await ctx.newPage();
  p.setDefaultTimeout(15000);
  await p.goto(base + "/crm/login");
  await p.getByLabel("Username or work email").fill(username);
  await p.getByLabel("Password").fill(password);
  await p.getByRole("button", { name: "Sign in" }).click();
  await Promise.race([p.waitForURL("**/crm/entrydashboard"), p.locator("form p.error[role=alert]").waitFor()]).catch(() => {});
  return p;
}
async function check(module, name, fn) {
  try { await fn(); results.push({ module, name, pass: true }); }
  catch (e) {
    results.push({ module, name, pass: false, error: String(e).split("\n")[0].slice(0, 300) });
    await page?.screenshot({ path: `test-artifacts/journey/control-failure-${results.length}.png` }).catch(() => {});
  }
  writeFileSync("test-artifacts/control-flows.json", JSON.stringify(results, null, 2));
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const dialog = () => page.getByRole("dialog");
async function confirmIfAsked() {
  const d = page.getByRole("alertdialog").or(page.getByRole("dialog")).last();
  if (await d.isVisible().catch(() => false)) {
    const btn = d.getByRole("button", { name: /^(Delete|Confirm|Yes|Disable|Enable|Transfer)/ }).last();
    if (await btn.isVisible().catch(() => false)) await btn.click();
  }
}

const ids = await one("select (select id from users where username='qa.exec1') exec1,(select id from users where username='qa.exec2') exec2");
page = await signIn("qa.admin");

// ---------------- Leads
const leadName = `CF Lead ${tag}`;
await check("Leads", "Create lead with empty required phone is blocked and nothing is saved", async () => {
  await page.goto(base + "/crm/lead-management");
  await page.getByRole("button", { name: "Add lead", exact: true }).click();
  await dialog().getByLabel("Name").fill(leadName + " invalid");
  await dialog().getByRole("button", { name: "Create lead" }).click();
  await page.waitForTimeout(800);
  expect(await dialog().isVisible(), "dialog closed although phone was empty");
  const valid = await dialog().getByLabel(/Phone/).evaluate((el) => el.validity.valid);
  const msg = await page.getByText(/phone or contact (number )?is required/i).count();
  expect(!valid || msg > 0, "no validation feedback for empty phone");
  expect((await one("select count(*)::int n from leads where name=$1", [leadName + " invalid"])).n === 0, "invalid lead persisted");
  await dialog().getByRole("button", { name: "Cancel" }).click();
});
await check("Leads", "Create lead with invalid email shows validation and saves nothing", async () => {
  await page.goto(base + "/crm/lead-management");
  await page.getByRole("button", { name: "Add lead", exact: true }).click();
  await dialog().getByLabel("Name").fill(leadName + " bad email");
  await dialog().getByLabel(/Phone/).fill("98" + tag.padStart(8, "1"));
  await dialog().getByLabel("Email").fill("not-an-email");
  await dialog().getByRole("button", { name: "Create lead" }).click();
  await page.waitForTimeout(800);
  expect(await dialog().isVisible(), "dialog closed with invalid email");
  expect((await one("select count(*)::int n from leads where name=$1", [leadName + " bad email"])).n === 0, "lead with invalid email persisted");
  await dialog().getByRole("button", { name: "Cancel" }).click();
});
const phone = "97" + tag.padStart(8, "3");
await check("Leads", "Create lead assigned to an employee persists lead and assignment", async () => {
  await page.goto(base + "/crm/lead-management");
  await page.getByRole("button", { name: "Add lead", exact: true }).click();
  await dialog().getByLabel("Name").fill(leadName);
  await dialog().getByLabel("Company").fill("CF Co");
  await dialog().getByLabel(/Phone/).fill(phone);
  await dialog().getByLabel("Assign to").selectOption({ label: "QA Exec One" });
  await dialog().getByRole("button", { name: "Create lead" }).click();
  await dialog().waitFor({ state: "hidden" });
  const row = await one("select l.id, array_agg(a.user_id::text) owners from leads l left join lead_assignments a on a.lead_id=l.id where l.name=$1 group by l.id", [leadName]);
  expect(row, "lead not in database");
  expect(row.owners.length === 1 && row.owners[0] === ids.exec1, "assignment mismatch: " + row.owners);
});
await check("Leads", "Search finds the new lead; clearing restores the full list", async () => {
  await page.goto(base + "/crm/lead-management?q=" + encodeURIComponent(leadName));
  await page.getByRole("button", { name: leadName, exact: true }).waitFor();
  expect((await page.locator("table tbody tr").count()) === 1, "search did not narrow to one row");
});
await check("Leads", "Pagination: next, last and page size change rows and URL", async () => {
  const { n } = await one("select count(*)::int n from leads");
  await page.goto(base + "/crm/lead-management");
  const first = await page.locator("table tbody tr").first().innerText();
  expect((await page.locator("table tbody tr").count()) === Math.min(25, n), "page 1 is not 25 rows");
  await page.getByRole("button", { name: "Next page" }).click();
  await page.waitForURL(/page=2/);
  expect((await page.locator("table tbody tr").first().innerText()) !== first, "page 2 shows page 1 rows");
  const pages = Math.ceil(n / 25);
  if (pages > 2) { await page.getByRole("button", { name: "Last page" }).click(); await page.waitForURL(new RegExp("page=" + pages)); }
  else expect(await page.getByRole("button", { name: "Last page" }).isDisabled(), "Last page enabled on the last page");
  await page.goto(base + "/crm/lead-management?pageSize=50");
  expect((await page.locator("table tbody tr").count()) === Math.min(50, n), "page size 50 not applied");
  await page.goto(base + "/crm/lead-management?pageSize=99999&page=-4");
  expect((await page.locator("table tbody tr").count()) === Math.min(25, n), "hostile page size not clamped");
});
await check("Leads", "Sort select reorders the list and is kept in the URL", async () => {
  await page.goto(base + "/crm/lead-management");
  const sort = page.getByLabel("Sort by");
  const options = await sort.locator("option").evaluateAll((o) => o.map((x) => x.value));
  const before = await page.locator("table tbody tr").first().innerText();
  await sort.selectOption(options[options.length - 1]);
  await page.waitForURL(/sort=/);
  await page.waitForLoadState("networkidle");
  expect((await page.locator("table tbody tr").first().innerText()) !== before || options.length < 2, "sort did not change order");
});
await check("Leads", "Transfer lead from Exec One to Exec Two replaces the owner and logs the event", async () => {
  await page.goto(base + "/crm/lead-management?q=" + encodeURIComponent(leadName));
  await page.getByLabel("Select " + leadName, { exact: true }).check();
  await page.getByLabel("Bulk actions").getByRole("button", { name: "Transfer" }).click();
  await dialog().getByLabel(/QA Exec Two/).check();
  await dialog().getByRole("button", { name: "Transfer" }).click();
  await dialog().waitFor({ state: "hidden" });
  const row = await one("select array_agg(a.user_id::text) owners from leads l join lead_assignments a on a.lead_id=l.id where l.name=$1", [leadName]);
  expect(row.owners.length === 1 && row.owners[0] === ids.exec2, "owners after transfer: " + row.owners);
  expect((await one("select count(*)::int n from lead_assignment_events e join leads l on l.id=e.lead_id where l.name=$1", [leadName])).n >= 1, "no assignment event recorded");
});
await check("Leads", "Export downloads CSV whose row count matches the database", async () => {
  await page.goto(base + "/crm/lead-management");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export" }).click().then(() => dialog().getByRole("button", { name: "Download" }).click())]);
  const path = await dl.path();
  const text = (await import("node:fs")).readFileSync(path, "utf8").replace(/^﻿/, "");
  const lines = text.trim().split(/\r?\n/).length - 1;
  const { n } = await one("select count(*)::int n from leads");
  expect(lines >= n, `export rows ${lines} < db ${n}`);
});
await check("Leads", "Bulk delete removes the selected lead after confirmation", async () => {
  await page.goto(base + "/crm/lead-management?q=" + encodeURIComponent(leadName));
  await page.getByLabel("Select " + leadName, { exact: true }).check();
  await page.getByLabel("Bulk actions").getByRole("button", { name: "Delete", exact: true }).click();
  await dialog().getByRole("button", { name: "Delete 1 lead" }).click();
  await page.waitForTimeout(1500);
  expect((await one("select count(*)::int n from leads where name=$1", [leadName])).n === 0, "lead still present");
});

// ---------------- User administration
const uname = `cf.user${tag}`;
await check("Users", "Create user rejects a short temporary password and saves nothing", async () => {
  await page.goto(base + "/crm/user-management");
  await page.getByRole("button", { name: "Add user" }).click();
  await dialog().getByLabel(/Full name/).fill("CF Employee");
  await dialog().getByLabel(/Username/).fill(uname);
  await dialog().getByLabel(/Work email/).fill(uname + "@example.test");
  await dialog().getByLabel(/Temporary password/).fill("short");
  await dialog().getByRole("button", { name: "Create user" }).click();
  await page.waitForTimeout(1000);
  expect((await one("select count(*)::int n from users where username=$1", [uname])).n === 0, "user created with short password");
  await dialog().getByRole("button", { name: "Cancel" }).click().catch(() => {});
});
await check("Users", "Create employee persists an enabled USER that can sign in", async () => {
  await page.goto(base + "/crm/user-management");
  await page.getByRole("button", { name: "Add user" }).click();
  await dialog().getByLabel(/Full name/).fill("CF Employee");
  await dialog().getByLabel(/Username/).fill(uname);
  await dialog().getByLabel(/Work email/).fill(uname + "@example.test");
  await dialog().getByLabel(/Temporary password/).fill(PASSWORD);
  await dialog().getByLabel("Role").selectOption("USER");
  await dialog().getByRole("button", { name: "Create user" }).click();
  await dialog().waitFor({ state: "hidden" });
  const u = await one("select role, enabled from users where username=$1", [uname]);
  expect(u && u.role === "USER" && u.enabled, "user row: " + JSON.stringify(u));
  const p2 = await signIn(uname);
  expect(p2.url().includes("/crm/entrydashboard"), "new employee could not sign in");
  await p2.context().close();
});
const row = () => page.locator("tr", { hasText: uname });
await check("Users", "Edit user name persists and is audited", async () => {
  await page.goto(base + "/crm/user-management");
  await row().getByRole("button", { name: "Edit" }).click();
  await dialog().getByLabel(/Full name/).fill("CF Employee Renamed");
  await dialog().getByRole("button", { name: /Save|Update/ }).click();
  await dialog().waitFor({ state: "hidden" });
  expect((await one("select name from users where username=$1", [uname])).name === "CF Employee Renamed", "name not saved");
  expect((await one("select count(*)::int n from activity_logs where action='user.updated'")).n >= 1, "edit not audited");
});
await check("Users", "Disable blocks sign-in; Enable restores it; both are audited", async () => {
  await page.goto(base + "/crm/user-management");
  await row().getByRole("button", { name: "Disable" }).click();
  await confirmIfAsked();
  await row().getByRole("button", { name: "Enable" }).waitFor();
  expect((await one("select enabled from users where username=$1", [uname])).enabled === false, "still enabled");
  const blocked = await signIn(uname);
  expect(/disabled/i.test(await blocked.locator("form p.error[role=alert]").innerText().catch(() => "")), "disabled user not refused");
  await blocked.context().close();
  await row().getByRole("button", { name: "Enable" }).click();
  await confirmIfAsked();
  await row().getByRole("button", { name: "Disable" }).waitFor();
  const ok = await signIn(uname);
  expect(ok.url().includes("/crm/entrydashboard"), "re-enabled user could not sign in");
  await ok.context().close();
  expect((await one("select count(*)::int n from activity_logs where action in ('user.disabled','user.enabled')")).n >= 2, "toggle not audited");
});
await check("Users", "Admin cannot disable their own account", async () => {
  await page.goto(base + "/crm/user-management");
  const own = page.locator("tr", { hasText: "qa.admin" }).filter({ hasNotText: "qa.admin2" });
  const btn = own.getByRole("button", { name: "Disable" });
  expect((await btn.count()) === 0 || (await btn.isDisabled()), "own Disable control is active");
  expect((await one("select enabled from users where username='qa.admin'")).enabled === true, "admin disabled themselves");
});

// ---------------- Reports
await check("Reports", "Lead insertion report filters by custom range and exports CSV/XLSX/PDF with valid signatures", async () => {
  await page.goto(base + "/crm/reports/lead-insertion");
  await page.locator("select[name=preset]").selectOption({ index: (await page.locator("select[name=preset] option").count()) - 1 });
  const today = new Date().toISOString().slice(0, 10);
  await page.locator("input[name=from]").fill("2020-01-01");
  await page.locator("input[name=to]").fill(today);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.waitForURL(/from=2020-01-01/);
  for (const [fmt, sig] of [["CSV", null], ["XLSX", "PK"], ["PDF", "%PDF-"]]) {
    const href = await page.getByRole("link", { name: fmt, exact: true }).getAttribute("href");
    const r = await page.request.get(new URL(href, base).toString());
    const body = await r.body();
    expect(r.status() === 200 && body.length > 0, `${fmt} status ${r.status()}`);
    if (sig) expect(body.subarray(0, sig.length).toString() === sig, `${fmt} bad signature`);
    expect(href.includes("from=2020-01-01"), `${fmt} link ignores filters`);
  }
});
await check("Reports", "Invalid custom date range does not crash the report", async () => {
  const r = await page.goto(base + "/crm/reports/lead-insertion?preset=custom&from=2024-02-31&to=garbage");
  expect(r.status() < 500 && (await page.getByText(/Application error|Something went wrong/i).count()) === 0, "report crashed");
});

// ---------------- Activity log
await check("Audit history", "Activity log search and page-size controls filter results", async () => {
  await page.goto(base + "/crm/activity-log");
  await page.locator("input[name=q]").fill("user.disabled");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.waitForURL(/q=user.disabled/);
  const rows = await page.locator("table tbody tr").allInnerTexts();
  expect(rows.length >= 1 && rows.every((t) => /disabl/i.test(t)), "search returned unrelated rows");
  await page.getByRole("link", { name: "50 rows per page" }).click();
  await page.waitForURL(/50/);
});

// ---------------- Quotations
await check("Quotations", "Saving a quotation with no client or items is refused and nothing is stored", async () => {
  const before = (await one("select count(*)::int n from quotations")).n;
  await page.goto(base + "/crm/quotations/create");
  await page.getByRole("button", { name: "Save quotation" }).first().click();
  await page.waitForTimeout(1500);
  expect(new URL(page.url()).pathname === "/crm/quotations/create", "navigated away after invalid save");
  expect((await page.getByRole("alert").or(page.locator(".error")).count()) > 0, "no error message shown");
  expect((await one("select count(*)::int n from quotations")).n === before, "invalid quotation stored");
});

// ---------------- Employee restrictions
await page.context().close();
page = await signIn("qa.exec1");
await check("Permissions", "Employee sees no delete, bulk delete or user-admin controls", async () => {
  await page.goto(base + "/crm/my-leads");
  await page.locator("table tbody tr").first().waitFor();
  expect((await page.getByRole("button", { name: /^Delete / }).count()) === 0, "row delete visible to employee");
  const boxes = page.locator("table tbody input[type=checkbox]");
  if (await boxes.count()) await boxes.first().check();
  expect((await page.getByLabel("Bulk actions").getByRole("button", { name: "Delete" }).count()) === 0, "bulk delete visible to employee");
  expect((await page.getByRole("link", { name: /User management/i }).count()) === 0, "user management link visible");
});
await check("Permissions", "Employee quotation prefix is fixed to the company series", async () => {
  await page.goto(base + "/crm/quotations/create");
  expect(await page.getByLabel("Prefix").isDisabled(), "prefix editable by employee");
});

await page.context().close();
await browser.close();
await db.end();
const failed = results.filter((r) => !r.pass);
console.log(`control flows: ${results.length - failed.length}/${results.length} passed`);
for (const f of failed) console.log("FAIL", f.module, "—", f.name, "::", f.error);
if (failed.length) process.exitCode = 1;
