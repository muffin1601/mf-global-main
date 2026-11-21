// Per-control UI suite: Leads (list, dialogs, bulk actions, saved views, export, detail page), Activities and
// Lead import. Every check drives the real control in Chromium against the isolated E2E stack and verifies the
// outcome in the UI and in PostgreSQL. All records are created by this suite and carry a unique tag.
// Run: node tests/e2e/ui-leads.mjs   Results: test-artifacts/ui-leads.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { base, expect, launch, openDb, recorder, signedIn, tag } from "./lib.mjs";

const r = recorder("leads");
const browser = await launch();
const { one, all, count, end } = await openDb();
const T = `UIL${tag}`; // unique token present in every lead name / subject this suite creates
const scratch = `test-artifacts/ui/leads-${tag}`;
mkdirSync(scratch, { recursive: true });

const ids = await one("select (select id::text from users where username='qa.admin') admin,(select id::text from users where username='qa.exec1') exec1,(select id::text from users where username='qa.exec2') exec2");
const istDay = (offsetDays = 0) => new Date(Date.now() + 5.5 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
const istLocal = (offsetHours) => new Date(Date.now() + 5.5 * 3_600_000 + offsetHours * 3_600_000).toISOString().slice(0, 16);
const phone = (n) => "9" + tag + String(n).padStart(2, "0");
const importPhone = (n) => "8" + tag + String(n).padStart(2, "0");
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
async function until(fn, msg, ms = 12000) {
  const t = Date.now();
  while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(250); }
  throw new Error(msg + " (timed out)");
}
const IST = (col) => `to_char((${col} at time zone 'UTC') at time zone 'Asia/Kolkata','YYYY-MM-DD')`;
async function mkLead(name, extra = {}) {
  const row = await one(
    "insert into leads (id,name,company,phone,email,location,category,updated_at) values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,now()) returning id::text",
    [name, extra.company ?? "UIL Co", extra.phone ?? null, extra.email ?? null, extra.location ?? null, extra.category ?? null]);
  return row.id;
}
const owners = async (id) => (await all("select user_id::text u, can_update from lead_assignments where lead_id=$1 order by user_id", [id]));

let page;
const dlg = (name) => (name ? page.getByRole("dialog", { name }) : page.getByRole("dialog"));
const toastText = (re) => page.locator("[data-sonner-toast]").filter({ hasText: re }).first();
async function settle() { await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {}); }
async function go(path) { await page.goto(base + path); await settle(); }
async function leads(qs = "") { await go("/crm/lead-management" + (qs ? "?" + qs : "")); await page.locator("table tbody tr").first().waitFor(); }
const q = (s) => "q=" + encodeURIComponent(s);
const bulk = () => page.getByRole("region", { name: "Bulk actions" });
const selectRow = (name) => page.getByLabel("Select " + name, { exact: true }).check();

// ===================================================================== ADMIN
let ctx = await signedIn(browser, "qa.admin");
page = await ctx.newPage();
page.setDefaultTimeout(15000);

// ---------------------------------------------------------------- Add / edit lead form
const nameA = `${T} Alpha`;
const A = { phone: phone(1), contact: "9" + tag + "91", email: `uil.${tag}@example.test`, fu: istDay(3), cd: istDay(0) };
let leadA;
await r.check(["UI-443", "UI-445", "UI-446", "UI-447", "UI-448", "UI-449", "UI-450", "UI-451", "UI-453", "UI-454", "UI-457", "UI-458", "UI-459", "UI-460"],
  "Add lead: every create field persists to PostgreSQL and is shown again in the edit form", async () => {
    await leads();
    await page.getByRole("button", { name: "Add lead", exact: true }).click();
    const d = dlg("Add lead");
    await d.locator("#lf-name").fill(nameA);
    await d.locator("#lf-company").fill("UIL Alpha Co");
    await d.locator("#lf-email").fill(A.email);
    await d.locator("#lf-cc").fill("+91");
    await d.locator("#lf-phone").fill(A.phone);
    await d.locator("#lf-contact").fill(A.contact);
    await d.locator("#lf-addr").fill("12 Test Street, Pune");
    await d.locator("#lf-category").fill(`${T}-catA`);
    await d.locator("#lf-dt").selectOption("Exhibition");
    await d.locator("#lf-location").fill("Pune");
    await d.locator("#lf-state").fill("Maharashtra");
    await d.locator("#lf-qty").fill("12.5");
    await d.locator("#lf-assign").selectOption({ label: "QA Exec One" });
    await d.locator("#lf-status").selectOption("In Progress");
    await d.locator("#lf-call").selectOption("Ring");
    await d.locator("#lf-fu").fill(A.fu);
    await d.locator("#lf-cd").fill(A.cd);
    await d.locator("#lf-req").fill("Needs 500 mugs");
    await d.locator("#lf-rem").fill("Call after 4pm");
    await d.getByRole("button", { name: "Create lead" }).click();
    await d.waitFor({ state: "hidden" });
    await toastText(/Lead created/).waitFor();
    const row = await until(() => one(`select id::text, country_code, phone, contact, address, category, data_type, location, state, quantity::text qty, status, call_status,
      ${IST("follow_up_date")} fu, ${IST("calling_date")} cd, requirements, remarks, email, company from leads where name=$1`, [nameA]), "lead not in database");
    leadA = row.id;
    const want = { country_code: "+91", phone: A.phone, contact: A.contact, address: "12 Test Street, Pune", category: `${T}-catA`, data_type: "Exhibition", location: "Pune",
      state: "Maharashtra", status: "In Progress", call_status: "Ring", fu: A.fu, cd: A.cd, requirements: "Needs 500 mugs", remarks: "Call after 4pm", email: A.email, company: "UIL Alpha Co" };
    for (const [k, v] of Object.entries(want)) expect(row[k] === v, `${k}: db=${row[k]} want=${v}`);
    expect(Number(row.qty) === 12.5, "quantity " + row.qty);
    const own = await owners(leadA);
    expect(own.length === 1 && own[0].u === ids.exec1 && own[0].can_update, "assignment " + JSON.stringify(own));
    // Re-open in the edit form: values are shown back.
    await leads(q(nameA));
    await page.getByRole("button", { name: `Edit ${nameA}` }).click();
    const e = dlg("Edit lead");
    await e.locator("#lf-priority").waitFor();
    const shown = { "#lf-cc": "+91", "#lf-contact": A.contact, "#lf-addr": "12 Test Street, Pune", "#lf-category": `${T}-catA`, "#lf-dt": "Exhibition", "#lf-location": "Pune",
      "#lf-state": "Maharashtra", "#lf-qty": "12.5", "#lf-status": "In Progress", "#lf-call": "Ring", "#lf-fu": A.fu, "#lf-cd": A.cd, "#lf-req": "Needs 500 mugs", "#lf-rem": "Call after 4pm" };
    for (const [sel, v] of Object.entries(shown)) { const got = await e.locator(sel).inputValue(); expect(got === v, `form ${sel}=${got} want ${v}`); }
    await e.getByRole("button", { name: "Cancel" }).click();
    await e.waitFor({ state: "hidden" });
    return `lead ${leadA}`;
  }, page);

