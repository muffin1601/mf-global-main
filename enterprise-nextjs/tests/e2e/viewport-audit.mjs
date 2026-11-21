import { createRequire } from "node:module";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, sep } from "node:path";
import pg from "pg";

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.QA_PLAYWRIGHT_MODULE || "playwright-core",
);
const out = "test-artifacts/browser-audit";
mkdirSync(out, { recursive: true });
const base = "http://localhost:3100";
const db = new pg.Client({
  connectionString: "postgresql://postgres:e2e@127.0.0.1:54340/crm_e2e",
});
await db.connect();
const {
  rows: [fixture],
} = await db.query(
  "select (select id from leads where name='E2E Lead 1' limit 1) lead, (select id from vendors limit 1) vendor, (select q.id from quotations q join users u on u.id=q.user_id where u.username='qa.exec1' limit 1) quotation",
);
await db.end();
if (!fixture.lead) throw new Error("Synthetic seed required");
const root = "src/app/(crm)";
const pages = readdirSync(root, { recursive: true })
  .filter((p) => p.endsWith("page.tsx"))
  .map((p) => "/" + p.split(sep).slice(0, -1).join("/"))
  .sort();
const browser = await chromium.launch({ headless: true });
const publicPages = [
  "/crm/login",
  "/crm/forgot-password",
  "/crm/reset-password",
  "/",
  "/contact",
  "/careers",
  "/careers/admin",
  "/blogs",
  "/blogs/[slug]",
  "/blogs/new",
];
const resume = process.argv.includes("--resume");
const prior = join(out, "results.json");
const results =
  resume && existsSync(prior) ? JSON.parse(readFileSync(prior, "utf8")) : [];
try {
  for (const [role, login] of [
    ["ADMIN", "qa.admin"],
    ["USER", "qa.exec1"],
    ["GUEST", null],
  ]) {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    await context.route("**/*", (route) =>
      ["localhost", "127.0.0.1"].includes(
        new URL(route.request().url()).hostname,
      )
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    const accessibility = await context.newCDPSession(page);
    if (login) {
      await page.goto(base + "/crm/login");
      await page.getByLabel("Username or work email").fill(login);
      await page.getByLabel("Password").fill("E2e-Test-Passw0rd!");
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL("**/crm/entrydashboard");
    }
    await context.tracing.start({ screenshots: true, snapshots: false });
    for (const route of login ? pages : publicPages) {
      if (
        resume &&
        results.filter(
          (r) => r.role === role && r.route === route && r.screenshot,
        ).length === 5
      )
        continue;
      const id = route.includes("vendors")
        ? fixture.vendor
        : route.includes("quotations")
          ? fixture.quotation
          : fixture.lead;
      if (route.includes("[id]") && !id) continue;
      const errors = [],
        failed = [],
        consoleErrors = [];
      const onError = (e) => errors.push(e.message);
      const onResponse = (r) => {
        if (r.status() >= 400)
          failed.push([new URL(r.url()).pathname, r.status()]);
      };
      const onFail = (r) =>
        failed.push([new URL(r.url()).pathname, r.failure()?.errorText]);
      const onConsole = (m) => {
        if (m.type() === "error") consoleErrors.push(m.text().slice(0, 180));
      };
      page.on("pageerror", onError);
      page.on("response", onResponse);
      page.on("requestfailed", onFail);
      page.on("console", onConsole);
      try {
        const start = Date.now();
        const response = await page.goto(
          base + route.replace("[id]", id).replace("[slug]", "qa-layout"),
          { waitUntil: "networkidle", timeout: 45000 },
        );
        const ms = Date.now() - start;
        for (const width of [375, 768, 1366, 1440, 1920]) {
          await page.setViewportSize({ width, height: 900 });
          await page.evaluate(
            () =>
              new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              ),
          );
          const metrics = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth - innerWidth,
            heading: document.querySelector("h1")?.textContent,
            errorPage:
              /Application error|Something went wrong|This page could not be found/i.test(
                document.body.innerText,
              ),
          }));
          const name =
            role +
            "-" +
            route.replace(/[^a-z0-9]/gi, "_") +
            "-" +
            width +
            ".png";
          await page.screenshot({
            path: join(out, name),
            animations: "disabled",
            timeout: 8000,
          });
          const tree = await accessibility.send("Accessibility.getFullAXTree");
          const controlRoles = new Set([
            "button",
            "link",
            "textbox",
            "searchbox",
            "checkbox",
            "radio",
            "combobox",
            "tab",
            "menuitem",
            "spinbutton",
            "switch",
          ]);
          const controls = tree.nodes
            .filter(
              (node) => !node.ignored && controlRoles.has(node.role?.value),
            )
            .map((node) => ({
              role: node.role.value,
              name: node.name?.value || "",
              disabled:
                node.properties?.some(
                  (prop) =>
                    prop.name === "disabled" && prop.value?.value === true,
                ) || false,
            }));
          writeFileSync(
            join(out, name.replace(".png", ".controls.json")),
            JSON.stringify(controls),
          );
          results.push({
            role,
            route,
            width,
            final: new URL(page.url()).pathname,
            status: response?.status(),
            ms,
            ...metrics,
            errors: [...new Set(errors)],
            failed: [...failed],
            consoleErrors: [...new Set(consoleErrors)],
            screenshot: name,
          });
        }
      } catch (e) {
        results.push({ role, route, error: String(e).slice(0, 300) });
      } finally {
        page.off("pageerror", onError);
        page.off("response", onResponse);
        page.off("requestfailed", onFail);
        page.off("console", onConsole);
        writeFileSync(
          join(out, "results.json"),
          JSON.stringify(results, null, 2),
        );
      }
    }
    await context.tracing.stop({
      path: join(out, role + (resume ? "-additional" : "") + "-trace.zip"),
    });
    await context.close();
  }
} finally {
  await browser.close();
}
