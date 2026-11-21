// Read-only SQL against the LOCAL E2E database, for verifying browser test results.
// Usage: node scripts/e2e/query.mjs "select ..." [param1 param2 ...]
import pg from "pg";
const [sql, ...params] = process.argv.slice(2);
if (!/^\s*(select|with)\b/i.test(sql ?? "")) throw new Error("query.mjs only runs SELECT statements");
const client = new pg.Client({ connectionString: `postgresql://postgres:e2e@127.0.0.1:${process.env.E2E_DB_PORT ?? 54340}/crm_e2e` });
await client.connect();
try {
  await client.query("BEGIN READ ONLY");
  const { rows } = await client.query(sql, params);
  console.table(rows);
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