await r.check(["UI-505", "UI-514", "UI-455", "UI-456", "UI-461", "UI-453", "UI-457"],
  "Edit lead: priority, tags, billing/shipping address and follow-up rotation persist and are shown on re-open", async () => {
    expect(leadA, "lead A missing");
    await leads(q(nameA));
    await page.getByRole("button", { name: `Edit ${nameA}` }).click();
    const e = dlg("Edit lead");
    await e.locator("#lf-priority").selectOption("High");
    await e.locator("#lf-tags").fill("expo, q4, Expo ,  ");
    const bill = { street: "1 Bill Rd", city: "Mumbai", state: "MH", postalCode: "400001", country: "India" };
    const ship = { street: "2 Ship Ln", city: "Nashik", state: "MH", postalCode: "422001", country: "India" };
    for (const [k, v] of Object.entries(bill)) await e.locator(`#bill-${k}`).fill(v);
    for (const [k, v] of Object.entries(ship)) await e.locator(`#ship-${k}`).fill(v);
    await e.locator("#lf-status").selectOption("Followed Up");
    const fu2 = istDay(5);
    await e.locator("#lf-fu").fill(fu2);
    await e.getByRole("button", { name: "Save changes" }).click();
    await e.waitFor({ state: "hidden" });
    await toastText(/Lead updated/).waitFor();
    const row = await one(`select priority, tags, billing_address b, shipping_address s, status, ${IST("follow_up_date")} fu, ${IST("follow_up_date_one")} f1, ${IST("follow_up_date_two")} f2 from leads where id=$1`, [leadA]);
    expect(row.priority === "High", "priority " + row.priority);
    expect(JSON.stringify(row.tags) === JSON.stringify(["expo", "q4"]), "tags not normalised: " + JSON.stringify(row.tags));
    for (const [k, v] of Object.entries(bill)) expect(row.b?.[k] === v, `billing.${k}=${row.b?.[k]}`);
    for (const [k, v] of Object.entries(ship)) expect(row.s?.[k] === v, `shipping.${k}=${row.s?.[k]}`);
    expect(row.status === "Followed Up", "status " + row.status);
    expect(row.fu === fu2 && row.f1 === A.fu && row.f2 === fu2, `follow-up rotation fu=${row.fu} f1=${row.f1} f2=${row.f2}`);
    expect((await count("select count(*) n from lead_status_history where lead_id=$1 and to_status='Followed Up'", [leadA])) >= 1, "status change not in history");
    await leads(q(nameA));
    await page.getByRole("button", { name: `Edit ${nameA}` }).click();
    await e.locator("#lf-priority").waitFor();
    expect((await e.locator("#lf-priority").inputValue()) === "High", "priority not shown on re-open");
    expect((await e.locator("#lf-tags").inputValue()) === "expo, q4", "tags not shown on re-open");
    expect((await e.locator("#bill-postalCode").inputValue()) === "400001" && (await e.locator("#ship-city").inputValue()) === "Nashik", "addresses not shown on re-open");
    await e.getByRole("button", { name: "Cancel" }).click();
  }, page);

await r.check(["UI-462", "UI-463", "UI-464", "UI-465", "UI-466", "UI-467"],
  "Additional contacts: Add is disabled without a number; add two, delete one; table and JSON column follow", async () => {
    await leads(q(nameA));
    await page.getByRole("button", { name: `Edit ${nameA}` }).click();
    const e = dlg("Edit lead");
    const add = e.getByRole("button", { name: "Add contact" });
    await e.locator("#ac-name").fill("Ravi");
    expect(await add.isDisabled(), "Add contact enabled without a contact number");
    await e.locator("#ac-contact").fill("9000000001");
    await e.locator("#ac-details").fill("Purchase head");
    await add.click();
    await toastText(/Contact added/).waitFor();
    await e.locator("table").getByRole("cell", { name: "Purchase head" }).waitFor();
    expect((await e.locator("#ac-name").inputValue()) === "", "contact inputs not cleared");
    await e.locator("#ac-name").fill("Temp");
    await e.locator("#ac-contact").fill("9000000002");
    await add.click();
    await e.getByRole("button", { name: "Delete contact Temp" }).waitFor();
    let rowJson = (await one("select additional_contacts c from leads where id=$1", [leadA])).c;
    expect(Array.isArray(rowJson) && rowJson.length === 2, "contacts after add: " + JSON.stringify(rowJson));
    expect(rowJson[0].name === "Ravi" && rowJson[0].contact === "9000000001" && rowJson[0].details === "Purchase head", "first contact " + JSON.stringify(rowJson[0]));
    await e.getByRole("button", { name: "Delete contact Temp" }).click();
    await toastText(/Contact removed/).waitFor();
    await e.getByRole("button", { name: "Delete contact Temp" }).waitFor({ state: "detached" });
    rowJson = (await one("select additional_contacts c from leads where id=$1", [leadA])).c;
    expect(rowJson.length === 1 && rowJson[0].name === "Ravi", "contacts after delete: " + JSON.stringify(rowJson));
    expect((await e.locator("table tbody tr").count()) === 1, "contacts table rows");
    await e.getByRole("button", { name: "Cancel" }).click();
  }, page);

await r.check(["UI-435"], "Edit lead dialog shows an error (not an endless skeleton) when the lead no longer exists", async () => {
  const ghost = `${T} Ghost`;
  const id = await mkLead(ghost, { phone: phone(9) });
  await leads(q(ghost));
  await one("delete from leads where id=$1 returning id", [id]); // removed behind the open page
  await page.getByRole("button", { name: `Edit ${ghost}` }).click();
  const e = dlg("Edit lead");
  const alert = e.getByRole("alert");
  await alert.waitFor();
  const text = (await alert.innerText()).trim();
  expect(text.length > 0 && !/Something went wrong/i.test(text), "error text: " + text);
  await e.getByRole("button", { name: "Close dialog" }).click();
  await e.waitFor({ state: "hidden" });
  return text;
}, page);

// ---------------------------------------------------------------- View dialog + detail page
await r.check(["UI-503", "UI-504", "UI-513", "UI-474", "UI-412", "UI-413", "UI-414", "UI-415", "UI-476", "UI-477", "UI-475"],
  "View dialog shows the lead (mailto/tel links, contacts, assignees); Close, Edit lead and Open full page work", async () => {
    await leads(q(nameA));
    await page.getByRole("button", { name: nameA, exact: true }).click();
    const v = dlg(nameA);
    await v.getByRole("heading", { name: "Contact", exact: true }).waitFor();
    const mail = v.getByRole("link", { name: A.email });
    expect((await mail.getAttribute("href")) === `mailto:${A.email}`, "mailto href");
    const tel = v.getByRole("link", { name: `+91 ${A.phone}` });
    expect((await tel.getAttribute("href")) === `tel:+91${A.phone}`, "tel href " + (await tel.getAttribute("href")));
    const tables = v.locator("table");
    const contacts = await tables.nth(0).innerText();
    expect(/Ravi/.test(contacts) && /9000000001/.test(contacts) && /Purchase head/.test(contacts), "contacts table: " + contacts);
    const assignees = await tables.nth(1).innerText();
    expect(/QA Exec One/.test(assignees) && /View \+ update/.test(assignees), "assignees table: " + assignees);
    await v.getByRole("button", { name: "Close", exact: true }).click();
    await v.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: `View ${nameA}` }).click();
    await v.getByRole("button", { name: "Edit lead" }).click();
    const e = dlg("Edit lead");
    await e.locator("#lf-name").waitFor();
    expect((await e.locator("#lf-name").inputValue()) === nameA, "Edit lead did not open this lead");
    await e.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: `View ${nameA}` }).click();
    await v.getByRole("link", { name: "Open full page" }).click();
    await page.waitForURL("**/crm/lead-management/" + leadA);
    await page.getByRole("heading", { name: nameA, level: 1 }).waitFor();
  }, page);

const callSubject = `${T} intro call`;
await r.check(["UI-65", "UI-66", "UI-333", "UI-334"],
  "Lead page: Log activity creates a CALL linked to the lead; Back to leads returns to the admin list", async () => {
    await go("/crm/lead-management/" + leadA);
    await page.getByRole("button", { name: "Log activity" }).click();
    const d = dlg(`Log activity · ${nameA}`);
    await d.waitFor();
    expect((await d.getByLabel("Type").inputValue()) === "CALL", "default type is not Call");
    await d.getByLabel("Subject").fill(callSubject);
    await d.getByRole("button", { name: "Save" }).click();
    await d.waitFor({ state: "hidden" });
    const act = await until(() => one("select type, lead_id::text, created_by_id::text c, status from activities where subject=$1", [callSubject]), "activity not stored");
    expect(act.type === "CALL" && act.lead_id === leadA && act.c === ids.admin && act.status === "OPEN", JSON.stringify(act));
    await page.getByRole("link", { name: "Back to leads" }).click();
    await page.waitForURL(/\/crm\/lead-management$/);
  }, page);

