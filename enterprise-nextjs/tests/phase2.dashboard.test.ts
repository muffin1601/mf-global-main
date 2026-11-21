import { beforeEach, describe, expect, it } from "vitest";
import { getLeadsPerDay, getQuotationKpis } from "@/server/dashboard/metrics";
import { actorOf, makeLead, makeUser, prisma, resetDb } from "./helpers/db";

type U = Awaited<ReturnType<typeof makeUser>>;
let admin: U, alice: U, bob: U;
const NOW = new Date("2026-11-20T10:00:00Z"); // 15:30 IST, 20 Nov

beforeEach(async () => {
  await resetDb();
  admin = await makeUser({ role: "ADMIN" });
  alice = await makeUser();
  bob = await makeUser();
});

describe("dashboard (Phase 2)", () => {
  it("leads per day is scoped: a user only counts leads assigned with view access", async () => {
    await makeLead({ createdAt: new Date("2026-11-20T05:00:00Z") }, [{ userId: alice.id }]);
    await makeLead({ createdAt: new Date("2026-11-20T06:00:00Z") }, [{ userId: bob.id }]);
    const hidden = await makeLead({ createdAt: new Date("2026-11-19T18:29:00Z") }); // 23:59 IST on the 19th
    await prisma.leadAssignment.create({ data: { leadId: hidden.id, userId: alice.id, canView: false } });
    const sum = (rows: { count: number }[]) => rows.reduce((s, r) => s + r.count, 0);
    const forAlice = await getLeadsPerDay(actorOf(alice), 7, NOW);
    expect(sum(forAlice)).toBe(1);
    expect(forAlice.find((d) => d.date === "2026-11-20")?.count).toBe(1);
    const forAdmin = await getLeadsPerDay(actorOf(admin), 7, NOW);
    expect(forAdmin.find((d) => d.date === "2026-11-19")?.count).toBe(1);
    expect(sum(forAdmin)).toBe(3);
  });

  it("quotation KPIs: admin sees all, users their own; 'this month' starts at the IST month boundary", async () => {
    const q = (userId: string, grandTotal: string, createdAt: string) =>
      prisma.quotation.create({ data: { userId, party: {}, invoiceDetails: {}, grandTotal, createdAt: new Date(createdAt) } });
    await q(alice.id, "1180.50", "2026-11-05T05:00:00Z");
    await q(alice.id, "100.25", "2026-10-31T18:30:00Z"); // 00:00 IST on 1 Nov -> this month
    await q(alice.id, "99.99", "2026-10-31T18:29:59Z"); // 23:59:59 IST on 31 Oct -> last month
    await q(bob.id, "500.00", "2026-11-10T05:00:00Z");
    expect(await getQuotationKpis(actorOf(alice), NOW)).toEqual({ count: 3, total: 1380.74, monthCount: 2, monthTotal: 1280.75 });
    expect(await getQuotationKpis(actorOf(admin), NOW)).toEqual({ count: 4, total: 1880.74, monthCount: 3, monthTotal: 1780.75 });
    expect(await getQuotationKpis(actorOf(bob), NOW)).toMatchObject({ count: 1, total: 500 });
  });
});
