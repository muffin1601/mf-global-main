import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import pg from "pg";

const base = "http://localhost:3100";
const db = new pg.Client({
  connectionString: "postgresql://postgres:e2e@127.0.0.1:54340/crm_e2e",
});
await db.connect();
const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.route("**/*", (r) =>
  ["localhost", "127.0.0.1"].includes(new URL(r.request().url()).hostname)
    ? r.continue()
    : r.abort(),
);
const page = await ctx.newPage();
page.setDefaultTimeout(12000);
const dialog = page.getByRole("dialog");
const results = [];
const suffix = Date.now().toString().slice(-9);
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
  } catch (error) {
    results.push({ name, pass: false, error: String(error).slice(0, 500) });
    await page.screenshot({
      path: "test-artifacts/journey/module-failure-" + results.length + ".png",
    });
  }
  writeFileSync(
    "test-artifacts/module-flows.json",
    JSON.stringify(results, null, 2),
  );
}
try {
  await page.goto(base + "/crm/login");
  await page.getByLabel("Username or work email").fill("qa.admin");
  await page.getByLabel("Password").fill("E2e-Test-Passw0rd!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/crm/entrydashboard");
  await check(
    "Dashboard cards reconcile to independent SQL counts in IST",
    async () => {
      const {
        rows: [totals],
      } = await db.query(`
   with snapshot as (select *,exists (select 1 from lead_assignments a where a.lead_id=l.id) assigned,
     ((created_at at time zone 'UTC') at time zone 'Asia/Kolkata')::date created_day,
     ((follow_up_date at time zone 'UTC') at time zone 'Asia/Kolkata')::date due_day,
     (now() at time zone 'Asia/Kolkata')::date today from leads l)
   select count(*) "Total leads",count(*) filter(where created_day=today) "New today",
    count(*) filter(where assigned) "Assigned",count(*) filter(where not assigned) "Unassigned",
    count(*) filter(where status='Won Lead') "Won",count(*) filter(where status='Lost Lead') "Lost",
    count(*) filter(where status='In Progress') "In progress",count(*) filter(where due_day=today) "Due today",
    count(*) filter(where due_day>today) "Upcoming",count(*) filter(where due_day<today and status not in ('Won Lead','Lost Lead')) "Overdue"
   from snapshot`);
      for (const [label, value] of Object.entries(totals)) {
        const tile = page
          .locator(".kpi")
          .filter({ has: page.getByText(label, { exact: true }) })
          .first();
        assert.equal(
          Number(
            (await tile.locator(".kpi-value").innerText()).replaceAll(",", ""),
          ),
          Number(value),
          label,
        );
      }
    },
  );
  await check(
    "Navigation, keyboard palette, dark theme and reload",
    async () => {
      await page.keyboard.press("Control+k");
      await dialog.waitFor();
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      await page.getByLabel("Switch to dark theme").click();
      await page.reload();
      await page.getByLabel("Switch to light theme").waitFor();
      await page.screenshot({
        path: "test-artifacts/journey/dark-dashboard.png",
      });
      await page.getByLabel("Switch to light theme").click();
      await page.setViewportSize({ width: 375, height: 812 });
      assert.equal(
        await page.getByRole("navigation", { name: "CRM navigation" }).count(),
        0,
        "Closed drawer should leave the accessibility tree",
      );
      await page.getByRole("button", { name: "Create", exact: true }).waitFor();
      await page.getByLabel("Open navigation").click();
      await page.getByRole("navigation", { name: "CRM navigation" }).waitFor();
      await page.getByLabel("Close navigation").click();
      await page.setViewportSize({ width: 1366, height: 900 });
    },
  );
  await check("Search lead list, refresh query and clear filters", async () => {
    await page.goto(base + "/crm/lead-management");
    const search = page.getByLabel("Search leads");
    await search.fill("E2E Lead 1");
    await search.press("Enter");
    await page.waitForURL(/q=/);
    await page.reload();
    assert.equal(await search.inputValue(), "E2E Lead 1");
    await page
      .getByRole("button", { name: /Filters/ })
      .first()
      .click();
    await dialog.waitFor();
    await dialog.getByRole("button", { name: /Clear all filters/ }).click();
    await dialog.waitFor({ state: "hidden" });
  });
  await check("Create vendor and verify saved profile", async () => {
    const name = "Supplier " + suffix;
    await page.goto(base + "/crm/vendors");
    await page.getByRole("button", { name: "Add vendor" }).click();
    await dialog.locator('[name="name"]').fill(name);
    await dialog.getByRole("button", { name: "Create vendor" }).click();
    await dialog.waitFor({ state: "hidden" });
    const {
      rows: [v],
    } = await db.query("select id,status from vendors where name=$1", [name]);
    assert.equal(v.status, "PENDING");
    await page.goto(base + "/crm/vendors/" + v.id);
    await page.getByRole("heading", { name, exact: true }).waitFor();
  });
  await check("Create product, verify price and search result", async () => {
    const name = "Catalogue " + suffix;
    await page.goto(base + "/crm/product-management");
    await page.getByRole("button", { name: "Add product" }).click();
    await page.locator("#pf-category").selectOption({ index: 1 });
    await page.locator("#pf-n").fill(name);
    await page.locator("#pf-s").fill("Q" + suffix);
    await page.locator("#pf-ba").fill("250.50");
    await page.locator("#pf-g").fill("5");
    await dialog.getByRole("button", { name: "Add product" }).click();
    await dialog.waitFor({ state: "hidden" });
    const r = await ctx.request.get(
      base + "/api/products?query=" + encodeURIComponent(name),
    );
    const body = await r.json();
    assert.equal(body.total, 1);
    assert.equal(Number(body.products[0].price.netAmount), 263.03);
  });
  await check(
    "CSV preview, commit, Unicode persistence and import report download",
    async () => {
      const phone = "8" + suffix;
      const csv =
        "Company Name,Contact Person,Mobile Number,Email,City,State,Category,Requirements,Remarks\nQA Supplier,Renée," +
        phone +
        ",,Pune,Maharashtra,QA,Sample,\nDuplicate,Duplicate," +
        phone +
        ",,Pune,Maharashtra,QA,Sample,\nInvalid,Invalid,ABC,,Pune,Maharashtra,QA,,";
      await page.goto(base + "/crm/import-leads");
      await page
        .getByLabel("CSV file to import", { exact: true })
        .setInputFiles({
          name: "QA-" + suffix + ".csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csv),
        });
      await page
        .getByRole("button", { name: "Import 1 lead", exact: true })
        .click();
      const link = page.getByRole("link", { name: "Download import report" });
      await link.waitFor();
      const report = await ctx.request.get(
        base + (await link.getAttribute("href")),
      );
      assert.equal(report.status(), 200);
      const { rows } = await db.query("select name from leads where phone=$1", [
        phone,
      ]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].name, "Renée");
    },
  );
  await check("Sign out and refresh protected dashboard", async () => {
    await page.goto(base + "/crm/entrydashboard");
    await page.getByLabel("Account menu").click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL(/crm\/login/);
    await page.goto(base + "/crm/entrydashboard");
    await page.waitForURL(/crm\/login/);
  });
} finally {
  await browser.close();
  await db.end();
}
if (results.some((r) => !r.pass)) process.exitCode = 1;
