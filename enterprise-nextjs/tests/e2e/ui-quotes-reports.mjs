// Per-control QA suite: Quotations (list, form, delete), Lead insertion report, Activity log, Dashboard,
// shared DataTable / MetricCard / Skeleton. Isolated E2E stack only (http://localhost:3100 + embedded PostgreSQL).
// Every check drives the real control in Chromium and verifies the outcome against PostgreSQL.
// Fixture rows are created with a unique tag and removed at the end; seeded rows are never touched.
// Results: test-artifacts/ui-quotes-reports.json
import { readFileSync } from "node:fs";
import { base, openDb, signedIn, launch, recorder, expect, tag } from "./lib.mjs";

const R = recorder("quotes-reports");
const { check } = R;
const D = await openDb();
const browser = await launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const istDate = (offsetDays = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(Date.now() + offsetDays * 86_400_000));
const TODAY = istDate(0), YDAY = istDate(-1), DBY = istDate(-2);
const digits = (t) => Number(String(t).replace(/[^0-9.-]/g, ""));
const money = (t) => { const s = String(t).trim(); const v = Number(s.replace(/[^0-9.]/g, "")); return s.startsWith("-") ? -v : v; };
const eq = (a, b, msg) => expect(String(a) === String(b), `${msg}: got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`);
const near = (a, b, msg) => expect(Math.abs(Number(a) - Number(b)) < 0.0001, `${msg}: got ${a} expected ${b}`);
const toast = (p, re) => p.locator("[data-sonner-toast]").filter({ hasText: re }).first().waitFor({ timeout: 15000 });
/** Retry a UI-vs-SQL comparison: other suites write to the same database concurrently. */
async function settle(fn, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) { try { return await fn(i); } catch (e) { last = e; await sleep(800); } }
  throw last;
}

const ids = await D.one(`select (select id::text from users where username='qa.admin') admin, (select id::text from users where username='qa.admin2') admin2,
  (select id::text from users where username='qa.exec1') exec1, (select id::text from users where username='qa.exec2') exec2,
  (select id::text from users where username='qa.disabled') disabled`);
const settings = await D.one("select quotation_prefix, pan, bank_details from company_settings limit 1");

// ---------------------------------------------------------------- fixtures (tagged, removed at the end)
const FILE = `qr-${tag}.csv`, DTYPE = `QRT${tag}`;
const CLIENT = { name: `QR Client ${tag}`, company: `QR Co ${tag}`, phone: `95${tag}1`, state: "Karnataka" };
const BILL = { street: "12 MG Road", city: "Bengaluru", state: "Karnataka", postalCode: "560001", country: "India" };
const SHIP = { street: "7 Dock Road", city: "Mysuru", state: "Karnataka", postalCode: "570001", country: "India" };
const BILL_TXT = "12 MG Road, Bengaluru, Karnataka, 560001, India", SHIP_TXT = "7 Dock Road, Mysuru, Karnataka, 570001, India";
const OTHER = `QR Other ${tag}`;
const utcAt = (day, minutes) => `(('${day}'::date + time '10:00' + interval '${minutes} minutes') - interval '330 minutes')`;
async function insertLead(f) {
  const r = await D.one(`insert into leads (id, name, company, phone, state, billing_address, shipping_address, source, status, initial_status, file_name, data_type, created_at, updated_at)
    values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::"LeadSource", $8, $9, $10, $11, ${f.createdAt ?? "(now() at time zone 'UTC')"}, now() at time zone 'UTC') returning id::text`,
  [f.name, f.company ?? null, f.phone, f.state ?? null, f.billing ? JSON.stringify(f.billing) : null, f.shipping ? JSON.stringify(f.shipping) : null, f.source ?? "MANUAL", f.status ?? "New Lead", f.initial ?? null, f.file ?? null, f.dtype ?? null]);
  if (f.assignee) await D.db.query("insert into lead_assignments (id, lead_id, user_id, can_view, assigned_at) values (gen_random_uuid(), $1, $2, true, now() at time zone 'UTC')", [r.id, f.assignee]);
  return r.id;
}
const fixtureLeads = [];
fixtureLeads.push(await insertLead({ ...CLIENT, billing: BILL, shipping: SHIP, assignee: ids.exec1 }));
fixtureLeads.push(await insertLead({ name: OTHER, company: "QR Other Co", phone: `95${tag}2` }));
const SOURCES3 = ["MANUAL", "IMPORT", "GIFTAGURU"], STATUSES4 = ["New Lead", "Won Lead", "Lost Lead", "In Progress"];
for (let i = 0; i < 52; i++) {
  fixtureLeads.push(await insertLead({
    name: `QR Rep ${tag} ${String(i).padStart(2, "0")}`, company: `QR Rep Co ${i}`, phone: `8${tag}${String(i).padStart(2, "0")}`,
    source: SOURCES3[i % 3], status: STATUSES4[i % 4], initial: i % 4 === 0 ? null : "New Lead", file: FILE, dtype: DTYPE,
    assignee: i % 5 === 0 ? ids.exec2 : null, createdAt: utcAt(i < 30 ? YDAY : DBY, i),
  }));
}
// 21 quotations owned by qa.admin2 so the admin list has more than one page (20 per page).
const SEED_PREFIX = `QRS${tag}/`;
const seedQuotes = [];
for (let n = 1; n <= 21; n++) {
  const r = await D.one(`insert into quotations (id, user_id, party, invoice_details, summary_snapshot, subtotal, tax, grand_total, created_at, updated_at)
    values (gen_random_uuid(), $1, $2, $3, '{}'::jsonb, $4, 0, $4, (now() at time zone 'UTC') - ($5 || ' seconds')::interval, now() at time zone 'UTC') returning id::text`,
  [ids.admin2, JSON.stringify({ name: `QR Seed ${tag} ${n}`, company: "QR Seed Co", phone: `91${tag}${String(n).padStart(2, "0")}` }),
    JSON.stringify({ prefix: SEED_PREFIX, number: String(n), date: TODAY }), n * 100, 600 + n]);
  seedQuotes.push({ id: r.id, number: `${SEED_PREFIX}${n}` });
}
const createdQuotes = [];

// ---------------------------------------------------------------- independent money maths (exact, BigInt)
const S = (v, s) => { const str = String(v); const neg = str.startsWith("-"); const [i, f = ""] = str.replace("-", "").split("."); const n = BigInt((i || "0") + (f + "0".repeat(s)).slice(0, s)); return neg ? -n : n; };
const halfUp = (n, s) => { const d = 10n ** BigInt(s - 2); const neg = n < 0n; const c = ((neg ? -n : n) + d / 2n) / d; return neg ? -c : c; };
const cents = (c) => Number(c) / 100;
function expectedTotals(items, sum) {
  let sub = 0n, tax = 0n; const lines = [];
  for (const it of items) {
    const a5 = S(it.qty, 3) * S(it.price, 2);
    const t10 = a5 * 100000n - a5 * S(it.discount, 3);
    const tax15 = t10 * S(it.tax, 3);
    const tc = halfUp(t10, 10), xc = halfUp(tax15, 15);
    sub += tc; tax += xc; lines.push(cents(halfUp(t10 * 100000n + tax15, 15)));
  }
  const disc = sum.discountType === "%" ? halfUp(sub * S(sum.discount, 3), 7) : halfUp(S(sum.discount, 10), 10);
  const charges = halfUp(S(sum.additionalCharges, 10), 10);
  const pre = sub + tax + charges - disc;
  const ro = sum.autoRoundOff ? (sum.roundOffSign === "-" ? -1n : 1n) * halfUp(S(sum.roundOffAmount, 10), 10) : 0n;
  let grand = pre + ro; if (grand < 0n) grand = 0n;
  const recv = halfUp(S(sum.amountReceived, 10), 10);
  return { lines, subtotal: cents(sub), totalTax: cents(tax), totalDiscount: cents(disc), additionalCharges: cents(charges), roundOff: cents(ro), grandTotal: cents(grand), amountReceived: cents(recv), balanceAmount: cents(grand - recv) };
}
async function previewTotals(p) {
  const dl = p.getByLabel("Totals preview");
  const dts = await dl.locator("dt").allInnerTexts(), dds = await dl.locator("dd").allInnerTexts();
  const o = {}; dts.forEach((k, i) => { o[k.trim()] = money(dds[i]); }); return o;
}
async function assertPreview(p, exp, msg) {
  const t = await previewTotals(p);
  near(t["Subtotal"], exp.subtotal, msg + " subtotal"); near(t["Tax / GST"], exp.totalTax, msg + " tax");
  near(t["Discount"], -exp.totalDiscount, msg + " discount"); near(t["Additional charges"], exp.additionalCharges, msg + " charges");
  near(t["Round off"], exp.roundOff, msg + " round off"); near(t["Grand total"], exp.grandTotal, msg + " grand total");
  near(t["Amount received"], exp.amountReceived, msg + " received"); near(t["Balance"], exp.balanceAmount, msg + " balance");
}
const isPdf = (buf) => buf.subarray(0, 5).toString() === "%PDF-";
async function downloadPdf(p, clickFn) {
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), clickFn()]);
  const buf = readFileSync(await dl.path());
  expect(isPdf(buf), "download is not a PDF (" + buf.subarray(0, 8).toString() + ")");
  return { name: dl.suggestedFilename(), size: buf.length };
}

// ---------------------------------------------------------------- contexts
const adminCtx = await signedIn(browser, "qa.admin");
const page = await adminCtx.newPage();
page.setDefaultTimeout(20000);
let ep; // employee page (qa.exec1)

// =================================================================== QUOTATION FORM (admin, every field)
const PARTY_NAME = `QR Party ${tag}`;
const ITEMS = [
  { name: "E2E Product 1", description: `Code: E2E-P1 ${tag}`, hsn: "4911", qty: "3", price: "26.25", discount: "0", tax: "18" },
  { name: `QR Custom ${tag}`, description: "Custom printed banner", hsn: "3926", qty: "2.5", price: "199.99", discount: "7.5", tax: "12" },
];
const SUM1 = { discount: "10.555", discountType: "₹", additionalCharges: "50.005", applyTCS: true, autoRoundOff: true, roundOffSign: "-", roundOffAmount: "0.4", amountReceived: "100", paymentMethod: "UPI" };
const INV = { date: istDate(4), vdays: "15", vdate: istDate(40), po: `PO-${tag}`, pos: "Karnataka (29)" };
const NEWSHIP = { name: `Warehouse ${tag}`, address: `Plot 9, KIADB ${tag}`, state: "Tamil Nadu" };
const TERMS = `Terms ${tag}: 50% advance.\nDelivery in 5 days.`, NOTES = `Notes ${tag}: handle with care`;
const BANK = { holder: `QR Holder ${tag}`, bank: "QR Bank", acc: `1234${tag}`, ifsc: "QRBK0001234", upi: `qr${tag}@upi` };
let Q = null; // saved quotation {id, number}

await check(["UI-184"], "Save is refused with a toast when no client / no items / invalid item, and nothing is stored", async () => {
  await page.goto(base + "/crm/quotations/create");
  const before = await D.count("select count(*) n from quotations");
  await page.getByRole("button", { name: "Save quotation" }).last().click();
  await toast(page, "Please select a client first.");
  await page.getByRole("button", { name: "Select client" }).click();
  await page.getByLabel("Search clients").fill(CLIENT.name);
  await page.getByRole("button", { name: new RegExp(CLIENT.name) }).click();
  await page.getByRole("button", { name: "Save quotation" }).last().click();
  await toast(page, "Please add at least one item.");
  await page.getByRole("button", { name: "Custom item" }).click();
  await page.getByLabel("Item 1 name").fill("Zero qty");
  await page.getByLabel("Item 1 quantity").fill("0");
  await page.getByRole("button", { name: "Save quotation" }).last().click();
  await toast(page, "Item 1: quantity must be greater than 0.");
  expect(new URL(page.url()).pathname === "/crm/quotations/create", "navigated away");
  eq(await D.count("select count(*) n from quotations"), before, "quotation count changed");
  eq(await page.locator("#q-number").inputValue(), "Assigned on save", "number placeholder");
  return "client, item and server-side quantity validation shown as toasts; DB unchanged";
}, page);

