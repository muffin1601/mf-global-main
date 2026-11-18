import { beforeAll, describe, expect, it } from "vitest";
import { actorOf, makeLead, makeUser, prisma, resetDb } from "./helpers/db";
import { getKpis, getLeadsPerDay, getPerformance, getStatusBreakdown } from "@/server/dashboard/metrics";
import { resolveRange } from "@/server/dashboard/range";

// 18 Nov 2026 15:30 IST. IST today = [2026-11-17T18:30Z, 2026-11-18T18:30Z).
const NOW = new Date("2026-11-18T10:00:00Z");
const D = (s: string) => new Date(s);

let admin: Awaited<ReturnType<typeof makeUser>>;
let alice: Awaited<ReturnType<typeof makeUser>>;
let bob: Awaited<ReturnType<typeof makeUser>>;
let nobody: Awaited<ReturnType<typeof makeUser>>;

// Independent oracle: load rows and filter in JS (no shared where-clauses with the service).
async function oracle(userId?: string) {
  const all = await prisma.lead.findMany({ include: { assignments: true } });
  const mine = all.filter((l) => !userId || l.assignments.some((a) => a.userId === userId && a.canView));
  const todayStart = D("2026-11-17T18:30:00Z").getTime();
  const tomorrowStart = D("2026-11-18T18:30:00Z").getTime();
  const fu = (l: { followUpDate: Date | null }) => l.followUpDate?.getTime();
  const total = mine.length;
  const converted = mine.filter((l) => l.status === "Won Lead").length;
  return {
    total, converted,
    newToday: mine.filter((l) => l.createdAt.getTime() >= todayStart && l.createdAt.getTime() < tomorrowStart).length,
    assigned: mine.filter((l) => l.assignments.length > 0).length,
    unassigned: mine.filter((l) => l.assignments.length === 0).length,
    trending: mine.filter((l) => l.status === "In Progress").length,
    lost: mine.filter((l) => l.status === "Lost Lead").length,
    followUpsToday: mine.filter((l) => fu(l) !== undefined && fu(l)! >= todayStart && fu(l)! < tomorrowStart).length,
    upcoming: mine.filter((l) => fu(l) !== undefined && fu(l)! >= tomorrowStart).length,
    overdue: mine.filter((l) => fu(l) !== undefined && fu(l)! < todayStart && l.status !== "Won Lead" && l.status !== "Lost Lead").length,
    conversionRate: total ? Math.round((converted / total) * 10000) / 100 : 0,
  };
}

beforeAll(async () => {
  await resetDb();
  admin = await makeUser({ role: "ADMIN" });
  alice = await makeUser();
  bob = await makeUser();
  nobody = await makeUser();
  const A = [{ userId: alice.id }];
  const B = [{ userId: bob.id }];
  // Alice: new-today (just inside IST day), Won (also legacy values must NOT count), trending, overdue follow-up...
  await makeLead({ createdAt: D("2026-11-17T18:30:00Z"), status: "New Lead", followUpDate: D("2026-11-18T18:29:59Z") }, A); // new today, follow-up today (last second)
  await makeLead({ createdAt: D("2026-11-17T18:29:59Z"), status: "Won Lead", followUpDate: D("2026-11-17T18:29:59Z") }, A); // yesterday IST; won so not overdue
  await makeLead({ createdAt: D("2026-11-10T00:00:00Z"), status: "In Progress", followUpDate: D("2026-11-18T18:30:00Z") }, A); // upcoming (first instant)
  await makeLead({ createdAt: D("2026-11-10T00:00:00Z"), status: "Followed Up", followUpDate: D("2026-11-17T18:29:59Z") }, A); // overdue (last instant of yesterday)
  await makeLead({ createdAt: D("2026-11-10T00:00:00Z"), status: "Lost Lead", followUpDate: D("2026-11-01T00:00:00Z") }, A); // lost, not overdue
  await makeLead({ createdAt: D("2026-11-10T00:00:00Z"), status: "Converted" }, A); // legacy-looking value: never counts as won
  // Bob
  await makeLead({ createdAt: D("2026-11-18T05:00:00Z"), status: "Won Lead" }, B);
  await makeLead({ createdAt: D("2026-11-18T06:00:00Z"), status: "Won Lead" }, B);
  await makeLead({ createdAt: D("2026-11-05T06:00:00Z"), status: "New Lead" }, B);
  // Shared by both and unassigned
  await makeLead({ createdAt: D("2026-11-16T06:00:00Z"), status: "In Progress" }, [{ userId: alice.id }, { userId: bob.id }]);
  await makeLead({ createdAt: D("2026-11-18T01:00:00Z"), status: "New Lead", followUpDate: D("2026-11-18T09:00:00Z") });
  await makeLead({ createdAt: D("2026-10-01T01:00:00Z"), status: "Won Lead", followUpDate: D("2026-10-02T09:00:00Z") });
});

