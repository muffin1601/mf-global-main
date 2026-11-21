import pg from "pg";
const db = new pg.Client({ connectionString: "postgresql://postgres:e2e@127.0.0.1:54340/crm_e2e" });
await db.connect();
for (const sql of process.argv.slice(2)) { const r = await db.query(sql); console.log(JSON.stringify(r.rows, null, 0)); }
await db.end();
