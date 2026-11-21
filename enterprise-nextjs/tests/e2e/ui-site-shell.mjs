// Per-control UI suite: public marketing site, Careers (public + PIN-protected admin), CRM app shell, auth pages,
// user management, shared Modal/ConfirmDialog and the CRM error boundary. Isolated E2E stack only.
// Every check drives the real control in Chromium and verifies the outcome (navigation, API response, PostgreSQL
// row, visible feedback). Results: test-artifacts/ui-site-shell.json (failure screenshots in test-artifacts/ui/).
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { base, PASSWORD, tag, openDb, signedIn, launch, recorder, expect } from "./lib.mjs";

const R = recorder("site-shell");
const check = (...a) => R.check(...a);
const D = await openDb();
const browser = await launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const FAKE_AUTH = "http://127.0.0.1:54321";

// ---------- fixtures ----------
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
function makePdf(text) {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
const PDF = makePdf(`QA resume ${tag}`);

/** Fresh, never-saved browser context signed in with the given credentials (for sign-out / password tests). */
async function freshLogin(identifier, password = PASSWORD, opts = {}) {
  const ctx = await signedIn(browser, null, opts);
  const p = await ctx.newPage();
  p.setDefaultTimeout(20000);
  for (let attempt = 0; attempt < 2; attempt++) {
    await p.goto(base + "/crm/login");
    await p.getByLabel("Username or work email").fill(identifier);
    await p.getByLabel("Password").fill(password);
    await p.getByRole("button", { name: "Sign in" }).click();
    await Promise.race([p.waitForURL("**/crm/entrydashboard", { timeout: 30000 }), p.locator("form p.error[role=alert]").waitFor({ timeout: 30000 })]).catch(() => {});
    const err = await p.locator("form p.error[role=alert]").innerText().catch(() => "");
    if (/too many/i.test(err) && attempt === 0) { execFileSync("node", ["scripts/e2e/reset-rate-limits.mjs"]); continue; }
    break;
  }
  return p;
}
/** Records uncaught page errors so "the page renders" also means "no client exception". */
function trackErrors(p) {
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  return errs;
}
/** Clicks an in-app link, waits for the expected path and confirms the server answers it with < 400. */
async function followLink(p, locator, path, errs) {
  const href = await locator.getAttribute("href");
  const before = errs ? errs.length : 0;
  await Promise.all([p.waitForURL((u) => new URL(u).pathname === path, { timeout: 30000 }), locator.click()]);
  await p.waitForLoadState("domcontentloaded");
  const r = await p.request.get(new URL(href, base).toString());
  expect(r.status() < 400, `${href} answered ${r.status()}`);
  if (errs) expect(errs.length === before, `page error after ${href}: ${errs.slice(before).join(" | ")}`);
  return href;
}
/** Clicks an external (target=_blank) link; the context guard aborts the off-site request, which we capture. */
async function externalClick(p, locator, host) {
  const ctx = p.context();
  expect((await locator.getAttribute("target")) === "_blank", "external link does not open a new tab");
  expect(/noopener/.test((await locator.getAttribute("rel")) ?? ""), "external link lacks rel=noopener");
  const reqP = ctx.waitForEvent("request", { predicate: (r) => new URL(r.url()).hostname.replace(/^www\./, "") === host, timeout: 15000 });
  const popP = ctx.waitForEvent("page", { timeout: 15000 });
  await locator.click();
  const [req, pop] = await Promise.all([reqP, popP]);
  await pop.close().catch(() => {});
  return req.url();
}
/** tel:/mailto: links hand off to the OS; verify the target and that activating it leaves the page intact. */
async function handoffLink(p, locator, expected) {
  const href = await locator.getAttribute("href");
  expect(href === expected, `href ${href} != ${expected}`);
  const url = p.url();
  await locator.click();
  await p.waitForTimeout(200);
  expect(p.url() === url, "activating " + href + " navigated the page");
  return href;
}

// =====================================================================================================
// Marketing site (anonymous visitor)
// =====================================================================================================
const pubCtx = await signedIn(browser, null);
let page = await pubCtx.newPage();
page.setDefaultTimeout(20000);
const pubErrs = trackErrors(page);

await check(["UI-586", "UI-585", "UI-600", "UI-590"], "Navbar home, hero, categories and Let's talk links reach rendering pages", async () => {
  await page.goto(base + "/contact");
  await followLink(page, page.locator("header.navbar").getByRole("link", { name: "MF Global Services home" }), "/", pubErrs);
  await page.locator("h1.hero-title").waitFor();
  await followLink(page, page.getByRole("link", { name: /Talk to our team/ }), "/contact", pubErrs);
  await page.locator("form.contactus-form").waitFor();
  await page.goto(base + "/");
  await followLink(page, page.getByRole("link", { name: /Explore gifting options/ }), "/contact", pubErrs);
  await page.goto(base + "/blogs");
  await followLink(page, page.locator("header.navbar").getByRole("link", { name: /Let.s talk/ }), "/contact", pubErrs);
  return "home, contact x3 rendered without page errors";
}, page);

await check([], "Navbar Home/Blog/Careers/Contact Us links render and mark the active page", async () => {
  await page.goto(base + "/");
  const nav = page.locator("nav.desktop-menu");
  for (const [name, path] of [["Blog", "/blogs"], ["Careers", "/careers"], ["Contact Us", "/contact"], ["Home", "/"]]) {
    await followLink(page, nav.getByRole("link", { name, exact: true }), path, pubErrs);
    expect((await nav.getByRole("link", { name, exact: true }).getAttribute("aria-current")) === "page", `${name} not marked active`);
  }
}, page);

await check(["UI-587"], "Our Products toggle opens and closes the products menu (keyboard)", async () => {
  await page.goto(base + "/");
  const btn = page.locator("header.navbar").getByRole("button", { name: "Our Products" });
  await btn.focus();
  await page.keyboard.press("Enter");
  expect((await btn.getAttribute("aria-expanded")) === "true", "Enter did not open the menu");
  expect(await page.locator("#desktop-products-menu.show").isVisible(), "menu not shown");
  await page.keyboard.press("Enter");
  expect((await btn.getAttribute("aria-expanded")) === "false", "Enter did not close the menu");
}, page);

await check(["UI-587"], "Clicking (mouse/tap) Our Products leaves the products menu open", async () => {
  await page.goto(base + "/");
  const btn = page.locator("header.navbar").getByRole("button", { name: "Our Products" });
  await btn.click();
  await page.waitForTimeout(300);
  expect((await btn.getAttribute("aria-expanded")) === "true", "menu is closed right after clicking Our Products (hover opened it, the click toggled it shut)");
}, page);

await check(["UI-588"], "Desktop product links open the partner sites in a new tab", async () => {
  await page.goto(base + "/");
  const btn = page.locator("header.navbar").getByRole("button", { name: "Our Products" });
  await btn.hover();
  const got = [];
  for (const [name, host] of [["Premium Gifts", "giftaguru.com"], ["Edu Print & Promo", "coachingpromo.in"], ["Corporate Gifting", "printkee.com"]]) {
    await btn.hover();
    await page.locator("#desktop-products-menu.show").waitFor();
    got.push(await externalClick(page, page.locator("#desktop-products-menu").getByRole("link", { name }), host));
  }
  return got.join(", ");
}, page);

await check(["UI-589"], "Navbar social icons open Facebook/LinkedIn/Instagram in a new tab", async () => {
  await page.goto(base + "/");
  const social = page.locator("header.navbar .navbar-social");
  const got = [];
  for (const [name, host] of [["Facebook", "facebook.com"], ["LinkedIn", "linkedin.com"], ["Instagram", "instagram.com"]]) got.push(await externalClick(page, social.getByRole("link", { name }), host));
  return got.join(", ");
}, page);

await check(["UI-599"], "Our Services Explore buttons open the service sites in a new tab", async () => {
  await page.goto(base + "/");
  const btns = page.locator("a.explore-button");
  const n = await btns.count();
  expect(n >= 1, "no Explore buttons");
  const got = [];
  for (let i = 0; i < n; i++) got.push(await externalClick(page, btns.nth(i), new URL(await btns.nth(i).getAttribute("href")).hostname.replace(/^www\./, "")));
  return got.join(", ");
}, page);

await check(["UI-570", "UI-571", "UI-572", "UI-573", "UI-574", "UI-575", "UI-576", "UI-584"], "Footer brand and Explore links reach rendering pages (anchors land on their sections)", async () => {
  const foot = () => page.locator("footer.footer");
  await page.goto(base + "/blogs");
  await followLink(page, foot().locator("a.footer-brand"), "/", pubErrs);
  for (const [name, path] of [["Blog", "/blogs"], ["Careers", "/careers"], ["Contact Us", "/contact"], ["Home", "/"]]) {
    await followLink(page, foot().getByRole("link", { name, exact: true }), path, pubErrs);
  }
  for (const [name, id] of [["About Us", "about"], ["Services", "services"]]) {
    await page.goto(base + "/contact");
    await followLink(page, foot().getByRole("link", { name, exact: true }), "/", pubErrs);
    await page.waitForFunction((h) => location.hash === "#" + h, id);
    expect(await page.locator("#" + id).count() === 1, `#${id} section missing`);
  }
  await page.goto(base + "/");
  await followLink(page, foot().getByRole("link", { name: "Careers Admin" }), "/careers/admin", pubErrs);
  await page.getByPlaceholder("Enter 6-digit PIN").waitFor();
}, page);

await check(["UI-577", "UI-578", "UI-579", "UI-580"], "Footer phone and email links target the published numbers/addresses", async () => {
  await page.goto(base + "/");
  const f = page.locator("footer.footer");
  await handoffLink(page, f.getByRole("link", { name: "+91 95997 74728" }), "tel:+919599774728");
  await handoffLink(page, f.getByRole("link", { name: "+91 87507 08222" }), "tel:+918750708222");
  await handoffLink(page, f.getByRole("link", { name: "Info@mfglobalservices.com" }), "mailto:Info@mfglobalservices.com");
  await handoffLink(page, f.getByRole("link", { name: "sales@mfglobalservices.com" }), "mailto:sales@mfglobalservices.com");
}, page);

await check(["UI-581", "UI-582", "UI-583"], "Footer social icons open Facebook/LinkedIn/YouTube in a new tab", async () => {
  await page.goto(base + "/");
  const f = page.locator("footer.footer");
  const got = [];
  for (const [name, host] of [["Facebook", "facebook.com"], ["LinkedIn", "linkedin.com"], ["YouTube", "youtube.com"]]) got.push(await externalClick(page, f.getByRole("link", { name }), host));
  return got.join(", ");
}, page);

await check(["UI-559", "UI-560", "UI-561", "UI-562"], "Contact page phone and email links target the published numbers/addresses", async () => {
  await page.goto(base + "/contact");
  const c = page.locator(".contactus-info-section");
  await handoffLink(page, c.getByRole("link", { name: "+91 95997 74728" }), "tel:+919599774728");
  await handoffLink(page, c.getByRole("link", { name: "+91 87507 08222" }), "tel:+918750708222");
  await handoffLink(page, c.getByRole("link", { name: "Info@mfglobalservices.com" }), "mailto:Info@mfglobalservices.com");
  await handoffLink(page, c.getByRole("link", { name: "business@mfglobalservices.com" }), "mailto:business@mfglobalservices.com");
}, page);

const contactName = `SS Contact ${tag}`;
await check(["UI-563", "UI-564", "UI-565", "UI-566", "UI-567", "UI-568", "UI-569"], "Contact form: required/email validation blocks, valid enquiry is stored and confirmed", async () => {
  await page.goto(base + "/contact");
  const form = page.locator("form.contactus-form");
  let posted = 0;
  const onReq = (r) => { if (r.url().includes("/api/send-email")) posted++; };
  page.on("request", onReq);
  await form.getByRole("button", { name: /Let.s Connect/ }).click();
  expect(await form.locator("input[name=name]").evaluate((e) => e.validity.valueMissing), "empty name not flagged");
  await form.getByLabel(/Full Name/).fill(contactName);
  await form.getByLabel(/Phone Number/).fill("+91 98" + tag.padStart(8, "0"));
  await form.getByLabel(/Work Email/).fill("not-an-email");
  await form.getByLabel(/Company/).fill(`SS Co ${tag}`);
  await form.getByLabel(/How can we help/).fill(`Need 50 gift hampers (${tag})`);
  await form.getByRole("button", { name: /Let.s Connect/ }).click();
  expect(await form.locator("input[name=email]").evaluate((e) => e.validity.typeMismatch), "invalid email not flagged");
  await page.waitForTimeout(300);
  expect(posted === 0, "invalid form was submitted");
  page.off("request", onReq);
  await form.getByLabel(/Work Email/).fill(`ss.contact${tag}@example.test`);
  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    [res] = await Promise.all([page.waitForResponse((r) => r.url().includes("/api/send-email")), form.getByRole("button", { name: /Let.s Connect/ }).click()]);
    if (res.status() !== 429) break;
    await form.locator(".contactus-error").waitFor();
    await sleep(61000); // shared 5/min bucket (all local clients); the app correctly told the visitor to retry
  }
  expect(res.status() === 200 && (await res.json()).success === true, "send-email status " + res.status());
  await form.locator(".contactus-success").waitFor();
  expect((await form.getByLabel(/Full Name/).inputValue()) === "", "form not cleared after success");
  const row = await D.one("select email, phone, subject, message from contact_submissions where name=$1", [contactName]);
  expect(row && row.email === `ss.contact${tag}@example.test` && row.subject === `SS Co ${tag}` && row.message.includes(tag) && row.phone.includes(tag.slice(-4)), "row: " + JSON.stringify(row));
  return "contact_submissions row stored";
}, page);

