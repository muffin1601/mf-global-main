import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as tradeindiaCron } from "@/app/api/cron/tradeindia/route";
import { GET as indiamartCron } from "@/app/api/cron/indiamart/route";
import { formatIndiaMartDate, pullIndiaMart } from "@/server/integrations/indiamart";
import { pullTradeIndia } from "@/server/integrations/tradeindia";
import { runCron } from "@/server/integrations/cron";
import { prisma, resetDb } from "./helpers/db";

const SECRET = "cron-secret-abcdef";
const IM_KEY = "im-secret-key-9999";
const TI = { TRADEINDIA_USERID: "tiuser77", TRADEINDIA_PROFILE_ID: "prof88", TRADEINDIA_KEY: "ti-secret-key-5555" };
const ENV_KEYS = ["CRON_SECRET", "INTEGRATIONS_ENABLED", "ENABLE_INDIAMART_SYNC", "INDIAMART_API_KEY", ...Object.keys(TI)];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const cronReq = (auth?: string) => new Request("http://localhost/api/cron/x", { headers: auth ? { authorization: auth } : {} });
const noSleep = async () => {};

// Payload shapes taken from backend/scripts/fetchLeadsFromIndiaMart.js and fetchTradeIndiaLeadsToCRM.js
const imLead = (n: number) => ({
  UNIQUE_QUERY_ID: `Q${n}`, SENDER_NAME: `Sender ${n}`, SENDER_COMPANY: `Co ${n}`, SENDER_EMAIL: `s${n}@im.test`,
  SENDER_MOBILE: `+91-98765${String(40000 + n)}`, SENDER_CITY: "Mumbai", SENDER_STATE: "Maharashtra", QUERY_MESSAGE: "Need pumps",
  QUERY_TIME: `2026-11-18 10:0${n}:00`, SENDER_ADDRESS: "Addr", QUERY_MCAT_NAME: "Pumps",
});
const tiLead = (n: number) => ({
  rfi_id: `R${n}`, sender_name: `Buyer ${n}`, sender_co: `TiCo ${n}`, sender_email: `b${n}@ti.test`, sender_mobile: `91981100${String(1000 + n)}`,
  sender_city: "Delhi", sender_state: "Delhi", sender_country: "India", message: "Hello, need 5 units! (urgent)", subject: "Valves",
  product_name: "Valve", generated_date: `2026-11-18 11:0${n}:00`,
});