// ---------------------------------------------------------------- Bulk actions (admin)
const B = [1, 2, 3].map((n) => `${T} Bulk ${n}`);
const bIds = [];
for (const [i, n] of B.entries()) bIds.push(await mkLead(n, { phone: phone(20 + i) }));
const bq = q(`${T} Bulk`);

await r.check(["UI-500", "UI-501", "UI-498"], "Table renders the matching leads; select-all selects the page; Clear selection clears it", async () => {
  await leads(bq);
  const rows = page.locator("table tbody tr");
  expect((await rows.count()) === 3, "rows " + (await rows.count()));
  const text = await rows.filter({ hasText: B[0] }).innerText();
  expect(text.includes(phone(20)) && /New Lead/.test(text) && /Not Called/.test(text) && /Unassigned/.test(text), "row content: " + text);
  await page.getByLabel("Select all leads on this page").check();
  await bulk().getByText("3 selected").waitFor();
  for (const n of B) expect(await page.getByLabel("Select " + n, { exact: true }).isChecked(), n + " not selected");
  await bulk().getByRole("button", { name: "Clear selection" }).click();
  await bulk().getByText("Select rows to assign").waitFor();
  for (const n of B) expect(!(await page.getByLabel("Select " + n, { exact: true }).isChecked()), n + " still selected");
}, page);

await r.check(["UI-492", "UI-519", "UI-397", "UI-398", "UI-399", "UI-400", "UI-395", "UI-396", "UI-401", "UI-402"],
  "Assign: needs a user; Cancel keeps nothing; employee search, View+update and View-only access persist", async () => {
    await leads(bq);
    await selectRow(B[0]);
    await bulk().getByRole("button", { name: "Assign", exact: true }).click();
    let d = dlg("Assign 1 lead");
    expect(await d.getByRole("button", { name: "Assign", exact: true }).isDisabled(), "Assign enabled with no user");
    await d.getByLabel(/QA Exec One/).check();
    await d.getByRole("button", { name: "Cancel" }).click();
    await d.waitFor({ state: "hidden" });
    expect((await owners(bIds[0])).length === 0, "Cancel assigned anyway");
    await bulk().getByRole("button", { name: "Assign", exact: true }).click();
    await d.getByLabel(/QA Exec One/).check();
    await d.getByLabel(/View and update/).check();
    await d.getByRole("button", { name: "Assign to 1 user" }).click();
    await d.waitFor({ state: "hidden" });
    await toastText(/Assigned 1 lead/).waitFor();
    await settle();
    await selectRow(B[0]); await selectRow(B[1]);
    await bulk().getByRole("button", { name: "Assign", exact: true }).click();
    d = dlg("Assign 2 leads");
    await d.getByLabel("Search employees").fill("exec two");
    const shown = await d.getByRole("group", { name: "Employees" }).locator("label").allInnerTexts();
    expect(shown.length === 1 && /QA Exec Two/.test(shown[0]), "employee search: " + shown.join("|"));
    await d.getByLabel(/QA Exec Two/).check();
    await d.getByLabel(/View only/).check();
    await d.getByRole("button", { name: "Assign to 1 user" }).click();
    await d.waitFor({ state: "hidden" });
    const o0 = await owners(bIds[0]), o1 = await owners(bIds[1]);
    const of = (o, u) => o.find((x) => x.u === u);
    expect(of(o0, ids.exec1)?.can_update === true, "B1 exec1 should keep update access " + JSON.stringify(o0));
    expect(of(o0, ids.exec2)?.can_update === false && of(o1, ids.exec2)?.can_update === false && o1.length === 1, "view-only assign " + JSON.stringify([o0, o1]));
  }, page);

await r.check(["UI-403", "UI-404", "UI-405", "UI-406"], "Transfer: needs a target; Cancel changes nothing; transfer replaces every assignee", async () => {
  await leads(bq);
  await selectRow(B[0]);
  await bulk().getByRole("button", { name: "Transfer" }).click();
  const d = dlg("Transfer 1 lead");
  expect(await d.getByRole("button", { name: "Transfer" }).isDisabled(), "Transfer enabled with no target");
  await d.getByRole("button", { name: "Cancel" }).click();
  await d.waitFor({ state: "hidden" });
  expect((await owners(bIds[0])).length === 2, "Cancel changed owners");
  await bulk().getByRole("button", { name: "Transfer" }).click();
  await d.getByLabel(/QA Admin Two/).check();
  await d.getByRole("button", { name: "Transfer" }).click();
  await d.waitFor({ state: "hidden" });
  const o = await owners(bIds[0]);
  expect(o.length === 1 && o[0].u !== ids.exec1 && o[0].can_update, "owners after transfer " + JSON.stringify(o));
  expect((await count("select count(*) n from lead_assignment_events where lead_id=$1 and reason='transfer'", [bIds[0]])) >= 1, "transfer not in ownership history");
}, page);

await r.check(["UI-494", "UI-523", "UI-392", "UI-393", "UI-394"], "Unassign: confirm dialog Cancel keeps owners; confirm removes every assignee", async () => {
  await leads(bq);
  await selectRow(B[0]); await selectRow(B[1]);
  await bulk().getByRole("button", { name: "Unassign" }).click();
  const d = dlg("Remove assignments");
  await d.getByText("Remove every assignee from 2 selected lead(s)?").waitFor();
  await d.getByRole("button", { name: "Cancel" }).click();
  await d.waitFor({ state: "hidden" });
  expect((await owners(bIds[1])).length === 1, "Cancel removed owners");
  await bulk().getByRole("button", { name: "Unassign" }).click();
  await d.getByRole("button", { name: "Remove assignments" }).click();
  await d.waitFor({ state: "hidden" });
  await toastText(/Unassigned 2 lead/).waitFor();
  expect((await owners(bIds[0])).length === 0 && (await owners(bIds[1])).length === 0, "owners remain");
  await page.locator("table tbody tr").filter({ hasText: B[1] }).getByText("Unassigned").waitFor();
}, page);

await r.check(["UI-495", "UI-522", "UI-385", "UI-386", "UI-387", "UI-388", "UI-389", "UI-390", "UI-391"],
  "Status & tags: empty Apply is refused; Cancel; status/call/priority/tags persist with status history", async () => {
    await leads(bq);
    await page.getByLabel("Select all leads on this page").check();
    await bulk().getByRole("button", { name: "Status & tags" }).click();
    const d = dlg("Update status, priority & tags");
    await d.getByRole("button", { name: "Apply" }).click();
    await d.getByRole("alert").filter({ hasText: "Choose at least one change." }).waitFor();
    await d.getByRole("button", { name: "Cancel" }).click();
    await d.waitFor({ state: "hidden" });
    await bulk().getByRole("button", { name: "Status & tags" }).click();
    await d.locator("#bf-status").selectOption("Won Lead");
    await d.locator("#bf-call").selectOption("Converted");
    await d.locator("#bf-priority").selectOption("Medium");
    await d.locator("#bf-tags").fill(`uil${tag}, q9`);
    await d.getByRole("button", { name: "Apply" }).click();
    await d.waitFor({ state: "hidden" });
    await toastText(/Updated 3 lead/).waitFor();
    const rows = await all("select status, call_status, priority, tags from leads where id = any($1::uuid[])", [bIds]);
    expect(rows.length === 3 && rows.every((x) => x.status === "Won Lead" && x.call_status === "Converted" && x.priority === "Medium" && x.tags.includes(`uil${tag}`) && x.tags.includes("q9")), JSON.stringify(rows));
    expect((await count("select count(*) n from lead_status_history where lead_id = any($1::uuid[]) and to_status='Won Lead'", [bIds])) === 3, "status history not recorded for 3 leads");
  }, page);