await check(["UI-134", "UI-135", "UI-136", "UI-137", "UI-138", "UI-139"], "Quotation details: number placeholder, date drives valid-till, validity days, manual valid-till, PO and place of supply", async () => {
  await page.goto(base + "/crm/quotations/create");
  const num = page.locator("#q-number");
  expect(await num.isDisabled(), "number field editable"); eq(await num.inputValue(), "Assigned on save", "number before save");
  eq(await page.locator("#q-date").inputValue(), TODAY, "default date is IST today");
  eq(await page.locator("#q-vdays").inputValue(), "30", "default validity");
  await page.locator("#q-date").fill(INV.date);
  eq(await page.locator("#q-vdate").inputValue(), istDate(34), "valid-till follows date + 30");
  await page.locator("#q-vdays").fill(INV.vdays);
  eq(await page.locator("#q-vdate").inputValue(), istDate(19), "valid-till follows date + 15");
  await page.locator("#q-vdate").fill(INV.vdate);
  eq(await page.locator("#q-vdate").inputValue(), INV.vdate, "manual valid-till");
  await page.locator("#q-po").fill(INV.po);
  await page.locator("#q-pos").fill("temp");
  eq(await page.locator("#q-pos").inputValue(), "temp", "place of supply editable");
  return "date/validity recalculation verified in the form (persistence checked after save)";
}, page);

await check(["UI-140", "UI-148", "UI-149"], "Client picker: toggles, searches the server, shows empty result, picks a client and fills the party", async () => {
  const btn = page.getByRole("button", { name: "Select client" });
  eq(await btn.getAttribute("aria-expanded"), "false", "picker initially closed");
  await btn.click();
  eq(await btn.getAttribute("aria-expanded"), "true", "picker did not open");
  const search = page.getByLabel("Search clients");
  const resp = page.waitForResponse((r) => r.url().includes("/api/quotations/clients") && r.url().includes("zzz-none"));
  await search.fill(`zzz-none-${tag}`);
  expect((await resp).status() === 200, "client API failed");
  await page.getByText("No clients found.").waitFor();
  await search.fill(CLIENT.name);
  const hit = page.getByRole("button", { name: new RegExp(CLIENT.name) });
  await hit.waitFor();
  expect((await hit.innerText()).includes(CLIENT.company) && (await hit.innerText()).includes(CLIENT.phone), "hit lacks company/phone");
  await hit.click();
  await search.waitFor({ state: "detached" });
  eq(await page.locator("#p-name").inputValue(), CLIENT.name, "party name");
  eq(await page.locator("#p-company").inputValue(), CLIENT.company, "party company");
  eq(await page.locator("#p-phone").inputValue(), CLIENT.phone, "party phone");
  eq(await page.locator("#p-state").inputValue(), CLIENT.state, "party state");
  eq(await page.locator("#p-pan").inputValue(), settings.pan, "party PAN defaults to company PAN");
  eq(await page.locator("#p-addr").inputValue(), BILL_TXT, "billing address");
  eq(await page.locator("#q-pos").inputValue(), CLIENT.state, "place of supply follows client state");
  expect(await page.getByRole("button", { name: "Change client" }).isVisible(), "button did not switch to Change client");
  return "picker opened, server search empty + hit, party filled from lead";
}, page);

await check(["UI-142", "UI-143", "UI-144", "UI-145", "UI-146", "UI-147"], "Party fields are editable (name, company, phone, state, PAN, billing address)", async () => {
  await page.locator("#p-name").fill(PARTY_NAME);
  await page.locator("#p-company").fill(`QR Party Co ${tag}`);
  await page.locator("#p-phone").fill(`96${tag}9`);
  await page.locator("#p-state").fill("Karnataka KA");
  await page.locator("#p-pan").fill("ABCDE1234F");
  await page.locator("#p-addr").fill(`Edited billing ${tag}\nLine 2`);
  await page.locator("#q-pos").fill(INV.pos);
  eq(await page.locator("#p-name").inputValue(), PARTY_NAME, "name edit");
  await page.getByText(`Edited billing ${tag}`, { exact: false }).first().waitFor();
  return "edited; persistence asserted after save";
}, page);

await check(["UI-141", "UI-150", "UI-151", "UI-152", "UI-153", "UI-154"], "Ship to: lists lead addresses, selects one, validates and adds a new address", async () => {
  const ship = page.getByRole("button", { name: "Ship to" });
  await ship.click();
  eq(await ship.getAttribute("aria-expanded"), "true", "ship panel not open");
  const existing = page.getByRole("button", { name: /^Shipping Address/ });
  expect((await existing.innerText()).includes(SHIP_TXT), "lead shipping address not listed");
  expect(await page.getByRole("button", { name: /^Billing Address/ }).isVisible(), "billing address option missing");
  await existing.click();
  await page.locator("p", { hasText: "Ship to:" }).filter({ hasText: SHIP_TXT }).waitFor();
  await ship.click();
  await page.getByRole("button", { name: "Add address" }).click();
  await toast(page, "Enter the shipping address.");
  await page.locator("#s-name").fill(NEWSHIP.name);
  await page.locator("#s-addr").fill(NEWSHIP.address);
  await page.locator("#s-state").fill(NEWSHIP.state);
  await page.getByRole("button", { name: "Add address" }).click();
  await page.locator("#s-addr").waitFor({ state: "detached" });
  await page.locator("p", { hasText: "Ship to:" }).filter({ hasText: NEWSHIP.address }).waitFor();
  return "existing address selected, empty address refused, new address added and selected";
}, page);

await check(["UI-155", "UI-157", "UI-156", "UI-158", "UI-159", "UI-160", "UI-161", "UI-162", "UI-163", "UI-164", "UI-165", "UI-166"], "Line items: product search adds a catalogue line, custom line, every cell edit, live amounts, remove", async () => {
  await page.getByLabel("Search products").fill("E2E Product 1");
  const prod = page.getByRole("button", { name: /^E2E Product 1/ });
  await prod.waitFor();
  expect(/GST \d+/.test(await prod.innerText()), "product hit lacks GST");
  await prod.click();
  eq(await page.getByLabel("Search products").inputValue(), "", "search not cleared");
  eq(await page.getByLabel("Item 1 name").inputValue(), "E2E Product 1", "product name");
  eq(await page.getByLabel("Item 1 description").inputValue(), "Code: E2E-P1", "product code description");
  eq(await page.getByLabel("Item 1 quantity").inputValue(), "1", "product qty");
  await page.getByRole("button", { name: "Custom item" }).click();
  await page.getByRole("button", { name: "Custom item" }).click();
  eq(await page.getByLabel("Item 3 name").inputValue(), "", "custom item blank");
  await page.getByLabel("Item 3 name").fill("to be removed");
  for (const [i, it] of ITEMS.entries()) {
    const n = i + 1;
    await page.getByLabel(`Item ${n} name`).fill(it.name);
    await page.getByLabel(`Item ${n} description`).fill(it.description);
    await page.getByLabel(`Item ${n} HSN`).fill(it.hsn);
    await page.getByLabel(`Item ${n} quantity`).fill(it.qty);
    await page.getByLabel(`Item ${n} rate`).fill(it.price);
    await page.getByLabel(`Item ${n} discount`).fill(it.discount);
    await page.getByLabel(`Item ${n} GST`).fill(it.tax);
  }
  const rows = page.locator("table tbody tr");
  eq(await rows.count(), 3, "rows before remove");
  await page.getByRole("button", { name: "Remove item 3" }).click();
  eq(await rows.count(), 2, "rows after remove");
  const exp = expectedTotals(ITEMS, { discount: "0", discountType: "%", additionalCharges: "0", amountReceived: "0" });
  for (let i = 0; i < 2; i++) near(money(await rows.nth(i).locator("td").nth(7).innerText()), exp.lines[i], `line ${i + 1} amount`);
  return `line amounts ${exp.lines.join(", ")} match independent calc`;
}, page);

await check(["UI-167", "UI-168", "UI-169", "UI-170", "UI-171", "UI-172", "UI-173", "UI-174", "UI-175"], "Summary controls update the live totals preview exactly (amount discount, charges, TCS, round off -, received, payment)", async () => {
  await page.locator("#s-disc").fill(SUM1.discount);
  await page.getByLabel("Discount type").selectOption("₹");
  await page.locator("#s-charges").fill(SUM1.additionalCharges);
  await page.getByLabel("Apply TCS").check();
  expect(await page.getByLabel("Round off sign").count() === 0, "round-off controls visible before enabling");
  await page.getByLabel("Auto round off").check();
  await page.getByLabel("Round off sign").selectOption("-");
  await page.getByLabel("Round off amount").fill(SUM1.roundOffAmount);
  await page.locator("#s-recv").fill(SUM1.amountReceived);
  await page.locator("#s-pay").selectOption("UPI");
  const exp = expectedTotals(ITEMS, SUM1);
  await assertPreview(page, exp, "preview");
  // TCS is a stored flag only (MERN parity): toggling it does not change the totals.
  await page.getByLabel("Apply TCS").uncheck(); await assertPreview(page, exp, "preview without TCS"); await page.getByLabel("Apply TCS").check();
  near(money(await page.locator("span.muted", { hasText: "Grand total" }).locator("strong").innerText()), exp.grandTotal, "save bar grand total");
  return JSON.stringify(exp);
}, page);

await check(["UI-176", "UI-177", "UI-178", "UI-179", "UI-180", "UI-181", "UI-182"], "Terms, notes and bank detail fields accept input (defaults come from company settings)", async () => {
  eq(await page.locator("#b-bank").inputValue(), settings.bank_details.bankName ?? "", "default bank name");
  eq(await page.locator("#b-acc").inputValue(), settings.bank_details.accountNumber ?? "", "default account");
  expect((await page.locator("#t-terms").inputValue()).startsWith("Payment Terms:"), "default terms missing");
  await page.locator("#t-terms").fill(TERMS);
  await page.locator("#t-notes").fill(NOTES);
  await page.locator("#b-holder").fill(BANK.holder);
  await page.locator("#b-bank").fill(BANK.bank);
  await page.locator("#b-acc").fill(BANK.acc);
  await page.locator("#b-ifsc").fill(BANK.ifsc);
  await page.locator("#b-upi").fill(BANK.upi);
  eq(await page.locator("#b-upi").inputValue(), BANK.upi, "upi");
  return "filled; persistence asserted after save";
}, page);

