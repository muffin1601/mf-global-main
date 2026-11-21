import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ user: null as null | { id: string; role: "ADMIN" | "USER"; name: string; userId: string; email: string | null; enabled: boolean } }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => state.user }));

import { GET as searchGET } from "@/app/api/search/route";
import { globalSearch, likePattern, normalizeQuery } from "@/server/search/service";
import { actorOf, makeLead, makeUser, prisma, resetDb } from "./helpers/db";

type U = Awaited<ReturnType<typeof makeUser>>;
let admin: U, alice: U, bob: U;
const as = (u: U | null) => { state.user = u ? { id: u.id, role: u.role, name: u.name, userId: u.userId, email: u.email, enabled: u.enabled } : null; };
const ids = (r: Awaited<ReturnType<typeof globalSearch>>, type: string) => r.groups.find((g) => g.type === type)?.hits.map((h) => h.id) ?? [];

const makeQuotation = (userId: string, name: string, number: string) =>
  prisma.quotation.create({ data: { userId, party: { name, company: `${name} Pvt Ltd`, phone: "9000000000" }, invoiceDetails: { prefix: "MF/Q/25-26/", number }, grandTotal: 1180 } });

beforeEach(async () => {
  await resetDb();
  admin = await makeUser({ role: "ADMIN", name: "Admin One" });
  alice = await makeUser({ role: "USER", name: "Alice Sales" });
  bob = await makeUser({ role: "USER", name: "Bob Sales" });
});

describe("normalizeQuery / likePattern", () => {
  it("ignores queries shorter than 2 characters and caps length at 100", () => {
    expect(normalizeQuery(" a ")).toBe("");
    expect(normalizeQuery(null)).toBe("");
    expect(normalizeQuery("  acme   corp ")).toBe("acme corp");
    expect(normalizeQuery("x".repeat(500))).toHaveLength(100);
  });
  it("escapes LIKE wildcards so they match literally", () => {
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});

describe("globalSearch — lead scope", () => {
  it("admin finds every matching lead; a user only leads assigned to them with view access", async () => {
    const mine = await makeLead({ name: "Zephyr Mine", company: "Zephyr Co" }, [{ userId: alice.id }]);
    const bobs = await makeLead({ name: "Zephyr Bob" }, [{ userId: bob.id }]);
    const unassigned = await makeLead({ name: "Zephyr Nobody" });
    const viewRevoked = await makeLead({ name: "Zephyr Hidden" });
    await prisma.leadAssignment.create({ data: { leadId: viewRevoked.id, userId: alice.id, canView: false } });

    expect(ids(await globalSearch(actorOf(admin), "zephyr"), "lead").sort()).toEqual([mine.id, bobs.id, unassigned.id, viewRevoked.id].sort());
    expect(ids(await globalSearch(actorOf(alice), "zephyr"), "lead")).toEqual([mine.id]);
    expect(ids(await globalSearch(actorOf(bob), "zephyr"), "lead")).toEqual([bobs.id]);
  });

  it("matches phone, contact and email, and links to the lead detail page", async () => {
    const lead = await makeLead({ name: "Phone Match", phone: "9812345678", email: "buyer@zeta.test" }, [{ userId: alice.id }]);
    for (const q of ["98123", "zeta.test", "PHONE match"]) {
      const r = await globalSearch(actorOf(alice), q);
      expect(ids(r, "lead")).toEqual([lead.id]);
    }
    const hit = (await globalSearch(actorOf(alice), "98123")).groups[0]!.hits[0]!;
    expect(hit.href).toBe(`/crm/lead-management/${lead.id}`);
  });

  it("treats % and _ literally instead of as wildcards", async () => {
    await makeLead({ name: "Plain Lead" });
    const r = await globalSearch(actorOf(admin), "%%");
    expect(ids(r, "lead")).toEqual([]);
  });
});

describe("globalSearch — quotations, products, vendors", () => {
  it("users only find their own quotations; admins find all; matches number, customer and company", async () => {
    const qa = await makeQuotation(alice.id, "Orion Traders", "101");
    const qb = await makeQuotation(bob.id, "Orion Exports", "102");
    expect(ids(await globalSearch(actorOf(alice), "orion"), "quotation")).toEqual([qa.id]);
    expect(ids(await globalSearch(actorOf(admin), "orion"), "quotation").sort()).toEqual([qa.id, qb.id].sort());
    expect(ids(await globalSearch(actorOf(bob), "25-26/102"), "quotation")).toEqual([qb.id]);
    expect(ids(await globalSearch(actorOf(bob), "Exports Pvt"), "quotation")).toEqual([qb.id]);
    expect(ids(await globalSearch(actorOf(bob), "25-26/101"), "quotation")).toEqual([]);
  });

  it("excludes archived products and archived vendors", async () => {
    const live = await prisma.product.create({ data: { code: "QX-1", name: "Quasar Mug", status: "ACTIVE" } });
    await prisma.product.create({ data: { code: "QX-2", name: "Quasar Old", status: "ARCHIVED", archivedAt: new Date() } });
    const vendor = await prisma.vendor.create({ data: { vendorCode: "VQ001", name: "Quasar Supplies", status: "ACTIVE" } });
    await prisma.vendor.create({ data: { vendorCode: "VQ002", name: "Quasar Gone", status: "ARCHIVED", archivedAt: new Date() } });
    for (const who of [admin, alice]) {
      const r = await globalSearch(actorOf(who), "quasar");
      expect(ids(r, "product")).toEqual([live.id]);
      expect(ids(r, "vendor")).toEqual([vendor.id]);
    }
  });

  it("caps each group at the limit (max 10) and omits empty groups", async () => {
    for (let i = 0; i < 14; i++) await makeLead({ name: `Nova ${i}` });
    const r = await globalSearch(actorOf(admin), "nova", { limit: 50 });
    expect(r.groups.map((g) => g.type)).toEqual(["lead"]);
    expect(r.groups[0]!.hits).toHaveLength(10);
    expect((await globalSearch(actorOf(admin), "nova")).groups[0]!.hits).toHaveLength(5);
  });
});

describe("GET /api/search", () => {
  it("rejects unauthenticated (401) and disabled (403) callers", async () => {
    as(null);
    expect((await searchGET(new Request("http://localhost/api/search?q=ab"))).status).toBe(401);
    const disabled = await makeUser({ enabled: false });
    as(disabled);
    expect((await searchGET(new Request("http://localhost/api/search?q=ab"))).status).toBe(403);
  });

  it("returns scoped results with no-store caching", async () => {
    await makeLead({ name: "Vega Unassigned" });
    const own = await makeLead({ name: "Vega Own" }, [{ userId: alice.id }]);
    as(alice);
    const res = await searchGET(new Request("http://localhost/api/search?q=vega"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.json() as { query: string; groups: { type: string; hits: { id: string }[] }[] };
    expect(body.query).toBe("vega");
    expect(body.groups.flatMap((g) => g.hits.map((h) => h.id))).toEqual([own.id]);
  });
});

describe("Prisma contains + LIKE wildcards (documents the behaviour escapeLike works around)", () => {
  it("unescaped `contains` treats % as a wildcard on PostgreSQL", async () => {
    await makeLead({ name: "Plain Lead" });
    expect(await prisma.lead.count({ where: { name: { contains: "%%", mode: "insensitive" } } })).toBe(1);
  });
  it("still finds names that really contain % or _", async () => {
    const lead = await makeLead({ name: "Deal 50%_off" });
    expect(ids(await globalSearch(actorOf(admin), "50%_"), "lead")).toEqual([lead.id]);
  });
});