await r.check(["UI-496", "UI-521", "UI-407", "UI-408", "UI-409", "UI-410", "UI-411"],
  "Bulk update: Apply disabled while empty; Cancel; category and location persist on every selected lead", async () => {
    await leads(bq);
    await page.getByLabel("Select all leads on this page").check();
    await bulk().getByRole("button", { name: "Bulk update" }).click();
    const d = dlg("Bulk update 3 leads");
    expect(await d.getByRole("button", { name: "Apply changes" }).isDisabled(), "Apply enabled with no values");
    await d.getByRole("button", { name: "Cancel" }).click();
    await d.waitFor({ state: "hidden" });
    await bulk().getByRole("button", { name: "Bulk update" }).click();
    await d.locator("#bu-cat").fill(`${T}cat`);
    await d.locator("#bu-loc").fill(`${T}loc`);
    await d.getByRole("button", { name: "Apply changes" }).click();
    await d.waitFor({ state: "hidden" });
    await toastText(/Updated 3 lead/).waitFor();
    const rows = await all("select category, location from leads where id = any($1::uuid[])", [bIds]);
    expect(rows.every((x) => x.category === `${T}cat` && x.location === `${T}loc`), JSON.stringify(rows));
  }, page);

// ---------------------------------------------------------------- Filters, chips, sort, paging
await r.check(["UI-485", "UI-486", "UI-516", "UI-427", "UI-424", "UI-425", "UI-426", "UI-429", "UI-430", "UI-431", "UI-432", "UI-433", "UI-434"],
  "Filter dialog: Cancel, group search/clear, date validation, assignment and Apply narrow the list to the DB match", async () => {
    await leads();
    const btn = page.getByRole("button", { name: /^Filters/ });
    expect((await btn.locator("svg").count()) === 1, "filter icon missing");
    await btn.click();
    const d = dlg("Filter leads");
    await d.getByRole("button", { name: "Cancel" }).click();
    await d.waitFor({ state: "hidden" });
    expect(!page.url().includes("?"), "Cancel changed the URL");
    await btn.click();
    const cat = d.getByRole("group", { name: /Category/ });
    const search = cat.getByLabel("Search Category");
    if (await search.count()) { await search.fill(`${T}cat`); expect((await cat.locator("label").count()) === 1, "category search did not narrow"); }
    await cat.getByLabel(`${T}cat`, { exact: true }).check();
    await cat.getByRole("button", { name: "Clear Category" }).click();
    expect(!(await cat.getByLabel(`${T}cat`, { exact: true }).isChecked()), "Clear Category did not clear");
    await cat.getByLabel(`${T}cat`, { exact: true }).check();
    await d.locator("#flt-dt").selectOption("createdAt");
    await d.locator("#flt-from").fill(istDay(1));
    await d.locator("#flt-to").fill(istDay(-1));
    await d.getByRole("button", { name: "Apply filters" }).click();
    await d.getByRole("alert").filter({ hasText: "The start date must not be after the end date." }).waitFor();
    expect(await d.isVisible(), "dialog closed on invalid range");
    await d.locator("#flt-from").fill(istDay(-1));
    await d.locator("#flt-to").fill(istDay(0));
    await d.getByRole("group", { name: "Assignment" }).getByLabel("Unassigned").check();
    await d.getByRole("button", { name: "Apply filters" }).click();
    await d.waitFor({ state: "hidden" });
    await page.waitForURL(/category=/);
    await settle();
    const u = new URL(page.url());
    expect(u.searchParams.get("category") === `${T}cat` && u.searchParams.get("assigned") === "unassigned" && u.searchParams.get("dateType") === "createdAt"
      && u.searchParams.get("from") === istDay(-1) && u.searchParams.get("to") === istDay(0), "URL " + u.search);
    const dbN = await count(`select count(*) n from leads l where category=$1 and not exists (select 1 from lead_assignments a where a.lead_id=l.id) and ${IST("created_at")} between $2 and $3`, [`${T}cat`, istDay(-1), istDay(0)]);
    await page.locator("table tbody tr").filter({ hasText: B[0] }).waitFor();
    expect((await page.locator("table tbody tr").count()) === dbN && dbN === 3, `rows vs db ${dbN}`);
    expect((await btn.innerText()).includes("3"), "active filter count not shown: " + (await btn.innerText()));
  }, page);

await r.check(["UI-428"], "Clear all filters (dialog) drops every filter but keeps the search", async () => {
  await leads(`${q(T)}&category=${encodeURIComponent(`${T}cat`)}&status=Won+Lead`);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await dlg("Filter leads").getByRole("button", { name: "Clear all filters" }).click();
  await page.waitForURL((u) => !u.search.includes("category"));
  const u = new URL(page.url());
  expect(u.searchParams.get("q") === T && !u.searchParams.has("status"), "URL " + u.search);
}, page);

await r.check(["UI-489", "UI-490", "UI-491"], "Filter chips: remove one filter, remove the search, Clear all", async () => {
  await leads(`${q(T)}&category=${encodeURIComponent(`${T}cat`)}&location=${encodeURIComponent(`${T}loc`)}`);
  await page.getByRole("button", { name: `Remove filter Category: ${T}cat` }).click();
  await page.waitForURL((u) => !u.search.includes("category"));
  let u = new URL(page.url());
  expect(u.searchParams.get("q") === T && u.searchParams.get("location") === `${T}loc`, "after chip remove " + u.search);
  await settle();
  await page.getByRole("button", { name: `Remove search ${T}` }).click();
  await page.waitForURL((x) => !x.search.includes("q="));
  expect((await page.getByLabel("Search leads").inputValue()) === "", "search box not cleared");
  await settle();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await page.waitForURL((x) => x.search === "");
  u = new URL(page.url());
  expect(u.pathname === "/crm/lead-management", "Clear all URL " + u.href);
}, page);

await r.check(["UI-488"], "Then-by sort adds a tiebreak to the URL, disables the primary field and orders rows like the DB", async () => {
  await leads(q(T) + "&sort=status:asc");
  const s2 = page.getByLabel("Then by");
  expect(await s2.locator('option[value="status:asc"]').isDisabled(), "primary field offered as tiebreak");
  await s2.selectOption("name:desc");
  await page.waitForURL(/sort=name%3Adesc|sort=name:desc/);
  await settle();
  const u = new URL(page.url());
  expect(JSON.stringify(u.searchParams.getAll("sort")) === JSON.stringify(["status:asc", "name:desc"]), "sort params " + u.search);
  const want = (await all("select name from leads where name ilike $1 order by status asc, name desc, id", [`%${T}%`])).map((x) => x.name);
  const got = await page.locator("table tbody tr td:nth-child(2) button").allInnerTexts();
  expect(JSON.stringify(got) === JSON.stringify(want), `order ui=${got.join("|")} db=${want.join("|")}`);
}, page);

await r.check(["UI-508", "UI-509", "UI-510"], "Rows per page changes page size; First/Previous page navigate back and are disabled on page 1", async () => {
  await leads();
  expect(await page.getByRole("button", { name: "First page" }).isDisabled() && await page.getByRole("button", { name: "Previous page" }).isDisabled(), "First/Previous enabled on page 1");
  const total = await count("select count(*) n from leads");
  await page.locator("#page-size").selectOption("50");
  await page.waitForURL(/pageSize=50/);
  await settle();
  expect((await page.locator("table tbody tr").count()) === Math.min(50, total), "50 rows not shown");
  await leads("page=3");
  await page.getByRole("button", { name: "Previous page" }).click();
  await page.waitForURL(/page=2/);
  await settle();
  await page.getByText(/Page 2 of/).waitFor();
  await page.getByRole("button", { name: "First page" }).click();
  await page.waitForURL((u) => !u.search.includes("page="));
  await page.getByText(/Page 1 of/).waitFor();
}, page);

