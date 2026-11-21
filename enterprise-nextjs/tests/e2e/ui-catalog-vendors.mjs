// Per-control UI suite: Product catalog (product-management, product-dashboard) and Vendors (list, profile tabs,
// modal forms, bulk table, import wizard, settings/categories/performance/import pages). Isolated E2E stack only.
// Every check drives the real control in Chromium and verifies the outcome (DB rows, API/server-action results,
// navigation, visible feedback, role gating). All records are created here with a unique tag; seeded data is
// read but never modified. Results: test-artifacts/ui-catalog-vendors.json
import { readFileSync } from "node:fs";
import { base, expect, launch, openDb, recorder, signedIn, tag } from "./lib.mjs";

const R = recorder("catalog-vendors");
const D = await openDb();
const browser = await launch();
const ctxA = await signedIn(browser, "qa.admin");
const ctxE = await signedIn(browser, "qa.exec1");
const pa = await ctxA.newPage();
const pe = await ctxE.newPage();
for (const p of [pa, pe]) { p.setDefaultTimeout(20000); p.setDefaultNavigationTimeout(60000); }
let page = pa; // page screenshotted on failure

const ids = await D.one("select (select id::text from users where username='qa.exec1') exec1, (select id::text from users where username='qa.admin') admin");

// ------------------------------------------------------------------ helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, msg, timeout = 15000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { last = await fn(); if (last) return last; } catch { /* retry */ }
    await sleep(300);
  }
  throw new Error(msg + (last !== undefined ? ` (last: ${JSON.stringify(last)})` : ""));
}
const toast = (p, text) => p.locator("[data-sonner-toast]", { hasText: text }).first().waitFor({ timeout: 20000 });
const native = (p) => p.locator("dialog[open]"); // vendor ModalForm (native <dialog>)
const modal = (p, name) => p.getByRole("dialog", { name }); // components/ui/modal
const goto = async (p, path) => { await p.goto(base + path); await p.waitForLoadState("domcontentloaded"); };
const path = (p) => { const u = new URL(p.url()); return u.pathname + u.search; };
function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const rows = []; let row = []; let f = ""; let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i += 1; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f.replace(/\r$/, "")); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}
async function download(p, click) {
  const [dl] = await Promise.all([p.waitForEvent("download"), click()]);
  return { name: dl.suggestedFilename(), text: readFileSync(await dl.path(), "utf8"), bytes: readFileSync(await dl.path()) };
}
const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from(`%PDF-1.4\n% QA ${tag}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`);
const fill = async (scope, name, value) => {
  const el = scope.locator(`[name="${name}"]`);
  const tagName = await el.evaluate((n) => n.tagName);
  if (tagName === "SELECT") await el.selectOption(value); else await el.fill(String(value));
};

// =====================================================================================================
// PRODUCT CATALOG
// =====================================================================================================
const catName = `UIC Cat ${tag}`;
const catRenamed = `${catName} R`;
const prodA = { name: `UIC Prod ${tag} Alpha`, style: `UIC-${tag}-A`, type: "Metal", color: "Matte Black", hsn: "96081019", dim: "14 x 1 cm", desc: `Alpha description ${tag}`, pp: "60.5", basic: "100", gst: "18" };
const prodB = { name: `UIC Prod ${tag} Beta`, style: `UIC-${tag}-B`, type: "Plastic", color: "Blue", hsn: "39269099", dim: "10 cm", desc: `Beta ${tag}`, pp: "20", basic: "50", gst: "12" };
let catId = null;
const prodRow = (name) => pa.locator("table tbody tr", { hasText: name });

