// Clears login/API throttle buckets in the LOCAL E2E database only (between browser test batches).
import pg from "pg";
const url = `postgresql://postgres:e2e@127.0.0.1:${process.env.E2E_DB_PORT ?? 54340}/crm_e2e`;
const client = new pg.Client({ connectionString: url });
await client.connect();
const { rowCount } = await client.query("DELETE FROM rate_limit_buckets");
await client.end();
console.log(`cleared ${rowCount} rate-limit buckets (local e2e db)`);