await r.check(["UI-507"], "Empty result offers Clear filters, which restores the full list", async () => {
  await leads();
  await go(`/crm/lead-management?${q(`${T}-nomatch`)}`);
  await page.getByText("No leads match this view").waitFor();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.waitForURL((u) => u.search === "");
  await settle();
  expect((await page.locator("table tbody tr").count()) > 1, "list not restored");
}, page);

await r.check(["UI-482"], "Lead view switcher links navigate to the preset page and mark it current", async () => {
  await leads();
  const nav = page.getByRole("navigation", { name: "Lead views" });
  await nav.getByRole("link", { name: "Unassigned" }).click();
  await page.waitForURL("**/crm/unassigned-leads");
  await settle();
  expect((await nav.getByRole("link", { name: "Unassigned" }).getAttribute("aria-current")) === "page", "aria-current not set");
  await page.getByText("Leads waiting to be assigned").waitFor();
}, page);

// ---------------------------------------------------------------- Products / export / saved views
await r.check(["UI-479", "UI-518", "UI-468", "UI-469", "UI-470", "UI-471", "UI-472", "UI-473"],
  "Products: search disabled while empty; results table shows catalogue rows; no-match message; Close", async () => {
    await leads();
    await page.getByRole("button", { name: "Products" }).click();
    const d = dlg("Search products");
    const btn = d.getByRole("button", { name: "Search", exact: true });
    expect(await btn.isDisabled(), "Search enabled with empty query");
    await d.getByLabel("Product search").fill("E2E Product");
    await btn.click();
    const rows = d.locator("table tbody tr");
    await rows.first().waitFor();
    const dbN = await count("select count(*) n from products where status <> 'ARCHIVED' and p_name ilike '%E2E Product%'");
    expect((await rows.count()) === Math.min(dbN, 50), `rows ${await rows.count()} db ${dbN}`);
    const p1 = await rows.filter({ hasText: "E2E-P1" }).innerText();
    expect(/E2E Product 1/.test(p1) && /\b12\b/.test(p1), "E2E-P1 row: " + p1);
    await d.getByLabel("Product search").press("Control+a");
    await d.getByLabel("Product search").fill(`zz-${T}-none`);
    await d.getByLabel("Product search").press("Enter"); // submits the form
    await d.getByText("No products found.").waitFor();
    await d.getByRole("button", { name: "Close", exact: true }).click();
    await d.waitFor({ state: "hidden" });
  }, page);

await r.check(["UI-417", "UI-419", "UI-420", "UI-421", "UI-422", "UI-423"],
  "Export: Cancel; inverted range refused; XLSX and CSV downloads honour format, date field, range and view", async () => {
    await leads(q(T));
    const open = async () => { await page.getByRole("button", { name: "Export" }).click(); return dlg("Export leads"); };
    let d = await open();
    await d.getByRole("button", { name: "Cancel" }).click();
    await d.waitFor({ state: "hidden" });
    d = await open();
    await d.locator("#dl-from").fill(istDay(1));
    await d.locator("#dl-to").fill(istDay(-1));
    await d.getByRole("button", { name: "Download" }).click();
    await toastText(/start date must not be after/).waitFor();
    expect(await d.isVisible(), "dialog closed on invalid range");
    await d.locator("#dl-from").fill(istDay(0));
    await d.locator("#dl-to").fill(istDay(0));
    await d.getByLabel(/Excel \(XLSX\)/).check();
    let [dl] = await Promise.all([page.waitForEvent("download"), d.getByRole("button", { name: "Download" }).click()]);
    let u = new URL(dl.url());
    expect(u.searchParams.get("format") === "xlsx" && u.searchParams.get("from") === istDay(0) && u.searchParams.get("dateType") === "createdAt" && u.searchParams.get("q") === T, "xlsx url " + u.search);
    const xlsx = readFileSync(await dl.path());
    expect(xlsx.subarray(0, 2).toString() === "PK", "not an xlsx file");
    // CSV, follow-up date field: only lead A has a follow-up in the range.
    d = await open();
    await d.locator("#dl-type").selectOption("followUpDate");
    await d.locator("#dl-from").fill(istDay(0));
    await d.locator("#dl-to").fill(istDay(10));
    await d.getByLabel(/^CSV/).check();
    [dl] = await Promise.all([page.waitForEvent("download"), d.getByRole("button", { name: "Download" }).click()]);
    u = new URL(dl.url());
    expect(u.searchParams.get("format") === "csv" && u.searchParams.get("dateType") === "followUpDate", "csv url " + u.search);
    const csv = readFileSync(await dl.path(), "utf8").replace(/^﻿/, "").trim().split(/\r?\n/);
    const dbN = await count(`select count(*) n from leads where name ilike $1 and ${IST("follow_up_date")} between $2 and $3`, [`%${T}%`, istDay(0), istDay(10)]);
    expect(csv.length - 1 === dbN && dbN === 1 && csv.slice(1).join("\n").includes(nameA), `csv rows ${csv.length - 1} db ${dbN}`);
  }, page);

const viewName = `${T} view`;
await r.check(["UI-478", "UI-527", "UI-528", "UI-529", "UI-530", "UI-531", "UI-532", "UI-533", "UI-534", "UI-535"],
  "Saved views: save disabled without a query; Cancel; name required; shared view persists, opens and deletes", async () => {
    await leads();
    const main = page.getByRole("main");
    const menuBtn = main.locator('button[aria-haspopup="menu"]').first();
    await menuBtn.click();
    const menu = page.getByRole("menu", { name: "Saved views" });
    expect(await menu.getByRole("menuitem", { name: /Save current view/ }).isDisabled(), "save enabled without filters");
    await menuBtn.click();
    await leads(`${q(T)}&sort=name:asc`);
    await menuBtn.click();
    await menu.getByRole("menuitem", { name: /Save current view/ }).click();
    const d = dlg("Save view");
    await d.getByRole("button", { name: "Cancel" }).click();
    await d.waitFor({ state: "hidden" });
    await menuBtn.click();
    await menu.getByRole("menuitem", { name: /Save current view/ }).click();
    await d.getByRole("button", { name: "Save view" }).click();
    await toastText(/Name the view/).waitFor();
    await d.getByLabel("Name").fill(viewName);
    await d.getByLabel("Share with everyone").check();
    await d.getByRole("button", { name: "Save view" }).click();
    await d.waitFor({ state: "hidden" });
    const row = await until(() => one("select shared, params, entity, user_id::text u from saved_views where name=$1", [viewName]), "view not saved");
    expect(row.shared === true && row.entity === "leads" && row.u === ids.admin && JSON.stringify(row.params).includes(T) && JSON.stringify(row.params).includes("name:asc"), JSON.stringify(row));
    await leads();
    await menuBtn.click();
    await menu.getByRole("menuitem", { name: viewName }).click();
    await page.waitForURL((u) => u.searchParams.get("q") === T);
    await settle();
    await main.locator('button[aria-haspopup="menu"]', { hasText: viewName }).waitFor();
    await menuBtn.click();
    await menu.getByRole("button", { name: `Delete view ${viewName}` }).click();
    await toastText(/Deleted/).waitFor();
    expect((await count("select count(*) n from saved_views where name=$1", [viewName])) === 0, "view not deleted");
  }, page);

// ---------------------------------------------------------------- Deletes
await r.check(["UI-506", "UI-525"], "Row Delete opens a confirm; Cancel keeps the lead; confirm deletes it", async () => {
  const name = `${T} Del1`;
  const id = await mkLead(name, { phone: phone(30) });
  await leads(q(name));
  await page.getByRole("button", { name: `Delete ${name}` }).click();
  const d = dlg("Delete lead");
  await d.getByRole("button", { name: "Cancel" }).click();
  await d.waitFor({ state: "hidden" });
  expect((await count("select count(*) n from leads where id=$1", [id])) === 1, "Cancel deleted the lead");
  await page.getByRole("button", { name: `Delete ${name}` }).click();
  await d.getByRole("button", { name: "Delete lead" }).click();
  await d.waitFor({ state: "hidden" });
  await toastText(/Lead deleted/).waitFor();
  expect((await count("select count(*) n from leads where id=$1", [id])) === 0, "lead still present");
}, page);