await check(["UI-184", "UI-134", "UI-135", "UI-136", "UI-137", "UI-138", "UI-139", "UI-142", "UI-143", "UI-144", "UI-145", "UI-146", "UI-147", "UI-150", "UI-154", "UI-159", "UI-160", "UI-161", "UI-162", "UI-163", "UI-164", "UI-165", "UI-167", "UI-168", "UI-169", "UI-170", "UI-171", "UI-172", "UI-173", "UI-174", "UI-175", "UI-176", "UI-177", "UI-178", "UI-179", "UI-180", "UI-181", "UI-182"],
  "Save quotation persists every field; server totals equal the independent calculation; PDF auto-downloads", async () => {
    const before = await D.count("select count(*) n from quotations where party->>'name'=$1", [PARTY_NAME]);
    eq(before, 0, "pre-existing quotation");
    const pdf = await downloadPdf(page, () => page.getByRole("button", { name: "Save quotation" }).last().click());
    await toast(page, /Quotation .+ saved/);
    const row = await D.one("select q.*, u.username from quotations q join users u on u.id=q.user_id where party->>'name'=$1", [PARTY_NAME]);
    expect(row, "quotation not stored");
    Q = { id: row.id, number: `${row.invoice_details.prefix}${row.invoice_details.number}` };
    createdQuotes.push(row.id);
    await page.getByRole("status").filter({ hasText: `Saved as ${Q.number}` }).waitFor();
    eq(await page.locator("#q-number").inputValue(), row.invoice_details.number, "number shown after save");
    expect(await page.getByRole("button", { name: "Save changes" }).first().isVisible(), "button not switched to Save changes");
    eq(row.username, "qa.admin", "owner");
    const inv = row.invoice_details;
    eq(inv.prefix, settings.quotation_prefix, "prefix"); expect(/^\d+$/.test(inv.number), "number not numeric");
    eq(inv.date, INV.date, "date"); eq(inv.validityDays, INV.vdays, "validity days"); eq(inv.validityDate, INV.vdate, "valid till");
    eq(inv.poNo, INV.po, "PO"); eq(inv.placeOfSupply, INV.pos, "place of supply");
    const pa = row.party;
    eq(pa.name, PARTY_NAME, "party name"); eq(pa.company, `QR Party Co ${tag}`, "company"); eq(pa.phone, `96${tag}9`, "phone");
    eq(pa.state, "Karnataka KA", "state"); eq(pa.pan, "ABCDE1234F", "pan"); eq(pa.billToAddress, `Edited billing ${tag}\nLine 2`, "bill to");
    eq(JSON.stringify(pa.selectedShippingAddress), JSON.stringify(NEWSHIP), "selected ship-to");
    eq(pa.shippingAddresses.length, 3, "shipping address count");
    eq(pa.shippingAddresses[1].address, SHIP_TXT, "lead shipping address kept");
    const items = await D.all("select * from quotation_items where quotation_id=$1 order by sort_order", [row.id]);
    eq(items.length, 2, "item count");
    items.forEach((it, i) => {
      const e = ITEMS[i];
      eq(it.name, e.name, `item ${i + 1} name`); eq(it.description, e.description, `item ${i + 1} description`); eq(it.hsn, e.hsn, `item ${i + 1} hsn`);
      near(it.qty, e.qty, `item ${i + 1} qty`); near(it.price, e.price, `item ${i + 1} price`); near(it.discount, e.discount, `item ${i + 1} discount`); near(it.tax, e.tax, `item ${i + 1} tax`);
    });
    const s = row.summary_snapshot.summary;
    near(s.discount, 10.56, "summary discount (half-up)"); eq(s.discountType, "₹", "discount type"); near(s.additionalCharges, 50.01, "charges (half-up)");
    eq(s.applyTCS, true, "TCS"); eq(s.autoRoundOff, true, "auto round off"); eq(s.roundOffSign, "-", "round off sign"); near(s.roundOffAmount, 0.4, "round off amount");
    near(s.amountReceived, 100, "amount received"); eq(s.paymentMethod, "UPI", "payment method");
    const exp = expectedTotals(ITEMS, SUM1);
    near(row.subtotal, exp.subtotal, "subtotal"); near(row.tax, exp.totalTax, "tax"); near(row.discount, exp.totalDiscount, "discount");
    near(row.round_off, exp.roundOff, "round off"); near(row.grand_total, exp.grandTotal, "grand total");
    const t = row.summary_snapshot.totals;
    near(t.additionalCharges, exp.additionalCharges, "snapshot charges"); near(t.amountReceived, exp.amountReceived, "snapshot received"); near(t.balanceAmount, exp.balanceAmount, "snapshot balance");
    eq(row.terms, TERMS, "terms"); eq(row.notes, NOTES, "notes");
    const b = row.bank_details;
    eq(b.accountHolder, BANK.holder, "holder"); eq(b.bankName, BANK.bank, "bank"); eq(b.accountNumber, BANK.acc, "acc"); eq(b.ifscCode, BANK.ifsc, "ifsc"); eq(b.upiId, BANK.upi, "upi");
    eq(await D.count("select count(*) n from activity_logs where action='quotation.created' and details->>'quotationId'=$1", [row.id]), 1, "created audit");
    return `${Q.number} grand ${row.grand_total} (expected ${exp.grandTotal}); pdf ${pdf.size} bytes`;
  }, page);

await check(["UI-131", "UI-183"], "Header PDF and footer Download PDF links download the saved quotation as a PDF", async () => {
  expect(Q, "no saved quotation");
  const top = page.locator("a.button", { hasText: /^PDF$/ });
  eq(await top.getAttribute("href"), `/api/quotations/${Q.id}/pdf`, "header PDF href");
  const a = await downloadPdf(page, () => top.click());
  const bottom = page.getByRole("link", { name: "Download PDF" });
  eq(await bottom.getAttribute("href"), `/api/quotations/${Q.id}/pdf`, "footer PDF href");
  const b = await downloadPdf(page, () => bottom.click());
  return `${a.name} ${a.size}B / ${b.size}B`;
}, page);

const SUM2 = { ...SUM1, discount: "10", discountType: "%", autoRoundOff: false, paymentMethod: "Cheque", applyTCS: false };
await check(["UI-184", "UI-168", "UI-171", "UI-170", "UI-175"], "Save changes updates the same quotation (percent discount, round-off off, TCS off) with recomputed totals", async () => {
  expect(Q, "no saved quotation");
  await page.locator("#s-disc").fill(SUM2.discount);
  await page.getByLabel("Discount type").selectOption("%");
  await page.getByLabel("Auto round off").uncheck();
  expect(await page.getByLabel("Round off sign").count() === 0, "round-off controls still shown");
  await page.getByLabel("Apply TCS").uncheck();
  await page.locator("#s-pay").selectOption("Cheque");
  const exp = expectedTotals(ITEMS, SUM2);
  await assertPreview(page, exp, "preview");
  await downloadPdf(page, () => page.getByRole("button", { name: "Save changes" }).last().click());
  await toast(page, `Quotation ${Q.number} saved`);
  const row = await settle(async () => { const r = await D.one("select * from quotations where id=$1", [Q.id]); near(r.grand_total, exp.grandTotal, "grand total"); return r; });
  eq(await D.count("select count(*) n from quotations where party->>'name'=$1", [PARTY_NAME]), 1, "duplicate created");
  near(row.discount, exp.totalDiscount, "discount"); near(row.round_off, 0, "round off"); near(row.subtotal, exp.subtotal, "subtotal");
  const s = row.summary_snapshot.summary;
  eq(s.discountType, "%", "type"); eq(s.autoRoundOff, false, "round off flag"); eq(s.applyTCS, false, "tcs"); eq(s.paymentMethod, "Cheque", "pay");
  eq(`${row.invoice_details.prefix}${row.invoice_details.number}`, Q.number, "number changed on update");
  eq(await D.count("select count(*) n from activity_logs where action='quotation.updated' and details->>'quotationId'=$1", [Q.id]), 1, "update audit");
  return `grand ${row.grand_total} = ${exp.grandTotal}`;
}, page);

await check(["UI-134", "UI-135", "UI-136", "UI-137", "UI-138", "UI-139", "UI-142", "UI-143", "UI-144", "UI-145", "UI-146", "UI-147", "UI-158", "UI-159", "UI-160", "UI-161", "UI-162", "UI-163", "UI-164", "UI-165", "UI-167", "UI-168", "UI-169", "UI-170", "UI-171", "UI-174", "UI-175", "UI-176", "UI-177", "UI-178", "UI-179", "UI-180", "UI-181", "UI-182"],
  "Re-opened quotation shows exactly the saved values and stored totals", async () => {
    expect(Q, "no saved quotation");
    await page.goto(base + `/crm/quotations/${Q.id}/edit`);
    const row = await D.one("select * from quotations where id=$1", [Q.id]);
    const v = (sel) => page.locator(sel).inputValue();
    eq(await v("#q-number"), row.invoice_details.number, "number"); eq(await v("#q-date"), INV.date, "date"); eq(await v("#q-vdays"), INV.vdays, "vdays");
    eq(await v("#q-vdate"), INV.vdate, "vdate"); eq(await v("#q-po"), INV.po, "po"); eq(await v("#q-pos"), INV.pos, "pos");
    expect(await page.locator("#q-prefix").isDisabled(), "prefix editable after issue");
    eq(await v("#p-name"), PARTY_NAME, "name"); eq(await v("#p-company"), `QR Party Co ${tag}`, "company"); eq(await v("#p-phone"), `96${tag}9`, "phone");
    eq(await v("#p-state"), "Karnataka KA", "state"); eq(await v("#p-pan"), "ABCDE1234F", "pan"); eq(await v("#p-addr"), `Edited billing ${tag}\nLine 2`, "addr");
    await page.locator("p", { hasText: "Ship to:" }).filter({ hasText: NEWSHIP.address }).waitFor();
    for (const [i, it] of ITEMS.entries()) {
      const n = i + 1;
      eq(await page.getByLabel(`Item ${n} name`).inputValue(), it.name, `item ${n} name`);
      eq(await page.getByLabel(`Item ${n} description`).inputValue(), it.description, `item ${n} desc`);
      eq(await page.getByLabel(`Item ${n} HSN`).inputValue(), it.hsn, `item ${n} hsn`);
      near(await page.getByLabel(`Item ${n} quantity`).inputValue(), it.qty, `item ${n} qty`);
      near(await page.getByLabel(`Item ${n} rate`).inputValue(), it.price, `item ${n} rate`);
      near(await page.getByLabel(`Item ${n} discount`).inputValue(), it.discount, `item ${n} disc`);
      near(await page.getByLabel(`Item ${n} GST`).inputValue(), it.tax, `item ${n} gst`);
    }
    near(await v("#s-disc"), 10, "discount"); eq(await page.getByLabel("Discount type").inputValue(), "%", "discount type");
    near(await v("#s-charges"), 50.01, "charges"); eq(await page.getByLabel("Apply TCS").isChecked(), false, "tcs");
    eq(await page.getByLabel("Auto round off").isChecked(), false, "round off"); near(await v("#s-recv"), 100, "received");
    eq(await page.locator("#s-pay").inputValue(), "Cheque", "payment");
    eq(await v("#t-terms"), TERMS, "terms"); eq(await v("#t-notes"), NOTES, "notes");
    eq(await v("#b-holder"), BANK.holder, "holder"); eq(await v("#b-bank"), BANK.bank, "bank"); eq(await v("#b-acc"), BANK.acc, "acc");
    eq(await v("#b-ifsc"), BANK.ifsc, "ifsc"); eq(await v("#b-upi"), BANK.upi, "upi");
    await page.getByText("Showing the totals stored with this quotation").waitFor();
    const t = await previewTotals(page);
    near(t["Grand total"], row.grand_total, "stored grand total shown"); near(t["Subtotal"], row.subtotal, "stored subtotal shown");
    return "all fields round-trip";
  }, page);