// ---------- Blog (ADMIN creates; public reads and comments)
const adminCtx = await signedIn(browser, "qa.admin");
const admin = await adminCtx.newPage();
admin.setDefaultTimeout(20000);
const adminErrs = trackErrors(admin);
const blogTitle = `SS Blog ${tag}`;
let blogId = null;

await check(["UI-608", "UI-601"], "+ Create New Blog opens the form; Close form returns to the list", async () => {
  await admin.goto(base + "/blogs");
  await followLink(admin, admin.getByRole("link", { name: "+ Create New Blog" }), "/blogs/new", adminErrs);
  await admin.getByRole("heading", { name: "Create New Blog" }).waitFor();
  await admin.getByRole("button", { name: "Close form" }).click();
  await admin.waitForURL((u) => new URL(u).pathname === "/blogs");
}, admin);

await check(["UI-602", "UI-603", "UI-604", "UI-605", "UI-606", "UI-607"], "Blog form (ADMIN): required fields block; post with image is stored and listed", async () => {
  await admin.goto(base + "/blogs/new");
  let posted = 0;
  const onReq = (r) => { if (r.url().includes("/api/blogs/post-blogs")) posted++; };
  admin.on("request", onReq);
  await admin.getByRole("button", { name: "Post Blog" }).click();
  expect(await admin.locator("input[name=title]").evaluate((e) => e.validity.valueMissing), "empty title not flagged");
  await admin.waitForTimeout(300);
  expect(posted === 0, "empty blog submitted");
  admin.off("request", onReq);
  await admin.getByLabel("Blog Title").fill(blogTitle);
  await admin.getByLabel("Image or video").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: PNG });
  await admin.getByRole("img", { name: "Preview" }).waitFor();
  await admin.getByLabel("Author Name").fill(`SS Author ${tag}`);
  await admin.getByLabel("Blog Content").fill(`Synthetic QA content for ${tag}. `.repeat(8));
  const [res] = await Promise.all([admin.waitForResponse((r) => r.url().includes("/api/blogs/post-blogs")), admin.getByRole("button", { name: "Post Blog" }).click()]);
  expect(res.status() === 201, "post-blogs " + res.status());
  await admin.waitForURL((u) => new URL(u).pathname === "/blogs");
  const row = await D.one("select id, author, media_path, published from blog_posts where title=$1", [blogTitle]);
  expect(row && row.author === `SS Author ${tag}` && row.published && /\.png$/.test(row.media_path ?? ""), "blog row: " + JSON.stringify(row));
  blogId = row.id;
  await admin.getByRole("heading", { name: blogTitle }).waitFor();
  return "blog_posts " + row.id;
}, admin);

await check(["UI-607"], "Blog form submitted without ADMIN rights shows an error instead of failing silently", async () => {
  const anon = await pubCtx.newPage();
  const errs = trackErrors(anon);
  try {
    await anon.goto(base + "/blogs/new");
    await anon.getByLabel("Blog Title").fill(`SS Anon ${tag}`);
    await anon.getByLabel("Blog Content").fill("Anonymous attempt");
    const [res] = await Promise.all([anon.waitForResponse((r) => r.url().includes("/api/blogs/post-blogs")), anon.getByRole("button", { name: "Post Blog" }).click()]);
    expect(res.status() === 401, "anonymous post status " + res.status());
    expect((await D.count("select count(*) n from blog_posts where title=$1", [`SS Anon ${tag}`])) === 0, "anonymous post stored");
    await anon.waitForTimeout(1000);
    const feedback = await anon.locator("[role=alert], .error, .form-error").count();
    expect(feedback > 0 && errs.length === 0, `no visible error; uncaught: ${errs.join(" | ") || "none"}`);
  } finally { await anon.close(); }
}, page);

await check(["UI-609"], "Blog list shows the new post; Read More opens the detail page", async () => {
  expect(blogId, "no blog created");
  await page.goto(base + "/blogs");
  const card = page.locator(".blog-card").filter({ has: page.getByRole("heading", { name: blogTitle }) });
  await card.waitFor();
  expect((await card.locator(".blog-author").innerText()).includes(`SS Author ${tag}`), "author not shown");
  await followLink(page, card.getByRole("link", { name: "Read More" }), `/blogs/${blogId}`, pubErrs);
  await page.getByRole("heading", { level: 1, name: blogTitle }).waitFor();
  expect(await page.locator("img.blog-detail-media").count() === 1, "media not shown on detail page");
}, page);

await check(["UI-555", "UI-556", "UI-557", "UI-558"], "Blog comment: required fields block; posted comment is stored and listed", async () => {
  expect(blogId, "no blog created");
  await page.goto(base + `/blogs/${blogId}`);
  const form = page.locator("form.comment-form");
  await form.getByRole("button", { name: "Post Comment" }).click();
  expect(await form.getByLabel("Your Name").evaluate((e) => e.validity.valueMissing), "empty name not flagged");
  await form.getByLabel("Your Name").fill(`SS Reader ${tag}`);
  await form.getByLabel("Write a comment").fill(`Helpful article ${tag}`);
  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    [res] = await Promise.all([page.waitForResponse((r) => r.url().endsWith("/api/blogs/comments") && r.request().method() === "POST"), form.getByRole("button", { name: "Post Comment" }).click()]);
    if (res.status() !== 429) break;
    await page.getByText("We couldn’t post your comment").waitFor();
    await sleep(61000);
  }
  expect(res.status() === 201, "comment status " + res.status());
  await page.getByRole("status").filter({ hasText: "Your comment was posted." }).waitFor();
  await page.locator(".comment-item").filter({ hasText: `Helpful article ${tag}` }).waitFor();
  const row = await D.one("select user_name, approved from blog_comments where blog_id=$1 and text=$2", [blogId, `Helpful article ${tag}`]);
  expect(row && row.user_name === `SS Reader ${tag}` && row.approved, "comment row: " + JSON.stringify(row));
}, page);

// ---------- Mobile navigation (390px)
const mobCtx = await signedIn(browser, null, { viewport: { width: 390, height: 844 } });
const mob = await mobCtx.newPage();
mob.setDefaultTimeout(20000);
const mobErrs = trackErrors(mob);
const sidebarOpen = async () => (await mob.locator("#mobile-navigation").getAttribute("class")).includes("open");

await check(["UI-591", "UI-592", "UI-594", "UI-598", "UI-593"], "Mobile menu: hamburger/icon opens, close button, overlay and brand link close it", async () => {
  await mob.goto(base + "/contact");
  const burger = mob.locator("header.navbar button.hamburger-icon");
  await burger.click();
  expect(await sidebarOpen() && (await burger.getAttribute("aria-expanded")) === "true", "hamburger did not open the menu");
  await mob.locator("#mobile-navigation .sidebar-close").click();
  expect(!(await sidebarOpen()), "close button did not close");
  await burger.locator("svg").click(); // the FiMenu icon itself
  expect(await sidebarOpen(), "menu icon did not open");
  await mob.locator("button.sidebar-overlay").click({ position: { x: 370, y: 700 } });
  expect(!(await sidebarOpen()), "overlay did not close");
  await burger.click();
  expect((await burger.getAttribute("aria-label")) === "Close navigation menu", "toggle label not updated");
  await followLink(mob, mob.locator("#mobile-navigation a.sidebar-brand"), "/", mobErrs);
  await mob.waitForFunction(() => !document.querySelector("#mobile-navigation").className.includes("open"));
}, mob);

await check(["UI-595", "UI-596"], "Mobile Our Products expands and product links open partner sites", async () => {
  await mob.goto(base + "/");
  await mob.locator("header.navbar button.hamburger-icon").click();
  const toggle = mob.locator("#mobile-navigation").getByRole("button", { name: "Our Products" });
  await toggle.click();
  expect((await toggle.getAttribute("aria-expanded")) === "true", "mobile products did not expand");
  const got = await externalClick(mob, mob.locator("#mobile-products-menu").getByRole("link", { name: "Premium Gifts" }), "giftaguru.com");
  await mob.waitForFunction(() => !document.querySelector("#mobile-navigation").className.includes("open"));
  return got;
}, mob);

await check(["UI-597"], "Mobile social icons open Facebook/LinkedIn/Instagram", async () => {
  await mob.goto(base + "/");
  await mob.locator("header.navbar button.hamburger-icon").click();
  const s = mob.locator("#mobile-navigation .sidebar-social");
  const got = [];
  for (const [name, host] of [["Facebook", "facebook.com"], ["LinkedIn", "linkedin.com"], ["Instagram", "instagram.com"]]) got.push(await externalClick(mob, s.getByRole("link", { name }), host));
  return got.join(", ");
}, mob);

await check([], "Mobile nav links Blog/Careers/Contact Us render and close the menu", async () => {
  for (const [name, path] of [["Blog", "/blogs"], ["Careers", "/careers"], ["Contact Us", "/contact"]]) {
    await mob.goto(base + "/");
    await mob.locator("header.navbar button.hamburger-icon").click();
    await followLink(mob, mob.locator("#mobile-navigation").getByRole("link", { name, exact: true }), path, mobErrs);
    await mob.waitForFunction(() => !document.querySelector("#mobile-navigation").className.includes("open"));
  }
}, mob);
await mobCtx.close();

// =====================================================================================================
// Careers — admin portal setup, jobs, public application, applications, PIN
// =====================================================================================================
const PIN = String(100000 + (Number(tag) % 800000)).slice(0, 6);
const PIN2 = String(Number(PIN) + 1111).slice(-6).padStart(6, "7");
await D.db.query("insert into career_admin_settings (key, pin_hash, updated_at) values ('admin', $1, now()) on conflict (key) do update set pin_hash = excluded.pin_hash, updated_at = now()", [bcrypt.hashSync(PIN, 8)]);
await D.db.query("delete from career_login_attempts");
const exec1Ctx = await signedIn(browser, "qa.exec1");

await check(["UI-644"], "PIN screen Back to Careers link reaches the public careers page", async () => {
  await page.goto(base + "/careers/admin");
  await followLink(page, page.getByRole("link", { name: /Back to Careers/ }), "/careers", pubErrs);
  await page.locator("#open-positions").waitFor();
}, page);