// ===================================================================== EMPLOYEE (lead list restrictions)
const ectx = await signedIn(browser, "qa.exec1");
const epage = await ectx.newPage();
epage.setDefaultTimeout(15000);
await r.check(["UI-499", "UI-501", "UI-506", "UI-482", "UI-434", "UI-445", "UI-535", "UI-66"],
  "Employee: no select/bulk/delete/delete-all controls, no admin views, no assignment filter, identity fields locked, no view sharing", async () => {
    const admin = page; page = epage;
    try {
      await go(`/crm/my-leads?${q(nameA)}`);
      await page.getByRole("button", { name: nameA, exact: true }).waitFor();
      expect((await page.getByLabel("Select all leads on this page").count()) === 0, "select-all visible");
      expect((await page.getByRole("region", { name: "Bulk actions" }).count()) === 0, "bulk bar visible (incl. Delete all matching)");
      expect((await page.getByRole("button", { name: /Delete all .* matching/ }).count()) === 0, "Delete all matching visible");
      expect((await page.getByRole("button", { name: `Delete ${nameA}` }).count()) === 0, "row delete visible");
      const nav = page.getByRole("navigation", { name: "Lead views" });
      expect((await nav.getByRole("link", { name: "Unassigned" }).count()) === 0 && (await nav.getByRole("link", { name: "All my leads" }).count()) === 1, "wrong view set");
      await page.getByRole("button", { name: /^Filters/ }).click();
      expect((await dlg("Filter leads").getByRole("group", { name: "Assignment" }).count()) === 0, "assignment filter shown");
      await dlg("Filter leads").getByRole("button", { name: "Cancel" }).click();
      await page.getByRole("button", { name: `Edit ${nameA}` }).click();
      const e = dlg("Edit lead");
      await e.locator("#lf-contact").waitFor();
      expect(await e.locator("#lf-contact").isDisabled() && await e.locator("#lf-phone").isDisabled() && await e.locator("#lf-company").isDisabled(), "identity fields editable");
      await e.getByRole("button", { name: "Cancel" }).click();
      await page.getByRole("main").locator('button[aria-haspopup="menu"]').first().click();
      await page.getByRole("menu", { name: "Saved views" }).getByRole("menuitem", { name: /Save current view/ }).click();
      expect((await dlg("Save view").getByLabel("Share with everyone").count()) === 0, "share offered to employee");
      await dlg("Save view").getByRole("button", { name: "Cancel" }).click();
      // Admin-only pipeline views are refused; the all-leads list is scoped to the employee and has no bulk/delete controls.
      await page.goto(base + "/crm/unassigned-leads");
      expect(new URL(page.url()).pathname === "/crm/entrydashboard", "employee reached admin-only list: " + page.url());
      await go(`/crm/lead-management?${q(T)}`);
      await page.getByRole("button", { name: nameA, exact: true }).waitFor();
      expect((await page.getByRole("region", { name: "Bulk actions" }).count()) === 0 && (await page.getByRole("button", { name: /^Delete / }).count()) === 0, "delete controls on employee all-leads list");
      const visible = await page.locator("table tbody tr td:first-child button").allInnerTexts();
      const allowed = (await all("select l.name from leads l join lead_assignments a on a.lead_id=l.id where a.user_id=$1 and l.name ilike $2", [ids.exec1, `%${T}%`])).map((x) => x.name);
      expect(visible.every((n) => allowed.includes(n)), "employee sees unassigned leads: " + visible.join("|"));
      // The detail page's back link goes to My leads.
      await go("/crm/lead-management/" + leadA);
      await page.getByRole("link", { name: "Back to leads" }).click();
      await page.waitForURL("**/crm/my-leads");
      // Not-assigned employee cannot open the lead page.
      const x2 = await signedIn(browser, "qa.exec2");
      const p2 = await x2.newPage();
      const resp = await p2.goto(base + "/crm/lead-management/" + leadA);
      expect(resp.status() === 404 || (await p2.getByText(/not found|could not be found/i).count()) > 0, "unassigned employee saw the lead");
      await x2.close();
    } finally { page = admin; }
  }, epage);

// Delete all matching (admin) - run after the employee check so Bulk leads exist for both.
await r.check(["UI-499", "UI-526"], "Delete all matching: confirm deletes exactly the filtered leads and nothing else", async () => {
  const seeded = await count("select count(*) n from leads where name like 'E2E Lead %'");
  await leads(bq);
  await bulk().getByRole("button", { name: "Delete all 3 matching" }).click();
  const d = dlg("Delete all matching leads");
  await d.getByText(/Permanently delete all 3 leads/).waitFor();
  await d.getByRole("button", { name: "Cancel" }).click();
  await d.waitFor({ state: "hidden" });
  expect((await count("select count(*) n from leads where id = any($1::uuid[])", [bIds])) === 3, "Cancel deleted");
  await bulk().getByRole("button", { name: "Delete all 3 matching" }).click();
  await d.getByRole("button", { name: "Delete 3 leads" }).click();
  await d.waitFor({ state: "hidden" });
  await toastText(/Deleted 3 lead/).waitFor();
  expect((await count("select count(*) n from leads where id = any($1::uuid[])", [bIds])) === 0, "bulk leads remain");
  expect((await count("select count(*) n from leads where id=$1", [leadA])) === 1, "non-matching lead deleted");
  expect((await count("select count(*) n from leads where name like 'E2E Lead %'")) === seeded, "seeded leads affected");
}, page);

// ===================================================================== ACTIVITIES
const actDlg = () => dlg("New activity");
async function newActivity(p, v) {
  await p.getByRole("button", { name: "New activity" }).click();
  const d = p.getByRole("dialog", { name: "New activity" });
  if (v.type) await d.getByLabel("Type").selectOption(v.type);
  await d.getByLabel("Subject").fill(v.subject);
  if (v.due) await d.getByLabel(/Due \(IST\)/).fill(v.due);
  if (v.assignee) await d.getByLabel("Assigned to").selectOption({ label: v.assignee });
  await d.getByRole("button", { name: "Save" }).click();
  await d.waitFor({ state: "hidden" });
  return until(() => one("select id::text, status from activities where subject=$1", [v.subject]), "activity not created: " + v.subject);
}

const fuSubject = `${T} follow-up done`;
const fuDue = istLocal(-3);
await r.check(["UI-18", "UI-332", "UI-333", "UI-334", "UI-335", "UI-336", "UI-337", "UI-338", "UI-339", "UI-340", "UI-341", "UI-342", "UI-343", "UI-344", "UI-345"],
  "New activity: Cancel saves nothing; subject and follow-up due date are validated; every field persists", async () => {
    await go("/crm/activities");
    await page.getByRole("button", { name: "New activity" }).click();
    const d = actDlg();
    await d.getByLabel("Subject").fill(fuSubject);
    await d.getByRole("button", { name: "Cancel" }).click();
    await d.waitFor({ state: "hidden" });
    expect((await count("select count(*) n from activities where subject=$1", [fuSubject])) === 0, "Cancel saved");
    await page.getByRole("button", { name: "New activity" }).click();
    expect((await d.getByLabel("Type").inputValue()) === "TASK", "default type on activities page is not Task");
    await d.getByRole("button", { name: "Save" }).click();
    await d.getByRole("alert").filter({ hasText: "Enter a subject." }).waitFor();
    await d.getByLabel("Type").selectOption("NOTE");
    expect((await d.getByLabel(/Due \(IST\)/).count()) === 0 && await d.getByLabel("Priority").isDisabled(), "note still shows due/priority");
    await d.getByLabel("Type").selectOption("FOLLOW_UP");
    await d.getByLabel("Subject").fill(fuSubject);
    await d.getByRole("button", { name: "Save" }).click();
    await d.getByRole("alert").filter({ hasText: "A follow-up needs a due date and time." }).waitFor();
    await d.getByLabel("Priority").selectOption("HIGH");
    await d.getByLabel(/Due \(IST\)/).fill(fuDue);
    await d.getByLabel("Assigned to").selectOption({ label: "QA Exec One" });
    await d.getByLabel("Details").fill("Discussed pricing");
    await d.getByLabel(/This already happened/).check();
    await d.getByLabel("Outcome").fill("Asked for quotation");
    await d.getByRole("button", { name: "Save" }).click();
    await d.waitFor({ state: "hidden" });
    await toastText(/Activity logged/).waitFor();
    const a = await one(`select type, priority, assignee_id::text asg, created_by_id::text c, body, status, outcome, completed_at is not null done,
      to_char((due_at at time zone 'UTC') at time zone 'Asia/Kolkata','YYYY-MM-DD"T"HH24:MI') due from activities where subject=$1`, [fuSubject]);
    const want = { type: "FOLLOW_UP", priority: "HIGH", asg: ids.exec1, c: ids.admin, body: "Discussed pricing", status: "COMPLETED", outcome: "Asked for quotation", done: true, due: fuDue };
    for (const [k, v] of Object.entries(want)) expect(a?.[k] === v, `${k}: db=${a?.[k]} want=${v}`);
  }, page);

