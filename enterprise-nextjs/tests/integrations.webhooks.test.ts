import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as coachinpromo } from "@/app/api/coachinpromo/capture-lead/route";
import { POST as printkee } from "@/app/api/printkee/capture-lead/route";
import { prisma, resetDb } from "./helpers/db";

const KEY = "test-webhook-key-123456";
const call = (handler: (r: Request) => Promise<Response>, body: unknown, key: string | null = KEY, ip = "10.0.0.1") =>
  handler(new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...(key ? { "x-api-key": key } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));

describe("webhooks: coachinpromo / printkee", () => {
  beforeEach(async () => { await resetDb(); process.env.COACHINGPROMO_API_KEY = KEY; });
  afterEach(() => { delete process.env.COACHINGPROMO_API_KEY; });

  it("rejects missing and wrong keys with 403 and creates nothing", async () => {
    const body = { name: "A", phone: "9876543210" };
    expect((await call(coachinpromo, body, null)).status).toBe(403);
    expect((await call(coachinpromo, body, "wrong-key")).status).toBe(403);
    expect((await call(printkee, body, `${KEY}x`)).status).toBe(403);
    expect(await prisma.lead.count()).toBe(0);
  });

  it("fails closed when the server key is not configured (MERN accepted any caller)", async () => {
    delete process.env.COACHINGPROMO_API_KEY;
    expect((await call(coachinpromo, { phone: "9876543210" }, "undefined")).status).toBe(403);
    expect((await call(coachinpromo, { phone: "9876543210" }, null)).status).toBe(403);
  });

  it("coachinpromo: maps fields, source COACHINGPROMO, dataType WebPortals, unassigned", async () => {
    const res = await call(coachinpromo, { name: "Asha", companyname: "Acme", email: "A@Acme.com", location: "Pune", phone: "9876543210", message: "Need quote" });
    expect(res.status).toBe(201);
    const { data } = await res.json();
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: data.id }, include: { assignments: true } });
    expect(lead).toMatchObject({
      name: "Asha", company: "Acme", email: "a@acme.com", location: "Pune", phone: "9876543210", requirements: "Need quote",
      source: "COACHINGPROMO", dataType: "WebPortals", status: "New Lead", callStatus: "Not Called",
    });
    expect(lead.assignments).toHaveLength(0);
    expect(lead.inquiryDate).toBeTruthy();
  });

  it("printkee: requirements fall back to productCode; source PRINTKEE", async () => {
    const res = await call(printkee, { name: "B", company: "Beta", productCode: "PK-9", phone: "9876543211" });
    expect(res.status).toBe(201);
    const lead = await prisma.lead.findFirstOrThrow({ where: { source: "PRINTKEE" } });
    expect(lead).toMatchObject({ company: "Beta", requirements: "PK-9", dataType: "WebPortals" });
  });

  it("validates the body", async () => {
    expect((await call(coachinpromo, "not json")).status).toBe(400);
    expect((await call(coachinpromo, [1])).status).toBe(400);
    expect((await call(coachinpromo, { name: "x" })).status).toBe(400); // no phone or email
    expect((await call(coachinpromo, { email: "bad", phone: "9876543210" })).status).toBe(400);
    expect((await call(printkee, { phone: "9".repeat(31) })).status).toBe(400);
    expect(await prisma.lead.count()).toBe(0);
  });

  it("does not create a second lead for the same phone (200 + duplicate flag)", async () => {
    expect((await call(coachinpromo, { phone: "9876543210", name: "A" })).status).toBe(201);
    const again = await call(printkee, { phone: "9876543210", name: "A" });
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ duplicate: true });
    expect(await prisma.lead.count()).toBe(1);
  });

  it("rate limits to 60 requests per minute per IP with 429 (before the key check)", async () => {
    for (let i = 0; i < 60; i++) expect((await call(coachinpromo, {}, "wrong", "10.9.9.9")).status).toBe(403);
    const limited = await call(coachinpromo, { phone: "9876543210" }, KEY, "10.9.9.9");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    expect((await call(coachinpromo, { phone: "9876543210" }, KEY, "10.8.8.8")).status).toBe(201); // other IP unaffected
  });
});