await check(["UI-645", "UI-646", "UI-647"], "PIN form is refused without a CRM ADMIN session (anonymous 401, employee 403)", async () => {
  await page.goto(base + "/careers/admin");
  const pin = page.getByPlaceholder("Enter 6-digit PIN");
  await pin.pressSequentially("12ab34");
  expect((await pin.inputValue()) === "1234", "non-digits not stripped");
  expect(await page.getByRole("button", { name: "Unlock dashboard" }).isDisabled(), "Unlock enabled with 4 digits");
  await pin.fill(PIN);
  const [r1] = await Promise.all([page.waitForResponse((r) => r.url().endsWith("/api/careers/admin/login")), page.getByRole("button", { name: "Unlock dashboard" }).click()]);
  expect(r1.status() === 401, "anonymous PIN login " + r1.status());
  await page.locator(".career-admin-error[role=alert]").filter({ hasText: "Sign in to the CRM as an administrator" }).waitFor();
  const ex = await exec1Ctx.newPage();
  try {
    await ex.goto(base + "/careers/admin");
    await ex.getByPlaceholder("Enter 6-digit PIN").fill(PIN);
    const [r2] = await Promise.all([ex.waitForResponse((r) => r.url().endsWith("/api/careers/admin/login")), ex.getByRole("button", { name: "Unlock dashboard" }).click()]);
    expect(r2.status() === 403, "employee PIN login " + r2.status());
    await ex.getByRole("alert").filter({ hasText: "Administrator access required." }).waitFor();
  } finally { await ex.close(); }
  expect((await D.count("select count(*) n from career_login_attempts")) === 0, "refused callers were counted as PIN failures");
}, page);

async function adminUnlock(pin) {
  await admin.goto(base + "/careers/admin");
  await admin.getByPlaceholder("Enter 6-digit PIN").fill(pin);
  const [r] = await Promise.all([admin.waitForResponse((x) => x.url().endsWith("/api/careers/admin/login")), admin.getByRole("button", { name: "Unlock dashboard" }).click()]);
  return r;
}
await check(["UI-645", "UI-646", "UI-647"], "ADMIN: wrong PIN is rejected and counted; correct PIN unlocks the dashboard", async () => {
  const bad = await adminUnlock(PIN === "999999" ? "999998" : "999999");
  expect(bad.status() === 401, "wrong PIN status " + bad.status());
  await admin.locator(".career-admin-error").filter({ hasText: "Invalid PIN." }).waitFor();
  expect((await D.one("select max(failures) f from career_login_attempts")).f === 1, "failure not recorded");
  const ok = await adminUnlock(PIN);
  expect(ok.status() === 200, "correct PIN status " + ok.status());
  await admin.getByRole("heading", { name: "Dashboard Overview" }).waitFor();
  expect((await D.count("select count(*) n from career_login_attempts")) === 0, "failures not cleared on success");
}, admin);

const nav = (label) => admin.locator("nav[aria-label='Careers administration']").getByRole("button", { name: label });
await check(["UI-649"], "Workspace tabs switch views and load their data", async () => {
  for (const [label, heading, api] of [["Manage Jobs", "Manage Jobs", "/api/careers/admin/jobs?"], ["Applications", "Applications", "/api/careers/admin/applications?"], ["Change PIN", "Change PIN", null], ["Overview", "Dashboard Overview", "/api/careers/admin/stats"]]) {
    const wait = api ? admin.waitForResponse((r) => r.url().includes(api) && r.status() === 200) : Promise.resolve();
    await nav(label).click();
    await wait;
    await admin.getByRole("heading", { level: 1, name: heading }).waitFor();
    expect((await nav(label).getAttribute("class")) === "active", `${label} tab not active`);
  }
}, admin);

const jobTitle = `SS Role ${tag}`;
const jobDept = `SS Dept ${tag}`;
const jobLoc = `SS City ${tag}`;
const jobModal = () => admin.locator("form.career-admin-modal");
const jl = (t) => jobModal().locator("label").filter({ hasText: new RegExp("^" + esc(t)) });
const jobRow = (title) => admin.locator(".career-table-wrap tbody tr").filter({ has: admin.locator("td strong", { hasText: new RegExp("^" + esc(title) + "$") }) });
let jobId = null;

await check(["UI-652", "UI-676", "UI-677", "UI-681"], "Add New Job: empty form is blocked natively, × closes without saving", async () => {
  await nav("Manage Jobs").click();
  await admin.getByRole("button", { name: /Add New Job/ }).click();
  await jobModal().getByRole("heading", { name: "Add Job" }).waitFor();
  let posted = 0;
  const onReq = (r) => { if (r.url().endsWith("/api/careers/admin/jobs") && r.request().method() === "POST") posted++; };
  admin.on("request", onReq);
  await jobModal().getByRole("button", { name: "Save Job" }).click();
  expect(await jl("Job title").locator("input").evaluate((e) => e.validity.valueMissing), "empty title not flagged");
  await admin.waitForTimeout(300);
  admin.off("request", onReq);
  expect(posted === 0, "empty job submitted");
  await jobModal().getByRole("button", { name: "×" }).click();
  expect((await jobModal().count()) === 0, "× did not close the job form");
}, admin);

await check(["UI-681"], "Save Job surfaces the server validation message (whitespace-only title)", async () => {
  await admin.getByRole("button", { name: /Add New Job/ }).click();
  await fillJob({ title: "   " });
  const [r] = await Promise.all([admin.waitForResponse((x) => x.url().endsWith("/api/careers/admin/jobs") && x.request().method() === "POST"), jobModal().getByRole("button", { name: "Save Job" }).click()]);
  expect(r.status() === 400, "whitespace title status " + r.status());
  await admin.locator(".career-admin-error").filter({ hasText: /title: is required/ }).waitFor();
  expect(await jobModal().isVisible(), "form closed on validation error");
  await jobModal().getByRole("button", { name: "×" }).click();
}, admin);

async function fillJob(over = {}) {
  const v = { title: jobTitle, department: jobDept, location: jobLoc, experience: "1-3 years", salaryRange: "3-5 LPA", vacancies: "2", displayOrder: "1", deadline: "2030-12-31", ...over };
  await jl("Job title").locator("input").fill(v.title);
  await jl("Department").locator("input").fill(v.department);
  await jl("Location").locator("input").fill(v.location);
  await jl("Experience required").locator("input").fill(v.experience);
  await jl("Salary range").locator("input").fill(v.salaryRange);
  await jl("Vacancies").locator("input").fill(v.vacancies);
  await jl("Display order").locator("input").fill(v.displayOrder);
  for (const key of ["Description", "Responsibilities", "Required qualifications", "Required skills", "Benefits"]) await jl(key).locator("textarea").fill(`${key} for ${tag}`);
  await jl("Application deadline").locator("input").fill(v.deadline);
}

await check(["UI-610", "UI-611", "UI-612", "UI-613", "UI-614", "UI-615"], "Rich text editor: Bold/Italic/List insert markup and the preview renders it", async () => {
  await admin.getByRole("button", { name: /Add New Job/ }).click();
  const ed = jl("Description");
  const ta = ed.locator("textarea");
  await ta.fill("Intro ");
  await ta.evaluate((e) => e.setSelectionRange(e.value.length, e.value.length));
  await ed.getByRole("button", { name: "Bold" }).click();
  expect((await ta.inputValue()) === "Intro **text**", "bold: " + (await ta.inputValue()));
  await ta.evaluate((e) => e.setSelectionRange(e.value.length, e.value.length));
  await ta.press("End");
  await ta.type(" and ");
  await ed.getByRole("button", { name: "Italic" }).click();
  expect((await ta.inputValue()).includes("*text*"), "italic missing: " + (await ta.inputValue()));
  await ta.press("End");
  await ta.type("\n");
  await ed.getByRole("button", { name: "Bulleted list" }).click();
  expect(/\n- text$/.test(await ta.inputValue()), "list markup missing: " + JSON.stringify(await ta.inputValue()));
  const details = ed.locator("details");
  expect(!(await details.evaluate((d) => d.open)), "preview open by default");
  await ed.locator("summary", { hasText: "Preview formatted text" }).click();
  expect(await details.evaluate((d) => d.open), "summary did not open preview");
  expect((await details.locator("strong").first().innerText()) === "text", "bold not rendered in preview");
  expect((await details.locator("em").count()) >= 1, "italic not rendered");
  expect((await details.locator("p.career-rich-bullet").innerText()).startsWith("•"), "bullet not rendered");
  await jobModal().getByRole("button", { name: "×" }).click();
}, admin);

await check(["UI-678", "UI-679", "UI-680", "UI-681", "UI-676"], "Create an Active, published job: every field is persisted", async () => {
  await admin.getByRole("button", { name: /Add New Job/ }).click();
  await fillJob();
  await jl("Description").locator("textarea").fill(`**Grow** with us ${tag}\n- Talk to customers`);
  await jl("employmentType").locator("select").selectOption("Contract");
  await jl("workMode").locator("select").selectOption("Hybrid");
  await jl("status").locator("select").selectOption("Active");
  await jobModal().locator("label.career-checkbox input").check();
  const [r] = await Promise.all([admin.waitForResponse((x) => x.url().endsWith("/api/careers/admin/jobs") && x.request().method() === "POST"), jobModal().getByRole("button", { name: "Save Job" }).click()]);
  expect(r.status() === 201, "create job " + r.status());
  await jobModal().waitFor({ state: "detached" });
  await jobRow(jobTitle).waitFor();
  const row = await D.one("select * from career_jobs where title=$1", [jobTitle]);
  expect(row, "job not stored");
  jobId = row.id;
  const want = { department: jobDept, location: jobLoc, employment_type: "Contract", work_mode: "Hybrid", experience: "1-3 years", salary_range: "3-5 LPA", vacancies: 2, display_order: 1, status: "ACTIVE", is_published: true };
  for (const [k, v] of Object.entries(want)) expect(row[k] === v, `${k}=${row[k]} expected ${v}`);
  expect(row.published_at && !row.archived_at && row.description.startsWith("**Grow**") && row.benefits === `Benefits for ${tag}`, "publish/description mismatch");
  expect(new Date(row.deadline).toISOString().startsWith("2030-12-31T18:29:59"), "deadline not end of day IST: " + row.deadline.toISOString());
  return "career_jobs " + jobId;
}, admin);

await check(["UI-667"], "Edit job: form is prefilled and the change is persisted", async () => {
  await jobRow(jobTitle).getByRole("button", { name: "Edit" }).click();
  await jobModal().getByRole("heading", { name: "Edit Job" }).waitFor();
  expect((await jl("Job title").locator("input").inputValue()) === jobTitle, "title not prefilled");
  expect((await jl("Application deadline").locator("input").inputValue()) === "2030-12-31", "deadline not prefilled");
  await jl("Experience required").locator("input").fill("2-4 years");
  const [r] = await Promise.all([admin.waitForResponse((x) => x.url().endsWith(`/api/careers/admin/jobs/${jobId}`) && x.request().method() === "PUT"), jobModal().getByRole("button", { name: "Save Job" }).click()]);
  expect(r.status() === 200, "edit status " + r.status());
  const row = await D.one("select experience, title, deadline from career_jobs where id=$1", [jobId]);
  expect(row.experience === "2-4 years" && row.title === jobTitle, "edit not stored: " + JSON.stringify(row));
}, admin);