const taskSubject = `${T} task one`;
await r.check(["UI-346", "UI-347", "UI-348", "UI-349", "UI-350", "UI-351", "UI-352", "UI-353", "UI-354", "UI-355"],
  "Row actions: Mark done (Cancel, outcome), Reopen, Cancel activity and Delete each persist", async () => {
    await go("/crm/activities?view=all");
    const act = await newActivity(page, { subject: taskSubject, due: istLocal(2) });
    await go(`/crm/activities?view=all&q=${encodeURIComponent(taskSubject)}`);
    await page.getByRole("button", { name: `Mark "${taskSubject}" done` }).click();
    let d = dlg("Mark as done");
    await d.getByRole("button", { name: "Cancel" }).click();
    await d.waitFor({ state: "hidden" });
    expect((await one("select status from activities where id=$1", [act.id])).status === "OPEN", "Cancel completed it");
    await page.getByRole("button", { name: `Mark "${taskSubject}" done` }).click();
    await d.getByLabel("Outcome (optional)").fill("Interested");
    await d.getByRole("button", { name: "Mark done" }).click();
    await d.waitFor({ state: "hidden" });
    let a = await one("select status, outcome, completed_by_id::text cb from activities where id=$1", [act.id]);
    expect(a.status === "COMPLETED" && a.outcome === "Interested" && a.cb === ids.admin, "complete " + JSON.stringify(a));
    await page.getByRole("button", { name: `Reopen "${taskSubject}"` }).click();
    await page.getByRole("button", { name: `Mark "${taskSubject}" done` }).waitFor();
    a = await one("select status, completed_at from activities where id=$1", [act.id]);
    expect(a.status === "OPEN" && a.completed_at === null, "reopen " + JSON.stringify(a));
    await page.getByRole("button", { name: `Cancel "${taskSubject}"` }).click();
    d = dlg("Cancel activity");
    await d.getByRole("button", { name: "Cancel activity" }).click();
    await d.waitFor({ state: "hidden" });
    expect((await one("select status from activities where id=$1", [act.id])).status === "CANCELLED", "not cancelled");
    await page.getByRole("button", { name: `Reopen "${taskSubject}"` }).waitFor();
    await page.getByRole("button", { name: `Delete "${taskSubject}"` }).click();
    d = dlg("Delete activity");
    await d.getByRole("button", { name: "Delete", exact: true }).click();
    await d.waitFor({ state: "hidden" });
    expect((await count("select count(*) n from activities where id=$1", [act.id])) === 0, "not deleted");
    expect((await count("select count(*) n from activity_logs where action='activity.deleted' and details->>'activityId'=$1", [act.id])) >= 1, "delete not audited");
  }, page);

const task2 = `${T} task for exec`;
await r.check(["UI-346", "UI-349", "UI-25", "UI-342"],
  "Activity permissions: assignee may complete but not delete; other employees do not see it; employee has no assignee controls", async () => {
    await go("/crm/activities?view=all");
    const act = await newActivity(page, { subject: task2, due: istLocal(4), assignee: "QA Exec One" });
    await go(`/crm/activities?view=all&q=${encodeURIComponent(task2)}`);
    expect((await page.getByRole("button", { name: `Delete "${task2}"` }).count()) === 1, "admin has no delete");
    const admin = page; page = epage;
    try {
      await go(`/crm/activities?view=all&q=${encodeURIComponent(task2)}`);
      await page.getByRole("button", { name: `Mark "${task2}" done` }).waitFor();
      expect((await page.getByRole("button", { name: `Delete "${task2}"` }).count()) === 0, "assignee can delete");
      expect((await page.locator("#act-assignee").count()) === 0, "employee sees Assigned-to filter");
      await page.getByRole("button", { name: "New activity" }).click();
      expect((await dlg("New activity").getByLabel("Assigned to").count()) === 0, "employee can assign activities");
      await dlg("New activity").getByRole("button", { name: "Cancel" }).click();
      await page.getByRole("button", { name: `Mark "${task2}" done` }).click();
      await dlg("Mark as done").getByRole("button", { name: "Mark done" }).click();
      await dlg("Mark as done").waitFor({ state: "hidden" });
      const a = await one("select status, completed_by_id::text cb from activities where id=$1", [act.id]);
      expect(a.status === "COMPLETED" && a.cb === ids.exec1, "employee completion " + JSON.stringify(a));
      const x2 = await signedIn(browser, "qa.exec2");
      const p2 = await x2.newPage();
      await p2.goto(`${base}/crm/activities?view=all&q=${encodeURIComponent(task2)}`);
      await p2.waitForLoadState("networkidle").catch(() => {});
      expect((await p2.getByText(task2).count()) === 0, "other employee sees the activity");
      await x2.close();
    } finally { page = admin; }
  }, page);

await r.check(["UI-20", "UI-21", "UI-22", "UI-23", "UI-24", "UI-25", "UI-26", "UI-27", "UI-19", "UI-17"],
  "Activities filter form keeps view and sort, filters by text/type/assignee like the DB; Reset; tabs; lead link", async () => {
    await go("/crm/activities?view=all&sort=created&dir=asc");
    const form = page.getByRole("search", { name: "Filter activities" });
    await form.locator("#act-q").fill(T);
    await form.locator("#act-type").selectOption("FOLLOW_UP");
    await form.locator("#act-assignee").selectOption({ label: "QA Exec One" });
    await form.getByRole("button", { name: "Apply" }).click();
    await page.waitForURL(/type=FOLLOW_UP/);
    await settle();
    const u = new URL(page.url());
    expect(u.searchParams.get("view") === "all" && u.searchParams.get("sort") === "created" && u.searchParams.get("dir") === "asc"
      && u.searchParams.get("q") === T && u.searchParams.get("assignee") === ids.exec1, "URL " + u.search);
    const dbN = await count("select count(*) n from activities where subject ilike $1 and type='FOLLOW_UP' and assignee_id=$2", [`%${T}%`, ids.exec1]);
    await page.getByText(fuSubject).waitFor();
    const rows = await page.locator("table tbody tr").count();
    expect(rows === dbN && dbN === 1, `rows ${rows} db ${dbN}`);
    await form.getByRole("link", { name: "Reset" }).click();
    await page.waitForURL((x) => x.search === "?view=all");
    await settle();
    const tabs = page.getByRole("navigation", { name: "Activity views" });
    await go(`/crm/activities?view=all&q=${encodeURIComponent(T)}`);
    await tabs.getByRole("link", { name: /^Completed/ }).click();
    await page.waitForURL(/view=completed/);
    await settle();
    expect(new URL(page.url()).searchParams.get("q") === T, "tab dropped the search");
    expect((await tabs.getByRole("link", { name: /^Completed/ }).getAttribute("aria-current")) === "page", "tab not current");
    await page.getByText(fuSubject).waitFor();
    await go(`/crm/activities?view=all&q=${encodeURIComponent(callSubject)}`);
    await page.getByRole("link", { name: nameA }).click();
    await page.waitForURL("**/crm/lead-management/" + leadA);
  }, page);