await check(["UI-172", "UI-173", "UI-184"], "Round off + sign persists and re-opens (edit mode)", async () => {
  expect(Q, "no saved quotation");
  await page.getByLabel("Auto round off").check();
  await page.getByLabel("Round off sign").selectOption("+");
  await page.getByLabel("Round off amount").fill("0.25");
  const exp = expectedTotals(ITEMS, { ...SUM2, autoRoundOff: true, roundOffSign: "+", roundOffAmount: "0.25" });
  await assertPreview(page, exp, "preview");
  await downloadPdf(page, () => page.getByRole("button", { name: "Save changes" }).last().click());
  await toast(page, `Quotation ${Q.number} saved`);
  const row = await settle(async () => { const r = await D.one("select * from quotations where id=$1", [Q.id]); near(r.round_off, 0.25, "round off"); return r; });
  near(row.grand_total, exp.grandTotal, "grand total");
  await page.reload();
  eq(await page.getByLabel("Round off sign").inputValue(), "+", "sign re-opened"); near(await page.getByLabel("Round off amount").inputValue(), 0.25, "amount re-opened");
  return `grand ${row.grand_total}`;
}, page);

await check(["UI-167", "UI-168"], "Percentage discount with 3 decimals: preview total equals the total the server stores", async () => {
  // Line discounts keep 3 decimals; the document discount field accepts any step. The preview promises the server's maths.
  await page.goto(base + "/crm/quotations/create");
  await page.getByRole("button", { name: "Select client" }).click();
  await page.getByLabel("Search clients").fill(CLIENT.name);
  await page.getByRole("button", { name: new RegExp(CLIENT.name) }).click();
  await page.locator("#p-name").fill(`QR Pct ${tag}`);
  await page.getByRole("button", { name: "Custom item" }).click();
  await page.getByLabel("Item 1 name").fill("Pct item");
  await page.getByLabel("Item 1 rate").fill("541.23");
  await page.locator("#s-disc").fill("10.555");
  const shown = (await previewTotals(page))["Grand total"];
  await downloadPdf(page, () => page.getByRole("button", { name: "Save quotation" }).last().click());
  const row = await settle(async () => { const r = await D.one("select id, grand_total, discount from quotations where party->>'name'=$1", [`QR Pct ${tag}`]); expect(r, "not saved"); return r; });
  createdQuotes.push(row.id);
  const exp = expectedTotals([{ qty: "1", price: "541.23", discount: "0", tax: "0" }], { discount: "10.555", discountType: "%", additionalCharges: "0", amountReceived: "0" });
  near(shown, exp.grandTotal, "preview grand total");
  near(row.grand_total, shown, `stored grand total ${row.grand_total} differs from the previewed ${shown} (stored discount ${row.discount}, exact ${exp.totalDiscount})`);
  return `preview ${shown} stored ${row.grand_total}`;
}, page);

await check(["UI-130"], "Quotations back link returns to the list", async () => {
  await page.goto(base + "/crm/quotations/create");
  await page.getByRole("link", { name: "Quotations", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/crm/quotations");
  await page.getByRole("heading", { name: "Quotations" }).waitFor();
  return "navigated to /crm/quotations";
}, page);

// =================================================================== QUOTATIONS LIST (admin)
const listTotal = async (p) => { const t = await p.locator("nav[aria-label=Pagination] span").first().innerText(); const m = t.match(/([\d,]+) quotations? · page (\d+) of (\d+)/); return { total: Number(m[1].replace(/,/g, "")), page: Number(m[2]), pages: Number(m[3]) }; };

await check(["UI-122"], "Admin list: count, page size, row content and Created by match PostgreSQL", async () => {
  return settle(async (i) => {
    await page.goto(base + "/crm/quotations");
    const n = await D.count("select count(*) n from quotations");
    const info = await listTotal(page);
    eq(info.total, n, "total"); eq(info.pages, Math.ceil(n / 20), "pages");
    const rows = page.locator("table tbody tr");
    eq(await rows.count(), Math.min(20, n), "rows on page 1");
    expect(await page.getByRole("columnheader", { name: "Created by" }).isVisible(), "Created by column missing for admin");
    const first20 = await D.all(`select q.invoice_details->>'prefix' || (q.invoice_details->>'number') num from quotations q order by created_at desc, id asc limit 20`);
    const shownNums = await page.locator("table tbody tr td:first-child a").allInnerTexts();
    eq(shownNums.join("|"), first20.map((r) => r.num).join("|"), "page 1 order");
    const r = await D.one("select * from quotations where id=$1", [Q.id]);
    const tr = page.locator("tr", { has: page.getByRole("link", { name: Q.number, exact: true }) });
    const cells = await tr.locator("td").allInnerTexts();
    expect(cells[2].includes(r.party.name) && cells[2].includes(r.party.company), "customer cell");
    eq(cells[3], r.party.phone, "phone cell"); near(money(cells[4]), r.grand_total, "grand total cell"); eq(cells[5], "QA Admin", "created by");
    expect(cells[1].includes(new Date(r.invoice_details.date + "T00:00:00Z").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })), "date cell " + cells[1]);
    return `${n} quotations, ${info.pages} pages${i ? ` (settled after ${i} retries)` : ""}`;
  });
}, page);

await check(["UI-128", "UI-129"], "Next / Previous page links move through the list (URL, rows, page indicator)", async () => {
  await page.goto(base + "/crm/quotations");
  expect(await page.getByRole("link", { name: "Previous page" }).count() === 0, "Previous shown on page 1");
  const first = await page.locator("table tbody tr td:first-child a").first().innerText();
  await page.getByRole("link", { name: "Next page" }).click();
  await page.waitForURL(/[?&]page=2/);
  await page.getByText(/page 2 of/).waitFor();
  const info = await listTotal(page);
  eq(await page.locator("table tbody tr").count(), Math.min(20, info.total - 20), "rows on page 2");
  expect((await page.locator("table tbody tr td:first-child a").first().innerText()) !== first, "page 2 repeats page 1");
  const p2 = await D.one("select invoice_details->>'prefix' || (invoice_details->>'number') num from quotations order by created_at desc, id asc offset 20 limit 1");
  const shown = await page.locator("table tbody tr td:first-child a").first().innerText();
  expect(shown === p2.num || info.total !== (await D.count("select count(*) n from quotations")), `page 2 first row ${shown} != ${p2.num}`);
  if (info.pages === 2) expect(await page.getByRole("link", { name: "Next page" }).count() === 0, "Next shown on last page");
  await page.getByRole("link", { name: "Previous page" }).click();
  await page.waitForURL(/[?&]page=1/);
  await page.getByText(/page 1 of/).waitFor();
  return `page 2 of ${info.pages}`;
}, page);

await check(["UI-127"], "Empty list state (page beyond the end) offers New quotation, which opens the form", async () => {
  await page.goto(base + "/crm/quotations?page=9999");
  await page.getByText("No quotations yet").waitFor();
  const link = page.getByRole("main").locator("table").getByRole("link", { name: "New quotation" });
  await link.click();
  await page.waitForURL("**/crm/quotations/create");
  await page.getByRole("heading", { name: "New quotation" }).waitFor();
  return "empty state link opened the create form";
}, page);

await check(["UI-121"], "Header New quotation opens the create form", async () => {
  await page.goto(base + "/crm/quotations");
  await page.locator(".page-head, header").getByRole("link", { name: "New quotation" }).first().click();
  await page.waitForURL("**/crm/quotations/create");
  eq(await page.locator("#q-number").inputValue(), "Assigned on save", "fresh form");
  return "opened";
}, page);

await check(["UI-123", "UI-124"], "Quotation number link and Edit icon open that quotation's edit form", async () => {
  await page.goto(base + "/crm/quotations");
  await page.getByRole("link", { name: Q.number, exact: true }).click();
  await page.waitForURL(`**/crm/quotations/${Q.id}/edit`);
  eq(await page.locator("#p-name").inputValue(), PARTY_NAME, "number link opened wrong quotation");
  await page.goto(base + "/crm/quotations");
  await page.getByRole("link", { name: `Edit quotation ${Q.number}` }).click();
  await page.waitForURL(`**/crm/quotations/${Q.id}/edit`);
  await page.getByRole("heading", { name: "Edit quotation" }).waitFor();
  eq(await page.locator("#p-name").inputValue(), PARTY_NAME, "edit icon opened wrong quotation");
  return "both open /edit of " + Q.number;
}, page);

await check(["UI-125"], "Row Download PDF downloads a valid PDF for that quotation", async () => {
  await page.goto(base + "/crm/quotations");
  const a = page.getByRole("link", { name: `Download PDF of ${Q.number}` });
  eq(await a.getAttribute("href"), `/api/quotations/${Q.id}/pdf`, "href");
  const r = await downloadPdf(page, () => a.click());
  return `${r.name} ${r.size} bytes`;
}, page);

await check(["UI-119", "UI-120", "UI-126"], "Delete: admin row button opens the confirm dialog; Cancel keeps it; Delete removes row, items and audits", async () => {
  const target = seedQuotes[0];
  await page.goto(base + "/crm/quotations?page=2");
  let btn = page.getByRole("button", { name: `Delete quotation ${target.number}` });
  if (!(await btn.count())) { await page.goto(base + "/crm/quotations"); btn = page.getByRole("button", { name: `Delete quotation ${target.number}` }); }
  eq(await page.getByRole("button", { name: /^Delete quotation / }).count(), await page.locator("table tbody tr").count(), "one delete button per row for admin");
  await btn.click();
  const dlg = page.getByRole("dialog");
  await dlg.getByText(`Delete quotation ${target.number}? This cannot be undone.`).waitFor();
  await dlg.getByRole("button", { name: "Cancel" }).click();
  await dlg.waitFor({ state: "hidden" });
  eq(await D.count("select count(*) n from quotations where id=$1", [target.id]), 1, "cancel deleted the quotation");
  await btn.click();
  await dlg.getByRole("button", { name: "Delete quotation" }).click();
  await toast(page, "Quotation deleted");
  await dlg.waitFor({ state: "hidden" });
  await page.getByRole("link", { name: target.number, exact: true }).waitFor({ state: "detached" });
  eq(await D.count("select count(*) n from quotations where id=$1", [target.id]), 0, "quotation still in DB");
  eq(await D.count("select count(*) n from activity_logs where action='quotation.deleted' and details->>'quotationId'=$1 and details->>'number'=$2", [target.id, target.number]), 1, "delete audit");
  return "cancel kept, confirm deleted + audited";
}, page);

await check(["UI-120"], "Delete of a quotation removed meanwhile shows the server error and keeps the dialog open", async () => {
  const target = seedQuotes[1];
  await page.goto(base + "/crm/quotations");
  let btn = page.getByRole("button", { name: `Delete quotation ${target.number}` });
  if (!(await btn.count())) { await page.goto(base + "/crm/quotations?page=2"); btn = page.getByRole("button", { name: `Delete quotation ${target.number}` }); }
  await btn.click();
  await D.db.query("delete from quotations where id=$1", [target.id]);
  const dlg = page.getByRole("dialog");
  await dlg.getByRole("button", { name: "Delete quotation" }).click();
  await toast(page, "Quotation not found");
  expect(await dlg.isVisible(), "dialog closed after a failed delete");
  await dlg.getByRole("button", { name: "Cancel" }).click();
  return "not-found error surfaced, dialog stayed open";
}, page);