await check(["UI-668"], "Duplicate job opens a Draft copy that saves as a new job", async () => {
  await jobRow(jobTitle).getByRole("button", { name: "Duplicate" }).click();
  await jobModal().getByRole("heading", { name: "Add Job" }).waitFor();
  expect((await jl("Job title").locator("input").inputValue()) === `${jobTitle} (copy)`, "copy title wrong");
  expect((await jl("status").locator("select").inputValue()) === "Draft" && !(await jobModal().locator("label.career-checkbox input").isChecked()), "copy not Draft/unpublished");
  const saved = admin.waitForResponse((x) => x.url().endsWith("/api/careers/admin/jobs") && x.request().method() === "POST", { timeout: 5000 }).catch(() => null);
  await jobModal().getByRole("button", { name: "Save Job" }).click();
  const r = await saved;
  if (!r) {
    const deadline = await jl("Application deadline").locator("input").evaluate((e) => ({ value: e.value, missing: e.validity.valueMissing }));
    await jobModal().getByRole("button", { name: "×" }).click().catch(() => {});
    throw new Error(`Save Job on the duplicate did nothing: deadline input value="${deadline.value}" valueMissing=${deadline.missing} (copied ISO timestamp is not a valid date-input value)`);
  }
  expect(r.status() === 201, "duplicate save " + r.status());
  const copy = await D.one("select status, is_published, department from career_jobs where title=$1", [`${jobTitle} (copy)`]);
  expect(copy && copy.status === "DRAFT" && !copy.is_published && copy.department === jobDept, "copy row: " + JSON.stringify(copy));
}, admin);

await check(["UI-669"], "Unpublish hides the job from the public list; Publish restores it", async () => {
  const publicHas = async () => (await (await admin.request.get(base + "/api/careers/jobs?limit=100")).json()).jobs.some((j) => j._id === jobId);
  const toggle = (name) => Promise.all([admin.waitForResponse((x) => x.url().endsWith(`/api/careers/admin/jobs/${jobId}`) && x.request().method() === "PUT"), jobRow(jobTitle).getByRole("button", { name, exact: true }).click()]);
  const [r1] = await toggle("Unpublish");
  expect(r1.status() === 200, "unpublish " + r1.status());
  await jobRow(jobTitle).getByRole("button", { name: "Publish", exact: true }).waitFor();
  expect((await D.one("select is_published from career_jobs where id=$1", [jobId])).is_published === false, "still published");
  expect(!(await publicHas()), "unpublished job still public");
  const [r2] = await toggle("Publish");
  expect(r2.status() === 200, "publish " + r2.status());
  await jobRow(jobTitle).getByRole("button", { name: "Unpublish", exact: true }).waitFor();
  expect((await D.one("select is_published from career_jobs where id=$1", [jobId])).is_published === true && (await publicHas()), "republish failed");
}, admin);

// 21 extra draft jobs (own records) so the 20-per-page list has a second page.
const pageTag = `SS Page ${tag}`;
await D.db.query(`insert into career_jobs (id, title, department, location, employment_type, work_mode, experience, vacancies, description, responsibilities, qualifications, skills, deadline, status, is_published, updated_at)
  select gen_random_uuid(), $1 || ' ' || lpad(g::text, 2, '0'), 'SS Paging', 'Remote', 'Full-time', 'Remote', 'Any', 1, 'd', 'r', 'q', 's', '2030-12-31', 'DRAFT', false, now() from generate_series(1, 21) g`, [pageTag]);

await check(["UI-660", "UI-661", "UI-666"], "Jobs search and status filter narrow the table", async () => {
  const search = admin.locator(".career-admin-filters input").first();
  await Promise.all([admin.waitForResponse((r) => r.url().includes("/api/careers/admin/jobs?") && r.url().includes(encodeURIComponent(`SS Role ${tag}`).replace(/%20/g, "+"))), search.fill(`SS Role ${tag}`)]);
  await admin.waitForTimeout(300);
  const titles = await admin.locator(".career-table-wrap tbody tr td strong").allInnerTexts();
  expect(titles.length === 2 && titles.every((t) => t.startsWith(`SS Role ${tag}`)), "search rows: " + titles);
  await Promise.all([admin.waitForResponse((r) => r.url().includes("/api/careers/admin/jobs?") && r.url().includes("status=Draft")), admin.locator(".career-admin-filters select").first().selectOption("Draft")]);
  await admin.waitForTimeout(300);
  const rows = await admin.locator(".career-table-wrap tbody tr").allInnerTexts();
  expect(rows.length === 1 && rows[0].includes("(copy)") && rows[0].includes("Draft"), "status filter rows: " + rows);
  await admin.locator(".career-admin-filters select").first().selectOption("");
}, admin);

await check(["UI-674", "UI-675"], "Jobs pagination: Next shows page 2, Previous returns to page 1", async () => {
  const search = admin.locator(".career-admin-filters input").first();
  await search.fill(pageTag);
  await admin.locator(".career-pagination").filter({ hasText: "Page 1 of 2" }).waitFor();
  const prev = admin.getByRole("button", { name: "Previous" });
  const next = admin.getByRole("button", { name: "Next" });
  expect(await prev.isDisabled(), "Previous enabled on page 1");
  expect((await admin.locator(".career-table-wrap tbody tr").count()) === 20, "page 1 not 20 rows");
  await Promise.all([admin.waitForResponse((r) => r.url().includes("/api/careers/admin/jobs?") && r.url().includes("page=2")), next.click()]);
  await admin.locator(".career-pagination").filter({ hasText: "Page 2 of 2" }).waitFor();
  await admin.waitForTimeout(300);
  expect((await admin.locator(".career-table-wrap tbody tr").count()) === 1 && (await next.isDisabled()), "page 2 wrong");
  await Promise.all([admin.waitForResponse((r) => r.url().includes("/api/careers/admin/jobs?") && r.url().includes("page=1")), prev.click()]);
  await admin.locator(".career-pagination").filter({ hasText: "Page 1 of 2" }).waitFor();
  await search.fill("");
}, admin);

await check(["UI-670"], "Delete (archive) job: cancelling the confirm keeps it; confirming archives it", async () => {
  const copyTitle = `${jobTitle} (copy)`;
  expect(await D.one("select id from career_jobs where title=$1", [copyTitle]), "no copy to archive (duplicate failed)");
  await admin.locator(".career-admin-filters input").first().fill(copyTitle);
  await jobRow(copyTitle).waitFor();
  admin.once("dialog", (d) => d.dismiss());
  await jobRow(copyTitle).getByRole("button", { name: "Delete" }).click();
  await admin.waitForTimeout(500);
  expect((await D.one("select archived_at from career_jobs where title=$1", [copyTitle])).archived_at === null, "archived despite cancel");
  admin.once("dialog", (d) => { expect(d.message().includes(copyTitle), "confirm text"); d.accept(); });
  const [r] = await Promise.all([admin.waitForResponse((x) => x.url().includes("/api/careers/admin/jobs/") && x.request().method() === "DELETE"), jobRow(copyTitle).getByRole("button", { name: "Delete" }).click()]);
  expect(r.status() === 200, "archive " + r.status());
  const row = await D.one("select archived_at, status, is_published from career_jobs where title=$1", [copyTitle]);
  expect(row.archived_at && row.status === "CLOSED" && !row.is_published, "archive row: " + JSON.stringify(row));
  await jobRow(copyTitle).locator("[data-status=Closed]").waitFor();
  await admin.locator(".career-admin-filters input").first().fill("");
}, admin);

// ---------- Public careers page
const appName = `SS Applicant ${tag}`;
const appName2 = `SS Second ${tag}`;
let appId = null, appId2 = null;
const card = () => page.locator("article.job-card").filter({ has: page.getByRole("heading", { name: jobTitle, exact: true }) });

await check(["UI-617", "UI-616"], "See open roles and banner slides jump to the openings section", async () => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base + "/careers");
  await page.getByRole("link", { name: /See open roles/ }).click();
  await page.waitForFunction(() => location.hash === "#open-positions");
  await page.evaluate(() => { history.replaceState(null, "", "/careers"); window.scrollTo(0, 0); });
  const slide = page.locator(".swiper-slide-active a.careers-banner-slide");
  expect(/Explore current openings: banner \d/.test(await slide.getAttribute("aria-label")), "banner label");
  await slide.click();
  await page.waitForFunction(() => location.hash === "#open-positions");
  await page.waitForFunction(() => document.getElementById("open-positions").getBoundingClientRect().top < window.innerHeight);
}, page);

await check(["UI-618", "UI-619", "UI-620", "UI-621"], "Public job search and Department/Location/Type filters narrow the roles", async () => {
  await page.goto(base + "/careers");
  await card().waitFor();
  const titles = () => page.locator("article.job-card h3").allInnerTexts();
  await page.getByLabel("Search job title").fill(`ss role ${tag}`);
  expect(JSON.stringify(await titles()) === JSON.stringify([jobTitle]), "search: " + (await titles()));
  await page.locator(".careers-openings-count").filter({ hasText: "1 role available" }).waitFor();
  await page.getByLabel("Search job title").fill("");
  await page.getByLabel("Department").selectOption(jobDept);
  expect(JSON.stringify(await titles()) === JSON.stringify([jobTitle]), "department: " + (await titles()));
  await page.getByLabel("Department").selectOption("");
  await page.getByLabel("Location").selectOption(jobLoc);
  expect(JSON.stringify(await titles()) === JSON.stringify([jobTitle]), "location: " + (await titles()));
  await page.getByLabel("Location").selectOption("");
  await page.getByLabel("Employment type").selectOption("Contract");
  const types = await page.locator("article.job-card .career-role-meta").allInnerTexts();
  expect((await titles()).includes(jobTitle) && types.every((t) => t.includes("Contract")), "type filter: " + types);
  await page.getByLabel("Employment type").selectOption("");
}, page);

await check(["UI-622", "UI-625", "UI-624", "UI-626", "UI-627"], "View Details dialog: content, click-inside keeps it, backdrop/Close dismiss, Apply Now switches to the form", async () => {
  await card().getByRole("button", { name: "View Details" }).click();
  const dlg = page.getByRole("dialog", { name: "Job details" });
  await dlg.getByRole("heading", { name: jobTitle }).waitFor();
  expect((await dlg.locator("strong").first().innerText()) === "Grow" && (await dlg.innerText()).includes("Contract · Hybrid"), "details content");
  await dlg.getByRole("heading", { name: jobTitle }).click();
  expect(await dlg.isVisible(), "click inside closed the dialog");
  await page.locator(".career-modal-backdrop").click({ position: { x: 5, y: 5 } });
  await dlg.waitFor({ state: "detached" });
  await card().getByRole("button", { name: "View Details" }).click();
  await dlg.getByRole("button", { name: "Close" }).click();
  await dlg.waitFor({ state: "detached" });
  await card().getByRole("button", { name: "View Details" }).click();
  await dlg.getByRole("button", { name: "Apply Now" }).click();
  await page.getByRole("dialog", { name: "Apply for job" }).getByRole("heading", { name: `Apply for ${jobTitle}` }).waitFor();
  expect((await dlg.count()) === 0, "details dialog still open");
}, page);

await check(["UI-629", "UI-628", "UI-630", "UI-623"], "Apply dialog: click-inside keeps it; backdrop and × close it; card Apply Now reopens it", async () => {
  const dlg = page.getByRole("dialog", { name: "Apply for job" });
  await dlg.locator(".career-application-intro").click();
  expect(await dlg.isVisible(), "click inside closed the form");
  await page.locator(".career-modal-backdrop").click({ position: { x: 3, y: 3 } });
  await dlg.waitFor({ state: "detached" });
  await card().getByRole("button", { name: /Apply Now/ }).click();
  await dlg.waitFor();
  await dlg.getByRole("button", { name: "Close application form" }).click();
  await dlg.waitFor({ state: "detached" });
  await card().getByRole("button", { name: /Apply Now/ }).click();
  await dlg.getByRole("heading", { name: `Apply for ${jobTitle}` }).waitFor();
}, page);

