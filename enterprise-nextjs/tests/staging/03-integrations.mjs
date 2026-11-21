// Integration configuration on staging. Never triggers a live provider pull: the success-path cron call is made
// only when INTEGRATIONS_ENABLED is not "true" on the server (it must answer skipped). Capture endpoints are probed
// with missing/wrong keys only, so no lead is created.
import { guard, reporter, expect } from "./guard.mjs";

guard(["STAGING_APP_URL", "CRON_SECRET"]);
const base = process.env.STAGING_APP_URL.replace(/\/$/, "");
const r = reporter("integrations");
const get = (p, headers = {}) => fetch(base + p, { headers, redirect: "manual" });

await r.check("health endpoint reports the database reachable", async () => {
  const res = await get("/api/health"); const body = await res.json().catch(() => ({}));
  expect(res.status === 200, "health " + res.status);
  return JSON.stringify(body).slice(0, 120);
});
await r.check("cron refuses missing and wrong secrets", async () => {
  expect((await get("/api/cron/tradeindia")).status === 401, "no secret accepted");
  expect((await get("/api/cron/tradeindia", { authorization: "Bearer wrong-secret" })).status === 401, "wrong secret accepted");
});
await r.check("cron with the right secret is skipped while integrations are disabled", async () => {
  const res = await get("/api/cron/tradeindia", { authorization: `Bearer ${process.env.CRON_SECRET}` });
  const body = await res.json();
  expect(res.status === 200, "status " + res.status);
  expect(body.skipped === true, "integrations appear ENABLED on staging - stop and confirm the provider sandbox before continuing: " + JSON.stringify(body).slice(0, 160));
});
for (const path of ["/api/coachinpromo/capture-lead", "/api/printkee/capture-lead", "/api/giftaguru/capture-lead"]) {
  await r.check(`${path} refuses a missing or wrong API key`, async () => {
    const post = (headers) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ name: "QA probe", phone: "9000000000" }) });
    const a = await post({}); const b = await post({ "x-api-key": "definitely-wrong" });
    expect([401, 403].includes(a.status) && [401, 403].includes(b.status), `statuses ${a.status}/${b.status}`);
  });
}
await r.check("contact endpoint is configured (rejects malformed JSON with 400, not 5xx)", async () => {
  const res = await fetch(base + "/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" });
  expect(res.status === 400, "status " + res.status);
});
r.done();