// =================================================================== QUOTATIONS (employee permissions)
const execCtx = await signedIn(browser, "qa.exec1");
ep = await execCtx.newPage();
ep.setDefaultTimeout(20000);
let EQ = null;
await check(["UI-148", "UI-149", "UI-184"], "Employee: client search is limited to assigned leads; saved quotation is owned by the employee with the company prefix", async () => {
  await ep.goto(base + "/crm/quotations/create");
  await ep.getByRole("button", { name: "Select client" }).click();
  await ep.getByLabel("Search clients").fill(OTHER);
  await ep.getByText("No clients found.").waitFor();
  await ep.getByLabel("Search clients").fill(CLIENT.name);
  await ep.getByRole("button", { name: new RegExp(CLIENT.name) }).click();
  await ep.locator("#p-name").fill(`QR Exec Party ${tag}`);
  await ep.getByRole("button", { name: "Custom item" }).click();
  await ep.getByLabel("Item 1 name").fill("Exec item");
  await ep.getByLabel("Item 1 rate").fill("1000");
  await ep.getByLabel("Item 1 GST").fill("5");
  await downloadPdf(ep, () => ep.getByRole("button", { name: "Save quotation" }).last().click());
  const row = await settle(async () => { const r = await D.one("select * from quotations where party->>'name'=$1", [`QR Exec Party ${tag}`]); expect(r, "not saved"); return r; });
  createdQuotes.push(row.id);
  EQ = { id: row.id, number: `${row.invoice_details.prefix}${row.invoice_details.number}` };
  eq(row.user_id, ids.exec1, "owner"); eq(row.invoice_details.prefix, settings.quotation_prefix, "prefix"); near(row.grand_total, 1050, "grand total");
  return EQ.number;
}, ep);

await check(["UI-122", "UI-126", "UI-125"], "Employee list shows only own quotations, no Created by column, no delete buttons; other users' PDFs/edit pages are refused", async () => {
  await ep.goto(base + "/crm/quotations");
  const n = await D.count("select count(*) n from quotations where user_id=$1", [ids.exec1]);
  eq((await listTotal(ep)).total, n, "employee total");
  eq(await ep.getByRole("columnheader", { name: "Created by" }).count(), 0, "Created by column shown to employee");
  eq(await ep.getByRole("button", { name: /^Delete quotation/ }).count(), 0, "delete button shown to employee");
  const own = await D.all("select invoice_details->>'prefix' || (invoice_details->>'number') num from quotations where user_id=$1", [ids.exec1]);
  const shown = await ep.locator("table tbody tr td:first-child a").allInnerTexts();
  expect(shown.every((s) => own.some((o) => o.num === s)), "employee sees a quotation they do not own");
  expect(shown.includes(EQ.number) && !shown.includes(Q.number), "own/admin quotation visibility wrong");
  const r = await ep.request.get(base + `/api/quotations/${Q.id}/pdf`);
  expect([403, 404].includes(r.status()), "admin PDF status for employee " + r.status());
  const own2 = await ep.request.get(base + `/api/quotations/${EQ.id}/pdf`);
  expect(own2.status() === 200 && isPdf(await own2.body()), "own PDF not served");
  const g = await ep.goto(base + `/crm/quotations/${Q.id}/edit`);
  eq(g.status(), 404, "admin quotation edit page status for employee");
  return `${n} own quotations; foreign PDF ${r.status()}`;
}, ep);

// =================================================================== LEAD INSERTION REPORT
const RBASE = `/crm/reports/lead-insertion?preset=custom&from=${DBY}&to=${TODAY}`;
const RF = `&fileName=${encodeURIComponent(FILE)}`;
const rWhere = `(l.created_at at time zone 'UTC' at time zone 'Asia/Kolkata')::date between $1::date and $2::date`;
const rCount = (extra = "true", args = []) => D.count(`select count(*) n from leads l where ${rWhere} and ${extra}`, [DBY, TODAY, ...args]);
const kpi = async (p, label) => digits(await p.locator(".kpi", { has: p.locator("span", { hasText: new RegExp(`^${label}$`) }) }).locator("strong").innerText());
async function applyReport(p, name, value, by = "value") {
  const sel = p.locator(`select[name=${name}]`);
  if (by === "label") await sel.selectOption({ label: value }); else if (by === "index") await sel.selectOption({ index: value }); else await sel.selectOption(value);
  const v = await sel.inputValue();
  await p.getByRole("button", { name: "Apply filters" }).click();
  await p.waitForURL((u) => u.searchParams.get(name) === v);
  return v;
}
const assigned = "exists (select 1 from lead_assignments a where a.lead_id=l.id)";
const fileF = "l.file_name=$3";

await check(["UI-190", "UI-201"], "Group by select regroups periods (day/week/month); period rows match SQL", async () => {
  await page.goto(base + RBASE + RF);
  const rows = page.locator("section.table-card", { hasText: "Insertions per period" }).locator("tbody tr");
  const sqlP = (g) => D.all(`select to_char(date_trunc('${g}', l.created_at at time zone 'UTC' at time zone 'Asia/Kolkata'),'YYYY-MM-DD') p, count(*)::int t,
      count(*) filter (where source='MANUAL')::int m, count(*) filter (where ${assigned})::int a from leads l where ${rWhere} and ${fileF} group by 1 order by 1`, [DBY, TODAY, FILE]);
  const verify = async (g) => {
    const exp = await sqlP(g);
    eq(await rows.count(), exp.length, `${g} period rows`);
    for (const [i, e] of exp.entries()) {
      const c = await rows.nth(i).locator("td").allInnerTexts();
      const label = g === "day" ? e.p : g === "week" ? `Week of ${e.p}` : e.p.slice(0, 7);
      eq(c[0], label, `${g} label`); eq(digits(c[1]), e.t, `${g} total`); eq(digits(c[2]), e.m, `${g} manual`); eq(digits(c[3]), e.t - e.m, `${g} imported`);
      eq(digits(c[c.length - 2]), e.a, `${g} assigned`); eq(digits(c[c.length - 1]), e.t - e.a, `${g} unassigned`);
    }
    return exp.length;
  };
  const d = await verify("day");
  await applyReport(page, "grouping", "week"); const w = await verify("week");
  await applyReport(page, "grouping", "month"); const m = await verify("month");
  eq(await kpi(page, "Total leads"), 52, "total with file filter");
  return `day ${d}, week ${w}, month ${m} periods`;
}, page);