describe("dashboard KPIs equal independent counts", () => {
  it("admin", async () => {
    const k = await getKpis(actorOf(admin), NOW);
    const o = await oracle();
    expect(k).toEqual(o);
    expect(k.total).toBe(12);
    expect(k.converted).toBe(4); // exactly 'Won Lead'; status 'Converted' excluded
    expect(await prisma.lead.count({ where: { status: "Won Lead" } })).toBe(k.converted);
    expect(await prisma.lead.count()).toBe(k.total);
  });
  it("assigned user sees only own leads", async () => {
    const k = await getKpis(actorOf(alice), NOW);
    expect(k).toEqual(await oracle(alice.id));
    expect(k.total).toBe(7);
    expect(k.unassigned).toBe(0);
    expect(k.assigned).toBe(k.total);
  });
  it("user with no assignments sees zeros", async () => {
    const k = await getKpis(actorOf(nobody), NOW);
    expect(k).toEqual({ total: 0, newToday: 0, assigned: 0, unassigned: 0, converted: 0, trending: 0, lost: 0, conversionRate: 0, followUpsToday: 0, upcoming: 0, overdue: 0 });
    expect(await oracle(nobody.id)).toMatchObject({ total: 0 });
  });
  it("respects IST day boundaries at 18:29:59Z / 18:30:00Z", async () => {
    const k = await getKpis(actorOf(alice), NOW);
    // new today: lead at 18:30:00Z counts, lead at 18:29:59Z does not.
    expect(k.newToday).toBe(1);
    // follow-up 18:29:59Z next day = today; 18:30:00Z = upcoming.
    expect(k.followUpsToday).toBe(1);
    expect(k.upcoming).toBe(1);
    // overdue: only the non-final-status lead at 2026-11-17T18:29:59Z.
    expect(k.overdue).toBe(1);
    // moving "now" one second past the boundary shifts the IST day
    const later = await getKpis(actorOf(alice), new Date("2026-11-18T18:30:00Z"));
    expect(later.newToday).toBe(0);
    expect(later.followUpsToday).toBe(1); // the 18:30:00Z follow-up is now today
    expect(later.overdue).toBe(2);
  });
});

describe("performance table", () => {
  it("all time: admin sees everyone, user only themself", async () => {
    const rows = await getPerformance(actorOf(admin));
    const byName = Object.fromEntries(rows.map((r) => [r.userId, r]));
    expect(byName[alice.id]).toMatchObject({ leads: 7, deals: 1, closePct: 14.29 });
    expect(byName[bob.id]).toMatchObject({ leads: 4, deals: 2, closePct: 50 });
    expect(rows).toHaveLength(2);
    const own = await getPerformance(actorOf(bob));
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ userId: bob.id, leads: 4, deals: 2 });
    expect(await getPerformance(actorOf(nobody))).toEqual([]);
  });
  it("today / week / month / custom windows (IST)", async () => {
    const admins = actorOf(admin);
    const count = async (w: ReturnType<typeof resolveRange>) => {
      const rows = await getPerformance(admins, w);
      return { alice: rows.find((r) => r.userId === alice.id)?.leads ?? 0, bob: rows.find((r) => r.userId === bob.id)?.leads ?? 0 };
    };
    expect(await count(resolveRange("today", undefined, undefined, NOW))).toEqual({ alice: 1, bob: 2 });
    // week starts Monday 16 Nov IST: includes 16 Nov 06:00Z shared lead
    expect(await count(resolveRange("week", undefined, undefined, NOW))).toEqual({ alice: 3, bob: 3 });
    expect(await count(resolveRange("month", undefined, undefined, NOW))).toEqual({ alice: 7, bob: 4 });
    expect(await count(resolveRange("all"))).toEqual({ alice: 7, bob: 4 });
    expect(await count(resolveRange("custom", "2026-11-18", "2026-11-18"))).toEqual({ alice: 1, bob: 2 });
    expect(await count(resolveRange("custom", "2026-11-05", "2026-11-05"))).toEqual({ alice: 0, bob: 1 });
    // deals respect the window too
    const todayRows = await getPerformance(admins, resolveRange("today", undefined, undefined, NOW));
    expect(todayRows.find((r) => r.userId === bob.id)).toMatchObject({ leads: 2, deals: 2, closePct: 100 });
  });
  it("rejects an inverted custom range", () => {
    expect(() => resolveRange("custom", "2026-11-10", "2026-11-01")).toThrow();
  });
});

describe("chart queries", () => {
  it("status breakdown equals groupBy of real rows and is scoped", async () => {
    const adminRows = await getStatusBreakdown(actorOf(admin));
    expect(adminRows.reduce((s, r) => s + r.count, 0)).toBe(12);
    expect(adminRows.find((r) => r.status === "Won Lead")?.count).toBe(4);
    const aliceRows = await getStatusBreakdown(actorOf(alice));
    expect(aliceRows.reduce((s, r) => s + r.count, 0)).toBe(7);
    expect(await getStatusBreakdown(actorOf(nobody))).toEqual([]);
  });
  it("leads per day: 30 zero-filled IST days that sum to the real count", async () => {
    const days = await getLeadsPerDay(actorOf(admin), 30, NOW);
    expect(days).toHaveLength(30);
    expect(days[29]?.date).toBe("2026-11-18");
    // 17:xx-18:29 UTC on 17 Nov belongs to IST 17th; 18:30Z belongs to the 18th.
    expect(days.find((d) => d.date === "2026-11-17")?.count).toBe(1);
    expect(days.find((d) => d.date === "2026-11-18")?.count).toBe(4);
    const inWindow = await prisma.lead.count({ where: { createdAt: { gte: new Date("2026-10-19T18:30:00Z"), lt: new Date("2026-11-18T18:30:00Z") } } });
    expect(days.reduce((s, d) => s + d.count, 0)).toBe(inWindow);
  });
});