describe("integrations: cron routes, pullers and safety", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(async () => {
    await resetDb();
    for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
    process.env.CRON_SECRET = SECRET;
  });
  afterEach(() => {
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const enable = () => { process.env.INTEGRATIONS_ENABLED = "true"; Object.assign(process.env, TI); };

  it("cron auth: 401 without, with wrong, or with a malformed bearer; 401 when CRON_SECRET is unset", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    enable();
    expect((await tradeindiaCron(cronReq())).status).toBe(401);
    expect((await tradeindiaCron(cronReq("Bearer nope"))).status).toBe(401);
    expect((await tradeindiaCron(cronReq(SECRET))).status).toBe(401);
    expect((await indiamartCron(cronReq("Bearer wrong"))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await tradeindiaCron(cronReq("Bearer undefined"))).status).toBe(401);
    expect((await tradeindiaCron(cronReq("Bearer "))).status).toBe(401);
    expect(f).not.toHaveBeenCalled();
    expect(await prisma.integrationRun.count()).toBe(0);
  });

  it("is disabled by default: authorised cron makes NO outbound call and creates no run/lead", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    Object.assign(process.env, TI, { INDIAMART_API_KEY: IM_KEY, ENABLE_INDIAMART_SYNC: "true" }); // INTEGRATIONS_ENABLED unset
    for (const handler of [tradeindiaCron, indiamartCron]) {
      const res = await handler(cronReq(`Bearer ${SECRET}`));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ skipped: true });
    }
    process.env.INTEGRATIONS_ENABLED = "false";
    await tradeindiaCron(cronReq(`Bearer ${SECRET}`));
    expect(f).not.toHaveBeenCalled();
    expect(await prisma.integrationRun.count()).toBe(0);
  });

  it("IndiaMART additionally needs ENABLE_INDIAMART_SYNC=true", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    enable();
    process.env.INDIAMART_API_KEY = IM_KEY;
    const res = await indiamartCron(cronReq(`Bearer ${SECRET}`));
    expect(await res.json()).toMatchObject({ skipped: true });
    expect(f).not.toHaveBeenCalled();
  });

  it("TradeIndia: maps MERN fields, pages until empty, queries 'today' in IST, records a run", async () => {
    enable();
    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      urls.push(url);
      const page = Number(new URL(url).searchParams.get("page_no"));
      return json(page === 1 ? [tiLead(1), tiLead(2)] : []);
    });
    // 2026-11-18T20:00Z is already 2026-11-19 01:30 in IST
    const out = await pullTradeIndia({ fetch: fetchMock, sleep: noSleep, now: new Date("2026-11-18T20:00:00Z") });
    expect(out).toMatchObject({ status: "SUCCESS", fetched: 2, created: 2, duplicates: 0, failed: 0 });
    expect(urls).toHaveLength(2);
    expect(new URL(urls[0]!).searchParams.get("from_date")).toBe("2026-11-19");
    expect(new URL(urls[0]!).searchParams.get("to_date")).toBe("2026-11-19");
    const lead = await prisma.lead.findFirstOrThrow({ where: { externalKey: "tradeindia:R1" }, include: { assignments: true } });
    expect(lead).toMatchObject({
      name: "Buyer 1", company: "TiCo 1", email: "b1@ti.test", phone: "9811001001", contact: "Buyer 1", category: "TradeIndia",
      dataType: "TradeIndia", source: "TRADEINDIA", status: "New Lead", remarks: "Valves", requirements: "Hello need 5 units urgent",
      address: "Delhi, Delhi, India", inquiryDate: "2026-11-18 11:01:00",
    });
    expect(lead.assignments).toHaveLength(0);
    const run = await prisma.integrationRun.findUniqueOrThrow({ where: { id: out.runId } });
    expect(run).toMatchObject({ provider: "tradeindia", status: "SUCCESS", fetched: 2, created: 2, errorMessage: null });
    expect(run.finishedAt).not.toBeNull();
  });

  it("TradeIndia re-run is idempotent (and falls back to phone+date when no provider id)", async () => {
    enable();
    const noId = (n: number) => { const { rfi_id: _drop, ...rest } = tiLead(n); void _drop; return rest; };
    const f = async (url: string) => json(new URL(url).searchParams.get("page_no") === "1" ? [tiLead(1), noId(2)] : []);
    const first = await pullTradeIndia({ fetch: f, sleep: noSleep });
    const second = await pullTradeIndia({ fetch: f, sleep: noSleep });
    expect(first.created).toBe(2);
    expect(second).toMatchObject({ created: 0, duplicates: 2, status: "SUCCESS" });
    expect(await prisma.lead.count()).toBe(2);
    expect(await prisma.lead.count({ where: { externalKey: { startsWith: "tradeindia:9811001002:" } } })).toBe(1);
  });

  it("TradeIndia treats an existing migrated lead (same phone + inquiryDate, no externalKey) as duplicate", async () => {
    enable();
    await prisma.lead.create({ data: { phone: "9811001001", inquiryDate: "2026-11-18 11:01:00", dataType: "TradeIndia" } });
    const out = await pullTradeIndia({ fetch: async (u) => json(new URL(u).searchParams.get("page_no") === "1" ? [tiLead(1)] : []), sleep: noSleep });
    expect(out).toMatchObject({ created: 0, duplicates: 1 });
  });

  it("provider 500 then success: retries with backoff and completes", async () => {
    enable();
    const sleeps: number[] = [];
    let n = 0;
    const f = vi.fn(async (url: string) => {
      if (++n <= 2) return new Response("boom", { status: 500 });
      return json(new URL(url).searchParams.get("page_no") === "1" ? [tiLead(1)] : []);
    });
    const out = await pullTradeIndia({ fetch: f, sleep: async (ms) => { sleeps.push(ms); } });
    expect(out).toMatchObject({ status: "SUCCESS", created: 1 });
    expect(sleeps).toEqual([500, 1000]);
  });

  it("persistent provider failure is recorded as FAILED with a safe message, then the next run recovers", async () => {
    enable();
    const spies = (["log", "info", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const down = vi.fn(async () => new Response("x", { status: 503 }));
    const failed = await pullTradeIndia({ fetch: down, sleep: noSleep });
    expect(down).toHaveBeenCalledTimes(3);
    expect(failed).toMatchObject({ status: "FAILED", created: 0 });
    const run = await prisma.integrationRun.findUniqueOrThrow({ where: { id: failed.runId } });
    expect(run.status).toBe("FAILED");
    expect(run.errorMessage).toContain("HTTP 503");
    const ok = await pullTradeIndia({ fetch: async (u) => json(new URL(u).searchParams.get("page_no") === "1" ? [tiLead(1)] : []), sleep: noSleep });
    expect(ok).toMatchObject({ status: "SUCCESS", created: 1 });
    expect(await prisma.integrationRun.count()).toBe(2);
    void spies;
  });

  it("a failure on page 2 records PARTIAL; page 1 leads are kept and the retry does not duplicate them", async () => {
    enable();
    vi.spyOn(console, "info").mockImplementation(() => {});
    const f = async (url: string) => {
      const p = new URL(url).searchParams.get("page_no");
      if (p === "1") return json([tiLead(1)]);
      throw new TypeError(`fetch failed ${url}`);
    };
    const partial = await pullTradeIndia({ fetch: f, sleep: noSleep });
    expect(partial).toMatchObject({ status: "PARTIAL", created: 1 });
    const again = await pullTradeIndia({ fetch: async (u) => json(new URL(u).searchParams.get("page_no") === "1" ? [tiLead(1), tiLead(2)] : []), sleep: noSleep });
    expect(again).toMatchObject({ status: "SUCCESS", created: 1, duplicates: 1 });
    expect(await prisma.lead.count()).toBe(2);
  });

  it("records per-lead failures as PARTIAL and keeps going", async () => {
    enable();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    const out = await pullTradeIndia({
      fetch: async (u) => json(new URL(u).searchParams.get("page_no") === "1" ? [null, tiLead(1)] : []), sleep: noSleep,
    });
    expect(out).toMatchObject({ status: "PARTIAL", fetched: 2, created: 1, failed: 1 });
  });

  it("IndiaMART: URL window is the last 24h in IST, MERN field mapping, idempotent re-run", async () => {
    process.env.INDIAMART_API_KEY = IM_KEY;
    const urls: string[] = [];
    const f = async (url: string) => { urls.push(url); return json({ CODE: 200, RESPONSE: [imLead(1), imLead(2)] }); };
    const now = new Date("2026-11-18T10:00:00Z"); // 15:30 IST
    const first = await pullIndiaMart({ fetch: f, sleep: noSleep, now });
    const u = new URL(urls[0]!);
    expect(u.searchParams.get("start_time")).toBe("17-Nov-2026 15:30:00");
    expect(u.searchParams.get("end_time")).toBe("18-Nov-2026 15:30:00");
    expect(first).toMatchObject({ status: "SUCCESS", fetched: 2, created: 2 });
    const lead = await prisma.lead.findFirstOrThrow({ where: { externalKey: "indiamart:Q1" }, include: { assignments: true } });
    expect(lead).toMatchObject({
      name: "Sender 1", company: "Co 1", email: "s1@im.test", phone: "9876540001", location: "Mumbai", state: "Maharashtra",
      category: "IndiaMart", dataType: "IndiaMart", source: "INDIAMART", requirements: "Need pumps", remarks: "Pumps",
      inquiryDate: "2026-11-18 10:01:00", address: "Addr", status: "New Lead", callStatus: "Not Called",
    });
    expect(lead.assignments).toHaveLength(0);
    const second = await pullIndiaMart({ fetch: f, sleep: noSleep, now });
    expect(second).toMatchObject({ created: 0, duplicates: 2, status: "SUCCESS" });
    expect(await prisma.lead.count()).toBe(2);
  });

  it("IndiaMART: bad CODE and missing key are recorded as FAILED; formatIndiaMartDate is IST", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const noKey = await pullIndiaMart({ fetch: vi.fn(), sleep: noSleep });
    expect(noKey).toMatchObject({ status: "FAILED" });
    process.env.INDIAMART_API_KEY = IM_KEY;
    const bad = await pullIndiaMart({ fetch: async () => json({ CODE: 401, STATUS: "FAILURE" }), sleep: noSleep });
    expect(bad).toMatchObject({ status: "FAILED", error: "Invalid response from IndiaMART (CODE 401)" });
    expect(formatIndiaMartDate(new Date("2026-01-05T18:45:10Z"))).toBe("06-Jan-2026 00:15:10");
  });

  it("full cron route path (enabled) uses the global fetch and returns the run summary", async () => {
    enable();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async (url: string) => json(new URL(url).searchParams.get("page_no") === "1" ? [tiLead(1)] : [])));
    const res = await tradeindiaCron(cronReq(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, status: "SUCCESS", created: 1 });
    process.env.ENABLE_INDIAMART_SYNC = "true";
    process.env.INDIAMART_API_KEY = IM_KEY;
    vi.stubGlobal("fetch", vi.fn(async () => json({ CODE: 200, RESPONSE: [imLead(3)] })));
    expect(await (await runCron("indiamart", cronReq(`Bearer ${SECRET}`))).json()).toMatchObject({ status: "SUCCESS", created: 1 });
  });

  it("never logs or stores secrets, provider URLs or lead PII", async () => {
    enable();
    process.env.ENABLE_INDIAMART_SYNC = "true";
    process.env.INDIAMART_API_KEY = IM_KEY;
    const out: string[] = [];
    for (const m of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, m).mockImplementation((...args: unknown[]) => { out.push(JSON.stringify(args)); });
    }
    // success, malformed lead, failing provider (error text carries the URL), bad response
    await pullTradeIndia({ fetch: async (u) => json(new URL(u).searchParams.get("page_no") === "1" ? [null, tiLead(1)] : []), sleep: noSleep });
    await pullTradeIndia({ fetch: async (u) => { throw new Error(`ECONNRESET ${u}`); }, sleep: noSleep });
    await pullIndiaMart({ fetch: async (u) => { throw new Error(`socket hang up ${u}`); }, sleep: noSleep });
    await pullIndiaMart({ fetch: async () => json({ CODE: 200, RESPONSE: [imLead(1)] }), sleep: noSleep });
    const runs = await prisma.integrationRun.findMany();
    const haystack = out.join("\n") + JSON.stringify(runs);
    for (const secret of [IM_KEY, SECRET, TI.TRADEINDIA_KEY, TI.TRADEINDIA_USERID, TI.TRADEINDIA_PROFILE_ID, "mapi.indiamart.com", "tradeindia.com", "b1@ti.test", "9811001001", "s1@im.test", "9876540001"]) {
      expect(haystack, `leaked ${secret}`).not.toContain(secret);
    }
    expect(out.length).toBeGreaterThan(0);
  });
});