const ph = (p) => page.getByRole("dialog", { name: "Apply for job" }).getByPlaceholder(p, { exact: true });
await check(["UI-631", "UI-632", "UI-633", "UI-634", "UI-635", "UI-636", "UI-637", "UI-638", "UI-639", "UI-640", "UI-641", "UI-642", "UI-643"], "Apply with a PDF resume: native, resume-type and server validation, then the application is stored", async () => {
  const dlg = page.getByRole("dialog", { name: "Apply for job" });
  let applies = 0;
  const onReq = (r) => { if (r.url().endsWith("/api/careers/apply")) applies++; };
  page.on("request", onReq);
  await dlg.getByRole("button", { name: /Submit Application/ }).click();
  expect(await ph("Your full name").evaluate((e) => e.validity.valueMissing), "empty name not flagged");
  await ph("Your full name").fill(appName);
  await ph("you@example.com").fill(`ss.app${tag}@example.test`);
  await ph("Your contact number").fill("12345");
  await ph("City, State").fill("Pune, MH");
  await dlg.getByLabel(/Job Designation/).selectOption("Sales Executive");
  await dlg.getByLabel(/Highest Qualification/).selectOption("Graduate");
  await ph("e.g., 12th Commerce, B.A. English, BBA, B.Com, Diploma in IT").fill("B.Com");
  await ph("e.g., Fresher or 2 years").fill("2 years");
  const kr = dlg.locator("textarea").first();
  await kr.fill("Handled 40 calls a day");
  await dlg.getByText("22/2000 characters").waitFor();
  await ph("Company name").fill("Prev Co");
  await ph("Your current role").fill("Telecaller");
  await ph("Your expected salary").fill("4 LPA");
  await ph("e.g., Immediate or 30 days").fill("30 days");
  await ph("Tell us why this role interests you").fill(`Cover ${tag}`);
  await ph("Anything else you would like to share?").fill(`Comment ${tag}`);
  await dlg.locator("input[type=checkbox]").check();
  await dlg.locator("input[type=file]").setInputFiles({ name: "resume.txt", mimeType: "text/plain", buffer: Buffer.from("plain text") });
  await dlg.getByRole("button", { name: /Submit Application/ }).click();
  await dlg.getByRole("alert").filter({ hasText: "Attach a PDF, DOC, or DOCX resume of up to 5 MB." }).waitFor();
  expect(applies === 0, "invalid resume was sent");
  page.off("request", onReq);
  await dlg.locator("input[type=file]").setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: PDF });
  await dlg.getByText("resume.pdf").waitFor();
  const [bad] = await Promise.all([page.waitForResponse((r) => r.url().endsWith("/api/careers/apply")), dlg.getByRole("button", { name: /Submit Application/ }).click()]);
  expect(bad.status() === 400, "short phone accepted: " + bad.status());
  await dlg.getByRole("alert").filter({ hasText: "Please complete all required application fields." }).waitFor();
  expect((await D.count("select count(*) n from career_applications where full_name=$1", [appName])) === 0, "invalid application stored");
  await ph("Your contact number").fill("+91 98" + tag.padStart(8, "0"));
  const [ok] = await Promise.all([page.waitForResponse((r) => r.url().endsWith("/api/careers/apply")), dlg.getByRole("button", { name: /Submit Application/ }).click()]);
  expect(ok.status() === 201, "apply " + ok.status());
  appId = (await ok.json()).applicationId;
  await page.locator("p.career-notice").filter({ hasText: `Application submitted. Your ID is ${appId}.` }).waitFor();
  expect((await dlg.count()) === 0, "form not closed after success");
  const row = await D.one("select * from career_applications where id=$1", [appId]);
  const want = { job_id: jobId, job_title: jobTitle, department: jobDept, full_name: appName, email: `ss.app${tag}@example.test`, location: "Pune, MH", job_designation: "Sales Executive", qualification: "Graduate", stream: "B.Com", experience: "2 years", key_responsibilities: "Handled 40 calls a day", current_company: "Prev Co", designation: "Telecaller", expected_salary: "4 LPA", notice_period: "30 days", cover_letter: `Cover ${tag}`, comments: `Comment ${tag}`, consent: true, status: "NEW", resume_file_name: "resume.pdf" };
  for (const [k, v] of Object.entries(want)) expect(row?.[k] === v, `${k}=${row?.[k]} expected ${v}`);
  expect(row.resume_path?.endsWith(".pdf"), "resume path");
  return "career_applications " + appId;
}, page);

await check([], "Second public application (fixture for the delete control)", async () => {
  await card().getByRole("button", { name: /Apply Now/ }).click();
  const dlg = page.getByRole("dialog", { name: "Apply for job" });
  await ph("Your full name").fill(appName2);
  await ph("you@example.com").fill(`ss.app2${tag}@example.test`);
  await ph("Your contact number").fill("+91 97" + tag.padStart(8, "0"));
  await ph("City, State").fill("Delhi");
  await dlg.getByLabel(/Job Designation/).selectOption("Telesales");
  await dlg.getByLabel(/Highest Qualification/).selectOption("12th");
  await ph("e.g., Fresher or 2 years").fill("Fresher");
  await ph("e.g., Immediate or 30 days").fill("Immediate");
  await dlg.locator("input[type=checkbox]").check();
  await dlg.locator("input[type=file]").setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: PDF });
  const [ok] = await Promise.all([page.waitForResponse((r) => r.url().endsWith("/api/careers/apply")), dlg.getByRole("button", { name: /Submit Application/ }).click()]);
  expect(ok.status() === 201, "apply " + ok.status());
  appId2 = (await ok.json()).applicationId;
}, page);

// ---------- Admin: applications
const appsWait = (frag) => admin.waitForResponse((r) => r.url().includes("/api/careers/admin/applications?") && (!frag || r.url().includes(frag)) && r.status() === 200);
const appRows = () => admin.locator(".career-table-wrap tbody tr");
const filt = admin.locator(".career-admin-filters");

await check(["UI-658", "UI-659"], "Overview stats match the database; recent application opens the candidate; Quick Add Job opens the job form", async () => {
  const [res] = await Promise.all([admin.waitForResponse((r) => r.url().endsWith("/api/careers/admin/stats") && r.status() === 200), nav("Overview").click()]);
  const stats = await res.json();
  const db = await D.one(`select (select count(*)::int from career_jobs) "totalJobs", (select count(*)::int from career_jobs where status='ACTIVE') "activeJobs", (select count(*)::int from career_jobs where status='DRAFT') "draftJobs", (select count(*)::int from career_jobs where status='CLOSED') "closedJobs", (select count(*)::int from career_applications) "totalApplications", (select count(*)::int from career_applications where status='NEW') "newApplications"`);
  for (const [k, label] of [["totalJobs", "Total Job Posts"], ["activeJobs", "Active Jobs"], ["draftJobs", "Draft Jobs"], ["closedJobs", "Closed Jobs"], ["totalApplications", "Total Applications"], ["newApplications", "New Applications"]]) {
    expect(stats[k] === db[k], `${k} api ${stats[k]} db ${db[k]}`);
    const shown = await admin.locator(".career-stats article").filter({ hasText: label }).locator("strong").innerText();
    expect(Number(shown) === db[k], `${label} shows ${shown}, db ${db[k]}`);
  }
  const recent = admin.locator(".career-panels button").filter({ hasText: `${appName2} · ${jobTitle} · New` });
  await recent.click();
  await admin.getByRole("heading", { level: 1, name: "Applications" }).waitFor();
  await admin.locator(".career-admin-modal h2", { hasText: appName2 }).waitFor();
  await admin.locator(".career-admin-modal").getByRole("button", { name: "×" }).click();
  await nav("Overview").click();
  await admin.getByRole("button", { name: "Quick Add Job" }).click();
  await jobModal().getByRole("heading", { name: "Add Job" }).waitFor();
  await admin.getByRole("heading", { level: 1, name: "Manage Jobs" }).waitFor();
  await jobModal().getByRole("button", { name: "×" }).click();
}, admin);

await check(["UI-660", "UI-661", "UI-662", "UI-664", "UI-665", "UI-671"], "Applications search, status, job, department and From-date filters narrow the table", async () => {
  await Promise.all([appsWait(), nav("Applications").click()]);
  const names = async () => { await admin.waitForTimeout(400); return (await appRows().locator("td:first-child").allInnerTexts()).map((t) => t.split("\n")[0]); };
  await Promise.all([appsWait("search=SS"), filt.locator("input").first().fill(`SS `)]).catch(() => {});
  await Promise.all([appsWait(tag), filt.locator("input").first().fill(tag)]);
  let n = await names();
  expect(n.length === 2 && n.includes(appName) && n.includes(appName2), "search rows: " + n);
  await Promise.all([appsWait("status=Hired"), filt.locator("select").first().selectOption("Hired")]);
  expect((await names()).length === 0, "status Hired shows rows");
  await Promise.all([appsWait("status=New"), filt.locator("select").first().selectOption("New")]);
  expect((await names()).length === 2, "status New lost rows");
  await Promise.all([appsWait("status="), filt.locator("select").first().selectOption("")]);
  await Promise.all([appsWait(`jobId=${jobId}`), filt.locator("select").nth(1).selectOption(jobId)]);
  n = await names();
  expect(n.length === 2, "job filter rows: " + n);
  await Promise.all([appsWait("department=zzz"), filt.getByLabel("Department").fill("zzz")]);
  expect((await names()).length === 0, "bogus department shows rows");
  await Promise.all([appsWait("department=" + encodeURIComponent(jobDept).replace(/%20/g, "+")), filt.getByLabel("Department").fill(jobDept)]);
  expect((await names()).length === 2, "department filter lost rows");
  const created = (await D.one("select created_at from career_applications where id=$1", [appId])).created_at;
  const day = created.toISOString().slice(0, 10);
  const next = new Date(created.getTime() + 86400000).toISOString().slice(0, 10);
  await Promise.all([appsWait("from=" + next), filt.getByLabel("From date").fill(next)]);
  expect((await names()).length === 0, "From tomorrow still shows today's rows");
  await Promise.all([appsWait("from=" + day), filt.getByLabel("From date").fill(day)]);
  expect((await names()).length === 2, "From today hides today's rows");
  await Promise.all([appsWait("from=&"), filt.getByLabel("From date").fill("")]);
}, admin);

await check(["UI-663"], "Applications To-date filter includes applications submitted on that day", async () => {
  const day = (await D.one("select created_at from career_applications where id=$1", [appId])).created_at.toISOString().slice(0, 10);
  const [res] = await Promise.all([appsWait("to=" + day), filt.getByLabel("To date").fill(day)]);
  const body = await res.json();
  await filt.getByLabel("To date").fill("");
  await appsWait("to=&").catch(() => {});
  const ids = body.applications.map((a) => a._id);
  expect(ids.includes(appId), `To=${day} returned ${ids.length} rows and excluded the application submitted on ${day}`);
}, admin);

await check(["UI-672", "UI-683", "UI-684", "UI-682"], "View candidate: details shown, resume preview opens, download is the uploaded PDF, × closes", async () => {
  const row = appRows().filter({ hasText: appName });
  const [r] = await Promise.all([admin.waitForResponse((x) => x.url().endsWith(`/api/careers/admin/applications/${appId}`) && x.status() === 200), row.getByRole("button", { name: "View" }).click()]);
  expect((await r.json())._id === appId, "wrong candidate");
  const modal = admin.locator(".career-admin-modal");
  await modal.locator("h2", { hasText: appName }).waitFor();
  const text = await modal.innerText();
  for (const v of [`Application ID: ${appId}`, "Sales Executive", "Graduate", "Handled 40 calls a day", `Cover ${tag}`, "30 days"]) expect(text.includes(v), "candidate modal missing " + v);
  const popP = adminCtx.waitForEvent("page");
  const [pr] = await Promise.all([admin.waitForResponse((x) => x.url().includes(`/applications/${appId}/resume`) && !x.url().includes("download")), modal.getByRole("button", { name: "Preview Resume" }).click()]);
  expect(pr.status() === 200 && pr.headers()["content-type"] === "application/pdf" && pr.headers()["content-disposition"].startsWith("inline"), "preview response " + pr.status());
  const pop = await popP;
  expect(pop.url().startsWith("blob:"), "preview did not open the resume: " + pop.url());
  await pop.close();
  const [dl] = await Promise.all([admin.waitForEvent("download"), modal.getByRole("button", { name: "Download Resume" }).click()]);
  expect(dl.suggestedFilename() === `resume-${appId}`, "download name " + dl.suggestedFilename());
  const bytes = readFileSync(await dl.path());
  expect(bytes.equals(PDF), "downloaded resume differs from the uploaded PDF");
  await modal.getByRole("button", { name: "×" }).click();
  expect((await modal.count()) === 0, "× did not close");
}, admin);

