import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import pg from "pg";
import { parse } from "csv-parse/sync";
const pw = createRequire(import.meta.url)(
  process.env.QA_PLAYWRIGHT_MODULE || "playwright-core",
);
const db = new pg.Client({
  connectionString: "postgresql://postgres:e2e@127.0.0.1:54340/crm_e2e",
});
await db.connect();
const {
  rows: [data],
} = await db.query(
  "select (select id from products limit 1) product,(select id from categories limit 1) category,(select count(*)::int from products where status='ACTIVE') products,(select id from vendors limit 1) vendor,(select id from quotations limit 1) quote,(select id from blog_posts limit 1) blog",
);
const { rows: leadRows } = await db.query("select coalesce(name, '') name, coalesce(company, '') company, coalesce(phone, '') phone from leads");
await db.end();
const base = "http://localhost:3100",
  results = [];
for (const engine of ["chromium", "firefox", "webkit"]) {
  let b;
  try {
    b = await pw[engine].launch();
    const c = await b.newContext();
    await c.route("**/*", (r) =>
      ["localhost", "127.0.0.1"].includes(new URL(r.request().url()).hostname)
        ? r.continue()
        : r.abort(),
    );
    const p = await c.newPage();
    await p.goto(base + "/crm/login");
    await p.getByLabel("Username or work email").fill("qa.admin");
    await p.getByLabel("Password").fill("E2e-Test-Passw0rd!");
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.waitForURL("**/crm/entrydashboard");
    await p.getByRole("heading", { name: "Dashboard", exact: true }).waitFor();
    results.push({
      engine,
      action: "Sign in and open dashboard",
      pass: await p
        .getByRole("heading", { name: "Dashboard", exact: true })
        .isVisible(),
    });
    if (engine === "chromium") {
      const paths = [
        "/api/health",
        "/api/categories",
        "/api/products",
        "/api/products/" + data.product,
        "/api/products/search?q=E2E",
        "/api/products/code-preview?categoryId=" + data.category,
        "/api/search?q=E2E",
        "/api/lead-import/history",
        "/api/lead-import/sample",
        "/api/leads/export",
        "/api/reports/lead-insertion/export?format=csv",
        "/api/reports/lead-insertion/export?format=xlsx",
        "/api/reports/lead-insertion/export?format=pdf",
        "/api/quotations/clients?q=Journey",
        "/api/quotations/" + data.quote + "/pdf",
        "/api/vendors",
        "/api/vendors/export",
        "/api/vendors/import/template",
        "/api/vendors/" + data.vendor + "/documents",
        "/api/vendors/" + data.vendor + "/audit",
        "/api/blogs",
        "/api/blogs/" + data.blog,
        "/api/blogs/comments/" + data.blog,
        "/api/careers/jobs",
      ];
      for (const path of paths) {
        const r = await c.request.get(base + path);
        const contentType = r.headers()["content-type"];
        const body = await r.body();
        let pass =
          r.status() === 200 &&
          body.length > 0 &&
          !contentType.includes("text/html");
        if (path === "/api/products")
          pass = pass && JSON.parse(body).total === data.products;
        if (path.includes("format=xlsx"))
          pass = pass && body.subarray(0, 2).toString() === "PK";
        if (path.endsWith("pdf"))
          pass = pass && body.subarray(0, 5).toString() === "%PDF-";
        if (path === "/api/leads/export") {
          const records = parse(body, { bom: true, columns: true, skip_empty_lines: true });
          const key = row => JSON.stringify([row.name, row.company, row.phone]);
          pass = pass && Number(r.headers()["x-row-count"]) === leadRows.length &&
            JSON.stringify(records.map(key).sort()) === JSON.stringify(leadRows.map(key).sort());
        }
        results.push({
          engine,
          path,
          status: r.status(),
          contentType,
          bytes: body.length,
          pass,
        });
      }
    }
  } catch (e) {
    results.push({ engine, error: String(e).slice(0, 260) });
  } finally {
    await b?.close();
  }
  writeFileSync(
    "test-artifacts/api-browser-results.json",
    JSON.stringify(results, null, 2),
  );
}

if (results.some((result) => result.pass === false || result.error))
  process.exitCode = 1;
