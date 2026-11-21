// Supabase Auth on staging, driven through the real login UI. Synthetic identities only.
import { chromium } from "playwright-core";
import { guard, reporter, expect } from "./guard.mjs";

guard(["STAGING_APP_URL", "STAGING_ADMIN_USER", "STAGING_EMPLOYEE_USER", "STAGING_DISABLED_USER", "STAGING_TEST_PASSWORD"]);
const base = process.env.STAGING_APP_URL.replace(/\/$/, "");
const pw = process.env.STAGING_TEST_PASSWORD;
const r = reporter("auth");
const browser = await chromium.launch();

async function attempt(user, password) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(base + "/crm/login");
  await p.getByLabel("Username or work email").fill(user);
  await p.getByLabel("Password").fill(password);
  await p.getByRole("button", { name: "Sign in" }).click();
  await Promise.race([p.waitForURL("**/crm/entrydashboard", { timeout: 20000 }), p.locator("form p.error[role=alert]").waitFor({ timeout: 20000 })]).catch(() => {});
  const error = await p.locator("form p.error[role=alert]").innerText().catch(() => "");
  return { ctx, p, ok: new URL(p.url()).pathname === "/crm/entrydashboard", error };
}

await r.check("admin signs in", async () => { const a = await attempt(process.env.STAGING_ADMIN_USER, pw); expect(a.ok, a.error); await a.ctx.close(); });
await r.check("employee signs in and cannot open user management", async () => {
  const a = await attempt(process.env.STAGING_EMPLOYEE_USER, pw); expect(a.ok, a.error);
  await a.p.goto(base + "/crm/user-management");
  expect(!new URL(a.p.url()).pathname.startsWith("/crm/user-management"), "employee reached user management");
  await a.ctx.close();
});
await r.check("disabled user is refused", async () => { const a = await attempt(process.env.STAGING_DISABLED_USER, pw); expect(!a.ok && /disabled/i.test(a.error), "disabled user not refused: " + a.error); await a.ctx.close(); });
await r.check("wrong password and unknown user get the same generic error", async () => {
  const a = await attempt(process.env.STAGING_ADMIN_USER, pw + "x"); const b = await attempt("no.such.user.qa", pw + "x");
  expect(!a.ok && a.error && a.error === b.error, `messages differ: "${a.error}" vs "${b.error}"`); await a.ctx.close(); await b.ctx.close();
});
await r.check("password recovery request gives a generic response (no account enumeration)", async () => {
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  const texts = [];
  for (const email of [`${process.env.STAGING_EMPLOYEE_USER}`, "nobody-qa@example.test"]) {
    await p.goto(base + "/crm/forgot-password");
    await p.getByRole("textbox").first().fill(email.includes("@") ? email : `${email}@example.test`);
    await p.getByRole("button").filter({ hasText: /send|reset|continue/i }).first().click();
    await p.waitForTimeout(2500);
    texts.push((await p.locator("main").innerText()).replace(/\S+@\S+/g, "<email>"));
  }
  expect(texts[0] === texts[1], "recovery responses differ between a real and an unknown account");
  await ctx.close();
  return "check the QA inbox for the recovery mail to the real test identity";
});
await r.check("sign-out invalidates the session", async () => {
  const a = await attempt(process.env.STAGING_EMPLOYEE_USER, pw); expect(a.ok, a.error);
  const res = await a.ctx.request.post(base + "/auth/signout", { headers: { origin: base }, maxRedirects: 0, failOnStatusCode: false });
  expect(res.status() === 303, "signout status " + res.status());
  const after = await a.ctx.request.get(base + "/api/search?q=a", { failOnStatusCode: false });
  expect(after.status() === 401, "API still authorised after sign-out: " + after.status());
  await a.ctx.close();
});
await browser.close();
r.done();
