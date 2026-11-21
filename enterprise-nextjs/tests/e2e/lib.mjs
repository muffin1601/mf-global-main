// Shared helpers for the per-control UI suites (tests/e2e/ui-*.mjs). Isolated E2E stack only.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import pg from "pg";

export const base = "http://localhost:3100";
export const PASSWORD = "E2e-Test-Passw0rd!";
export const tag = Date.now().toString().slice(-7);
mkdirSync("test-artifacts/ui", { recursive: true });

export async function openDb() {
  const db = new pg.Client({ connectionString: "postgresql://postgres:e2e@127.0.0.1:54340/crm_e2e" });
  await db.connect();
  return {
    db,
    one: async (sql, args = []) => (await db.query(sql, args)).rows[0],
    all: async (sql, args = []) => (await db.query(sql, args)).rows,
    count: async (sql, args = []) => Number((await db.query(sql, args)).rows[0].n),
    end: () => db.end(),
  };
}

/** Browser context signed in as `username`; the session is cached per user so suites do not trip the login throttle. */
export async function signedIn(browser, username, opts = {}) {
  const file = `test-artifacts/ui/state-${username}.json`;
  const make = (state) => browser.newContext({ acceptDownloads: true, viewport: opts.viewport ?? { width: 1366, height: 900 }, ...(state ? { storageState: state } : {}) });
  if (username && existsSync(file)) {
    const ctx = await make(file);
    const p = await ctx.newPage();
    const r = await p.goto(base + "/crm/entrydashboard");
    if (r && new URL(p.url()).pathname === "/crm/entrydashboard") { await p.close(); return guard(ctx); }
    await ctx.close();
  }
  const ctx = await make(null);
  if (username) {
    const p = await ctx.newPage();
    await p.goto(base + "/crm/login");
    await p.getByLabel("Username or work email").fill(username);
    await p.getByLabel("Password").fill(PASSWORD);
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.waitForURL("**/crm/entrydashboard", { timeout: 30000 });
    await ctx.storageState({ path: file });
    await p.close();
  }
  return guard(ctx);
}
function guard(ctx) {
  // Never let the browser reach anything outside the local stack.
  ctx.route("**/*", (r) => (["localhost", "127.0.0.1"].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
  return ctx;
}

export const launch = () => chromium.launch();

/**
 * Result recorder. `ui` is one or more matrix ids ("UI-123") whose control the check exercised end to end;
 * only checks that ran and passed may mark a row PASS.
 */
export function recorder(suite) {
  const results = [];
  const out = `test-artifacts/ui-${suite}.json`;
  return {
    results,
    async check(ui, name, fn, page) {
      const ids = [].concat(ui);
      try { const evidence = await fn(); results.push({ ui: ids, name, pass: true, evidence: evidence ?? "" }); }
      catch (e) {
        results.push({ ui: ids, name, pass: false, error: String(e).split("\n")[0].slice(0, 400) });
        await page?.screenshot({ path: `test-artifacts/ui/${suite}-fail-${results.length}.png` }).catch(() => {});
      }
      writeFileSync(out, JSON.stringify(results, null, 2));
    },
    finish() {
      const failed = results.filter((r) => !r.pass);
      console.log(`ui-${suite}: ${results.length - failed.length}/${results.length} checks passed, ${new Set(results.filter((r) => r.pass).flatMap((r) => r.ui)).size} UI rows exercised`);
      for (const f of failed) console.log("FAIL", f.ui.join(","), "—", f.name, "::", f.error);
      if (failed.length) process.exitCode = 1;
    },
  };
}
export const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
