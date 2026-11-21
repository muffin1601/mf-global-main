// Credential rotation check: the OLD (exposed) database credential must be refused; the CURRENT one must connect.
// Neither connection string is printed. Run by the account owner after resetting the password in Supabase.
import pg from "pg";
import { guard, hostOf, reporter, expect } from "./guard.mjs";

guard(["OLD_DATABASE_URL", "VERIFY_DATABASE_URL"]);
const r = reporter("rotation");
const tryConnect = async (url) => {
  const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 });
  try { await c.connect(); await c.query("select 1"); await c.end(); return { ok: true }; }
  catch (e) { return { ok: false, code: e.code ?? "", message: String(e.message).replace(/postgres(ql)?:\/\/\S+/g, "<url>").slice(0, 120) }; }
};
await r.check(`old credential is refused (${hostOf(process.env.OLD_DATABASE_URL)})`, async () => {
  const res = await tryConnect(process.env.OLD_DATABASE_URL);
  expect(!res.ok, "OLD CREDENTIAL STILL WORKS - rotation not effective");
  expect(res.code === "28P01" || /password|authentication/i.test(res.message), "refused for another reason (network?): " + res.code + " " + res.message);
  return "refused: " + (res.code || res.message);
});
await r.check(`current credential connects (${hostOf(process.env.VERIFY_DATABASE_URL)})`, async () => {
  const res = await tryConnect(process.env.VERIFY_DATABASE_URL);
  expect(res.ok, "current credential failed: " + res.code + " " + res.message);
});
r.done();