await check(["UI-685", "UI-686", "UI-687"], "Change application status and HR notes: persisted and reflected in the table", async () => {
  const row = appRows().filter({ hasText: appName });
  await row.getByRole("button", { name: "View" }).click();
  const modal = admin.locator(".career-admin-modal");
  await modal.getByLabel("Status").selectOption("Shortlisted");
  await modal.getByLabel("Internal HR notes").fill(`Strong call skills ${tag}`);
  const [r] = await Promise.all([admin.waitForResponse((x) => x.url().endsWith(`/api/careers/admin/applications/${appId}`) && x.request().method() === "PATCH"), modal.getByRole("button", { name: "Save Changes" }).click()]);
  expect(r.status() === 200, "patch " + r.status());
  await modal.waitFor({ state: "detached" });
  const dbRow = await D.one("select status, admin_notes from career_applications where id=$1", [appId]);
  expect(dbRow.status === "SHORTLISTED" && dbRow.admin_notes === `Strong call skills ${tag}`, "row: " + JSON.stringify(dbRow));
  await appRows().filter({ hasText: appName }).locator("[data-status=Shortlisted]").waitFor();
}, admin);

await check(["UI-653"], "Export CSV downloads the filtered applications with the stored values", async () => {
  const [dl] = await Promise.all([admin.waitForEvent("download"), admin.getByRole("button", { name: /Export CSV/ }).click()]);
  expect(dl.suggestedFilename() === "career-applications.csv", "filename " + dl.suggestedFilename());
  const csv = readFileSync(await dl.path(), "utf8").replace(/^﻿/, "");
  const lines = csv.trim().split("\n");
  expect(lines[0].startsWith('"applicationId","jobId","jobTitle"'), "header " + lines[0].slice(0, 60));
  const n = await D.count("select count(*) n from career_applications where full_name ilike $1 or email ilike $1 or phone ilike $1 or job_title ilike $1", [`%${tag}%`]);
  expect(lines.length - 1 === n, `csv rows ${lines.length - 1} != db ${n}`);
  const mine = lines.find((l) => l.startsWith(`"${appId}"`));
  expect(mine && mine.includes('"Shortlisted"') && mine.includes(`"Strong call skills ${tag}"`), "export row missing values");
}, admin);

await check(["UI-653", "UI-662"], "Export CSV honours the From-date filter shown on screen", async () => {
  const created = (await D.one("select created_at from career_applications where id=$1", [appId])).created_at;
  const next = new Date(created.getTime() + 86400000).toISOString().slice(0, 10);
  await Promise.all([appsWait("from=" + next), filt.getByLabel("From date").fill(next)]);
  await admin.waitForTimeout(300);
  const visible = await appRows().count();
  const [dl] = await Promise.all([admin.waitForEvent("download"), admin.getByRole("button", { name: /Export CSV/ }).click()]);
  const rows = readFileSync(await dl.path(), "utf8").trim().split("\n").length - 1;
  await filt.getByLabel("From date").fill("");
  await appsWait("from=&").catch(() => {});
  expect(rows === visible, `table shows ${visible} rows for From=${next} but the export contains ${rows}`);
}, admin);

await check(["UI-673"], "Delete application: cancel keeps it, confirm removes the row", async () => {
  const row = () => appRows().filter({ hasText: appName2 });
  admin.once("dialog", (d) => d.dismiss());
  await row().getByRole("button", { name: "Delete" }).click();
  await admin.waitForTimeout(500);
  expect((await D.count("select count(*) n from career_applications where id=$1", [appId2])) === 1, "deleted despite cancel");
  admin.once("dialog", (d) => d.accept());
  const [r] = await Promise.all([admin.waitForResponse((x) => x.url().endsWith(`/api/careers/admin/applications/${appId2}`) && x.request().method() === "DELETE"), row().getByRole("button", { name: "Delete" }).click()]);
  expect(r.status() === 200, "delete " + r.status());
  await row().waitFor({ state: "detached" });
  expect((await D.count("select count(*) n from career_applications where id=$1", [appId2])) === 0, "application still stored");
}, admin);

await check(["UI-670"], "Archiving the published job removes it from the public careers page", async () => {
  await nav("Manage Jobs").click();
  await admin.locator(".career-admin-filters input").first().fill(jobTitle);
  await jobRow(jobTitle).waitFor();
  admin.once("dialog", (d) => d.accept());
  const [r] = await Promise.all([admin.waitForResponse((x) => x.url().endsWith(`/api/careers/admin/jobs/${jobId}`) && x.request().method() === "DELETE"), jobRow(jobTitle).getByRole("button", { name: "Delete" }).click()]);
  expect(r.status() === 200, "archive " + r.status());
  await page.goto(base + "/careers");
  await page.locator(".careers-openings-count").filter({ hasText: /available/ }).waitFor();
  expect((await card().count()) === 0, "archived job still listed publicly");
  expect((await D.one("select archived_at from career_jobs where id=$1", [jobId])).archived_at, "not archived");
}, admin);

await check(["UI-654", "UI-655", "UI-656", "UI-657"], "Change PIN: wrong current PIN is refused; valid change stores the new hash", async () => {
  await nav("Change PIN").click();
  const form = admin.locator("form.career-pin-form");
  await form.getByLabel("Current PIN").fill(PIN === "000000" ? "000001" : "000000");
  await form.getByLabel("New 6-digit PIN").fill(PIN2);
  const [bad] = await Promise.all([admin.waitForResponse((r) => r.url().endsWith("/api/careers/admin/change-pin")), form.getByRole("button", { name: "Change PIN" }).click()]);
  expect(bad.status() === 400, "wrong current PIN " + bad.status());
  await admin.locator(".career-admin-error").filter({ hasText: "Invalid current or new PIN." }).waitFor();
  expect(bcrypt.compareSync(PIN, (await D.one("select pin_hash from career_admin_settings where key='admin'")).pin_hash), "hash changed on failure");
  await form.getByLabel("Current PIN").fill(PIN);
  await form.getByLabel("New 6-digit PIN").fill(PIN2);
  const [ok] = await Promise.all([admin.waitForResponse((r) => r.url().endsWith("/api/careers/admin/change-pin")), form.getByRole("button", { name: "Change PIN" }).click()]);
  expect(ok.status() === 200, "change pin " + ok.status());
  await form.getByRole("status").filter({ hasText: "PIN changed." }).waitFor();
  expect((await form.getByLabel("Current PIN").inputValue()) === "", "inputs not cleared");
  expect(bcrypt.compareSync(PIN2, (await D.one("select pin_hash from career_admin_settings where key='admin'")).pin_hash), "new PIN not stored");
}, admin);

await check(["UI-651"], "Logout ends the PIN session; the new PIN unlocks again", async () => {
  const before = await D.count("select count(*) n from career_admin_sessions where expires_at > now()");
  const [r] = await Promise.all([admin.waitForResponse((x) => x.url().endsWith("/api/careers/admin/logout")), admin.getByRole("button", { name: /Logout/ }).click()]);
  expect(r.status() === 200, "logout " + r.status());
  await admin.getByPlaceholder("Enter 6-digit PIN").waitFor();
  expect((await D.count("select count(*) n from career_admin_sessions where expires_at > now()")) === before - 1, "session row not removed");
  const s = await admin.request.get(base + "/api/careers/admin/session");
  expect(s.status() === 401, "session still valid after logout: " + s.status());
  const old = await adminUnlock(PIN);
  expect(old.status() === 401, "old PIN still accepted");
  const ok = await adminUnlock(PIN2);
  expect(ok.status() === 200, "new PIN rejected " + ok.status());
  await admin.getByRole("heading", { name: "Dashboard Overview" }).waitFor();
  await D.db.query("delete from career_login_attempts");
}, admin);

await check(["UI-650", "UI-648"], "Workspace Public Careers and brand links reach the public site", async () => {
  await followLink(admin, admin.locator(".career-admin-side-bottom").getByRole("link", { name: /Public Careers/ }), "/careers", adminErrs);
  await admin.goto(base + "/careers/admin");
  await admin.getByRole("heading", { name: "Dashboard Overview" }).waitFor();
  await followLink(admin, admin.locator("a.career-admin-sidebar-brand"), "/", adminErrs);
  await admin.locator("h1.hero-title").waitFor();
}, admin);

await D.db.query("delete from career_jobs where title like $1 and not exists (select 1 from career_applications a where a.job_id = career_jobs.id)", [`${pageTag}%`]);

// =====================================================================================================
// CRM app shell (ADMIN)
// =====================================================================================================
const crmErrs = adminErrs;
await check(["UI-356"], "Every sidebar link navigates to a rendering page and is marked current", async () => {
  await admin.goto(base + "/crm/entrydashboard");
  const hrefs = await admin.locator("aside.sidebar nav > .nav-group > a.side-link").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(hrefs.length >= 15, "few links: " + hrefs.length);
  for (const href of hrefs) {
    const link = admin.locator(`aside.sidebar nav > .nav-group > a.side-link[href="${href}"]`);
    await followLink(admin, link, href, crmErrs);
    expect((await link.getAttribute("aria-current")) === "page", `${href} not marked current`);
    expect((await admin.getByText("The page could not be loaded").count()) === 0, `${href} hit the error boundary`);
  }
  return `${hrefs.length} links`;
}, admin);

await check(["UI-357", "UI-358", "UI-368"], "Vendors section expands, child link navigates; breadcrumb parent link navigates back", async () => {
  await admin.goto(base + "/crm/entrydashboard");
  const sec = admin.locator("aside.sidebar").getByRole("button", { name: "Vendors" });
  expect((await sec.getAttribute("aria-expanded")) === "false", "section open initially");
  await sec.click();
  expect((await sec.getAttribute("aria-expanded")) === "true", "section did not expand");
  await followLink(admin, admin.locator(".side-sub").getByRole("link", { name: "Active" }), "/crm/vendors/active", crmErrs);
  const crumb = admin.locator("nav.crumbs").getByRole("link", { name: "Vendors" });
  await followLink(admin, crumb, "/crm/vendors", crmErrs);
  expect((await admin.locator("nav.crumbs li[aria-current=page]").innerText()).includes("All vendors"), "breadcrumb not updated");
  await sec.click();
  expect((await sec.getAttribute("aria-expanded")) === "false", "section did not collapse");
}, admin);

await check(["UI-361"], "Brand link returns to the dashboard", async () => {
  await admin.goto(base + "/crm/activity-log");
  await followLink(admin, admin.getByRole("link", { name: "MF Global CRM home" }), "/crm/entrydashboard", crmErrs);
}, admin);

await check(["UI-360"], "Skip to content is the first tab stop and moves focus to the main region", async () => {
  await admin.goto(base + "/crm/entrydashboard");
  await admin.keyboard.press("Tab");
  expect((await admin.evaluate(() => document.activeElement?.textContent)) === "Skip to content", "skip link not first tab stop");
  await admin.keyboard.press("Enter");
  await admin.waitForFunction(() => location.hash === "#main" && document.activeElement?.id === "main");
}, admin);

await check(["UI-362", "UI-364"], "Collapse sidebar persists the rail; Expand restores it", async () => {
  await admin.goto(base + "/crm/entrydashboard");
  await admin.getByRole("button", { name: "Collapse sidebar" }).click();
  expect((await admin.evaluate(() => [document.documentElement.dataset.sidebar, localStorage.getItem("mf-crm-sidebar")])).join() === "collapsed,collapsed", "not collapsed");
  const w = (await admin.locator("aside.sidebar").boundingBox()).width;
  await admin.reload();
  expect((await admin.evaluate(() => document.documentElement.dataset.sidebar)) === "collapsed", "collapse not persisted across reload");
  await admin.getByRole("button", { name: "Expand sidebar" }).click();
  expect((await admin.evaluate(() => [document.documentElement.dataset.sidebar ?? "", localStorage.getItem("mf-crm-sidebar")])).join() === ",expanded", "not expanded");
  expect((await admin.locator("aside.sidebar").boundingBox()).width > w, "sidebar width did not grow");
}, admin);