if (!process.env.ONLY || process.env.ONLY === "catalog") {
  await R.check(["UI-67"], "Product dashboard: Open products link navigates to the catalogue; totals match the database", async () => {
    await goto(pa, "/crm/product-dashboard");
    const total = await D.count("select count(*) n from products where status<>'ARCHIVED'");
    const card = await pa.getByRole("link", { name: /^Total products:/ }).getAttribute("aria-label");
    expect(card.includes(total.toLocaleString("en-IN")), `total card "${card}" != db ${total}`);
    await pa.getByRole("link", { name: "Open products", exact: true }).click();
    await pa.waitForURL((u) => u.pathname === "/crm/product-management");
    await pa.getByRole("heading", { name: "Products", exact: true }).waitFor();
    return `db total ${total}; navigated to ${path(pa)}`;
  }, pa);

  await R.check(["UI-68", "UI-88", "UI-91", "UI-93", "UI-94", "UI-95"], "Manage categories: add a category (empty name blocked, duplicate rejected) persists with a generated code", async () => {
    await goto(pa, "/crm/product-management");
    await pa.getByRole("button", { name: "Manage categories" }).click();
    const m = modal(pa, "Manage categories");
    await m.waitFor();
    const add = m.getByRole("button", { name: "Add", exact: true });
    expect(await add.isDisabled(), "Add enabled with an empty name");
    await m.getByLabel("New category name").fill(catName);
    await add.click();
    await toast(pa, "Category added.");
    const row = await until(() => D.one("select id::text, cat_id, name from categories where name=$1", [catName]), "category not persisted");
    catId = row.id;
    expect(/^CU\d{3}$/.test(row.cat_id), "unexpected category code " + row.cat_id);
    await m.getByLabel(`Name of ${catName}`).waitFor();
    expect((await m.getByLabel("New category name").inputValue()) === "", "input not cleared after add");
    await m.getByLabel("New category name").fill(catName.toLowerCase());
    await add.click();
    await m.getByRole("alert").filter({ hasText: "Category already exists." }).waitFor();
    expect(await D.count("select count(*) n from categories where lower(name)=lower($1)", [catName]) === 1, "duplicate category persisted");
    await m.getByLabel("New category name").fill("");
    return `created ${row.cat_id} ${catName}; duplicate rejected`;
  }, pa);

  await R.check(["UI-96", "UI-97"], "Manage categories: rename input + save button persist the new name", async () => {
    const m = modal(pa, "Manage categories");
    const save = m.getByRole("button", { name: `Save new name for ${catName}` });
    expect(await save.isDisabled(), "save enabled before any change");
    await m.getByLabel(`Name of ${catName}`).fill(catRenamed);
    expect(await save.isEnabled(), "save disabled after change");
    await save.click();
    await toast(pa, "Category renamed.");
    await until(async () => (await D.one("select name from categories where id=$1", [catId]))?.name === catRenamed, "rename not persisted");
    await m.getByLabel(`Name of ${catRenamed}`).waitFor();
    return `renamed to ${catRenamed}`;
  }, pa);

  await R.check(["UI-98", "UI-90", "UI-92"], "Manage categories: delete opens a confirm dialog; cancel keeps, confirm removes; Done closes", async () => {
    const m = modal(pa, "Manage categories");
    const tmp = `UIC Del ${tag}`;
    await m.getByLabel("New category name").fill(tmp);
    await m.getByRole("button", { name: "Add", exact: true }).click();
    await m.getByLabel(`Name of ${tmp}`).waitFor();
    await m.getByRole("button", { name: `Delete ${tmp}` }).click();
    const c = modal(pa, "Delete category");
    await c.waitFor();
    expect((await c.innerText()).includes(tmp), "confirm text lacks the category name");
    await c.getByRole("button", { name: "Cancel" }).click();
    await m.getByLabel(`Name of ${tmp}`).waitFor();
    expect(await D.count("select count(*) n from categories where name=$1", [tmp]) === 1, "cancel deleted the category");
    await m.getByRole("button", { name: `Delete ${tmp}` }).click();
    await modal(pa, "Delete category").getByRole("button", { name: "Delete category" }).click();
    await toast(pa, "Category deleted.");
    await until(async () => (await D.count("select count(*) n from categories where name=$1", [tmp])) === 0, "category not deleted");
    await m.getByLabel(`Name of ${tmp}`).waitFor({ state: "detached" });
    await m.getByRole("button", { name: "Done" }).click();
    await m.waitFor({ state: "hidden" });
    return "cancel kept, confirm deleted, Done closed";
  }, pa);

  await R.check(["UI-69", "UI-86", "UI-99", "UI-100"], "Add product opens the add modal; Cancel closes it without saving", async () => {
    await pa.getByRole("button", { name: "Add product" }).click();
    const m = modal(pa, "Add product");
    await m.waitFor();
    await m.locator("#pf-n").fill(prodA.name + " cancelled");
    await m.getByRole("button", { name: "Cancel" }).click();
    await m.waitFor({ state: "hidden" });
    expect(await D.count("select count(*) n from products where p_name=$1", [prodA.name + " cancelled"]) === 0, "cancelled product saved");
    return "modal opened and cancelled";
  }, pa);

  await R.check(["UI-101", "UI-102", "UI-103", "UI-104", "UI-107", "UI-108", "UI-109", "UI-110", "UI-111", "UI-112", "UI-113", "UI-114", "UI-115", "UI-116", "UI-117", "UI-118"],
    "Add product: required-field validation, code preview, image pick/discard, net auto-calc; every field persisted", async () => {
      await pa.getByRole("button", { name: "Add product" }).click();
      const m = modal(pa, "Add product");
      await m.waitFor();
      let posted = false;
      const onReq = (r) => { if (r.method() === "POST" && new URL(r.url()).pathname === "/api/products") posted = true; };
      pa.on("request", onReq);
      await m.getByRole("button", { name: "Add product" }).click();
      await sleep(500);
      expect(!posted && !(await m.locator("#pf-category").evaluate((e) => e.validity.valid)), "empty required form was submitted");
      pa.off("request", onReq);
      await m.locator("#pf-category").selectOption({ label: catRenamed });
      const preview = await until(async () => { const t = (await m.locator("text=/^[A-Z]+-\\d{3}$/").first().innerText().catch(() => "")); return t; }, "no code preview");
      await m.locator("#pf-image").setInputFiles({ name: "a.png", mimeType: "image/png", buffer: PNG });
      expect((await m.getByAltText("Product preview").getAttribute("src")).startsWith("blob:"), "picked image not previewed");
      await m.getByRole("button", { name: "Discard new image" }).click();
      expect(await m.getByAltText("Product preview").count() === 0, "discard did not clear the preview");
      await m.locator("#pf-image").setInputFiles({ name: "a.png", mimeType: "image/png", buffer: PNG });
      await m.locator("#pf-n").fill(prodA.name);
      await m.locator("#pf-s").fill(prodA.style);
      await m.locator("#pf-t").fill(prodA.type);
      await m.locator("#pf-c").fill(prodA.color);
      await m.locator("#pf-h").fill(prodA.hsn);
      await m.locator("#pf-d").fill(prodA.dim);
      await m.locator("#pf-desc").fill(prodA.desc);
      await m.locator("#pf-pp").fill(prodA.pp);
      await m.locator("#pf-ba").fill(prodA.basic);
      await m.locator("#pf-g").fill(prodA.gst);
      const net = await m.getByPlaceholder("Basic + GST").inputValue();
      expect(net === "118.00", "net amount auto-calc shows " + net);
      expect(await m.getByPlaceholder("Basic + GST").evaluate((e) => e.readOnly), "net amount is editable");
      const [resp] = await Promise.all([pa.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/products"), m.getByRole("button", { name: "Add product" }).click()]);
      expect(resp.status() === 201 || resp.status() === 200, "POST /api/products status " + resp.status());
      await m.waitFor({ state: "hidden" });
      const p = await until(() => D.one(`select p.*, pr.purchase_price, pr.basic_amount, pr.gst_rate pgst, pr.net_amount, pr.price_code from products p left join product_prices pr on pr.product_id=p.id where p.p_name=$1`, [prodA.name]), "product not persisted");
      await toast(pa, `Product ${p.p_code} added.`);
      const want = { s_code: prodA.style, p_type: prodA.type, p_color: prodA.color, hsn_code: prodA.hsn, dimension: prodA.dim, p_description: prodA.desc, category_id: catId, status: "ACTIVE" };
      for (const [k, v] of Object.entries(want)) expect(p[k] === v, `${k}: ${p[k]} != ${v}`);
      expect(p.p_code === preview, `saved code ${p.p_code} != preview ${preview}`);
      expect(Number(p.purchase_price) === 60.5 && Number(p.basic_amount) === 100 && Number(p.pgst) === 18 && Number(p.gst_rate) === 18 && Number(p.net_amount) === 118, "price row mismatch " + JSON.stringify(p));
      expect(/product-[0-9a-f-]+\.png$/.test(p.p_image ?? ""), "image path " + p.p_image);
      const img = await pa.request.get(p.p_image);
      expect(img.status() === 200 && (await img.body()).equals(PNG), "stored image not served back");
      await pa.getByRole("complementary", { name: "Product details" }).getByRole("heading", { name: prodA.name }).waitFor();
      return `${p.p_code} saved with image ${p.p_image.split("/").pop()}, net ${p.net_amount}`;
    }, pa);

  await R.check(["UI-101", "UI-102"], "Add product: duplicate style code is rejected by the server with a visible error and nothing saved", async () => {
    await pa.getByRole("button", { name: "Add product" }).click();
    const m = modal(pa, "Add product");
    await m.locator("#pf-category").selectOption({ label: catRenamed });
    await m.locator("#pf-n").fill(prodA.name + " dup");
    await m.locator("#pf-s").fill(prodA.style.toLowerCase());
    await m.locator("#pf-ba").fill("10");
    await m.locator("#pf-g").fill("5");
    await m.getByRole("button", { name: "Add product" }).click();
    await m.getByRole("alert").filter({ hasText: "style/SKU code already exists" }).waitFor();
    expect(await D.count("select count(*) n from products where p_name=$1", [prodA.name + " dup"]) === 0, "duplicate product persisted");
    await m.getByRole("button", { name: "Cancel" }).click();
    // second product (fixture for filters/sort/archive)
    await pa.getByRole("button", { name: "Add product" }).click();
    await m.locator("#pf-category").selectOption({ label: catRenamed });
    for (const [id, v] of [["#pf-n", prodB.name], ["#pf-s", prodB.style], ["#pf-t", prodB.type], ["#pf-c", prodB.color], ["#pf-h", prodB.hsn], ["#pf-d", prodB.dim], ["#pf-desc", prodB.desc], ["#pf-pp", prodB.pp], ["#pf-ba", prodB.basic], ["#pf-g", prodB.gst]]) await m.locator(id).fill(v);
    await m.getByRole("button", { name: "Add product" }).click();
    await m.waitFor({ state: "hidden" });
    await until(() => D.one("select id from products where p_name=$1", [prodB.name]), "second product not saved");
    return "409 duplicate shown in alert; fixture product B created";
  }, pa);

  await R.check(["UI-84", "UI-87", "UI-99", "UI-105", "UI-106", "UI-101"], "Edit product: form re-opens with persisted values; edits, Remove image/Undo/Remove persist", async () => {
    await goto(pa, "/crm/product-management?query=" + encodeURIComponent(prodA.name));
    await prodRow(prodA.name).click();
    const panel = pa.getByRole("complementary", { name: "Product details" });
    await panel.getByRole("button", { name: "Edit" }).click();
    const code = (await D.one("select p_code from products where p_name=$1", [prodA.name])).p_code;
    const m = modal(pa, `Edit ${code}`);
    await m.waitFor();
    const shown = { "#pf-n": prodA.name, "#pf-s": prodA.style, "#pf-t": prodA.type, "#pf-c": prodA.color, "#pf-h": prodA.hsn, "#pf-d": prodA.dim, "#pf-desc": prodA.desc, "#pf-pp": prodA.pp, "#pf-ba": prodA.basic, "#pf-g": prodA.gst, "#pf-category": catId };
    for (const [sel, v] of Object.entries(shown)) { const got = await m.locator(sel).inputValue(); expect(got === v, `${sel} re-opened as "${got}" (want "${v}")`); }
    expect(await m.getByAltText("Product preview").count() === 1, "current image not shown");
    await m.getByRole("button", { name: "Remove image" }).click();
    await m.getByText("The current image will be removed when you save.").waitFor();
    await m.getByRole("button", { name: "Undo" }).click();
    await m.getByRole("button", { name: "Remove image" }).waitFor();
    await m.getByRole("button", { name: "Remove image" }).click();
    await m.locator("#pf-n").fill(prodA.name + " v2");
    await m.locator("#pf-c").fill("Gloss Red");
    await m.locator("#pf-ba").fill("200");
    expect((await m.getByPlaceholder("Basic + GST").inputValue()) === "236.00", "net not recalculated");
    await m.getByRole("button", { name: "Save changes" }).click();
    await toast(pa, "Product updated.");
    const p = await until(() => D.one("select p.p_name, p.p_color, p.p_image, pr.basic_amount, pr.net_amount from products p join product_prices pr on pr.product_id=p.id where p.p_code=$1 and p.p_name=$2", [code, prodA.name + " v2"]), "edit not persisted");
    expect(p.p_color === "Gloss Red" && Number(p.basic_amount) === 200 && Number(p.net_amount) === 236 && p.p_image === null, "edit row " + JSON.stringify(p));
    prodA.name += " v2";
    return `edited ${code}; image removed; net 236`;
  }, pa);

  await R.check(["UI-70", "UI-71", "UI-75", "UI-78", "UI-79"], "Filter form: search input + Search button narrow the table; rows match the database", async () => {
    await goto(pa, "/crm/product-management");
    await pa.locator("#pm-search").fill(`UIC Prod ${tag}`);
    await pa.getByRole("search", { name: "Filter products" }).getByRole("button", { name: "Search" }).click();
    await pa.waitForURL(/query=UIC/);
    await until(async () => (await pa.locator("table tbody tr").count()) === 2, "search did not narrow to 2 rows");
    const names = (await pa.locator("table tbody tr").allInnerTexts()).join("|");
    expect(names.includes(prodA.name) && names.includes(prodB.name), "rows: " + names);
    // Enter submits the form too
    await pa.locator("#pm-search").fill(prodB.style);
    await pa.locator("#pm-search").press("Enter");
    await pa.waitForURL(new RegExp("query=" + prodB.style));
    await until(async () => (await pa.locator("table tbody tr").count()) === 1, "Enter search did not narrow to 1 row");
    return "2 rows for tag search, 1 for style code";
  }, pa);

  await R.check(["UI-78", "UI-79", "UI-83"], "Row click opens the details panel with persisted data; keyboard toggles; Close details hides it", async () => {
    await goto(pa, "/crm/product-management?query=" + encodeURIComponent(prodB.name));
    const row = prodRow(prodB.name);
    await row.click();
    expect((await row.getAttribute("aria-selected")) === "true", "row not selected");
    const panel = pa.getByRole("complementary", { name: "Product details" });
    const t = await panel.innerText();
    const db = await D.one("select p.p_code, pr.price_code from products p join product_prices pr on pr.product_id=p.id where p.p_name=$1", [prodB.name]);
    for (const v of [db.p_code, prodB.style, prodB.type, prodB.color, prodB.hsn, prodB.desc, "₹50.00", "₹56.00", db.price_code, catRenamed]) expect(t.includes(v), `panel lacks ${v}`);
    await panel.getByRole("button", { name: "Close details" }).click();
    await panel.waitFor({ state: "detached" });
    await row.focus();
    await row.press("Enter");
    await panel.waitFor();
    await row.press("Enter");
    await panel.waitFor({ state: "detached" });
    return "panel shows code/style/type/colour/HSN/prices/category";
  }, pa);

  await R.check(["UI-72"], "Category select filters the list to that category", async () => {
    await goto(pa, "/crm/product-management");
    await pa.locator("#pm-category").selectOption(catId);
    await pa.waitForURL(new RegExp("category=" + catId));
    const n = await D.count("select count(*) n from products where category_id=$1 and status<>'ARCHIVED'", [catId]);
    await until(async () => (await pa.locator("table tbody tr").count()) === n, `rows != ${n}`);
    return `${n} rows for category`;
  }, pa);

  await R.check(["UI-74"], "Sort select reorders rows (name A–Z / Z–A / price low–high)", async () => {
    const first = async () => (await pa.locator("table tbody tr").first().innerText());
    for (const [v, want] of [["name_desc", prodB.name], ["name_asc", prodA.name], ["price_asc", prodB.name], ["price_desc", prodA.name]]) {
      await pa.locator("#pm-sort").selectOption(v);
      await pa.waitForURL(new RegExp("sort=" + v));
      await until(async () => (await first()).includes(want), `sort ${v}: first row is not ${want}`);
    }
    expect(new URL(pa.url()).searchParams.get("category") === catId, "sort dropped the category filter");
    return "orders verified";
  }, pa);

  await R.check(["UI-76"], "Reset clears search/filters and returns to the default list", async () => {
    await pa.locator("#pm-search").fill("zzz");
    await pa.getByRole("button", { name: "Reset" }).click();
    await pa.waitForURL((u) => u.pathname === "/crm/product-management" && !u.search);
    expect((await pa.locator("#pm-search").inputValue()) === "", "search input not cleared");
    expect((await pa.locator("#pm-category").inputValue()) === "" && (await pa.locator("#pm-sort").inputValue()) === "updated_desc", "filters not reset");
    expect(await pa.getByRole("button", { name: "Reset" }).count() === 0, "Reset still shown with default filters");
    return "reset to default";
  }, pa);

  await R.check(["UI-77"], "Refresh re-reads server data without navigating", async () => {
    await goto(pa, "/crm/product-management?query=" + encodeURIComponent(prodB.style));
    await prodRow(prodB.name).waitFor();
    const url = pa.url();
    await D.db.query("update products set p_name=$1 where s_code=$2", [prodB.name + " refreshed", prodB.style]); // own record
    await pa.getByRole("button", { name: "Refresh list" }).click();
    await prodRow(prodB.name + " refreshed").waitFor();
    expect(pa.url() === url, "refresh navigated");
    prodB.name += " refreshed";
    return "server change visible after refresh";
  }, pa);

  await R.check(["UI-73"], "Status select filters by lifecycle status (archived / all)", async () => {
    await goto(pa, "/crm/product-management");
    await pa.locator("#pm-status").selectOption("archived");
    await pa.waitForURL(/status=archived/);
    const n = await D.count("select count(*) n from products where status='ARCHIVED'");
    await until(async () => (await pa.getByRole("heading", { name: "Products" }).locator("..").innerText()).includes(`${n} product`), "archived total mismatch");
    const rows = await pa.locator("table tbody tr").allInnerTexts();
    expect(rows.length === Math.min(n, 20) && rows.every((r) => r.includes("Archived")), "non-archived rows in archived view");
    await pa.locator("#pm-status").selectOption("all");
    await pa.waitForURL(/status=all/);
    const all = await D.count("select count(*) n from products");
    await until(async () => (await pa.locator("main").innerText()).includes(`${all.toLocaleString("en-IN")} product`), "all total mismatch");
    return `archived ${n}, all ${all}`;
  }, pa);

  await R.check(["UI-80", "UI-81", "UI-82"], "Rows-per-page select and Previous/Next page buttons page through the catalogue", async () => {
    await goto(pa, "/crm/product-management?status=all");
    await pa.locator("#pm-limit").selectOption("10");
    await pa.waitForURL(/limit=10/);
    const total = await D.count("select count(*) n from products");
    const pages = Math.ceil(total / 10);
    await pa.getByText(`Page 1 of ${pages}`).waitFor();
    expect(await pa.locator("table tbody tr").count() === 10, "limit 10 not applied");
    expect(await pa.getByRole("button", { name: "Previous page" }).isDisabled(), "Previous enabled on page 1");
    const p1 = await pa.locator("table tbody tr").allInnerTexts();
    await pa.getByRole("button", { name: "Next page" }).click();
    await pa.waitForURL(/page=2/);
    await pa.getByText(`Page 2 of ${pages}`).waitFor();
    const p2 = await pa.locator("table tbody tr").allInnerTexts();
    expect(p2.every((r) => !p1.includes(r)), "page 2 repeats page 1 rows");
    await pa.getByRole("button", { name: "Previous page" }).click();
    await pa.waitForURL((u) => !u.searchParams.get("page"));
    await pa.getByText(`Page 1 of ${pages}`).waitFor();
    return `${total} products, ${pages} pages of 10`;
  }, pa);

  await R.check(["UI-85", "UI-89"], "Archive product: confirm dialog (cancel keeps it), confirm archives and removes it from the active list", async () => {
    await goto(pa, "/crm/product-management?query=" + encodeURIComponent(prodB.style));
    await prodRow(prodB.name).click();
    const panel = pa.getByRole("complementary", { name: "Product details" });
    await panel.getByRole("button", { name: "Archive" }).click();
    const c = modal(pa, "Archive product");
    expect((await c.innerText()).includes(prodB.name), "confirm lacks product name");
    await c.getByRole("button", { name: "Cancel" }).click();
    expect((await D.one("select status from products where s_code=$1", [prodB.style])).status === "ACTIVE", "cancel archived");
    await panel.getByRole("button", { name: "Archive" }).click();
    const [resp] = await Promise.all([pa.waitForResponse((r) => r.request().method() === "DELETE" && r.url().includes("/api/products/")), modal(pa, "Archive product").getByRole("button", { name: "Archive product" }).click()]);
    expect(resp.status() === 200, "DELETE status " + resp.status());
    await toast(pa, "Product archived.");
    const p = await until(async () => { const r = await D.one("select status, archived_at from products where s_code=$1", [prodB.style]); return r.status === "ARCHIVED" && r.archived_at ? r : null; }, "not archived");
    await panel.waitFor({ state: "detached" });
    await until(async () => (await prodRow(prodB.name).count()) === 0, "archived product still listed as active");
    return "archived " + JSON.stringify(p.status);
  }, pa);

  await R.check(["UI-98", "UI-90"], "Deleting a category that is in use is refused with a visible error and the category is kept", async () => {
    await goto(pa, "/crm/product-management");
    await pa.getByRole("button", { name: "Manage categories" }).click();
    const m = modal(pa, "Manage categories");
    await m.getByRole("button", { name: `Delete ${catRenamed}` }).click();
    const c = modal(pa, "Delete category");
    expect((await c.innerText()).includes("used by 2 product"), "confirm does not warn about products: " + (await c.innerText()));
    await c.getByRole("button", { name: "Delete category" }).click();
    await m.getByRole("alert").filter({ hasText: "used by 2 products" }).waitFor();
    expect(await D.count("select count(*) n from categories where id=$1", [catId]) === 1, "in-use category deleted");
    await m.getByRole("button", { name: "Done" }).click();
    return "409 shown, category kept";
  }, pa);

  page = pe;
  await R.check(["UI-68", "UI-69", "UI-84", "UI-85"], "Employee: no Manage categories/Add product/Edit/Archive controls, ?create=product ignored, write APIs refuse (403)", async () => {
    await goto(pe, "/crm/product-management?create=product&query=" + encodeURIComponent(prodA.name));
    await pe.locator("table tbody tr", { hasText: prodA.name }).click();
    await pe.getByRole("complementary", { name: "Product details" }).waitFor();
    for (const n of ["Manage categories", "Add product", "Edit", "Archive"]) expect(await pe.getByRole("button", { name: n, exact: true }).count() === 0, `employee sees ${n}`);
    expect(await pe.getByRole("dialog").count() === 0, "create deep link opened the modal for an employee");
    const id = (await D.one("select id::text from products where s_code=$1", [prodA.style])).id;
    const del = await pe.request.delete(`${base}/api/products/${id}`);
    const put = await pe.request.put(`${base}/api/products/${id}`, { multipart: { name: "x", secondaryCode: "x", categoryId: catId, price: "{}" } });
    const cat = await pe.request.post(`${base}/api/categories`, { data: { name: "Emp " + tag } });
    expect(del.status() === 403 && put.status() === 403 && cat.status() === 403, `statuses ${del.status()}/${put.status()}/${cat.status()}`);
    expect((await D.one("select status from products where id=$1", [id])).status === "ACTIVE", "employee changed product");
    return "controls hidden; DELETE/PUT/POST 403";
  }, pe);
  page = pa;
}

// =====================================================================================================
// VENDORS
// =====================================================================================================
const L = (n) => String.fromCharCode(65 + Number(n));
const pan = `${L(tag[0])}${L(tag[1])}${L(tag[2])}P${L(tag[3])}${tag.slice(3)}Q`;
const V = {
  name: `UIV ${tag} Main`, legalName: `UIV ${tag} Main Pvt Ltd`, vendorType: "Manufacturer", status: "ACTIVE", priority: "Critical", industry: "QA Printing",
  tags: `uitag${tag}, second`, description: `Main vendor ${tag}`, email: `uiv${tag}@example.test`, phone: `9${tag}12`, website: `uiv${tag}.example.com`,
  gstin: `27${pan}1Z5`, pan, cin: "U74999MH2020PTC123456", taxRegistration: `TR-${tag}`,
  contactName: `Ravi ${tag}`, contactDesignation: "Purchase Manager", contactEmail: `ravi${tag}@example.test`, contactPhone: `8${tag}34`,
  addressType: "Billing", line1: `${tag} MG Road`, line2: "Floor 2", city: "Pune", state: "Maharashtra", postalCode: "411001", country: "India",
  bank_bankName: "HDFC Bank", bank_accountHolderName: `UIV ${tag} Main`, bank_accountNumber: `50100${tag}`, bank_ifsc: "HDFC0001234", bank_branch: "FC Road",
  bank_upi: `uiv.${tag}@okhdfc`, bank_currency: "USD", bank_paymentTerms: "Net 30", bank_creditPeriodDays: "45", bank_preferredPaymentMethod: "NEFT",
};
const vcat = `UIV Cat ${tag}`;
let vcatId = null;
let v1 = null; // vendor id
const prof = (t) => `/crm/vendors/${v1}${t ? `?tab=${t}` : ""}`;
const importPrefix = `UIV ${tag} Imp`;
let jobId = null;

if (!process.env.ONLY || process.env.ONLY === "vendors") {
  // ---- fixture: vendor category via the categories page ModalForm
  await R.check(["UI-238"], "Vendor categories page: Add category modal persists a category that appears in the table", async () => {
    await goto(pa, "/crm/vendors/categories");
    await pa.getByRole("button", { name: "Add category" }).click();
    const d = native(pa);
    await fill(d, "name", vcat);
    await fill(d, "description", "QA vendor category " + tag);
    await d.getByRole("button", { name: "Create category" }).click();
    await toast(pa, "Category created");
    const row = await until(() => D.one("select id::text, description, is_active from vendor_categories where name=$1", [vcat]), "category not saved");
    vcatId = row.id;
    const tr = pa.locator("table tbody tr", { hasText: vcat });
    await tr.waitFor();
    expect((await tr.innerText()).includes("QA vendor category " + tag) && (await tr.innerText()).includes("Active"), "table row: " + (await tr.innerText()));
    const n = await D.count("select count(*) n from vendor_categories");
    expect(await pa.locator("table tbody tr").count() === n, "table rows != db categories");
    return `category ${vcatId}`;
  }, pa);

  // ---- create vendor: validation, duplicates, full persistence
  await R.check(["UI-267", "UI-268", "UI-269", "UI-270", "UI-279"], "Add vendor modal: required name blocks submit, invalid GSTIN shows server error, Close dismisses; nothing saved", async () => {
    await goto(pa, "/crm/vendors");
    await pa.getByRole("button", { name: "Add vendor" }).click();
    const d = native(pa);
    await d.waitFor();
    await d.getByRole("button", { name: "Create vendor" }).click();
    expect(!(await d.locator("[name=name]").evaluate((e) => e.validity.valid)), "empty name accepted by the form");
    await fill(d, "name", V.name + " Invalid");
    await fill(d, "gstin", "BADGSTIN");
    await d.getByRole("button", { name: "Create vendor" }).click();
    await d.locator("p.error[role=alert]").filter({ hasText: "Enter a valid 15-character GSTIN" }).waitFor();
    expect(await D.count("select count(*) n from vendors where name=$1", [V.name + " Invalid"]) === 0, "invalid vendor saved");
    await d.getByRole("button", { name: "Close" }).click();
    await d.waitFor({ state: "hidden" });
    return "required + server validation; closed";
  }, pa);

  await R.check(["UI-276"], "Check duplicates lists matching vendors, or reports none", async () => {
    await pa.getByRole("button", { name: "Add vendor" }).click();
    const d = native(pa);
    await fill(d, "name", "QA Layout Vendor");
    await d.getByRole("button", { name: "Check duplicates" }).click();
    const box = d.locator("[role=alert]", { hasText: "Possible duplicates found." });
    await box.waitFor();
    expect((await box.innerText()).includes("QA-AUDIT-1"), "duplicate list lacks QA-AUDIT-1");
    await fill(d, "name", V.name);
    await d.getByRole("button", { name: "Check duplicates" }).click();
    await toast(pa, "No duplicates found");
    return "match listed; none for new name";
  }, pa);

  await R.check(["UI-271", "UI-273", "UI-274", "UI-275", "UI-279"], "Add vendor: every field (identity, contact, address, bank) persisted; redirect to the new profile", async () => {
    const d = native(pa);
    await fill(d, "categoryId", vcatId);
    await fill(d, "ownerId", ids.exec1);
    for (const [k, v] of Object.entries(V)) if (k !== "categoryId") await fill(d, k, v);
    await d.getByRole("button", { name: "Create vendor" }).click();
    await pa.waitForURL(/\/crm\/vendors\/[0-9a-f-]{36}$/, { timeout: 30000 });
    v1 = pa.url().split("/").pop();
    const r = await D.one("select * from vendors where id=$1", [v1]);
    await toast(pa, `Vendor ${r.vendor_code} created`);
    const want = { name: V.name, legal_name: V.legalName, vendor_type: V.vendorType, category_id: vcatId, status: "ACTIVE", priority: "Critical", owner_id: ids.exec1, industry: V.industry,
      description: V.description, email: V.email, phone: V.phone, website: "https://" + V.website, gstin: V.gstin, pan: V.pan, cin: V.cin, tax_registration: V.taxRegistration, currency: "USD", payment_terms: "Net 30" };
    for (const [k, v] of Object.entries(want)) expect(r[k] === v, `${k}: ${r[k]} != ${v}`);
    expect(JSON.stringify(r.tags) === JSON.stringify([`uitag${tag}`, "second"]), "tags " + r.tags);
    const b = r.bank_details;
    expect(b.bankName === V.bank_bankName && b.accountHolderName === V.bank_accountHolderName && b.accountNumber === V.bank_accountNumber && b.ifsc === V.bank_ifsc && b.branch === V.bank_branch && b.upi === V.bank_upi && Number(b.creditPeriodDays) === 45 && b.preferredPaymentMethod === "NEFT", "bank " + JSON.stringify(b));
    const c = await D.one("select * from vendor_contacts where vendor_id=$1", [v1]);
    expect(c.name === V.contactName && c.designation === V.contactDesignation && c.email === V.contactEmail && c.phone === V.contactPhone && c.is_primary, "contact " + JSON.stringify(c));
    const a = await D.one("select * from vendor_addresses where vendor_id=$1", [v1]);
    expect(a.type === "Billing" && a.line1 === V.line1 && a.line2 === V.line2 && a.city === "Pune" && a.state === "Maharashtra" && a.postal_code === "411001" && a.country === "India" && a.is_primary, "address " + JSON.stringify(a));
    expect(/^VU\d{3}$/.test(r.vendor_code), "code " + r.vendor_code);
    expect(await D.count("select count(*) n from activity_logs where action='vendor.created' and details->>'vendorId'=$1", [v1]) === 1, "create not audited");
    return `${r.vendor_code} with contact, address, bank`;
  }, pa);

  await R.check(["UI-277", "UI-278"], "Possible duplicate (same email) warns; Cancel saves nothing; Save anyway creates; GSTIN duplicate blocks without Save anyway", async () => {
    await goto(pa, "/crm/vendors");
    await pa.getByRole("button", { name: "Add vendor" }).click();
    const d = native(pa);
    await fill(d, "name", `UIV ${tag} Second`);
    await fill(d, "email", V.email);
    await d.getByRole("button", { name: "Create vendor" }).click();
    await d.locator("[role=alert]", { hasText: "Possible duplicates found." }).waitFor();
    await d.getByRole("button", { name: "Cancel" }).click();
    await d.waitFor({ state: "hidden" });
    expect(await D.count("select count(*) n from vendors where name=$1", [`UIV ${tag} Second`]) === 0, "cancel saved the vendor");
    await pa.getByRole("button", { name: "Add vendor" }).click();
    await fill(d, "name", `UIV ${tag} Second`);
    await fill(d, "email", V.email);
    await d.getByRole("button", { name: "Create vendor" }).click();
    await d.getByRole("button", { name: "Save anyway" }).click();
    await pa.waitForURL(/\/crm\/vendors\/[0-9a-f-]{36}$/, { timeout: 30000 });
    expect(await D.count("select count(*) n from vendors where email=$1", [V.email]) === 2, "Save anyway did not create the second vendor");
    await goto(pa, "/crm/vendors");
    await pa.getByRole("button", { name: "Add vendor" }).click();
    await fill(d, "name", `UIV ${tag} Third`);
    await fill(d, "gstin", V.gstin);
    await d.getByRole("button", { name: "Create vendor" }).click();
    await d.locator("[role=alert]", { hasText: "A vendor with the same GSTIN or PAN already exists." }).waitFor();
    expect(await d.getByRole("button", { name: "Save anyway" }).count() === 0, "Save anyway offered for a blocking duplicate");
    expect(await D.count("select count(*) n from vendors where name=$1", [`UIV ${tag} Third`]) === 0, "blocking duplicate saved");
    await d.getByRole("button", { name: "Cancel" }).click();
    return "warning→cancel/save anyway; GSTIN blocked";
  }, pa);

  // ---- profile
  await R.check(["UI-271", "UI-273", "UI-274", "UI-275", "UI-279"], "Edit vendor: form re-opens with persisted values; edits persist; blank account number keeps the stored one; stale version refused", async () => {
    await goto(pa, prof());
    await pa.getByRole("button", { name: "Edit vendor" }).click();
    const d = native(pa);
    for (const [k, v] of Object.entries({ name: V.name, legalName: V.legalName, vendorType: V.vendorType, categoryId: vcatId, priority: V.priority, ownerId: ids.exec1, industry: V.industry, tags: `uitag${tag}, second`, description: V.description, email: V.email, phone: V.phone, website: "https://" + V.website, gstin: V.gstin, pan: V.pan, cin: V.cin, taxRegistration: V.taxRegistration, bank_bankName: V.bank_bankName, bank_ifsc: V.bank_ifsc, bank_upi: V.bank_upi, bank_currency: "USD", bank_creditPeriodDays: "45", bank_preferredPaymentMethod: "NEFT", bank_accountNumber: "" })) {
      const got = await d.locator(`[name="${k}"]`).inputValue();
      expect(got === v, `${k} re-opened as "${got}" (want "${v}")`);
    }
    expect((await d.locator("[name=bank_accountNumber]").getAttribute("placeholder")).includes(V.bank_accountNumber.slice(-4)), "masked account placeholder missing");
    const hidden = d.locator("input[type=hidden][name=updatedAt]");
    expect(!Number.isNaN(Date.parse(await hidden.inputValue())), "hidden updatedAt missing");
    // stale version: bump updated_at of our own vendor behind the form's back
    await D.db.query("update vendors set updated_at = updated_at + interval '1 second' where id=$1", [v1]);
    await fill(d, "legalName", V.legalName + " X");
    await d.getByRole("button", { name: "Save", exact: true }).click();
    await d.locator("p.error[role=alert]").filter({ hasText: "changed by someone else" }).waitFor();
    expect((await D.one("select legal_name from vendors where id=$1", [v1])).legal_name === V.legalName, "stale edit persisted");
    await goto(pa, prof());
    await pa.getByRole("button", { name: "Edit vendor" }).click();
    await fill(d, "legalName", V.legalName + " Edited");
    await fill(d, "priority", "High");
    await fill(d, "notes", "Internal note " + tag);
    await fill(d, "bank_branch", "Baner");
    await d.getByRole("button", { name: "Save", exact: true }).click();
    await toast(pa, "Vendor updated");
    const r = await until(async () => { const x = await D.one("select legal_name, priority, notes, bank_details from vendors where id=$1", [v1]); return x.notes ? x : null; }, "edit not saved");
    expect(r.legal_name === V.legalName + " Edited" && r.priority === "High" && r.notes === "Internal note " + tag && r.bank_details.branch === "Baner" && r.bank_details.accountNumber === V.bank_accountNumber, "edit row " + JSON.stringify({ ...r, bank_details: { ...r.bank_details, accountNumber: "?" } }));
    await pa.getByText("Internal note " + tag).waitFor();
    return "re-open matches; 409 on stale; edit persisted; account kept";
  }, pa);

  await R.check(["UI-273", "UI-274"], "Change status modal persists the status and audits the reason", async () => {
    await pa.getByRole("button", { name: "Change status" }).click();
    const d = native(pa);
    expect((await d.locator("[name=status]").inputValue()) === "ACTIVE", "status not prefilled");
    await fill(d, "status", "INACTIVE");
    await fill(d, "reason", "QA reason " + tag);
    await d.getByRole("button", { name: "Update status" }).click();
    await toast(pa, "Status updated");
    await until(async () => (await D.one("select status from vendors where id=$1", [v1])).status === "INACTIVE", "status not saved");
    const log = await D.one("select details from activity_logs where action='vendor.status_changed' and details->>'vendorId'=$1 order by occurred_at desc limit 1", [v1]);
    expect(log.details.reason === "QA reason " + tag && log.details.to === "INACTIVE", "audit " + JSON.stringify(log.details));
    return "INACTIVE with audited reason";
  }, pa);

  await R.check(["UI-252", "UI-254", "UI-255", "UI-251"], "Profile Archive: confirm dialog (cancel keeps), confirm archives (badge + Restore shown); Restore un-archives", async () => {
    await goto(pa, prof());
    await pa.getByRole("button", { name: "Archive", exact: true }).click();
    const c = modal(pa, "Archive");
    expect((await c.innerText()).includes(`Archive ${V.name}? It can be restored later.`), "confirm message");
    await c.getByRole("button", { name: "Cancel" }).click();
    expect((await D.one("select archived_at from vendors where id=$1", [v1])).archived_at === null, "cancel archived");
    await pa.getByRole("button", { name: "Archive", exact: true }).click();
    await modal(pa, "Archive").getByRole("button", { name: "Archive", exact: true }).click();
    await toast(pa, "Vendor archived");
    await until(async () => (await D.one("select archived_at from vendors where id=$1", [v1])).archived_at !== null, "not archived");
    await pa.getByRole("button", { name: "Restore", exact: true }).waitFor();
    expect(await pa.getByRole("button", { name: "Edit vendor" }).count() === 0, "Edit offered on an archived vendor");
    await pa.getByRole("button", { name: "Delete permanently" }).waitFor();
    await pa.getByRole("button", { name: "Restore", exact: true }).click();
    await toast(pa, "Vendor restored");
    await until(async () => (await D.one("select archived_at from vendors where id=$1", [v1])).archived_at === null, "not restored");
    await pa.getByRole("button", { name: "Archive", exact: true }).waitFor();
    return "archive/restore persisted and audited";
  }, pa);

  await R.check(["UI-253", "UI-250"], "Profile tab links switch sections (aria-current) and the Vendors breadcrumb returns to the list", async () => {
    for (const [key, label] of [["contacts", "Contacts"], ["addresses", "Addresses"], ["products", "Products & Pricing"], ["documents", "Documents"], ["activities", "Activities"], ["performance", "Performance"], ["audit", "Audit History"], ["overview", "Overview"]]) {
      const nav = pa.getByRole("navigation", { name: "Vendor sections" });
      await nav.getByRole("link", { name: label, exact: true }).click();
      await pa.waitForURL((u) => (key === "overview" ? !u.searchParams.get("tab") : u.searchParams.get("tab") === key));
      await until(async () => (await nav.getByRole("link", { name: label, exact: true }).getAttribute("aria-current")) === "page", `${label} not current`);
    }
    await pa.getByRole("link", { name: "Vendors", exact: true }).first().click();
    await pa.waitForURL((u) => u.pathname === "/crm/vendors");
    return "8 tabs + breadcrumb";
  }, pa);

  await R.check(["UI-280"], "Overview: website renders as an external link to the stored URL", async () => {
    await goto(pa, prof());
    const a = pa.getByRole("link", { name: "https://" + V.website });
    expect((await a.getAttribute("href")) === "https://" + V.website && (await a.getAttribute("target")) === "_blank" && (await a.getAttribute("rel")).includes("noopener"), "website link attrs");
    const t = await pa.locator("main").innerText();
    for (const v of [V.gstin, V.pan, V.cin, "HDFC Bank", "*" + V.bank_accountNumber.slice(-4), "Net 30", "45 days"]) expect(t.includes(v), "overview lacks " + v);
    expect(!t.includes(V.bank_accountNumber), "full account number shown");
    return "link + overview values";
  }, pa);

  await R.check(["UI-281", "UI-272", "UI-282", "UI-283"], "Contacts: table lists contacts; add (checkbox off) persists; validation; Make primary swaps; Delete with confirm removes", async () => {
    await goto(pa, prof("contacts"));
    await pa.getByRole("button", { name: "Add contact" }).click();
    const d = native(pa);
    await fill(d, "name", `Nobody ${tag}`);
    await d.getByRole("button", { name: "Add contact" }).click();
    await d.locator("p.error[role=alert]").filter({ hasText: "Provide at least an email or a phone number" }).waitFor();
    await fill(d, "name", `Second ${tag}`);
    await fill(d, "designation", "Accounts");
    await fill(d, "email", `second${tag}@example.test`);
    await fill(d, "phone", `7${tag}56`);
    expect(!(await d.getByLabel("Primary contact").isChecked()), "checkbox pre-checked");
    await d.getByRole("button", { name: "Add contact" }).click();
    await toast(pa, "Contact added");
    const c2 = await until(() => D.one("select * from vendor_contacts where vendor_id=$1 and name=$2", [v1, `Second ${tag}`]), "contact not saved");
    expect(c2.is_primary === false && c2.designation === "Accounts" && c2.phone === `7${tag}56`, "contact row " + JSON.stringify(c2));
    const rows = pa.locator("table tbody tr");
    await until(async () => (await rows.count()) === 2, "table does not show 2 contacts");
    expect((await pa.locator("tr", { hasText: V.contactName }).innerText()).includes("Primary"), "primary badge missing");
    // edit: checkbox on -> becomes primary
    await pa.locator("tr", { hasText: `Second ${tag}` }).getByRole("button", { name: "Edit" }).click();
    expect((await d.locator("[name=email]").inputValue()) === `second${tag}@example.test`, "edit form not prefilled");
    await d.getByLabel("Primary contact").check();
    await d.getByRole("button", { name: "Save", exact: true }).click();
    await toast(pa, "Contact updated");
    await until(async () => (await D.one("select is_primary from vendor_contacts where id=$1", [c2.id])).is_primary === true, "checkbox did not persist");
    await until(async () => (await D.one("select is_primary from vendor_contacts where vendor_id=$1 and name=$2", [v1, V.contactName])).is_primary === false, "old primary not cleared");
    // Make primary back on the original contact
    await pa.locator("tr", { hasText: V.contactName }).getByRole("button", { name: "Make primary" }).click();
    await toast(pa, "Primary contact set");
    await until(async () => (await D.one("select is_primary from vendor_contacts where vendor_id=$1 and name=$2", [v1, V.contactName])).is_primary === true, "make primary not saved");
    expect((await D.one("select is_primary from vendor_contacts where id=$1", [c2.id])).is_primary === false, "two primaries");
    await pa.locator("tr", { hasText: `Second ${tag}` }).getByRole("button", { name: "Delete" }).click();
    const cf = modal(pa, "Delete");
    expect((await cf.innerText()).includes(`Delete contact Second ${tag}?`), "delete confirm text");
    await cf.getByRole("button", { name: "Delete", exact: true }).click();
    await toast(pa, "Contact deleted");
    await until(async () => (await D.count("select count(*) n from vendor_contacts where id=$1", [c2.id])) === 0, "contact not deleted");
    await until(async () => (await rows.count()) === 1, "deleted contact still listed");
    return "add/validate/edit checkbox/make primary/delete";
  }, pa);

  await R.check(["UI-284", "UI-285"], "Addresses: add second address, Make primary swaps primaries, Delete with confirm removes", async () => {
    await goto(pa, prof("addresses"));
    await pa.getByRole("button", { name: "Add address" }).click();
    const d = native(pa);
    await fill(d, "type", "Warehouse");
    await fill(d, "line1", `${tag} Ware Lane`);
    await fill(d, "city", "Nashik");
    await fill(d, "postalCode", "12345");
    await d.getByRole("button", { name: "Add address" }).click();
    await d.locator("p.error[role=alert]").filter({ hasText: "6-digit PIN" }).waitFor();
    await fill(d, "postalCode", "422001");
    await d.getByRole("button", { name: "Add address" }).click();
    await toast(pa, "Address added");
    const a2 = await until(() => D.one("select * from vendor_addresses where vendor_id=$1 and line1=$2", [v1, `${tag} Ware Lane`]), "address not saved");
    expect(a2.type === "Warehouse" && a2.city === "Nashik" && a2.is_primary === false, "address row");
    const card = pa.locator("div", { has: pa.getByRole("heading", { name: /^Warehouse/ }) }).last();
    await card.getByRole("button", { name: "Make primary" }).click();
    await toast(pa, "Primary address set");
    await until(async () => (await D.one("select is_primary from vendor_addresses where id=$1", [a2.id])).is_primary, "make primary not saved");
    expect((await D.one("select is_primary from vendor_addresses where vendor_id=$1 and line1=$2", [v1, V.line1])).is_primary === false, "two primary addresses");
    await card.getByRole("button", { name: "Delete" }).click();
    await modal(pa, "Delete").getByRole("button", { name: "Delete", exact: true }).click();
    await toast(pa, "Address deleted");
    await until(async () => (await D.count("select count(*) n from vendor_addresses where id=$1", [a2.id])) === 0, "address not deleted");
    return "validate/add/make primary/delete";
  }, pa);

  await R.check(["UI-286", "UI-287", "UI-272"], "Products & pricing: add pricing (all fields + tier + checkboxes) persists and lists; Remove with confirm deletes", async () => {
    const prod = await D.one("select id::text, p_name, p_code from products where s_code=$1 and status<>'ARCHIVED'", [prodA.style]) ?? await D.one("select id::text, p_name, p_code from products where p_name='E2E Product 1'");
    await goto(pa, prof("products"));
    await pa.getByRole("button", { name: "Add product pricing" }).click();
    const d = native(pa);
    await fill(d, "productId", prod.id);
    for (const [k, v] of Object.entries({ vendorItemCode: `VIC-${tag}`, purchasePrice: "42.5", currency: "EUR", moq: "100", leadTimeDays: "12", taxRate: "18", discountPercent: "5", effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31", notes: "Pricing note " + tag, tier1_minQty: "100", tier1_maxQty: "500", tier1_unitPrice: "40", tier1_discountPercent: "2" })) await fill(d, k, v);
    await d.getByLabel("Preferred supplier for this product").check();
    expect(await d.getByLabel("Active", { exact: true }).isChecked(), "Active not checked by default");
    await d.getByRole("button", { name: "Add", exact: true }).click();
    await toast(pa, "Pricing record added");
    const vp = await until(() => D.one("select * from vendor_products where vendor_id=$1 and product_id=$2", [v1, prod.id]), "pricing not saved");
    expect(vp.vendor_item_code === `VIC-${tag}` && Number(vp.purchase_price) === 42.5 && vp.currency === "EUR" && Number(vp.moq) === 100 && vp.lead_time_days === 12 && Number(vp.tax_rate) === 18 && Number(vp.discount_percent) === 5 && vp.notes === "Pricing note " + tag && vp.is_active && vp.is_preferred, "pricing row " + JSON.stringify(vp));
    const tier = await D.one("select * from vendor_price_tiers where vendor_product_id=$1", [vp.id]);
    expect(Number(tier.min_qty) === 100 && Number(tier.max_qty) === 500 && Number(tier.unit_price) === 40 && Number(tier.discount_percent) === 2, "tier " + JSON.stringify(tier));
    const row = pa.locator("table tbody tr", { hasText: `VIC-${tag}` });
    const t = await row.innerText();
    expect(t.includes("EUR 42.50") && t.includes("Preferred") && t.includes("100-500: 40.00") && t.includes("12 d"), "table row: " + t);
    await row.getByRole("button", { name: "Remove" }).click();
    await modal(pa, "Remove").getByRole("button", { name: "Remove", exact: true }).click();
    await toast(pa, "Pricing record removed");
    await until(async () => (await D.count("select count(*) n from vendor_products where id=$1", [vp.id])) === 0, "pricing not removed");
    await row.waitFor({ state: "detached" });
    return `priced ${prod.p_code}; removed`;
  }, pa);

  await R.check(["UI-289", "UI-290", "UI-291", "UI-292", "UI-288", "UI-293", "UI-275"], "Documents: upload persists; Preview serves inline; Download returns the bytes; Archive → Show archived → Restore; Delete with confirm", async () => {
    await goto(pa, prof("documents"));
    await pa.getByRole("button", { name: "Upload document" }).click();
    const d = native(pa);
    await d.locator("[name=file]").setInputFiles({ name: `gst-${tag}.pdf`, mimeType: "application/pdf", buffer: PDF });
    await fill(d, "name", `GST cert ${tag}`);
    await fill(d, "documentType", "GST Certificate");
    await fill(d, "issueDate", "2026-01-01");
    await fill(d, "expiryDate", "2030-01-01");
    await fill(d, "description", "Doc desc " + tag);
    await d.getByRole("button", { name: "Upload", exact: true }).click();
    await toast(pa, "Document uploaded");
    const doc = await until(() => D.one("select * from vendor_documents where vendor_id=$1 and name=$2", [v1, `GST cert ${tag}`]), "document not saved");
    expect(doc.document_type === "GST Certificate" && doc.mime_type === "application/pdf" && doc.size_bytes === PDF.length && doc.original_name === `gst-${tag}.pdf` && doc.status === "ACTIVE", "doc row " + JSON.stringify(doc));
    const row = pa.locator("table tbody tr", { hasText: `GST cert ${tag}` });
    await row.waitFor();
    expect((await row.innerText()).includes("Valid") && (await row.innerText()).includes("Doc desc " + tag), "row text");
    const pv = row.getByRole("link", { name: "Preview" });
    expect((await pv.getAttribute("target")) === "_blank", "preview not in a new tab");
    const [popup] = await Promise.all([pa.waitForEvent("popup"), pv.click()]);
    const pr = await pa.request.get(new URL(await pv.getAttribute("href"), base).toString());
    expect(pr.status() === 200 && pr.headers()["content-disposition"].startsWith("inline") && (await pr.body()).equals(PDF), "preview response");
    expect(popup.url().includes(`/documents/${doc.id}/file?disposition=inline`), "popup url " + popup.url());
    await popup.close();
    const dl = await download(pa, () => row.getByRole("link", { name: "Download" }).click());
    expect(dl.bytes.equals(PDF) && dl.name === `gst-${tag}.pdf`, "download mismatch " + dl.name);
    await row.getByRole("button", { name: "Archive" }).click();
    await toast(pa, "Document archived");
    await until(async () => (await D.one("select status from vendor_documents where id=$1", [doc.id])).status === "ARCHIVED", "doc not archived");
    await row.waitFor({ state: "detached" });
    await pa.getByRole("link", { name: "Show archived" }).click();
    await pa.waitForURL(/docs=archived/);
    await pa.getByRole("heading", { name: "Archived documents" }).waitFor();
    await row.getByRole("button", { name: "Restore" }).click();
    await toast(pa, "Document restored");
    await until(async () => (await D.one("select status from vendor_documents where id=$1", [doc.id])).status === "ACTIVE", "doc not restored");
    await pa.getByRole("link", { name: "Show active" }).click();
    await pa.waitForURL((u) => !u.searchParams.get("docs"));
    await row.getByRole("button", { name: "Delete" }).click();
    const cf = modal(pa, "Delete");
    expect((await cf.innerText()).includes(`Permanently delete GST cert ${tag}?`), "delete confirm text");
    await cf.getByRole("button", { name: "Delete", exact: true }).click();
    await toast(pa, "Document deleted");
    await until(async () => (await D.count("select count(*) n from vendor_documents where id=$1", [doc.id])) === 0, "doc not deleted");
    return "upload/preview/download/archive/restore/delete";
  }, pa);

  await R.check(["UI-294"], "Activities: add persists and shows in the timeline; Delete with confirm removes", async () => {
    await goto(pa, prof("activities"));
    await pa.getByRole("button", { name: "Add activity" }).click();
    const d = native(pa);
    await fill(d, "type", "Meeting");
    await fill(d, "occurredAt", "2026-11-01");
    await fill(d, "subject", "Kickoff " + tag);
    await fill(d, "description", "Discussed pricing " + tag);
    await d.getByRole("button", { name: "Add activity" }).click();
    await toast(pa, "Activity added");
    const act = await until(() => D.one("select * from vendor_activities where vendor_id=$1 and subject=$2", [v1, "Kickoff " + tag]), "activity not saved");
    expect(act.type === "Meeting" && act.description === "Discussed pricing " + tag, "activity row");
    const li = pa.locator("li", { hasText: "Kickoff " + tag });
    await li.waitFor();
    await li.getByRole("button", { name: "Delete" }).click();
    await modal(pa, "Delete").getByRole("button", { name: "Delete", exact: true }).click();
    await toast(pa, "Activity deleted");
    await until(async () => (await D.count("select count(*) n from vendor_activities where id=$1", [act.id])) === 0, "activity not deleted");
    await li.waitFor({ state: "detached" });
    return "added + deleted";
  }, pa);

  await R.check(["UI-295", "UI-296"], "Performance: record evaluation updates score and table; Delete with confirm recalculates to no data", async () => {
    await goto(pa, prof("performance"));
    await pa.getByRole("button", { name: "Record evaluation" }).click();
    const d = native(pa);
    const scores = { quality: "5", delivery: "4", leadTime: "4", pricing: "3", responsiveness: "5", compliance: "3" };
    for (const [k, v] of Object.entries(scores)) await fill(d, k, v);
    await fill(d, "periodLabel", "Q4 " + tag);
    await fill(d, "comments", "Eval comment " + tag);
    await d.getByRole("button", { name: "Save evaluation" }).click();
    await toast(pa, "Evaluation recorded");
    const e = await until(() => D.one("select * from vendor_evaluations where vendor_id=$1", [v1]), "evaluation not saved");
    expect(Number(e.overall_score) === 4 && e.quality === 5 && e.lead_time === 4 && e.period_label === "Q4 " + tag && e.comments === "Eval comment " + tag, "eval row");
    expect(Number((await D.one("select performance_score from vendors where id=$1", [v1])).performance_score) === 4, "vendor score not recomputed");
    const row = pa.locator("table tbody tr", { hasText: "Q4 " + tag });
    expect((await row.innerText()).includes("4.00"), "table row lacks overall");
    await row.getByRole("button", { name: "Delete" }).click();
    await modal(pa, "Delete").getByRole("button", { name: "Delete", exact: true }).click();
    await toast(pa, "Evaluation deleted");
    await until(async () => (await D.one("select performance_score, evaluation_count from vendors where id=$1", [v1])).performance_score === null, "score not cleared");
    await pa.getByText("No evaluations recorded.").waitFor();
    return "4.00 recorded then deleted";
  }, pa);

  // ---- import wizard (end to end)
  const hdr = ["Vendor Name", "Legal Name", "Vendor Type", "Category", "Status", "Priority", "Email", "Internal Ref", "City", "Pincode", "Tags"];
  const rowsCsv = [];
  for (let i = 1; i <= 52; i += 1) rowsCsv.push([`${importPrefix} ${String(i).padStart(2, "0")}`, `Legal ${i} ${tag}`, "Trader", vcat, i % 2 ? "Active" : "Pending", "Low", "", `Ref industry ${tag}`, "Mumbai", "400001", `imp${tag}`]);
  rowsCsv.push(["QA Layout Vendor", "", "", "", "", "", "", "", "", "", ""]); // duplicate of seeded vendor
  rowsCsv.push([`${importPrefix} Bad`, "", "", "", "", "", "not-an-email", "", "", "", ""]); // error
  rowsCsv.push(["", "Nameless", "", "", "", "", "", "", "", "", ""]); // error (no name)
  const csvText = [hdr, ...rowsCsv].map((r) => r.map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\r\n") + "\r\n";
  const csvFile = { name: `uiv-import-${tag}.csv`, mimeType: "text/csv", buffer: Buffer.from(csvText) };
  const WIZ = ["UI-256", "UI-257", "UI-258", "UI-259", "UI-261", "UI-262", "UI-264"];

  await R.check(["UI-256", "UI-257"], "Import wizard step 1: upload without a file warns; CSV upload creates a job and shows column mapping", async () => {
    await goto(pa, "/crm/vendors/import");
    await pa.getByRole("button", { name: "Upload and detect columns" }).click();
    await toast(pa, "Choose a .csv file first");
    await pa.getByLabel("CSV file").setInputFiles(csvFile);
    const [resp] = await Promise.all([pa.waitForResponse((r) => r.url().endsWith("/api/vendors/import/upload")), pa.getByRole("button", { name: "Upload and detect columns" }).click()]);
    expect(resp.status() === 201, "upload status " + resp.status());
    jobId = (await resp.json()).jobId;
    await pa.getByRole("heading", { name: `Map columns - ${csvFile.name} (55 rows)` }).waitFor();
    const job = await D.one("select status, total_rows, headers, user_id::text from vendor_import_jobs where id=$1", [jobId]);
    expect(job.status === "uploaded" && job.total_rows === 55 && job.headers.length === hdr.length && job.user_id === ids.admin, "job " + JSON.stringify(job));
    return "job " + jobId;
  }, pa);

  await R.check(["UI-258", "UI-259", "UI-261"], "Import wizard step 2-3: mapping selects (auto-suggested + changed) drive validation; review table matches stored rows", async () => {
    expect((await pa.getByLabel("Map Vendor Name").inputValue()) === "name" && (await pa.getByLabel("Map Category").inputValue()) === "categoryName" && (await pa.getByLabel("Map Internal Ref").inputValue()) === "", "auto mapping");
    await pa.getByLabel("Map Internal Ref").selectOption("industry");
    await pa.getByLabel("Map Legal Name").selectOption("");
    await pa.getByRole("button", { name: "Validate" }).click();
    await pa.getByRole("heading", { name: "Review" }).waitFor();
    const kpi = async (label) => (await pa.locator(".kpi", { hasText: label }).locator("strong").innerText()).trim();
    expect((await kpi("Rows")) === "55" && (await kpi("Ready to import")) === "52" && (await kpi("Duplicates (skipped)")) === "1" && (await kpi("Errors (skipped)")) === "2", "review KPIs");
    const job = await D.one("select status, mapping, duplicates, error_count from vendor_import_jobs where id=$1", [jobId]);
    expect(job.status === "validated" && job.mapping["Internal Ref"] === "industry" && job.mapping["Legal Name"] === "" && job.duplicates === 1 && job.error_count === 2, "job " + JSON.stringify(job));
    const dbRows = await D.all("select row_number, vendor_name, status, reason from vendor_import_rows where job_id=$1 order by row_number", [jobId]);
    expect(dbRows.length === 55, "stored rows " + dbRows.length);
    const ui = await pa.locator("table tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((c) => c.innerText.trim())));
    expect(ui.length === 50, "preview rows " + ui.length);
    ui.forEach((r, i) => { const d = dbRows[i]; expect(Number(r[0]) === d.row_number && r[1] === (d.vendor_name || "-") && r[2] === d.status && r[3] === d.reason, `preview row ${i}: ${r} vs ${JSON.stringify(d)}`); });
    await pa.getByText("Showing the first 50 rows.").waitFor();
    return "mapping saved; 52/1/2; preview == vendor_import_rows";
  }, pa);

  await R.check(["UI-263"], "Review: Download row report returns the validated per-row CSV", async () => {
    const dl = await download(pa, () => pa.getByRole("link", { name: "Download row report", exact: true }).click());
    const rows = parseCsv(dl.text);
    expect(rows[0].join("|") === "Row Number|Vendor Name|Status|Reason|Vendor ID" && rows.length - 1 === 55, "report rows " + (rows.length - 1));
    expect(rows.filter((r) => r[2] === "Ready").length === 52, "ready rows in report");
    return dl.name;
  }, pa);

  await R.check(["UI-262"], "Import commits the ready rows: 52 vendors created with mapped fields; job completed", async () => {
    await pa.getByRole("button", { name: "Import 52 vendor(s)" }).click();
    await pa.getByRole("heading", { name: "Import complete" }).waitFor({ timeout: 60000 });
    await pa.getByText("52 imported, 1 duplicates skipped, 2 rows with errors, out of 55.").waitFor();
    await toast(pa, "52 vendor(s) imported");
    const v = await D.all("select name, legal_name, industry, category_id::text, vendor_type, status, tags from vendors where name like $1", [importPrefix + " %"]);
    expect(v.length === 52, "imported vendors " + v.length);
    expect(v.every((x) => x.legal_name === null && x.industry === `Ref industry ${tag}` && x.category_id === vcatId && x.vendor_type === "Trader" && x.tags[0] === `imp${tag}`), "mapped fields wrong");
    expect(v.filter((x) => x.status === "ACTIVE").length === 26, "status mapping");
    const job = await D.one("select status, imported from vendor_import_jobs where id=$1", [jobId]);
    expect(job.status === "completed" && job.imported === 52, "job " + JSON.stringify(job));
    return "52 imported";
  }, pa);

  await R.check(WIZ.concat(["UI-264"]).filter((x, i, a) => a.indexOf(x) === i), "GET /api/vendors/import/[jobId]/report success", async () => {
    const link = pa.getByRole("link", { name: "Download row report (CSV)" });
    expect((await link.getAttribute("href")) === `/api/vendors/import/${jobId}/report`, "report href");
    const dl = await download(pa, () => link.click());
    const api = await pa.request.get(`${base}/api/vendors/import/${jobId}/report`);
    expect(api.status() === 200 && api.headers()["content-type"].startsWith("text/csv"), "report status/type " + api.status());
    const apiText = await api.text();
    expect(apiText.replace(/^﻿/, "") === dl.text.replace(/^﻿/, ""), "download != API body");
    const rows = parseCsv(apiText);
    const db = await D.all("select row_number, vendor_name, status, reason, coalesce(vendor_id::text,'') vid from vendor_import_rows where job_id=$1 order by row_number", [jobId]);
    expect(rows[0].join("|") === "Row Number|Vendor Name|Status|Reason|Vendor ID", "header " + rows[0]);
    expect(rows.length - 1 === db.length && db.length === 55, `csv ${rows.length - 1} rows vs db ${db.length}`);
    db.forEach((d, i) => { const r = rows[i + 1]; expect(Number(r[0]) === d.row_number && r[1] === d.vendor_name && r[2] === d.status && r[3] === d.reason && r[4] === d.vid, `row ${i}: ${r} vs ${JSON.stringify(d)}`); });
    expect(db.filter((d) => d.status === "Imported" && d.vid).length === 52, "imported rows lack vendor ids");
    return `${db.length} rows match vendor_import_rows (52 Imported, 1 Duplicate, 2 Error)`;
  }, pa);

  await R.check(["UI-266", "UI-260", "UI-265"], "Import another file resets to step 1; Start over abandons a validated job; View vendors opens the list", async () => {
    await pa.getByRole("button", { name: "Import another file" }).click();
    await pa.getByRole("button", { name: "Upload and detect columns" }).waitFor();
    expect((await pa.getByLabel("CSV file").inputValue()) === "", "file input not cleared");
    const small = { name: `uiv-extra-${tag}.csv`, mimeType: "text/csv", buffer: Buffer.from(`Vendor Name,City\r\nUIV ${tag} Extra,Goa\r\n`) };
    await pa.getByLabel("CSV file").setInputFiles(small);
    const [r1] = await Promise.all([pa.waitForResponse((r) => r.url().endsWith("/api/vendors/import/upload")), pa.getByRole("button", { name: "Upload and detect columns" }).click()]);
    const abandoned = (await r1.json()).jobId;
    expect(abandoned !== jobId, "Import another file reused the old job");
    await pa.getByRole("button", { name: "Validate" }).click();
    await pa.getByRole("button", { name: "Import 1 vendor(s)" }).waitFor();
    await pa.getByRole("button", { name: "Start over" }).click();
    await pa.getByRole("button", { name: "Upload and detect columns" }).waitFor();
    expect((await D.one("select status from vendor_import_jobs where id=$1", [abandoned])).status === "validated", "abandoned job committed");
    expect(await D.count("select count(*) n from vendors where name=$1", [`UIV ${tag} Extra`]) === 0, "start over imported");
    await pa.getByLabel("CSV file").setInputFiles(small);
    const [r2] = await Promise.all([pa.waitForResponse((r) => r.url().endsWith("/api/vendors/import/upload")), pa.getByRole("button", { name: "Upload and detect columns" }).click()]);
    expect((await r2.json()).jobId !== abandoned, "Start over reused the job");
    await pa.getByRole("button", { name: "Validate" }).click();
    await pa.getByRole("button", { name: "Import 1 vendor(s)" }).click();
    await pa.getByRole("heading", { name: "Import complete" }).waitFor({ timeout: 60000 });
    await pa.getByRole("link", { name: "View vendors" }).click();
    await pa.waitForURL((u) => u.pathname === "/crm/vendors");
    expect(await D.count("select count(*) n from vendors where name=$1", [`UIV ${tag} Extra`]) === 1, "second import missing");
    return "reset, abandon, view vendors";
  }, pa);

  // ---- vendor list: header actions, presets, filters, pagination
  const totalText = async (p) => (await p.locator("main").innerText()).match(/([\d,]+) vendors? · page (\d+) of (\d+)/);
  const myLive = (extra = "", args = []) => D.count(`select count(*) n from vendors where name like $1 and archived_at is null ${extra}`, [`UIV ${tag} %`, ...args]);
  const applyFilters = async (set) => {
    const f = pa.locator("form[action='/crm/vendors']");
    await f.locator("[name=search]").fill(`UIV ${tag}`);
    for (const [k, v] of Object.entries(set)) await fill(f, k, v);
    await f.getByRole("button", { name: "Apply filters" }).click();
    await pa.waitForURL((u) => u.searchParams.get("search") === `UIV ${tag}` && Object.entries(set).every(([k, v]) => (u.searchParams.get(k) ?? "") === v));
    await pa.waitForLoadState("domcontentloaded");
  };
  const expectTotal = async (n, what) => { await until(async () => Number((await totalText(pa))?.[1].replace(/,/g, "")) === n, `${what}: list total != ${n}`); };

  await R.check(["UI-300", "UI-240"], "Import CSV link opens the import page; Back to vendors returns to the list", async () => {
    await goto(pa, "/crm/vendors");
    await pa.getByRole("link", { name: "Import CSV" }).click();
    await pa.waitForURL((u) => u.pathname === "/crm/vendors/import");
    await pa.getByRole("heading", { name: "Import vendors" }).waitFor();
    await pa.getByRole("link", { name: "Back to vendors" }).click();
    await pa.waitForURL((u) => u.pathname === "/crm/vendors");
    return "navigated both ways";
  }, pa);

  await R.check(["UI-301"], "Export CSV downloads exactly the filtered vendors (all live; then search-filtered)", async () => {
    await goto(pa, "/crm/vendors");
    const all = await download(pa, () => pa.getByRole("link", { name: "Export CSV" }).click());
    const live = await D.count("select count(*) n from vendors where archived_at is null");
    const rows = parseCsv(all.text);
    expect(rows[0][0] === "Vendor Code" && rows.length - 1 === live, `export ${rows.length - 1} vs db ${live}`);
    await goto(pa, `/crm/vendors?search=${encodeURIComponent(`UIV ${tag} Main`)}`);
    const href = await pa.getByRole("link", { name: "Export CSV" }).getAttribute("href");
    expect(href.includes("search=UIV"), "export link ignores filter");
    const f = parseCsv((await download(pa, () => pa.getByRole("link", { name: "Export CSV" }).click())).text);
    const r = f[1];
    expect(f.length === 2 && r[1] === V.name && r[12] === V.gstin && !f.flat().includes(V.bank_accountNumber), "filtered export " + JSON.stringify(f));
    return `${live} rows; filtered 1`;
  }, pa);

  await R.check(["UI-302"], "Status preset links open the preset views whose totals match the database", async () => {
    await goto(pa, "/crm/vendors");
    for (const [label, p, st] of [["Active", "/crm/vendors/active", "ACTIVE"], ["Pending", "/crm/vendors/pending", "PENDING"], ["Inactive", "/crm/vendors/inactive", "INACTIVE"], ["All vendors", "/crm/vendors", null]]) {
      await pa.getByRole("navigation", { name: "Status presets" }).getByRole("link", { name: label, exact: true }).click();
      await pa.waitForURL((u) => u.pathname === p);
      const n = await D.count(`select count(*) n from vendors where archived_at is null ${st ? "and status=$1" : ""}`, st ? [st] : []);
      await expectTotal(n, label);
      expect((await pa.getByRole("navigation", { name: "Status presets" }).getByRole("link", { name: label, exact: true }).getAttribute("aria-current")) === "page", "preset not current");
    }
    return "4 presets";
  }, pa);

  await R.check(["UI-303", "UI-304", "UI-316"], "Filter form: search + Apply filters narrows to my vendors (total matches the database)", async () => {
    await goto(pa, "/crm/vendors");
    await applyFilters({});
    await expectTotal(await myLive(), "search");
    return "search total ok";
  }, pa);

  const filterCases = [
    ["UI-305", "status", { status: "ACTIVE" }, "and status='ACTIVE'", []],
    ["UI-306", "category", () => ({ category: vcatId }), "and category_id=$2", () => [vcatId]],
    ["UI-307", "owner", () => ({ owner: ids.exec1 }), "and owner_id=$2", () => [ids.exec1]],
    ["UI-307", "owner unassigned", { owner: "unassigned" }, "and owner_id is null", []],
    ["UI-308", "priority", { priority: "Low" }, "and priority='Low'", []],
    ["UI-309", "type", { type: "Manufacturer" }, "and vendor_type='Manufacturer'", []],
    ["UI-310", "tag", { tag: `uitag${tag}` }, "and $2 = any(tags)", [`uitag${tag}`]],
    ["UI-311", "created from today", () => ({ createdFrom: istToday() }), "", []],
    ["UI-312", "created to 2001-01-01", { createdTo: "2001-01-01" }, "and false", []],
  ];
  for (const [id, label, set, sql, args] of filterCases) {
    await R.check([id, "UI-316"], `Filter ${label}: control value is applied and the total matches the database`, async () => {
      await goto(pa, "/crm/vendors");
      const s = typeof set === "function" ? set() : set;
      await applyFilters(s);
      const n = await myLive(sql, typeof args === "function" ? args() : args);
      await expectTotal(n, label);
      if (n === 0) await pa.getByText("No vendors match these filters.").waitFor();
      for (const [k, v] of Object.entries(s)) expect((await pa.locator(`form [name=${k}]`).inputValue()) === v, `${k} not kept after apply`);
      return `${label}: ${n}`;
    }, pa);
  }

  await R.check(["UI-313", "UI-314"], "Sort by + Order selects reorder the table", async () => {
    await goto(pa, "/crm/vendors");
    for (const dir of ["asc", "desc"]) {
      await applyFilters({ sortBy: "name", sortDir: dir });
      const want = (await D.one(`select name from vendors where name like $1 and archived_at is null order by name ${dir}, id desc limit 1`, [`UIV ${tag} %`])).name;
      const first = await pa.locator("table tbody tr").first().getByRole("link").first().innerText();
      expect(first === want, `${dir}: first ${first} != ${want}`);
    }
    return "name asc/desc";
  }, pa);

  await R.check(["UI-317"], "Reset link clears all filters", async () => {
    await pa.getByRole("link", { name: "Reset", exact: true }).click();
    await pa.waitForURL((u) => u.pathname === "/crm/vendors" && !u.search);
    expect((await pa.locator("form [name=search]").inputValue()) === "" && (await pa.locator("form [name=sortDir]").inputValue()) === "desc", "inputs not reset");
    return "reset";
  }, pa);

  await R.check(["UI-318", "UI-319"], "Next / Previous pager links page through results keeping the filters", async () => {
    await goto(pa, `/crm/vendors?search=${encodeURIComponent(importPrefix)}`);
    const n = await myLive("and name like $2", [importPrefix + " %"]);
    const pages = Math.ceil(n / 25);
    const m = await totalText(pa);
    expect(Number(m[1]) === n && Number(m[3]) === pages, `pager ${m?.[0]} vs ${n}`);
    expect(await pa.getByRole("link", { name: "Previous" }).count() === 0, "Previous on page 1");
    const p1 = await pa.locator("table tbody tr").allInnerTexts();
    await pa.getByRole("link", { name: "Next" }).click();
    await pa.waitForURL((u) => u.searchParams.get("page") === "2" && u.searchParams.get("search") === importPrefix);
    const p2 = await pa.locator("table tbody tr").allInnerTexts();
    expect(p2.length === Math.min(25, n - 25) && p2.every((r) => !p1.includes(r)), "page 2 rows");
    await pa.getByRole("link", { name: "Previous" }).click();
    await pa.waitForURL((u) => u.searchParams.get("page") === "1");
    expect((await pa.locator("table tbody tr").allInnerTexts()).join() === p1.join(), "Previous did not restore page 1");
    return `${n} rows, ${pages} pages`;
  }, pa);

  // ---- vendor table (bulk + row actions)
  const imp = (n) => `${importPrefix} ${String(n).padStart(2, "0")}`;
  const vrow = (name) => pa.locator("table tbody tr", { has: pa.getByRole("link", { name, exact: true }) });
  await R.check(["UI-324", "UI-325", "UI-326", "UI-323"], "Vendor table: Select all selects every row, Clear deselects; row checkbox selects one", async () => {
    await goto(pa, `/crm/vendors?search=${encodeURIComponent(importPrefix + " 0")}`);
    const n = await pa.locator("table tbody tr").count();
    expect(n === 9, "rows " + n);
    await pa.getByLabel("Select all").check();
    const bar = pa.getByRole("region", { name: "Bulk actions" });
    await bar.getByText(`${n} selected`).waitFor();
    expect((await pa.locator("tbody input[type=checkbox]:checked").count()) === n, "not all rows checked");
    await bar.getByRole("button", { name: "Clear" }).click();
    await bar.waitFor({ state: "detached" });
    await pa.getByLabel(`Select ${imp(1)}`).check();
    await bar.getByText("1 selected").waitFor();
    await pa.getByLabel(`Select ${imp(1)}`).uncheck();
    await bar.waitFor({ state: "detached" });
    return `${n} rows selected/cleared`;
  }, pa);

  await R.check(["UI-320", "UI-321"], "Bulk New status + Set status updates the selected vendors", async () => {
    await pa.getByLabel(`Select ${imp(1)}`).check();
    await pa.getByLabel(`Select ${imp(2)}`).check();
    const bar = pa.getByRole("region", { name: "Bulk actions" });
    await bar.getByLabel("New status").selectOption("INACTIVE");
    await bar.getByRole("button", { name: "Set status" }).click();
    await toast(pa, "2 vendor(s) updated");
    await until(async () => (await D.count("select count(*) n from vendors where name in ($1,$2) and status='INACTIVE'", [imp(1), imp(2)])) === 2, "bulk status not saved");
    await bar.waitFor({ state: "detached" });
    expect((await pa.getByLabel(`Status of ${imp(1)}`).inputValue()) === "INACTIVE", "row status select not refreshed");
    return "2 → INACTIVE";
  }, pa);

  await R.check(["UI-322", "UI-315"], "Archive selected archives; Show=Archived only lists them; Restore selected restores", async () => {
    await pa.getByLabel(`Select ${imp(1)}`).check();
    await pa.getByLabel(`Select ${imp(2)}`).check();
    await pa.getByRole("region", { name: "Bulk actions" }).getByRole("button", { name: "Archive selected" }).click();
    await toast(pa, "2 vendor(s) archived");
    await until(async () => (await D.count("select count(*) n from vendors where name in ($1,$2) and archived_at is not null", [imp(1), imp(2)])) === 2, "bulk archive not saved");
    await goto(pa, `/crm/vendors?search=${encodeURIComponent(importPrefix + " 0")}`);
    await fill(pa.locator("form[action='/crm/vendors']"), "archived", "true");
    await pa.getByRole("button", { name: "Apply filters" }).click();
    await pa.waitForURL(/archived=true/);
    await until(async () => (await pa.locator("table tbody tr").count()) === 2, "archived view rows");
    await pa.getByLabel("Select all").check();
    await pa.getByRole("region", { name: "Bulk actions" }).getByRole("button", { name: "Restore selected" }).click();
    await toast(pa, "2 vendor(s) restored");
    await until(async () => (await D.count("select count(*) n from vendors where name in ($1,$2) and archived_at is null", [imp(1), imp(2)])) === 2, "bulk restore not saved");
    return "archived 2, listed, restored 2";
  }, pa);

  await R.check(["UI-328"], "Row status select changes one vendor's status (admin may blacklist)", async () => {
    await goto(pa, `/crm/vendors?search=${encodeURIComponent(imp(3))}`);
    const sel = pa.getByLabel(`Status of ${imp(3)}`);
    expect((await sel.locator("option").allInnerTexts()).includes("Blacklisted"), "admin lacks Blacklisted");
    await sel.selectOption("BLOCKED");
    await toast(pa, "Status updated");
    await until(async () => (await D.one("select status from vendors where name=$1", [imp(3)])).status === "BLOCKED", "row status not saved");
    await sel.selectOption("ACTIVE");
    await until(async () => (await D.one("select status from vendors where name=$1", [imp(3)])).status === "ACTIVE", "row status not restored");
    return "BLOCKED then ACTIVE";
  }, pa);

  await R.check(["UI-331", "UI-254", "UI-255", "UI-330"], "Row Archive (confirm) archives; Restore in the archived view restores", async () => {
    await goto(pa, `/crm/vendors?search=${encodeURIComponent(imp(4))}`);
    await vrow(imp(4)).getByRole("button", { name: "Archive" }).click();
    const c = modal(pa, "Archive");
    expect((await c.innerText()).includes(`Archive ${imp(4)}? It can be restored later.`), "confirm text");
    await c.getByRole("button", { name: "Archive", exact: true }).click();
    await toast(pa, "Vendor archived");
    await until(async () => (await D.one("select archived_at from vendors where name=$1", [imp(4)])).archived_at !== null, "row archive not saved");
    await goto(pa, `/crm/vendors?search=${encodeURIComponent(imp(4))}&archived=true`);
    expect((await vrow(imp(4)).innerText()).includes("Archived"), "archived badge missing");
    await vrow(imp(4)).getByRole("button", { name: "Restore" }).click();
    await toast(pa, "Vendor restored");
    await until(async () => (await D.one("select archived_at from vendors where name=$1", [imp(4)])).archived_at === null, "row restore not saved");
    return "archive + restore";
  }, pa);

  await R.check(["UI-327", "UI-329"], "Vendor name link and Open link navigate to the vendor profile", async () => {
    await goto(pa, `/crm/vendors?search=${encodeURIComponent(V.name)}`);
    await vrow(V.name).getByRole("link", { name: V.name, exact: true }).click();
    await pa.waitForURL((u) => u.pathname === `/crm/vendors/${v1}`);
    await pa.getByRole("heading", { name: V.name, level: 1 }).waitFor();
    await goto(pa, `/crm/vendors?search=${encodeURIComponent(V.name)}`);
    await vrow(V.name).getByRole("link", { name: "Open" }).click();
    await pa.waitForURL((u) => u.pathname === `/crm/vendors/${v1}`);
    return "both links";
  }, pa);

  // ---- settings / categories / import / performance pages
  await R.check(["UI-246"], "Vendor settings: permission table matches the role matrix and marks the admin as allowed", async () => {
    await goto(pa, "/crm/vendors/settings");
    const rows = await pa.locator("table tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((c) => c.innerText.trim())));
    const userYes = new Set(["vendor.view", "vendor.create", "vendor.edit", "vendor.export", "vendor.documents"]);
    expect(rows.length === 12, "permission rows " + rows.length);
    for (const r of rows) {
      expect(r[2] === "Yes", `${r[0]} not Yes for admin`);
      expect(r[3] === (userYes.has(r[0]) ? "Yes" : "No"), `${r[0]} user column ${r[3]}`);
      expect(r[4] === "Allowed", `${r[0]} you column ${r[4]}`);
    }
    return "12 permissions";
  }, pa);

  await R.check(["UI-247", "UI-248", "UI-249"], "Vendor settings: Manage categories link, template download and Import vendors link work", async () => {
    const t = await download(pa, () => pa.getByRole("link", { name: "Download import template" }).click());
    expect(t.name === "vendor-import-template.csv" && parseCsv(t.text)[0].join(",").startsWith("Vendor Name,Legal Name,Vendor Type,Category"), "template " + t.text.slice(0, 80));
    await pa.getByRole("link", { name: "Import vendors" }).click();
    await pa.waitForURL((u) => u.pathname === "/crm/vendors/import");
    await goto(pa, "/crm/vendors/settings");
    await pa.getByRole("link", { name: "Manage categories" }).click();
    await pa.waitForURL((u) => u.pathname === "/crm/vendors/categories");
    return "template + 2 links";
  }, pa);

  await R.check(["UI-241"], "Import page: Download the template link returns the CSV template", async () => {
    await goto(pa, "/crm/vendors/import");
    const t = await download(pa, () => pa.getByRole("link", { name: "Download the template" }).click());
    expect(parseCsv(t.text)[0].length === 20 && parseCsv(t.text).length === 1, "template headers");
    return t.name;
  }, pa);

  await R.check(["UI-238", "UI-239"], "Vendor categories: table shows vendor counts; the count link opens the list filtered by that category", async () => {
    await goto(pa, "/crm/vendors/categories");
    const n = await D.count("select count(*) n from vendors where category_id=$1", [vcatId]);
    const link = pa.locator("table tbody tr", { hasText: vcat }).getByRole("link");
    expect((await link.innerText()).trim() === String(n), `count link ${await link.innerText()} != ${n}`);
    await link.click();
    await pa.waitForURL((u) => u.pathname === "/crm/vendors" && u.searchParams.get("category") === vcatId);
    await expectTotal(await D.count("select count(*) n from vendors where category_id=$1 and archived_at is null", [vcatId]), "category link");
    return `${n} vendors`;
  }, pa);

  await R.check(["UI-242", "UI-243", "UI-244", "UI-245"], "Performance leaderboard: ranked table matches the database; vendor link opens its Performance tab; Next/Previous page", async () => {
    // fixture: evaluations for 51 of our imported vendors (own records) so the leaderboard has 2 pages
    const mine = await D.all("select id from vendors where name like $1 and archived_at is null order by name limit 51", [importPrefix + " %"]);
    for (const [i, v] of mine.entries()) {
      const s = 1 + (i % 5);
      await D.db.query(`insert into vendor_evaluations (id, vendor_id, quality, delivery, lead_time, pricing, responsiveness, compliance, overall_score, evaluation_date, period_label, comments, evaluated_by_id, evaluated_by_name, created_at)
        values (gen_random_uuid(), $1, $2,$2,$2,$2,$2,$2, $2, now(), $3, '', $4, 'QA Admin', now())`, [v.id, s, "QA " + tag, ids.admin]);
      await D.db.query("update vendors set performance_score=$2, evaluation_count=1, last_evaluated_at=now() where id=$1", [v.id, s]);
    }
    await goto(pa, "/crm/vendors/performance");
    const total = await D.count("select count(*) n from vendors where archived_at is null and performance_score is not null");
    const pages = Math.ceil(total / 50);
    expect((await pa.locator(".kpi", { hasText: "Rated vendors" }).locator("strong").innerText()) === String(total), "rated KPI");
    const top = await D.all("select name, performance_score from vendors where archived_at is null and performance_score is not null order by performance_score desc, name asc limit 50");
    const ui = await pa.locator("table tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((c) => c.innerText.trim())));
    expect(ui.length === 50, "page 1 rows " + ui.length);
    ui.forEach((r, i) => expect(r[0] === String(i + 1) && r[1] === top[i].name && r[5] === Number(top[i].performance_score).toFixed(2), `rank ${i + 1}: ${r} vs ${JSON.stringify(top[i])}`));
    await pa.getByText(`Page 1 of ${pages}`).waitFor();
    await pa.getByRole("link", { name: "Next" }).click();
    await pa.waitForURL(/page=2/);
    await pa.getByText(`Page 2 of ${pages}`).waitFor();
    const first2 = await pa.locator("table tbody tr").first().innerText();
    expect(first2.startsWith("51"), "page 2 does not continue ranking: " + first2);
    await pa.getByRole("link", { name: "Previous" }).click();
    await pa.waitForURL(/page=1/);
    const l = pa.locator("table tbody tr").first().getByRole("link");
    const name = await l.innerText();
    await l.click();
    await pa.waitForURL((u) => /\/crm\/vendors\/[0-9a-f-]{36}$/.test(u.pathname) && u.searchParams.get("tab") === "performance");
    await pa.getByRole("heading", { name, level: 1 }).waitFor();
    return `${total} rated, ${pages} pages`;
  }, pa);

  await R.check(["UI-297", "UI-298", "UI-299"], "Audit history: table lists the vendor's audit events (matches DB); Older/Newer paginate", async () => {
    const have = await D.count("select count(*) n from activity_logs where details->>'module'='vendor' and details->>'vendorId'=$1", [v1]);
    for (let i = have; i < 30; i += 1) { // top up with own synthetic audit rows so there are 2 pages of 25
      await D.db.query("insert into activity_logs (id, action, actor_name, actor_role, details, occurred_at, created_at) values (gen_random_uuid(), 'vendor.qa_filler', 'QA Admin', 'ADMIN', $1, now() - ($2 || ' minutes')::interval, now())", [{ module: "vendor", vendorId: v1, note: "filler " + i }, String(1000 + i)]);
    }
    const total = await D.count("select count(*) n from activity_logs where details->>'module'='vendor' and details->>'vendorId'=$1", [v1]);
    await goto(pa, prof("audit"));
    await pa.getByText(`${total} events`).waitFor();
    const actions = await pa.locator("table tbody tr td:nth-child(2)").allInnerTexts();
    const dbActions = (await D.all("select action from activity_logs where details->>'module'='vendor' and details->>'vendorId'=$1 order by occurred_at desc limit 25", [v1])).map((r) => r.action);
    expect(actions.join() === dbActions.join(), "audit actions differ: " + actions.slice(0, 5));
    for (const a of ["vendor.created", "vendor.updated", "vendor.status_changed", "vendor.archived", "vendor.restored"]) expect(actions.includes(a) || total > 25, "missing " + a);
    await pa.getByRole("link", { name: "Older" }).click();
    await pa.waitForURL(/auditPage=2/);
    await pa.getByText(`Page 2 of ${Math.ceil(total / 25)}`).waitFor();
    expect(await pa.locator("table tbody tr").count() === Math.min(25, total - 25), "page 2 rows");
    await pa.getByRole("link", { name: "Newer" }).click();
    await pa.waitForURL(/auditPage=1/);
    await pa.getByText(`Page 1 of ${Math.ceil(total / 25)}`).waitFor();
    return `${total} events (${have} real)`;
  }, pa);

  // ---- employee restrictions
  page = pe;
  await R.check(["UI-300", "UI-301", "UI-331", "UI-330", "UI-322", "UI-320", "UI-328"], "Employee vendor list: no Import CSV / Archive / Restore / Archive selected / Blacklisted options; Export works", async () => {
    await goto(pe, `/crm/vendors?search=${encodeURIComponent(importPrefix + " 0")}`);
    expect(await pe.getByRole("link", { name: "Import CSV" }).count() === 0, "employee sees Import CSV");
    expect(await pe.getByRole("button", { name: "Archive" }).count() === 0, "employee sees row Archive");
    expect(!(await pe.getByLabel(`Status of ${imp(5)}`).locator("option").allInnerTexts()).includes("Blacklisted"), "row select offers Blacklisted");
    await pe.getByLabel(`Select ${imp(5)}`).check();
    const bar = pe.getByRole("region", { name: "Bulk actions" });
    expect(!(await bar.getByLabel("New status").locator("option").allInnerTexts()).includes("Blacklisted"), "bulk select offers Blacklisted");
    expect(await bar.getByRole("button", { name: /selected$/ }).count() === 0, "employee sees Archive selected");
    const ex = parseCsv((await download(pe, () => pe.getByRole("link", { name: "Export CSV" }).click())).text);
    expect(ex.length - 1 === 9, "employee export rows " + (ex.length - 1));
    await goto(pe, `/crm/vendors?search=${encodeURIComponent(importPrefix)}&archived=true`);
    expect(await pe.getByRole("button", { name: "Restore" }).count() === 0, "employee sees Restore");
    return "restricted";
  }, pe);

  await R.check(["UI-252", "UI-251", "UI-296", "UI-292", "UI-293"], "Employee profile: no Archive/Restore/evaluation controls; bank restricted; document controls kept (vendor.documents)", async () => {
    await goto(pe, prof());
    expect(await pe.getByRole("button", { name: "Archive", exact: true }).count() === 0 && await pe.getByRole("button", { name: "Restore", exact: true }).count() === 0, "employee sees Archive/Restore");
    await pe.getByText("Bank account details are restricted to administrators.").waitFor();
    expect(!(await pe.locator("main").innerText()).includes("HDFC Bank"), "bank name leaked to employee");
    await goto(pe, prof("performance"));
    expect(await pe.getByRole("button", { name: "Record evaluation" }).count() === 0, "employee can record evaluations");
    await goto(pe, prof("documents"));
    await pe.getByRole("button", { name: "Upload document" }).waitFor();
    return "restricted";
  }, pe);

  await R.check(["UI-242", "UI-256", "UI-241", "UI-248", "UI-249", "UI-247"], "Employee: performance page redirects; import page refuses (no wizard/template); settings hide import links; template API 403", async () => {
    await goto(pe, "/crm/vendors/performance");
    expect(new URL(pe.url()).pathname === "/crm/entrydashboard", "performance not refused: " + pe.url());
    await goto(pe, "/crm/vendors/import");
    await pe.getByText("You do not have permission to import vendors.").waitFor();
    expect(await pe.getByLabel("CSV file").count() === 0 && await pe.getByRole("link", { name: "Download the template" }).count() === 0, "wizard/template shown");
    const api = await pe.request.get(`${base}/api/vendors/import/template`);
    const rep = await pe.request.get(`${base}/api/vendors/import/${jobId}/report`);
    expect(api.status() === 403 && rep.status() === 403, `template ${api.status()} report ${rep.status()}`);
    await goto(pe, "/crm/vendors/settings");
    expect(await pe.getByRole("link", { name: "Download import template" }).count() === 0 && await pe.getByRole("link", { name: "Import vendors" }).count() === 0, "import links shown");
    const archiveRow = await pe.locator("table tbody tr", { hasText: "vendor.archive" }).innerText();
    expect(archiveRow.includes("Not allowed"), "You column for archive");
    await pe.getByRole("link", { name: "View categories" }).click();
    await pe.waitForURL((u) => u.pathname === "/crm/vendors/categories");
    expect(await pe.getByRole("button", { name: "Add category" }).count() === 0, "employee can add categories");
    return "restricted";
  }, pe);
  page = pa;
}

await ctxA.close();
await ctxE.close();
await browser.close();
await D.end();
R.finish();