await check(["UI-191", "UI-203"], "Employee select filters by assignee (and Unassigned); per-employee table matches SQL", async () => {
  await page.goto(base + RBASE + RF);
  const empRows = page.locator("section.table-card", { hasText: "Per employee" }).locator("tbody tr");
  const exp = await D.all(`select u.name, count(*)::int n from leads l join lead_assignments a on a.lead_id=l.id join users u on u.id=a.user_id where ${rWhere} and ${fileF} group by u.name order by 2 desc, 1`, [DBY, TODAY, FILE]);
  const un = await rCount(`${fileF} and not ${assigned}`, [FILE]);
  const shown = (await empRows.allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  const want = [...exp.map((e) => `${e.name} ${e.n}`), ...(un ? [`Unassigned ${un}`] : [])].sort((a, b) => digits(b) - digits(a));
  eq(shown.join("|"), want.join("|"), "per-employee rows");
  const v = await applyReport(page, "employee", "QA Exec Two", "label");
  eq(v, ids.exec2, "employee param");
  eq(await kpi(page, "Total leads"), await rCount(`${fileF} and exists (select 1 from lead_assignments a where a.lead_id=l.id and a.user_id=$4)`, [FILE, ids.exec2]), "exec2 total");
  await applyReport(page, "employee", "unassigned");
  eq(await kpi(page, "Total leads"), un, "unassigned total");
  return `exec2 / unassigned (${un}) totals match`;
}, page);

await check(["UI-191"], "Employee view of the report: only their own option and only leads assigned to them", async () => {
  const c2 = await signedIn(browser, "qa.exec2");
  const p2 = await c2.newPage();
  try {
    await p2.goto(base + RBASE + RF);
    const opts = await p2.locator("select[name=employee] option").allInnerTexts();
    eq(opts.join("|"), "All|QA Exec Two", "employee options for USER");
    eq(await kpi(p2, "Total leads"), await rCount(`${fileF} and exists (select 1 from lead_assignments a where a.lead_id=l.id and a.user_id=$4 and a.can_view)`, [FILE, ids.exec2]), "scoped total");
    await applyReport(p2, "employee", ids.exec2);
    eq(await kpi(p2, "Total leads"), 11, "scoped + employee filter");
    return "scoped to 11 assigned leads";
  } finally { await c2.close(); }
}, page);

await check(["UI-192"], "Source select filters by source and 'Any imported'", async () => {
  await page.goto(base + RBASE + RF);
  await applyReport(page, "source", "GIFTAGURU");
  eq(await kpi(page, "Total leads"), await rCount(`${fileF} and l.source='GIFTAGURU'`, [FILE]), "GiftaGuru total");
  eq(await kpi(page, "GiftaGuru"), await rCount(`${fileF} and l.source='GIFTAGURU'`, [FILE]), "GiftaGuru KPI");
  await applyReport(page, "source", "IMPORTED");
  eq(await kpi(page, "Total leads"), await rCount(`${fileF} and l.source<>'MANUAL'`, [FILE]), "imported total");
  eq(await kpi(page, "Manual"), 0, "manual under imported filter");
  return "source filters match SQL";
}, page);

await check(["UI-193"], "Current status select filters by lead status", async () => {
  await page.goto(base + RBASE + RF);
  await applyReport(page, "status", "Won Lead");
  eq(await kpi(page, "Total leads"), await rCount(`${fileF} and l.status='Won Lead'`, [FILE]), "won total");
  return "Won Lead = " + (await kpi(page, "Total leads"));
}, page);

await check(["UI-194"], "Status at insertion select filters (incl. Unknown legacy = NULL)", async () => {
  await page.goto(base + RBASE + RF);
  await applyReport(page, "initialStatus", "Unknown (legacy)");
  eq(await kpi(page, "Total leads"), await rCount(`${fileF} and l.initial_status is null`, [FILE]), "unknown total");
  await applyReport(page, "initialStatus", "New Lead");
  eq(await kpi(page, "Total leads"), await rCount(`${fileF} and l.initial_status='New Lead'`, [FILE]), "new lead total");
  return "initial status filters match SQL";
}, page);

await check(["UI-195"], "Assignment select filters assigned / unassigned", async () => {
  await page.goto(base + RBASE + RF);
  await applyReport(page, "assignment", "assigned");
  eq(await kpi(page, "Total leads"), await rCount(`${fileF} and ${assigned}`, [FILE]), "assigned");
  eq(await kpi(page, "Unassigned"), 0, "unassigned KPI under assigned filter");
  await applyReport(page, "assignment", "unassigned");
  eq(await kpi(page, "Total leads"), await rCount(`${fileF} and not ${assigned}`, [FILE]), "unassigned");
  return "assignment filters match SQL";
}, page);

await check(["UI-196"], "Import file select narrows the report to that file", async () => {
  await page.goto(base + RBASE);
  await applyReport(page, "fileName", FILE);
  eq(await kpi(page, "Total leads"), 52, "file total");
  eq(await kpi(page, "Total leads"), await rCount(fileF, [FILE]), "file total vs SQL");
  return "52 leads";
}, page);

await check(["UI-197"], "Import batch select filters by import job", async () => {
  await page.goto(base + RBASE);
  const opts = await page.locator("select[name=importJobId] option").count();
  expect(opts > 1, "no import batches to choose");
  const v = await applyReport(page, "importJobId", 1, "index");
  return settle(async (i) => {
    if (i) await page.reload();
    const n = await rCount("l.import_job_id=$3::uuid", [v]);
    eq(await kpi(page, "Total leads"), n, "batch total");
    return `batch ${v.slice(0, 8)}: ${n}`;
  });
}, page);

await check(["UI-198"], "Data type select filters by data type", async () => {
  await page.goto(base + RBASE);
  await applyReport(page, "dataType", DTYPE);
  eq(await kpi(page, "Total leads"), await rCount("l.data_type=$3", [DTYPE]), "data type total");
  eq(await kpi(page, "Total leads"), 52, "data type total = fixture");
  return "52";
}, page);

await check(["UI-200"], "Reset clears every filter (URL and controls)", async () => {
  await page.goto(base + RBASE + RF + "&grouping=week&source=MANUAL");
  await page.getByRole("link", { name: "Reset" }).click();
  await page.waitForURL((u) => u.pathname === "/crm/reports/lead-insertion" && u.search === "");
  eq(await page.locator("select[name=preset]").inputValue(), "month", "preset reset");
  eq(await page.locator("select[name=grouping]").inputValue(), "day", "grouping reset");
  eq(await page.locator("select[name=source]").inputValue(), "", "source reset");
  eq(await page.locator("select[name=fileName]").inputValue(), "", "file reset");
  return "cleared";
}, page);

const leadsSection = (p) => p.locator("section#leads");
const sqlLeads = (from, to, off, lim) => D.all(`select l.name, l.phone from leads l where (l.created_at at time zone 'UTC' at time zone 'Asia/Kolkata')::date between $1::date and $2::date and l.file_name=$3
  order by l.created_at desc, l.id desc offset ${off} limit ${lim}`, [from, to, FILE]);
await check(["UI-202", "UI-205", "UI-204"], "Period link opens the drill-down; lead rows match SQL order and content; Close hides it", async () => {
  await page.goto(base + RBASE + RF);
  const link = page.locator("section.table-card", { hasText: "Insertions per period" }).getByRole("link", { name: YDAY, exact: true });
  await link.click();
  await page.waitForURL((u) => u.searchParams.get("period") === YDAY);
  await leadsSection(page).getByRole("heading", { name: `Leads inserted in ${YDAY}` }).waitFor();
  eq(await page.locator("section.table-card", { hasText: "Insertions per period" }).getByRole("link", { name: YDAY, exact: true }).getAttribute("aria-current"), "true", "aria-current on period");
  const exp = await sqlLeads(YDAY, YDAY, 0, 50);
  expect((await leadsSection(page).innerText()).includes(`${exp.length} leads`), "lead count text");
  const rows = leadsSection(page).locator("tbody tr");
  eq(await rows.count(), exp.length, "drill-down rows");
  for (let i = 0; i < exp.length; i++) {
    const c = await rows.nth(i).locator("td").allInnerTexts();
    expect(c[0].startsWith(exp[i].name), `row ${i} name ${c[0]} != ${exp[i].name}`); eq(c[1], exp[i].phone, `row ${i} phone`);
    expect(c[3].startsWith(YDAY), `row ${i} inserted-at ${c[3]}`); eq(c[7], FILE, `row ${i} file`);
  }
  await leadsSection(page).getByRole("link", { name: "Close" }).click();
  await page.waitForURL((u) => !u.searchParams.has("period"));
  await leadsSection(page).waitFor({ state: "detached" });
  expect(new URL(page.url()).searchParams.get("fileName") === FILE, "Close dropped the filters");
  return `${exp.length} leads listed and closed`;
}, page);

await check(["UI-206", "UI-207"], "Drill-down Next / Previous pages through 52 leads (50 per page)", async () => {
  await page.goto(base + RBASE + RF + "&grouping=month");
  await page.locator("section.table-card", { hasText: "Insertions per period" }).locator("tbody tr a").first().click();
  await page.waitForURL((u) => u.searchParams.has("period"));
  await leadsSection(page).getByText("Page 1 of 2").waitFor();
  eq(await leadsSection(page).locator("tbody tr").count(), 50, "page 1 rows");
  await leadsSection(page).getByRole("link", { name: "Next" }).click();
  await page.waitForURL((u) => u.searchParams.get("page") === "2");
  await leadsSection(page).getByText("Page 2 of 2").waitFor();
  const exp = await sqlLeads(DBY, TODAY, 50, 50);
  const names = (await leadsSection(page).locator("tbody tr td:first-child .cell-primary").allInnerTexts());
  eq(names.join("|"), exp.map((e) => e.name).join("|"), "page 2 rows");
  eq(await leadsSection(page).getByRole("link", { name: "Next" }).count(), 0, "Next on last page");
  await leadsSection(page).getByRole("link", { name: "Previous" }).click();
  await page.waitForURL((u) => u.searchParams.get("page") === "1");
  await leadsSection(page).getByText("Page 1 of 2").waitFor();
  eq(await leadsSection(page).getByRole("link", { name: "Previous" }).count(), 0, "Previous on first page");
  return "page 2 rows match SQL offset 50";
}, page);

// =================================================================== ACTIVITY LOG + DATA TABLE
const AL = "/crm/activity-log";
const alTotal = async (p) => { const t = await p.locator(".dt-toolbar-info").innerText(); if (/No records/.test(t)) return 0; return digits(t.match(/of ([\d,]+)/)[1]); };
const alCount = (where, args) => D.count(`select count(*) n from activity_logs a left join users u on u.id=a.user_id where ${where}`, args);
const dayStart = (d) => `(${d}::date - interval '330 minutes')`;

await check(["UI-33"], "User select filters the log to that user (SQL count)", async () => {
  await page.goto(base + AL);
  await page.locator("#al-user").selectOption(ids.admin);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.waitForURL((u) => u.searchParams.get("user") === ids.admin);
  return settle(async (i) => {
    if (i) await page.reload();
    const n = await alCount("(a.user_id=$1 or (a.user_id is null and a.actor_user_code='E2E001'))", [ids.admin]);
    eq(await alTotal(page), n, "qa.admin entries");
    const users = (await page.locator("table tbody tr td:nth-child(2) .cell-primary").allInnerTexts());
    expect(users.every((u) => u === "QA Admin"), "rows from other users");
    eq(await page.locator("#al-user").inputValue(), ids.admin, "select keeps value");
    return `${n} entries`;
  });
}, page);

await check(["UI-34", "UI-35"], "From / To date inputs bound the log by IST day; reversed range shows an error", async () => {
  await page.goto(base + AL);
  await page.locator("#al-from").fill(TODAY);
  await page.locator("#al-to").fill(TODAY);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.waitForURL((u) => u.searchParams.get("from") === TODAY && u.searchParams.get("to") === TODAY);
  const today = await settle(async (i) => {
    if (i) await page.reload();
    const n = await alCount(`a.occurred_at >= ${dayStart("$1")} and a.occurred_at < ${dayStart("$1")} + interval '1 day'`, [TODAY]);
    eq(await alTotal(page), n, "today total"); return n;
  });
  await page.locator("#al-from").fill("2020-01-01");
  await page.locator("#al-to").fill(YDAY);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.waitForURL((u) => u.searchParams.get("to") === YDAY);
  const past = await alCount(`a.occurred_at < ${dayStart("$1")} + interval '1 day'`, [YDAY]);
  eq(await alTotal(page), past, "past total");
  if (past === 0) await page.getByText("No activity found").waitFor();
  await page.locator("#al-from").fill(TODAY);
  await page.locator("#al-to").fill(YDAY);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByRole("alert").filter({ hasText: "From date must not be after To date." }).waitFor();
  return `today ${today}, until yesterday ${past}, reversed range refused`;
}, page);

await check(["UI-31", "UI-37"], "Filter form carries table prefs (hidden inputs); Reset appears only when filtered and clears filters", async () => {
  await page.goto(base + AL + "?size=50&density=compact&dir=asc");
  eq(await page.getByRole("link", { name: "Reset" }).count(), 0, "Reset shown without filters");
  eq(await page.locator("form[role=search] input[type=hidden]").count(), 3, "hidden pref inputs");
  await page.locator("#al-q").fill("quotation.");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.waitForURL((u) => u.searchParams.get("q") === "quotation.");
  const u = new URL(page.url());
  eq(u.searchParams.get("size"), "50", "size kept"); eq(u.searchParams.get("density"), "compact", "density kept"); eq(u.searchParams.get("dir"), "asc", "dir kept");
  const actions = await page.locator("table tbody tr td:nth-child(3)").allInnerTexts();
  expect(actions.length > 0 && actions.every((a) => a.includes("quotation.")), "search result rows");
  await page.getByRole("link", { name: "Reset" }).click();
  await page.waitForURL((x) => x.pathname === AL && x.search === "");
  eq(await page.locator("#al-q").inputValue(), "", "search cleared");
  eq(await page.getByRole("link", { name: "Reset" }).count(), 0, "Reset still shown");
  return "prefs carried, reset cleared";
}, page);

await check(["UI-28", "UI-29"], "View details expands the JSON details, which equal the stored audit record", async () => {
  await page.goto(base + AL + "?q=quotation.created&size=100");
  const log = await D.one("select details from activity_logs where action='quotation.created' and details->>'quotationId'=$1", [Q.id]);
  const row = page.locator("table tbody tr").filter({ has: page.locator("pre", { hasText: Q.id }) });
  eq(await row.count(), 1, "audit row for the quotation");
  const det = row.locator("details");
  expect(!(await det.evaluate((d) => d.open)), "details open by default");
  expect(!(await row.locator("pre").isVisible()), "JSON visible before expanding");
  await row.getByText("View details").click();
  expect(await det.evaluate((d) => d.open), "details did not open");
  await row.locator("pre").waitFor({ state: "visible" });
  eq(JSON.stringify(JSON.parse(await row.locator("pre").innerText())), JSON.stringify(log.details), "details JSON");
  await row.getByText("View details").click();
  expect(!(await det.evaluate((d) => d.open)), "details did not close");
  return JSON.stringify(log.details);
}, page);

await check(["UI-37", "UI-33"], "Activity log is admin-only: employee is redirected", async () => {
  await ep.goto(base + AL);
  expect(new URL(ep.url()).pathname !== AL, "employee reached the activity log");
  eq(await ep.locator("#al-user").count(), 0, "filters rendered for employee");
  return "redirected to " + new URL(ep.url()).pathname + new URL(ep.url()).search;
}, ep);

const oldest = (off, lim) => D.all(`select a.action, coalesce(u.name, a.actor_name, 'Unknown') name from activity_logs a left join users u on u.id=a.user_id order by a.occurred_at asc, a.id asc offset ${off} limit ${lim}`);
const shownRows = async (p) => (await p.locator("table tbody tr").evaluateAll((trs) => trs.map((tr) => `${tr.children[2]?.innerText.trim()}@${tr.children[1]?.querySelector(".cell-primary")?.innerText.trim()}`)));
await check(["UI-547", "UI-548"], "Data table renders rows from the server; sortable header toggles direction (URL, aria-sort, order vs SQL)", async () => {
  await page.goto(base + AL);
  const th = page.getByRole("columnheader", { name: /When \(IST\)/ });
  eq(await th.getAttribute("aria-sort"), "descending", "default sort");
  eq(await page.locator("table thead th").count(), 4, "column count");
  const total = await alTotal(page);
  eq(await page.locator("table tbody tr").count(), Math.min(25, total), "rows on page");
  await th.getByRole("link").click();
  await page.waitForURL((u) => u.searchParams.get("dir") === "asc" && u.searchParams.get("sort") === "occurredAt");
  eq(await page.getByRole("columnheader", { name: /When \(IST\)/ }).getAttribute("aria-sort"), "ascending", "aria-sort after click");
  const exp = (await oldest(0, 25)).map((r) => `${r.action}@${r.name}`);
  eq((await shownRows(page)).join("|"), exp.join("|"), "ascending rows");
  await page.getByRole("columnheader", { name: /When \(IST\)/ }).getByRole("link").click();
  await page.waitForURL((u) => u.searchParams.get("dir") === "desc");
  eq(await page.getByRole("columnheader", { name: /When \(IST\)/ }).getAttribute("aria-sort"), "descending", "aria-sort after 2nd click");
  return "asc order equals SQL; toggles back to desc";
}, page);

await check(["UI-550", "UI-551"], "Data table Next / Previous page links (URL, range text, rows vs SQL)", async () => {
  await page.goto(base + AL + "?sort=occurredAt&dir=asc");
  eq(await page.locator(".table-foot").getByRole("link", { name: "Previous page" }).count(), 0, "Previous link on page 1");
  await page.locator(".table-foot").getByRole("link", { name: "Next page" }).click();
  await page.waitForURL((u) => u.searchParams.get("page") === "2");
  expect(/^26–/.test(await page.locator(".dt-toolbar-info").innerText()), "range text on page 2");
  await page.getByText(/^Page 2 of/).waitFor();
  const exp = (await oldest(25, 25)).map((r) => `${r.action}@${r.name}`);
  eq((await shownRows(page)).join("|"), exp.join("|"), "page 2 rows");
  expect(new URL(page.url()).searchParams.get("dir") === "asc", "sort lost when paging");
  await page.locator(".table-foot").getByRole("link", { name: "Previous page" }).click();
  await page.waitForURL((u) => u.searchParams.get("page") === "1");
  expect(/^1–/.test(await page.locator(".dt-toolbar-info").innerText()), "range text on page 1");
  return "paged forward/back";
}, page);

await check(["UI-549"], "Rows-per-page links change page size (URL, aria-current, row count)", async () => {
  await page.goto(base + AL + "?q=quotation&page=2");
  await page.getByRole("link", { name: "50 rows per page" }).click();
  await page.waitForURL((u) => u.searchParams.get("size") === "50");
  const u = new URL(page.url());
  expect(!u.searchParams.has("page") && u.searchParams.get("q") === "quotation", "page not reset / filter lost");
  eq(await page.getByRole("link", { name: "50 rows per page" }).getAttribute("aria-current"), "page", "aria-current");
  const total = await alTotal(page);
  eq(await page.locator("table tbody tr").count(), Math.min(50, total), "rows at size 50");
  await page.goto(base + AL);
  await page.getByRole("link", { name: "100 rows per page" }).click();
  await page.waitForURL((x) => x.searchParams.get("size") === "100");
  eq(await page.locator("table tbody tr").count(), Math.min(100, await alTotal(page)), "rows at size 100");
  return "50 and 100";
}, page);

await check(["UI-540"], "Density link toggles compact / comfortable rows", async () => {
  await page.goto(base + AL + "?q=quotation");
  const sect = page.locator("section.table-card[aria-label='Activity log entries']");
  eq(await sect.getAttribute("data-density"), "comfortable", "initial density");
  await page.getByRole("link", { name: "Compact row density" }).click();
  await page.waitForURL((u) => u.searchParams.get("density") === "compact");
  eq(await sect.getAttribute("data-density"), "compact", "compact applied");
  expect(new URL(page.url()).searchParams.get("q") === "quotation", "filter lost");
  await page.getByRole("link", { name: "Comfortable row density" }).click();
  await page.waitForURL((u) => !u.searchParams.has("density"));
  eq(await sect.getAttribute("data-density"), "comfortable", "comfortable restored");
  return "toggled";
}, page);

await check(["UI-541", "UI-542", "UI-543", "UI-544", "UI-545", "UI-546", "UI-539"], "Columns menu: hide and re-show the Details column; carried params survive", async () => {
  await page.goto(base + AL + "?q=quotation&size=50&page=2");
  const det = page.locator("details.dt-columns");
  expect(!(await det.evaluate((d) => d.open)), "menu open by default");
  await page.locator("summary", { hasText: "Columns" }).click();
  expect(await det.evaluate((d) => d.open), "menu did not open");
  const box = det.getByLabel("Details");
  expect(await box.isChecked(), "Details not checked by default");
  eq(await det.locator("input[type=hidden][name=cols]").inputValue(), "_", "cols sentinel");
  eq((await det.locator("input[type=hidden]").evaluateAll((els) => els.filter((e) => e.name !== "cols").map((e) => `${e.name}=${e.value}`))).sort().join("&"), "q=quotation&size=50", "carried hidden inputs (page dropped)");
  await box.uncheck();
  await det.getByRole("button", { name: "Apply" }).click();
  await page.waitForURL((u) => u.searchParams.getAll("cols").join(",") === "_");
  let u = new URL(page.url());
  expect(u.searchParams.get("q") === "quotation" && u.searchParams.get("size") === "50" && !u.searchParams.has("page"), "carried params wrong: " + u.search);
  eq(await page.getByRole("columnheader", { name: "Details" }).count(), 0, "Details column still shown");
  eq(await page.locator("table thead th").count(), 3, "header count without details");
  await page.locator("summary", { hasText: "Columns" }).click();
  await det.getByLabel("Details").check();
  await det.getByRole("button", { name: "Apply" }).click();
  await page.waitForURL((x) => x.searchParams.getAll("cols").join(",") === "_,details");
  await page.getByRole("columnheader", { name: "Details" }).waitFor();
  u = new URL(page.url());
  expect(u.searchParams.get("q") === "quotation", "filter lost on re-show");
  return "hidden and restored";
}, page);

// =================================================================== DASHBOARD + METRIC CARDS
const DASH = "/crm/entrydashboard";
const istStart = `(date_trunc('day', now() at time zone 'Asia/Kolkata') - interval '330 minutes')`;
const scopeSql = (uid) => (uid ? `exists (select 1 from lead_assignments s where s.lead_id=l.id and s.user_id='${uid}' and s.can_view)` : "true");
async function kpiSql(uid) {
  const sc = scopeSql(uid);
  return D.one(`select count(*)::int total,
    count(*) filter (where created_at >= ${istStart} and created_at < ${istStart} + interval '1 day')::int "newToday",
    count(*) filter (where exists (select 1 from lead_assignments a where a.lead_id=l.id))::int assigned,
    count(*) filter (where not exists (select 1 from lead_assignments a where a.lead_id=l.id))::int unassigned,
    count(*) filter (where status='In Progress')::int trending, count(*) filter (where status='Won Lead')::int won, count(*) filter (where status='Lost Lead')::int lost,
    count(*) filter (where follow_up_date >= ${istStart} and follow_up_date < ${istStart} + interval '1 day')::int "dueToday",
    count(*) filter (where follow_up_date >= ${istStart} + interval '1 day')::int upcoming,
    count(*) filter (where follow_up_date < ${istStart} and status not in ('Won Lead','Lost Lead'))::int overdue
    from leads l where ${sc}`);
}
async function quoteSql(uid) {
  const w = uid ? `user_id='${uid}'` : "true";
  return D.one(`select count(*)::int c, coalesce(sum(grand_total),0)::text t,
    count(*) filter (where created_at >= (date_trunc('month', now() at time zone 'Asia/Kolkata') - interval '330 minutes'))::int mc,
    coalesce(sum(grand_total) filter (where created_at >= (date_trunc('month', now() at time zone 'Asia/Kolkata') - interval '330 minutes')),0)::text mt from quotations where ${w}`);
}
async function activitySql(uid) {
  const r = await D.one(`select count(*) filter (where due_at >= ${istStart} and due_at < ${istStart} + interval '1 day')::int today,
    count(*) filter (where due_at < ${istStart})::int overdue from activities where assignee_id=$1 and status='OPEN' and type <> 'NOTE'`, [uid]).catch(() => null);
  return r;
}
const card = (p, label) => p.locator("a.kpi, div.kpi").filter({ has: p.locator(".kpi-label", { hasText: new RegExp(`^${label.replace(/[()]/g, "\\$&")}$`) }) });
const cardVal = async (p, label) => card(p, label).locator(".kpi-value").innerText();
const pct = (w, t) => (t > 0 ? Math.round((w / t) * 10000) / 100 : 0).toFixed(2) + "%";
const inr0 = (v) => Number(v).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

await check(["UI-552"], "Admin metric cards: every value equals SQL; linked cards expose value in aria-label and open their list", async () => {
  const links = { "Total leads": "/crm/lead-management", "New today": `/crm/lead-management?dateType=createdAt&from=${TODAY}&to=${TODAY}`, "Assigned": "/crm/assigned-leads",
    "Unassigned": "/crm/unassigned-leads", "In progress": "/crm/trending-leads", "Won": "/crm/won-leads", "Due today": `/crm/lead-management?dateType=followUpDate&from=${TODAY}&to=${TODAY}`,
    "Upcoming": `/crm/lead-management?dateType=followUpDate&from=${istDate(1)}`, "My activities due today": "/crm/activities?view=today", "My overdue activities": "/crm/activities?view=overdue",
    "Quotations this month": "/crm/quotations", "All quotations": "/crm/quotations" };
  const res = await settle(async (i) => {
    await page.goto(base + DASH);
    const k = await kpiSql(null), q = await quoteSql(null);
    const want = { "Total leads": k.total, "New today": k.newToday, "Assigned": k.assigned, "Unassigned": k.unassigned, "In progress": k.trending, "Won": k.won, "Lost": k.lost,
      "Due today": k.dueToday, "Upcoming": k.upcoming, "Overdue": k.overdue };
    for (const [l, v] of Object.entries(want)) eq(digits(await cardVal(page, l)), v, l);
    eq(await cardVal(page, "Conversion rate"), pct(k.won, k.total), "conversion rate");
    eq(await cardVal(page, "All quotations"), inr0(q.t), "all quotations value");
    eq(await cardVal(page, "Quotations this month"), inr0(q.mt), "month quotations value");
    expect((await card(page, "All quotations").innerText()).includes(`${q.c.toLocaleString("en-IN")} quotation`), "all quotations count hint");
    expect((await card(page, "Quotations this month").innerText()).includes(`${q.mc.toLocaleString("en-IN")} quotation`), "month quotations count hint");
    const act = await activitySql(ids.admin);
    if (act) { eq(digits(await cardVal(page, "My activities due today")), act.today, "activities today"); eq(digits(await cardVal(page, "My overdue activities")), act.overdue, "activities overdue"); }
    return `total ${k.total}, quotes ${q.c}/${q.t}${act ? "" : " (activities not SQL-checked)"}${i ? `, settled after ${i}` : ""}`;
  });
  for (const l of ["Lost", "Conversion rate", "Overdue"]) eq(await page.locator("div.kpi").filter({ has: page.locator(".kpi-label", { hasText: new RegExp(`^${l}$`) }) }).count(), 1, `${l} should be a plain (unlinked) card`);
  for (const [l, href] of Object.entries(links)) {
    const a = card(page, l);
    eq(await a.getAttribute("href"), href, `${l} href`);
    const v = await a.locator(".kpi-value").innerText();
    eq(await a.getAttribute("aria-label"), `${l}: ${v}. Open list`, `${l} aria-label`);
  }
  for (const l of ["Total leads", "Unassigned", "Won", "All quotations", "My overdue activities", "Due today"]) {
    await page.goto(base + DASH);
    await card(page, l).click();
    await page.waitForURL((u) => u.pathname + u.search === links[l]);
  }
  return res + "; navigation verified";
}, page);

await check(["UI-552"], "Employee metric cards: scoped values equal SQL; links target the employee lists", async () => {
  const links = { "My leads": "/crm/my-leads", "In progress": "/crm/my-trending-leads", "Won": "/crm/conversions", "Conversion rate": "/crm/conversions",
    "Due today": "/crm/today-followups", "Upcoming": "/crm/upcoming-followups", "My quotations this month": "/crm/quotations", "All my quotations": "/crm/quotations" };
  const res = await settle(async () => {
    await ep.goto(base + DASH);
    const k = await kpiSql(ids.exec1), q = await quoteSql(ids.exec1);
    for (const [l, v] of Object.entries({ "My leads": k.total, "New today": k.newToday, "In progress": k.trending, "Won": k.won, "Due today": k.dueToday, "Upcoming": k.upcoming, "Overdue": k.overdue })) eq(digits(await cardVal(ep, l)), v, l);
    eq(await cardVal(ep, "Conversion rate"), pct(k.won, k.total), "conversion");
    eq(await cardVal(ep, "All my quotations"), inr0(q.t), "all my quotations"); eq(await cardVal(ep, "My quotations this month"), inr0(q.mt), "month");
    return `my leads ${k.total}, quotes ${q.c}`;
  });
  for (const [l, href] of Object.entries(links)) eq(await card(ep, l).getAttribute("href"), href, `${l} href`);
  eq(await card(ep, "Total leads").count(), 0, "admin card shown to employee");
  await card(ep, "My leads").click();
  await ep.waitForURL("**/crm/my-leads");
  await ep.goto(base + DASH);
  await card(ep, "Upcoming").click();
  await ep.waitForURL("**/crm/upcoming-followups");
  return res;
}, ep);

await check(["UI-38", "UI-39"], "Header View leads / New lead links (admin and employee targets; create dialog opens)", async () => {
  await page.goto(base + DASH);
  await page.getByRole("link", { name: "View leads" }).click();
  await page.waitForURL((u) => u.pathname === "/crm/lead-management");
  await page.goto(base + DASH);
  await page.getByRole("link", { name: "New lead" }).click();
  await page.waitForURL((u) => u.pathname === "/crm/lead-management" && u.searchParams.get("create") === "lead");
  await page.getByRole("dialog").waitFor();
  await ep.goto(base + DASH);
  await ep.getByRole("link", { name: "View leads" }).click();
  await ep.waitForURL((u) => u.pathname === "/crm/my-leads");
  await ep.goto(base + DASH);
  await ep.getByRole("link", { name: "New lead" }).click();
  await ep.waitForURL((u) => u.pathname === "/crm/my-leads" && u.searchParams.get("create") === "lead");
  return "admin → lead-management, employee → my-leads; create dialog opened";
}, page);

const perfRows = async (p) => (await p.locator("section[aria-labelledby=perf-title] tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.innerText.trim()).join("|"))));
async function perfSql(gte, lt, uid) {
  const conds = ["a.can_view"]; const args = [];
  if (uid) { args.push(uid); conds.push(`a.user_id=$${args.length}`); }
  if (gte) conds.push(`l.created_at >= ${gte}`);
  if (lt) conds.push(`l.created_at < ${lt}`);
  const rows = await D.all(`select u.name, count(*)::int leads, count(*) filter (where l.status='Won Lead')::int deals from lead_assignments a join leads l on l.id=a.lead_id join users u on u.id=a.user_id
    where ${conds.join(" and ")} group by u.id, u.name`, args);
  return rows.sort((a, b) => a.name.localeCompare(b.name)).map((r) => `${r.name}|${r.leads.toLocaleString("en-IN")}|${r.deals.toLocaleString("en-IN")}|${pct(r.deals, r.leads)}`);
}
const RANGES = {
  "Today": [istStart, `${istStart} + interval '1 day'`],
  "This week": [`(date_trunc('week', now() at time zone 'Asia/Kolkata') - interval '330 minutes')`, `${istStart} + interval '1 day'`],
  "This month": [`(date_trunc('month', now() at time zone 'Asia/Kolkata') - interval '330 minutes')`, `${istStart} + interval '1 day'`],
  "All time": [null, null],
};
await check(["UI-40", "UI-46"], "Performance period links switch the window (URL, aria-current) and the team table matches SQL", async () => {
  const out = [];
  for (const [label, [gte, lt]] of Object.entries(RANGES)) {
    await page.goto(base + DASH + "?range=custom&from=2020-01-01&to=2020-01-02");
    await page.getByRole("navigation", { name: "Performance period" }).getByRole("link", { name: label }).click();
    const want = label === "All time" ? null : { "Today": "today", "This week": "week", "This month": "month" }[label];
    await page.waitForURL((u) => u.pathname === DASH && (want ? u.searchParams.get("range") === want : !u.searchParams.has("range")));
    eq(await page.getByRole("navigation", { name: "Performance period" }).getByRole("link", { name: label }).getAttribute("aria-current"), "page", `${label} aria-current`);
    await settle(async (i) => {
      if (i) await page.reload();
      const exp = await perfSql(gte, lt);
      const shown = await perfRows(page);
      if (exp.length === 0) expect(shown.length === 1 && shown[0].includes("No assigned leads"), `${label} empty state`);
      else eq(shown.join(" / "), exp.join(" / "), `${label} rows`);
      out.push(`${label}:${exp.length}`);
    });
  }
  return out.join(", ");
}, page);

await check(["UI-41", "UI-42", "UI-43", "UI-44", "UI-45", "UI-46"], "Custom range form: required dates, Apply submits range=custom with dates, table matches SQL, reversed range shows an alert", async () => {
  await page.goto(base + DASH);
  const form = page.locator("section[aria-labelledby=perf-title] form");
  eq(await form.locator("input[type=hidden][name=range]").inputValue(), "custom", "hidden range");
  await form.getByRole("button", { name: "Apply" }).click();
  await sleep(500);
  expect(new URL(page.url()).search === "", "form submitted with empty required dates");
  expect(!(await page.getByLabel("From date").evaluate((e) => e.validity.valid)), "from not flagged invalid");
  await page.getByLabel("From date").fill(DBY);
  await page.getByLabel("To date").fill(YDAY);
  await form.getByRole("button", { name: "Apply" }).click();
  await page.waitForURL((u) => u.searchParams.get("range") === "custom" && u.searchParams.get("from") === DBY && u.searchParams.get("to") === YDAY);
  eq(await page.getByLabel("From date").inputValue(), DBY, "from kept"); eq(await page.getByLabel("To date").inputValue(), YDAY, "to kept");
  const exp = await settle(async (i) => {
    if (i) await page.reload();
    const e = await perfSql(`(('${DBY}'::date) - interval '330 minutes')`, `(('${YDAY}'::date + 1) - interval '330 minutes')`);
    eq((await perfRows(page)).join(" / "), e.join(" / "), "custom rows"); return e;
  });
  expect(exp.some((r) => r.startsWith("QA Exec Two|")), "fixture assignments missing from custom window");
  await page.getByLabel("From date").fill(YDAY);
  await page.getByLabel("To date").fill(DBY);
  await form.getByRole("button", { name: "Apply" }).click();
  await page.getByRole("alert").filter({ hasText: "From date must not be after To date." }).waitFor();
  return exp.join(" / ");
}, page);

await check(["UI-46"], "Employee performance table shows only the employee's own row (SQL)", async () => {
  await ep.goto(base + DASH);
  await settle(async (i) => {
    if (i) await ep.reload();
    eq((await perfRows(ep)).join(" / "), (await perfSql(null, null, ids.exec1)).join(" / "), "employee rows");
  });
  return "own row only";
}, ep);

await check(["UI-48", "UI-49", "UI-47"], "Recently added leads table equals the 8 newest leads in scope; lead link and View all navigate", async () => {
  const names = await settle(async (i) => {
    await page.goto(base + DASH);
    const exp = await D.all("select id::text, coalesce(name,'Unnamed lead') name, coalesce(company,'—') company, status from leads order by created_at desc limit 8");
    const rows = page.locator("section[aria-labelledby=recent-title] tbody tr");
    eq(await rows.count(), exp.length, "recent rows");
    for (let j = 0; j < exp.length; j++) {
      const link = rows.nth(j).locator("a");
      eq(await link.innerText(), exp[j].name, `row ${j} name`);
      eq(await link.getAttribute("href"), `/crm/lead-management/${exp[j].id}`, `row ${j} href`);
      eq((await rows.nth(j).locator(".sub").innerText()), exp[j].company, `row ${j} company`);
      expect((await rows.nth(j).locator("td").nth(1).innerText()).includes(exp[j].status), `row ${j} status`);
    }
    return exp;
  });
  await page.locator("section[aria-labelledby=recent-title] tbody tr a").first().click();
  await page.waitForURL((u) => u.pathname.startsWith("/crm/lead-management/") && u.pathname.split("/").length === 4);
  await page.goto(base + DASH);
  await page.locator("section[aria-labelledby=recent-title]").getByRole("link", { name: "View all" }).click();
  await page.waitForURL((u) => u.pathname === "/crm/lead-management");
  await ep.goto(base + DASH);
  const exp = await D.all(`select coalesce(name,'Unnamed lead') name from leads l where ${scopeSql(ids.exec1)} order by created_at desc limit 8`);
  eq((await ep.locator("section[aria-labelledby=recent-title] tbody tr a").allInnerTexts()).join("|"), exp.map((e) => e.name).join("|"), "employee recent leads");
  await ep.locator("section[aria-labelledby=recent-title]").getByRole("link", { name: "View all" }).click();
  await ep.waitForURL((u) => u.pathname === "/crm/my-leads");
  return `${names.length} recent leads; employee scoped`;
}, page);

// =================================================================== LOADING SKELETON (observed by delaying the RSC response)
await check(["UI-554"], "Route loading skeleton table is shown while a CRM page's data is in flight", async () => {
  await page.goto(base + DASH);
  let delayed = 0;
  await page.route((u) => u.pathname === "/crm/quotations" && (u.searchParams.has("_rsc")), async (r) => { delayed++; await sleep(4000); await r.continue().catch(() => {}); });
  await page.route((u) => u.pathname === "/crm/quotations", async (r) => { if (r.request().headers()["rsc"]) { delayed++; await sleep(4000); } await r.fallback(); });
  await card(page, "All quotations").click();
  const sk = page.locator("section.table-card[role=status][aria-label='Loading records']");
  await sk.waitFor({ state: "visible", timeout: 3500 });
  eq(await sk.locator("table thead th").count(), 5, "skeleton columns");
  eq(await sk.locator("table tbody tr").count(), 8, "skeleton rows");
  eq(await sk.locator("table").getAttribute("aria-hidden"), "true", "skeleton table hidden from AT");
  expect(await page.locator("main[aria-busy=true]").isVisible(), "page not marked busy");
  await page.waitForURL((u) => u.pathname === "/crm/quotations");
  await page.getByRole("heading", { name: "Quotations" }).waitFor();
  await sk.waitFor({ state: "detached" });
  await page.unrouteAll({ behavior: "ignoreErrors" });
  return `skeleton observed (${delayed} delayed RSC request(s)), replaced by the real page`;
}, page);

// =================================================================== cleanup (only tagged fixtures created by this run)
try {
  const qids = [...createdQuotes, ...seedQuotes.map((s) => s.id)];
  await D.db.query("delete from quotation_items where quotation_id = any($1::uuid[])", [qids]);
  await D.db.query("delete from quotations where id = any($1::uuid[])", [qids]);
  await D.db.query("delete from lead_assignments where lead_id = any($1::uuid[])", [fixtureLeads]);
  await D.db.query("delete from leads where id = any($1::uuid[])", [fixtureLeads]);
} catch (e) { console.log("cleanup warning:", String(e).split("\n")[0]); }

await browser.close();
await D.end();
R.finish();