await check(["UI-373"], "Theme toggle switches dark/light and persists the preference", async () => {
  await admin.goto(base + "/crm/entrydashboard");
  await admin.getByRole("button", { name: "Switch to dark theme" }).click();
  expect((await admin.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem("mf-crm-theme")])).join() === "dark,dark", "dark not applied");
  await admin.reload();
  expect((await admin.evaluate(() => document.documentElement.dataset.theme)) === "dark", "dark not persisted");
  await admin.getByRole("button", { name: "Switch to light theme" }).click();
  expect((await admin.evaluate(() => [document.documentElement.dataset.theme ?? "", localStorage.getItem("mf-crm-theme")])).join() === ",light", "light not applied");
}, admin);

await check(["UI-374", "UI-359"], "Account menu shows the user and its theme radio items apply Light/Dark/System", async () => {
  await admin.goto(base + "/crm/entrydashboard");
  const btn = admin.getByRole("button", { name: "Account menu" });
  await btn.click();
  const menu = admin.getByRole("menu", { name: "Account" });
  expect((await menu.innerText()).includes("qa.admin@example.test") && (await btn.getAttribute("aria-expanded")) === "true", "account menu content");
  await menu.getByRole("menuitemradio", { name: "Dark" }).click();
  expect((await admin.evaluate(() => document.documentElement.dataset.theme)) === "dark" && (await menu.getByRole("menuitemradio", { name: "Dark" }).getAttribute("aria-checked")) === "true", "Dark item");
  await menu.getByRole("menuitemradio", { name: "System" }).click();
  expect((await admin.evaluate(() => localStorage.getItem("mf-crm-theme"))) === "system", "System item");
  await menu.getByRole("menuitemradio", { name: "Light" }).click();
  expect((await admin.evaluate(() => [document.documentElement.dataset.theme ?? "", localStorage.getItem("mf-crm-theme")])).join() === ",light", "Light item");
  await admin.keyboard.press("Escape");
  await menu.waitFor({ state: "detached" });
}, admin);

await check(["UI-371", "UI-372"], "Create menu lists quick actions and New quotation opens the form", async () => {
  await admin.goto(base + "/crm/entrydashboard");
  await admin.getByRole("button", { name: "Create" }).click();
  const menu = admin.getByRole("menu", { name: "Create" });
  const items = await menu.getByRole("menuitem").allInnerTexts();
  expect(["New lead", "New quotation", "Import leads", "New product"].every((t) => items.includes(t)), "items: " + items);
  await followLink(admin, menu.getByRole("menuitem", { name: "New quotation" }), "/crm/quotations/create", crmErrs);
  await menu.waitFor({ state: "detached" });
  await admin.getByRole("button", { name: "Create" }).click();
  await followLink(admin, admin.getByRole("menu", { name: "Create" }).getByRole("menuitem", { name: "Import leads" }), "/crm/import-leads", crmErrs);
}, admin);

const leadName = (await D.one("select name from leads where name like 'E2E Lead %' order by name limit 1"))?.name;
await check(["UI-369", "UI-377", "UI-378"], "Command palette: Ctrl+K opens, record search hits the server, choosing a hit and a page navigates", async () => {
  await admin.goto(base + "/crm/entrydashboard");
  await admin.keyboard.press("Control+k");
  const dlg = admin.getByRole("dialog", { name: "Search and commands" });
  const input = dlg.getByRole("combobox", { name: "Search records and pages" });
  await input.waitFor();
  expect(await input.evaluate((e) => e === document.activeElement), "input not focused");
  await admin.keyboard.press("Control+k");
  await dlg.waitFor({ state: "detached" });
  await admin.getByRole("button", { name: /Search records or jump to/ }).click();
  await input.waitFor();
  expect(leadName, "no seeded lead to search for");
  const [res] = await Promise.all([admin.waitForResponse((r) => r.url().includes("/api/search?q=") && r.status() === 200), input.fill(leadName)]);
  const hit = (await res.json()).groups.flatMap((g) => g.hits).find((h) => h.title === leadName);
  expect(hit, "search API did not return the lead");
  const opt = dlg.getByRole("option").filter({ hasText: leadName }).first();
  await opt.waitFor();
  await Promise.all([admin.waitForURL((u) => u.pathname + u.search === hit.href || new URL(u).pathname === new URL(hit.href, base).pathname), opt.click()]);
  await admin.getByText(leadName).first().waitFor();
  const recent = await admin.evaluate(() => Object.entries(localStorage).find(([k]) => k.startsWith("mf-crm-recent:"))?.[1] ?? "");
  expect(recent.includes(hit.id), "chosen hit not stored in recents");
  await admin.keyboard.press("/");
  await input.fill("activity");
  const page2 = dlg.getByRole("option").filter({ hasText: "Activity log" });
  await page2.waitFor();
  await page2.hover();
  expect((await page2.getAttribute("aria-selected")) === "true", "hover did not select option");
  await Promise.all([admin.waitForURL("**/crm/activity-log"), admin.keyboard.press("Enter")]);
  await dlg.waitFor({ state: "detached" });
}, admin);

await check(["UI-377"], "Employee palette never offers admin-only pages", async () => {
  const ex = await exec1Ctx.newPage();
  try {
    await ex.goto(base + "/crm/entrydashboard");
    await ex.keyboard.press("Control+k");
    const input = ex.getByRole("combobox", { name: "Search records and pages" });
    await input.fill("user");
    await ex.waitForTimeout(800);
    const opts = await ex.getByRole("option").allInnerTexts();
    expect(!opts.some((o) => /User management|Activity log|All leads/.test(o)), "admin page offered: " + opts.join(" | "));
    expect((await ex.locator("aside.sidebar").getByRole("link", { name: "User management" }).count()) === 0, "admin link in employee sidebar");
  } finally { await ex.close(); }
}, admin);

// Mobile shell
const admMob = await signedIn(browser, "qa.admin", { viewport: { width: 390, height: 844 } });
const am = await admMob.newPage();
am.setDefaultTimeout(20000);
await check(["UI-366", "UI-367", "UI-365", "UI-363", "UI-370"], "Mobile shell: open drawer (button/icon), backdrop and Close dismiss it, mobile Search opens the palette", async () => {
  await am.goto(base + "/crm/entrydashboard");
  const shell = am.locator(".app-shell");
  const open = am.getByRole("button", { name: "Open navigation" });
  await open.click();
  expect((await shell.getAttribute("data-mobile-open")) === "true" && (await open.getAttribute("aria-expanded")) === "true", "drawer not open");
  await am.locator(".sidebar-backdrop").click({ position: { x: 370, y: 500 }, force: true });
  await am.waitForFunction(() => document.querySelector(".app-shell").dataset.mobileOpen === "false");
  await open.locator("svg").click();
  expect((await shell.getAttribute("data-mobile-open")) === "true", "menu icon did not open");
  await am.getByRole("button", { name: "Close navigation" }).click();
  expect((await shell.getAttribute("data-mobile-open")) === "false", "Close navigation did not close");
  await open.click();
  await followLink(am, am.locator("aside.sidebar").getByRole("link", { name: "Activity log" }), "/crm/activity-log", null);
  expect((await shell.getAttribute("data-mobile-open")) === "false", "drawer stays open after navigating");
  await am.getByRole("button", { name: "Search", exact: true }).click();
  await am.getByRole("dialog", { name: "Search and commands" }).waitFor();
  await am.keyboard.press("Escape");
}, am);
await admMob.close();

// error.tsx — the boundary is reached by injecting a malformed (null) product hit into the quotation form's live
// product search; the quotation form renders it and throws during render.
await check(["UI-50", "UI-51"], "CRM error boundary: injected render failure shows the safe message; Try again recovers; Go to dashboard navigates", async () => {
  await admin.goto(base + "/crm/quotations/create");
  const inject = (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"products":[null]}' });
  await admin.route("**/api/products/search?**", inject);
  try {
    await admin.getByLabel("Search products").fill("zz");
    await admin.getByText("The page could not be loaded. Your data has not been changed.").waitFor();
    expect(!(await admin.locator("main").innerText()).match(/TypeError|null|stack/i), "boundary leaks error details");
    expect(await admin.locator("aside.sidebar").isVisible(), "shell lost");
  } finally { await admin.unroute("**/api/products/search?**", inject); }
  await admin.getByRole("button", { name: "Try again" }).click();
  await admin.getByLabel("Search products").waitFor();
  expect((await admin.getByText("The page could not be loaded").count()) === 0, "Try again did not recover");
  await admin.route("**/api/products/search?**", inject);
  try {
    await admin.getByLabel("Search products").fill("zz");
    await admin.getByRole("link", { name: "Go to dashboard" }).waitFor();
  } finally { await admin.unroute("**/api/products/search?**", inject); }
  await Promise.all([admin.waitForURL("**/crm/entrydashboard"), admin.getByRole("link", { name: "Go to dashboard" }).click()]);
  expect((await admin.getByText("The page could not be loaded").count()) === 0, "dashboard shows the error");
}, admin);

// =====================================================================================================
// User management (ADMIN) + shared Modal / ConfirmDialog
// =====================================================================================================
const uname = `ss.user${tag}`;
const uemail = `${uname}@example.test`;
const uemail2 = `${uname}.new@example.test`;
const NEWPW = `Ss-New-Passw0rd-${tag}`;
const dialog = () => admin.getByRole("dialog");
const urow = () => admin.locator("tbody tr").filter({ hasText: "@" + uname });
const toast = (t) => admin.locator("[data-sonner-toast]").filter({ hasText: t });
let uid = null;

await check(["UI-208", "UI-209", "UI-219"], "Add user creates the account with its location; the table lists it", async () => {
  await admin.goto(base + "/crm/user-management");
  await admin.getByRole("button", { name: "Add user" }).click();
  await dialog().getByRole("heading", { name: "Register user" }).waitFor();
  await dialog().getByLabel(/Full name/).fill(`SS User ${tag}`);
  await dialog().getByLabel(/Username/).fill(uname);
  await dialog().getByLabel(/Work email/).fill(uemail);
  await dialog().getByLabel(/Temporary password/).fill(PASSWORD);
  await dialog().getByLabel("Location").fill("Okhla Office");
  await dialog().getByLabel("Role").selectOption("USER");
  await dialog().getByRole("button", { name: "Create user" }).click();
  await toast(`User SS User ${tag} created.`).waitFor();
  await dialog().waitFor({ state: "detached" });
  const u = await D.one("select id, location, role, enabled, auth_user_id from users where username=$1", [uname]);
  expect(u && u.location === "Okhla Office" && u.role === "USER" && u.enabled && u.auth_user_id, "user row: " + JSON.stringify(u));
  uid = u.id;
  expect((await D.count("select count(*) n from activity_logs where action='user.created' and details->>'targetUserId'=$1", [uid])) === 1, "creation not audited");
  const cells = await urow().locator("td").allInnerTexts();
  expect(cells[2] === uemail && cells[3] === "Okhla Office" && cells[4] === "User" && cells[5].includes("Enabled"), "table row: " + cells.join(" | "));
}, admin);

await check(["UI-225", "UI-553"], "Edit dialog: Cancel and the Close (×) button discard changes", async () => {
  await urow().getByRole("button", { name: "Edit" }).click();
  await dialog().getByLabel("Full name").fill("Should Not Save");
  await dialog().getByRole("button", { name: "Cancel" }).click();
  await dialog().waitFor({ state: "detached" });
  await urow().getByRole("button", { name: "Edit" }).click();
  expect((await dialog().getByLabel("Full name").inputValue()) === `SS User ${tag}`, "cancelled edit kept its value");
  await dialog().getByLabel("Location").fill("Should Not Save");
  await dialog().getByRole("button", { name: "Close dialog" }).click();
  await dialog().waitFor({ state: "detached" });
  const u = await D.one("select name, location from users where id=$1", [uid]);
  expect(u.name === `SS User ${tag}` && u.location === "Okhla Office", "discarded edit persisted: " + JSON.stringify(u));
}, admin);

