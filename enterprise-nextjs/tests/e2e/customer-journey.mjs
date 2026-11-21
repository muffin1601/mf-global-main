import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import pg from "pg";
const { chromium } = createRequire(import.meta.url)(
  process.env.QA_PLAYWRIGHT_MODULE || "playwright-core",
);
const db = new pg.Client({
  connectionString: "postgresql://postgres:e2e@127.0.0.1:54340/crm_e2e",
});
await db.connect();
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
assert(await one("select id from users where username='qa.exec1'"));
const out = "test-artifacts/journey";
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const base = "http://localhost:3100",
  suffix = Date.now().toString().slice(-9),
  name = "Journey " + suffix,
  phone = "7" + suffix;
const ctx = await b.newContext();
await ctx.route("**/*", (r) =>
  ["localhost", "127.0.0.1"].includes(new URL(r.request().url()).hostname)
    ? r.continue()
    : r.abort(),
);
const p = await ctx.newPage();
p.setDefaultTimeout(15000);
const tomorrow = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(Date.now() + 86_400_000));
const steps = [];
const mark = async (action) => {
  steps.push(action);
  writeFileSync(out + "/steps.json", JSON.stringify(steps, null, 2));
  await p.screenshot({ path: out + "/" + steps.length + ".png" });
};
async function login(user) {
  await ctx.clearCookies();
  await p.goto(base + "/crm/login");
  await p.getByLabel("Username or work email").fill(user);
  await p.getByLabel("Password").fill("E2e-Test-Passw0rd!");
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.waitForURL("**/crm/entrydashboard");
}
try {
  await login("qa.admin");
  await mark("Admin login");
  await p.goto(base + "/crm/lead-management?create=lead");
  await p.locator("#lf-name").fill(name);
  await p.locator("#lf-phone").fill(phone);
  await p.locator("#lf-assign").selectOption({ label: "QA Exec One" });
  await p.getByRole("button", { name: "Create lead" }).click();
  await p.getByRole("dialog").waitFor({ state: "hidden" });
  const lead = await one(
    "select l.id from leads l join lead_assignments a on a.lead_id=l.id join users u on u.id=a.user_id where l.phone=$1 and u.username='qa.exec1'",
    [phone],
  );
  assert(lead);
  await mark("Create lead and verify employee assignment in PostgreSQL");
  await p.goto(base + "/crm/lead-management?create=lead");
  await p.locator("#lf-phone").fill(phone.slice(0, 5) + " " + phone.slice(5));
  await p.locator("#lf-name").click();
  await p
    .getByText(/A lead with this phone number already exists/i)
    .first()
    .waitFor();
  await p.getByRole("button", { name: "Create lead" }).click();
  await p
    .getByText("A lead with that phone or contact already exists.")
    .first()
    .waitFor();
  await mark("Formatted duplicate preview and submission rejected");
  await login("qa.exec1");
  await p.goto(base + "/crm/my-leads?q=" + encodeURIComponent(name));
  await p.getByRole("button", { name: "Edit " + name, exact: true }).click();
  await p.locator("#lf-call").selectOption("Follow-up Required");
  await p.locator("#lf-status").selectOption("In Progress");
  await p.locator("#lf-rem").fill("Synthetic follow-up requested");
  await p.locator("#lf-fu").fill(tomorrow);
  await p.getByRole("button", { name: "Save changes" }).click();
  await p.getByRole("dialog").waitFor({ state: "hidden" });
  await p.goto(base + "/crm/lead-management/" + lead.id);
  await p.reload();
  await p.getByText("Synthetic follow-up requested", { exact: true }).waitFor();
  await mark("Employee edit, notes, status and follow-up survive refresh");
  await p.getByRole("button", { name: "Log activity" }).click();
  const dlg = p.getByRole("dialog");
  await dlg.getByLabel("Type", { exact: true }).selectOption("FOLLOW_UP");
  await dlg.getByLabel(/Subject/).fill(name);
  await dlg.getByLabel(/Due/).fill(tomorrow + "T09:00");
  await dlg.getByRole("button", { name: "Save", exact: true }).click();
  await dlg.waitFor({ state: "hidden" });
  await p.goto(base + "/crm/activities?view=all&q=" + encodeURIComponent(name));
  await p.getByRole("button", { name: 'Mark "' + name + '" done' }).click();
  await dlg.getByRole("button", { name: "Mark done" }).click();
  await dlg.waitFor({ state: "hidden" });
  await mark("Schedule and complete employee follow-up");
  await p.goto(base + "/crm/quotations/create");
  assert(await p.getByLabel("Prefix", { exact: true }).isDisabled());
  await p.getByRole("button", { name: "Select client" }).click();
  await p.getByLabel("Search clients").fill(name);
  await p.getByRole("button", { name: new RegExp(name) }).click();
  await p.getByLabel("Search products").fill("E2E Product 1");
  await p.getByRole("button", { name: /E2E Product 1/ }).click();
  await p.getByLabel("Item 1 quantity").fill("2");
  await p.getByLabel("Item 1 rate").fill("100");
  await p.getByLabel("Item 1 GST").fill("18");
  const dl = p.waitForEvent("download");
  await p.getByRole("button", { name: "Save quotation" }).first().click();
  const file = await dl;
  await file.saveAs(out + "/quotation.pdf");
  assert.equal(
    readFileSync(out + "/quotation.pdf")
      .subarray(0, 5)
      .toString(),
    "%PDF-",
  );
  const quote = await one(
    "select id,grand_total,tax from quotations where party->>'name'=$1",
    [name],
  );
  assert.equal(Number(quote.grand_total), 236);
  assert.equal(Number(quote.tax), 36);
  await mark(
    "Selected customer and product, saved quotation, checked tax and total in PostgreSQL and downloaded PDF",
  );
  await p.goto(base + "/crm/quotations/" + quote.id + "/edit");
  assert.equal(await p.getByLabel("Item 1 quantity").inputValue(), "2");
  await mark("Reopened saved quotation");
} catch (e) {
  await p.screenshot({ path: out + "/failure.png" });
  console.error(String(e), p.url());
  process.exitCode = 1;
} finally {
  await b.close();
  await db.end();
}