// ===================================================================== IMPORT
const csvHead = "Company Name,Contact Person,Mobile Number,Email,City,State,Category,Requirements,Remarks";
const fileOk = `${scratch}/${T}-import.csv`;
writeFileSync(fileOk, [csvHead,
  `${T} ImpCo 1,${T} Imp One,${importPhone(1)},,Pune,Maharashtra,Gifts,Mugs,first`,
  `${T} ImpCo 2,${T} Imp Two,${importPhone(2)},,Delhi,Delhi,Gifts,Pens,second`,
  `${T} ImpCo 3,${T} Imp Bad,12345,,Pune,Maharashtra,Gifts,,bad phone`,
  `${T} ImpCo 4,${T} Imp Dup,${importPhone(1)},,Pune,Maharashtra,Gifts,,dup in file`].join("\n"));
const fileCancel = `${scratch}/${T}-cancel.csv`;
writeFileSync(fileCancel, [csvHead, `${T} CanCo,${T} Cancel,${importPhone(5)},,Pune,MH,Gifts,,`].join("\n"));
const fileTxt = `${scratch}/${T}-notes.txt`;
writeFileSync(fileTxt, "not a csv");

await r.check(["UI-62"], "Sample CSV link downloads a template with the required columns", async () => {
  await go("/crm/import-leads");
  const href = await page.getByRole("link", { name: "Sample CSV" }).getAttribute("href");
  const res = await page.request.get(new URL(href, base).toString());
  const text = (await res.text()).replace(/^﻿/, "");
  expect(res.status() === 200 && text.startsWith("Company Name,Contact Person,Mobile Number"), `status ${res.status()} body ${text.slice(0, 80)}`);
}, page);

await r.check(["UI-54", "UI-56", "UI-52"], "File input rejects non-CSV; Cancel and Start over return to upload without importing", async () => {
  await go("/crm/import-leads");
  const input = page.getByLabel("CSV file to import", { exact: true });
  await input.setInputFiles(fileTxt);
  await toastText(/Please choose a \.csv file/).waitFor();
  await page.getByRole("button", { name: "Choose a CSV file to import" }).waitFor();
  await input.setInputFiles(fileCancel);
  await page.getByRole("button", { name: "Import 1 lead" }).waitFor();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Choose a CSV file to import" }).waitFor();
  await page.getByLabel("CSV file to import", { exact: true }).setInputFiles(fileCancel);
  await page.getByRole("button", { name: "Import 1 lead" }).waitFor();
  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("button", { name: "Choose a CSV file to import" }).waitFor();
  expect((await count("select count(*) n from lead_import_jobs where file_name=$1", [`${T}-cancel.csv`])) === 0, "job created");
  expect((await count("select count(*) n from leads where phone=$1", [importPhone(5)])) === 0, "lead created");
}, page);

await r.check(["UI-53", "UI-58", "UI-59", "UI-55", "UI-57", "UI-60", "UI-61", "UI-63", "UI-64"],
  "Import: drop zone opens the picker; preview splits valid/skipped rows; import with assignee persists; report and history", async () => {
    await go("/crm/import-leads");
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Choose a CSV file to import" }).click()]);
    await chooser.setFiles(fileOk);
    await page.getByRole("button", { name: "Import 2 leads" }).waitFor();
    const validT = page.locator("section", { has: page.getByRole("heading", { name: /^Valid rows/ }) }).locator("table");
    const skipT = page.locator("section", { has: page.getByRole("heading", { name: /^Skipped rows/ }) }).locator("table");
    const vt = await validT.innerText(), st = await skipT.innerText();
    expect(vt.includes(`${T} ImpCo 1`) && vt.includes(`${T} ImpCo 2`) && (await validT.locator("tbody tr").count()) === 2, "valid table: " + vt);
    expect(/Invalid Mobile Number/.test(st) && /Duplicate Mobile Number \(in file\)/.test(st) && (await skipT.locator("tbody tr").count()) === 2, "skipped table: " + st);
    await page.getByLabel("Assign imported leads to (optional)").selectOption({ label: "QA Exec One" });
    await page.getByRole("button", { name: "Import 2 leads" }).click();
    await page.getByText("Import finished.").waitFor({ timeout: 30000 });
    const job = await one("select id::text, total_rows, imported, skipped, duplicates, status from lead_import_jobs where file_name=$1", [`${T}-import.csv`]);
    expect(job && job.total_rows === 4 && job.imported === 2 && job.status === "COMPLETED", "job " + JSON.stringify(job));
    const imported = await all("select l.id::text, l.location, l.import_job_id::text j, array(select user_id::text from lead_assignments a where a.lead_id=l.id) o from leads l where phone = any($1)", [[importPhone(1), importPhone(2)]]);
    expect(imported.length === 2 && imported.every((x) => x.j === job.id && x.o.length === 1 && x.o[0] === ids.exec1), "imported leads " + JSON.stringify(imported));
    const reportHref = await page.getByRole("link", { name: "Download import report" }).getAttribute("href");
    expect(reportHref === `/api/lead-import/report/${job.id}`, "report href " + reportHref);
    const rep = await page.request.get(base + reportHref);
    const repText = await rep.text();
    expect(rep.status() === 200 && repText.includes(`${T} ImpCo 3`) && /Invalid Mobile Number/.test(repText), `report ${rep.status()} ${repText.slice(0, 120)}`);
    await page.getByRole("button", { name: "Import another file" }).click();
    await page.getByRole("button", { name: "Choose a CSV file to import" }).waitFor();
    await go("/crm/import-leads");
    const hist = page.locator("table tbody tr", { hasText: `${T}-import.csv` });
    const ht = await hist.innerText();
    expect(/QA Admin/.test(ht) && /\b4\b/.test(ht) && /\b2\b/.test(ht) && /Completed/.test(ht), "history row: " + ht);
    const href = await hist.getByRole("link", { name: "Report" }).getAttribute("href");
    expect(href === `/api/lead-import/report/${job.id}`, "history report href " + href);
    expect((await page.request.get(base + href)).status() === 200, "history report download failed");
  }, page);

await r.check(["UI-55", "UI-63"], "Employee import: no assignee select; history shows only the employee's own imports", async () => {
  const admin = page; page = epage;
  try {
    await go("/crm/import-leads");
    await page.getByRole("heading", { name: "My import history" }).waitFor();
    expect((await page.locator("table tbody tr", { hasText: `${T}-import.csv` }).count()) === 0, "employee sees admin import");
    await page.getByLabel("CSV file to import", { exact: true }).setInputFiles(fileCancel);
    await page.getByRole("button", { name: "Import 1 lead" }).waitFor();
    expect((await page.getByLabel("Assign imported leads to (optional)").count()) === 0, "employee offered assignee");
    await page.getByRole("button", { name: "Cancel" }).click();
  } finally { page = admin; }
}, epage);

// ===================================================================== cleanup (only this suite's records)
try {
  await one("delete from activities where subject ilike $1 returning 1", [`%${T}%`]).catch(() => {});
  await one("delete from saved_views where name ilike $1 returning 1", [`%${T}%`]).catch(() => {});
  await all("delete from leads where name ilike $1 or company ilike $1 or phone = any($2) returning id", [`%${T}%`, [importPhone(1), importPhone(2), importPhone(5)]]);
  await all("delete from lead_import_jobs where file_name ilike $1 returning id", [`%${T}%`]);
} catch (e) { console.log("cleanup warning:", String(e).slice(0, 200)); }

await ectx.close();
await ctx.close();
await browser.close();
await end();
r.finish();