await check(["UI-229", "UI-230"], "Edit email and location: validated, persisted, audited, sign-in email updated", async () => {
  await urow().getByRole("button", { name: "Edit" }).click();
  await dialog().getByLabel("Email").fill("bad-email");
  await dialog().getByRole("button", { name: "Save changes" }).click();
  expect(await dialog().getByLabel("Email").evaluate((e) => e.validity.typeMismatch), "invalid email not flagged");
  await dialog().getByLabel("Email").fill("qa.exec2@example.test");
  await dialog().getByRole("button", { name: "Save changes" }).click();
  await toast("This email is already in use by another user.").waitFor();
  expect(await dialog().isVisible(), "dialog closed on duplicate email");
  await dialog().getByLabel("Email").fill(uemail2);
  await dialog().getByLabel("Location").fill("Noida Office");
  await dialog().getByRole("button", { name: "Save changes" }).click();
  await toast("User details updated.").waitFor();
  await dialog().waitFor({ state: "detached" });
  const u = await D.one("select email, location from users where id=$1", [uid]);
  expect(u.email === uemail2 && u.location === "Noida Office", "edit row: " + JSON.stringify(u));
  const log = await D.one("select details from activity_logs where action='user.updated' and details->>'targetUserId'=$1 order by created_at desc limit 1", [uid]);
  expect(log?.details?.changes?.email?.new === uemail2 && log.details.changes.location?.new === "Noida Office", "audit: " + JSON.stringify(log));
  const cells = await urow().locator("td").allInnerTexts();
  expect(cells[2] === uemail2 && cells[3] === "Noida Office", "table not refreshed");
}, admin);

await check(["UI-222", "UI-232", "UI-233", "UI-235", "UI-236", "UI-237", "UI-234"], "Change password: mismatch is caught, Cancel discards, valid change is audited", async () => {
  const dis = admin.locator("tbody tr").filter({ hasText: "@qa.disabled" }).getByRole("button", { name: "Password" });
  expect((await dis.isDisabled()) && (await dis.getAttribute("title")) === "Enable the account first", "password control active for a disabled user");
  const audits = () => D.count("select count(*) n from activity_logs where action='user.password_changed' and details->>'targetUserId'=$1", [uid]);
  await urow().getByRole("button", { name: "Password" }).click();
  await dialog().getByRole("heading", { name: "Change password" }).waitFor();
  await dialog().getByLabel("New password").fill("short");
  await dialog().getByRole("button", { name: "Update password" }).click();
  expect(await dialog().getByLabel("New password").evaluate((e) => e.validity.tooShort), "short password not flagged");
  await dialog().getByLabel("New password").fill(NEWPW);
  await dialog().getByLabel("Confirm password").fill(NEWPW + "x");
  await dialog().getByRole("button", { name: "Update password" }).click();
  await dialog().getByRole("alert").filter({ hasText: "Passwords do not match." }).waitFor();
  expect((await dialog().getByLabel("Confirm password").getAttribute("aria-invalid")) === "true", "aria-invalid not set");
  await dialog().getByRole("button", { name: "Cancel" }).click();
  await dialog().waitFor({ state: "detached" });
  expect((await audits()) === 0, "password changed by mismatch/cancel");
  await urow().getByRole("button", { name: "Password" }).click();
  await dialog().getByLabel("New password").fill(NEWPW);
  await dialog().getByLabel("Confirm password").fill(NEWPW);
  await dialog().getByRole("button", { name: "Update password" }).click();
  await toast(`Password updated for SS User ${tag}.`).waitFor();
  await dialog().waitFor({ state: "detached" });
  expect((await audits()) === 1, "password change not audited");
}, admin);

await check(["UI-536", "UI-537", "UI-538"], "Confirm dialog: Cancel keeps the account; confirming Disable/Enable toggles and audits", async () => {
  await urow().getByRole("button", { name: "Disable" }).click();
  const cd = admin.getByRole("dialog", { name: "Disable user" });
  await cd.waitFor();
  expect((await cd.innerText()).includes(`SS User ${tag}`), "confirm message missing the user");
  expect(await cd.getByRole("button", { name: "Cancel" }).evaluate((e) => e === document.activeElement), "Cancel not focused by default");
  await cd.getByRole("button", { name: "Cancel" }).click();
  await cd.waitFor({ state: "detached" });
  expect((await D.one("select enabled from users where id=$1", [uid])).enabled === true, "disabled despite cancel");
  await urow().getByRole("button", { name: "Disable" }).click();
  await cd.getByRole("button", { name: "Disable user" }).click();
  await toast(`SS User ${tag} disabled.`).waitFor();
  await cd.waitFor({ state: "detached" });
  expect((await D.one("select enabled from users where id=$1", [uid])).enabled === false, "not disabled");
  await urow().getByRole("button", { name: "Enable" }).click();
  await admin.getByRole("dialog", { name: "Enable user" }).getByRole("button", { name: "Enable user" }).click();
  await toast(`SS User ${tag} enabled.`).waitFor();
  expect((await D.one("select enabled from users where id=$1", [uid])).enabled === true, "not re-enabled");
  expect((await D.count("select count(*) n from activity_logs where action in ('user.disabled','user.enabled') and details->>'targetUserId'=$1", [uid])) === 2, "toggle not audited");
}, admin);

// The new user signs in with the edited email and the admin-set password (proves both changes reached auth).
let userPage = null;
await check(["UI-229", "UI-234"], "User signs in with the edited email and the password set by the admin", async () => {
  userPage = await freshLogin(uemail2, NEWPW);
  expect(new URL(userPage.url()).pathname === "/crm/entrydashboard", "sign-in failed: " + (await userPage.locator("form p.error").innerText().catch(() => userPage.url())));
}, admin);

// =====================================================================================================
// Auth pages
// =====================================================================================================
await check(["UI-10", "UI-11"], "Login page: Forgot password? and brand links navigate", async () => {
  await page.goto(base + "/crm/login");
  await followLink(page, page.getByRole("link", { name: "Forgot password?" }), "/crm/forgot-password", pubErrs);
  await page.goto(base + "/crm/login");
  await followLink(page, page.locator("a.brand"), "/", pubErrs);
  await page.locator("h1.hero-title").waitFor();
}, page);

await check([], "Login notices: disabled / recovery_expired / auth_callback show their message; unknown codes show none", async () => {
  for (const [code, text] of [["disabled", "Your account has been disabled."], ["recovery_expired", "That recovery link has expired."], ["auth_callback", "We could not complete sign-in from that link."]]) {
    await page.goto(base + `/crm/login?error=${code}`);
    expect((await page.locator(".callout[role=alert]").innerText()).startsWith(text), `${code} notice`);
  }
  await page.goto(base + "/crm/login?error=<script>alert(1)</script>");
  expect((await page.locator(".callout[role=alert]").count()) === 0, "unknown code shows a notice");
}, page);

await check(["UI-1", "UI-2"], "Forgot-password brand and Return to sign in links navigate", async () => {
  await page.goto(base + "/crm/forgot-password");
  await followLink(page, page.getByRole("link", { name: "Return to sign in" }), "/crm/login", pubErrs);
  await page.goto(base + "/crm/forgot-password");
  await followLink(page, page.locator("a.brand"), "/", pubErrs);
}, page);

await check(["UI-3", "UI-4", "UI-5"], "Forgot password: invalid email blocked; known and unknown emails get the same generic response", async () => {
  await page.goto(base + "/crm/forgot-password");
  const email = page.getByLabel("Work email");
  await email.fill("not-an-email");
  await page.getByRole("button", { name: "Send recovery link" }).click();
  expect(await email.evaluate((e) => e.validity.typeMismatch), "invalid email not flagged");
  const messages = [];
  for (const addr of [uemail2, `nobody.${tag}@example.test`]) {
    await page.goto(base + "/crm/forgot-password");
    await page.getByLabel("Work email").fill(addr);
    const [r] = await Promise.all([page.waitForResponse((x) => x.url().includes("/auth/v1/recover")), page.getByRole("button", { name: "Send recovery link" }).click()]);
    expect(r.status() === 200, "recover status " + r.status());
    messages.push(await page.getByRole("status").innerText());
  }
  expect(messages[0] === "If that account exists, a recovery email has been sent." && messages[0] === messages[1], "responses differ: " + messages);
  const sent = await (await page.request.get(FAKE_AUTH + "/__e2e/recovery-emails")).json();
  expect(sent.includes(uemail2) && sent.includes(`nobody.${tag}@example.test`), "recovery requests not received by auth");
}, page);

await check([], "Reset-password page is refused without a session (login notice) and without a recovery link (forgot page)", async () => {
  await page.goto(base + "/crm/reset-password");
  await page.waitForURL("**/crm/login?error=recovery_expired");
  await page.locator(".callout[role=alert]").filter({ hasText: "recovery link has expired" }).waitFor();
  expect(userPage, "no signed-in user");
  await userPage.goto(base + "/crm/reset-password");
  await userPage.waitForURL("**/crm/forgot-password");
}, page);

await check(["UI-12", "UI-13", "UI-14", "UI-15", "UI-16"], "Reset password (recovery session): short and mismatched passwords refused; valid password updates sign-in", async () => {
  expect(userPage, "no signed-in user");
  // The fake auth server cannot mint emailed PKCE codes, so set the marker cookie /auth/callback would set.
  await userPage.context().addCookies([{ name: "pw_recovery", value: "1", domain: "localhost", path: "/crm", httpOnly: true, sameSite: "Lax" }]);
  await userPage.goto(base + "/crm/reset-password");
  await userPage.getByRole("heading", { name: "Choose a new password" }).waitFor();
  const pw = userPage.getByLabel("New password"), cf = userPage.getByLabel("Confirm password"), btn = userPage.getByRole("button", { name: "Update password" });
  let updates = 0;
  const onReq = (r) => { if (r.url().includes("/auth/v1/user") && r.method() === "PUT") updates++; };
  userPage.on("request", onReq);
  await pw.fill("short1");
  await cf.fill("short1");
  await btn.click();
  expect(await pw.evaluate((e) => e.validity.tooShort), "short password not flagged");
  await pw.fill(NEWPW + "-2");
  await cf.fill(NEWPW + "-3");
  await btn.click();
  await userPage.locator("form p.error[role=alert]").filter({ hasText: "Passwords do not match." }).waitFor();
  expect(updates === 0, "auth update sent for an invalid form");
  userPage.off("request", onReq);
  await cf.fill(NEWPW + "-2");
  const [r] = await Promise.all([userPage.waitForResponse((x) => x.url().includes("/auth/v1/user") && x.request().method() === "PUT"), btn.click()]);
  expect(r.status() === 200, "update user " + r.status());
  await userPage.waitForURL("**/crm/entrydashboard");
  const tok = await (await userPage.request.post(FAKE_AUTH + "/auth/v1/token?grant_type=password", { data: { email: uemail2, password: NEWPW + "-2" }, headers: { apikey: "sb_publishable_e2e_fake" } })).status();
  expect(tok === 200, "new password not accepted by auth: " + tok);
  await userPage.goto(base + "/crm/reset-password");
  await followLink(userPage, userPage.locator("a.brand"), "/", null);
}, page);

await check(["UI-375", "UI-376"], "Sign out ends the session; CRM pages then redirect to sign in", async () => {
  expect(userPage, "no signed-in user");
  await userPage.goto(base + "/crm/entrydashboard");
  await userPage.getByRole("button", { name: "Account menu" }).click();
  await Promise.all([userPage.waitForURL("**/crm/login"), userPage.getByRole("menuitem", { name: "Sign out" }).click()]);
  await userPage.goto(base + "/crm/entrydashboard");
  expect(new URL(userPage.url()).pathname === "/crm/login", "still signed in after sign out: " + userPage.url());
}, page);

if (userPage) await userPage.context().close();
await exec1Ctx.close();
await adminCtx.close();
await pubCtx.close();
await browser.close();
await D.end();
R.finish();
