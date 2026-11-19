import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { getLeadInsertionLeads, getLeadInsertionReport } from "@/server/reports/lead-insertion";
import { actorOf, makeLead, makeUser, prisma, resetDb } from "./helpers/db";

// Exact MongoDB baseline (docs/LEAD_REPORT_AUDIT.md), grouped by IST day.
const BASELINE: Record<string, number> = {
  "2026-06-22": 1, "2026-06-23": 47, "2026-09-05": 6, "2026-10-05": 1, "2026-10-08": 1,
  "2026-10-09": 2, "2026-11-04": 1, "2026-11-05": 2, "2026-11-09": 1,
};
const NOW = new Date("2026-11-18T06:00:00Z"); // 11:30 IST, Wednesday 18 Nov 2026
const at = (istDate: string, hhmm = "10:00") => new Date(Date.parse(`${istDate}T${hhmm}:00Z`) - 330 * 60_000);
let phone = 7_000_000_000;
const seed = (createdAt: Date, extra: Record<string, unknown> = {}) =>
  makeLead({ createdAt, phone: String(phone++), initialStatus: "New Lead", ...extra });

async function seedBaseline() {
  for (const [d, n] of Object.entries(BASELINE)) {
    await prisma.lead.createMany({
      data: Array.from({ length: n }, (_, i) => ({
        name: `B ${d} ${i}`, phone: String(phone++), createdAt: at(d, `${String(8 + (i % 12)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}`),
      })),
    });
  }
}
const days = (r: Awaited<ReturnType<typeof getLeadInsertionReport>>) => Object.fromEntries(r.periods.map((p) => [p.period, p.total]));

describe("lead insertion report: aggregates", () => {
  beforeEach(resetDb);

  it("reproduces the 62-lead MongoDB baseline per IST day exactly", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    await seedBaseline();
    const r = await getLeadInsertionReport(admin, { preset: "custom", from: "2026-01-01", to: "2026-12-31" }, NOW);
    expect(days(r)).toEqual(BASELINE);
    expect(r.summary.total).toBe(62);
  });

  it("splits days at 18:30 UTC (IST midnight)", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    await seed(new Date("2026-11-04T18:29:59Z"));
    await seed(new Date("2026-11-04T18:30:00Z"));
    await seed(new Date("2026-11-05T18:29:59Z"));
    const r = await getLeadInsertionReport(admin, { preset: "custom", from: "2026-11-01", to: "2026-11-30" }, NOW);
    expect(days(r)).toEqual({ "2026-11-04": 1, "2026-11-05": 2 });
    // inclusive custom range ending exactly on a boundary day
    const one = await getLeadInsertionReport(admin, { preset: "custom", from: "2026-11-05", to: "2026-11-05" }, NOW);
    expect(one.summary.total).toBe(2);
  });

  it("supports today, yesterday, this week (Monday start), this month and custom", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    for (const d of ["2026-10-31", "2026-11-01", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18"]) await seed(at(d));
    await seed(new Date("2026-11-18T18:45:00Z")); // 19 Nov 00:15 IST: tomorrow, after NOW
    const total = async (preset: "today" | "yesterday" | "week" | "month") => (await getLeadInsertionReport(admin, { preset }, NOW)).summary.total;
    expect(await total("today")).toBe(1);
    expect(await total("yesterday")).toBe(1);
    expect(await total("week")).toBe(3); // 16, 17, 18 Nov
    expect(await total("month")).toBe(5); // 1, 15, 16, 17, 18 Nov
    const custom = await getLeadInsertionReport(admin, { preset: "custom", from: "2026-11-15", to: "2026-11-17" }, NOW);
    expect(days(custom)).toEqual({ "2026-11-15": 1, "2026-11-16": 1, "2026-11-17": 1 });
  });

  it("rejects invalid custom ranges", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    await expect(getLeadInsertionReport(admin, { preset: "custom", from: "2026-11-10", to: "2026-11-01" })).rejects.toMatchObject({ status: 400 });
    await expect(getLeadInsertionReport(admin, { preset: "custom", from: "nope", to: "2026-11-01" })).rejects.toMatchObject({ status: 400 });
  });

  it("groups weekly (Monday) and monthly", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    for (const d of ["2026-11-01", "2026-11-02", "2026-11-08", "2026-11-09", "2026-11-30", "2026-12-01"]) await seed(at(d));
    const range = { preset: "custom" as const, from: "2026-11-01", to: "2026-12-31" };
    const weekly = await getLeadInsertionReport(admin, { ...range, grouping: "week" }, NOW);
    expect(days(weekly)).toEqual({ "2026-10-26": 1, "2026-11-02": 2, "2026-11-09": 1, "2026-11-30": 2 });
    const monthly = await getLeadInsertionReport(admin, { ...range, grouping: "month" }, NOW);
    expect(days(monthly)).toEqual({ "2026-11-01": 5, "2026-12-01": 1 });
    expect(weekly.summary.total).toBe(6);
  });

  it("separates manual from imported and per source", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const d = at("2026-11-10");
    await seed(d, { source: "MANUAL" }); await seed(d, { source: "IMPORT" }); await seed(d, { source: "INDIAMART" });
    await seed(d, { source: "TRADEINDIA" }); await seed(d, { source: "COACHINGPROMO" }); await seed(d, { source: "PRINTKEE" });
    await seed(d, { source: "GIFTAGURU" }); await seed(d, { source: "WEBHOOK" }); await seed(d, { source: "LEGACY" });
    const q = { preset: "custom" as const, from: "2026-11-10", to: "2026-11-10" };
    const r = await getLeadInsertionReport(admin, q, NOW);
    expect(r.periods[0]).toMatchObject({ total: 9, manual: 1, imported: 8 });
    expect(r.summary.bySource).toEqual({ MANUAL: 1, IMPORT: 1, INDIAMART: 1, TRADEINDIA: 1, COACHINGPROMO: 1, PRINTKEE: 1, GIFTAGURU: 1, WEBHOOK: 1, LEGACY: 1 });
    expect((await getLeadInsertionReport(admin, { ...q, source: "MANUAL" }, NOW)).summary.total).toBe(1);
    expect((await getLeadInsertionReport(admin, { ...q, source: "INDIAMART" }, NOW)).summary.total).toBe(1);
    // Each website is its own source: GiftaGuru is not counted under PrintKee or the old unattributed bucket.
    expect((await getLeadInsertionReport(admin, { ...q, source: "GIFTAGURU" }, NOW)).summary.total).toBe(1);
    expect((await getLeadInsertionReport(admin, { ...q, source: "PRINTKEE" }, NOW)).summary.total).toBe(1);
    expect((await getLeadInsertionReport(admin, { ...q, source: "IMPORTED" }, NOW)).summary.total).toBe(8);
  });

  it("applies employee, assignment, status, status-at-insertion, file, batch and dataType filters", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const a = await makeUser({ name: "Asha" });
    const b = await makeUser({ name: "Bela" });
    const job = await prisma.leadImportJob.create({ data: { fileName: "march.csv", retryKey: randomUUID() } });
    const d = at("2026-11-10");
    await makeLead({ createdAt: d, initialStatus: "New Lead", dataType: "Offline", fileName: "march.csv", importJobId: job.id, source: "IMPORT" }, [{ userId: a.id }]);
    await makeLead({ createdAt: d, initialStatus: "Active", status: "Active", dataType: "Online" }, [{ userId: b.id }]);
    await makeLead({ createdAt: d, initialStatus: null, status: "Lost" }); // legacy, unassigned
    const q = { preset: "custom" as const, from: "2026-11-10", to: "2026-11-10" };
    const total = async (extra: Record<string, string>) => (await getLeadInsertionReport(admin, { ...q, ...extra }, NOW)).summary.total;
    expect(await total({})).toBe(3);
    expect(await total({ employee: a.id })).toBe(1);
    expect(await total({ employee: "unassigned" })).toBe(1);
    expect(await total({ assignment: "assigned" })).toBe(2);
    expect(await total({ assignment: "unassigned" })).toBe(1);
    expect(await total({ status: "Lost" })).toBe(1);
    expect(await total({ initialStatus: "Active" })).toBe(1);
    expect(await total({ initialStatus: "Unknown (legacy)" })).toBe(1);
    expect(await total({ fileName: "march.csv" })).toBe(1);
    expect(await total({ importJobId: job.id })).toBe(1);
    expect(await total({ dataType: "Online" })).toBe(1);
    expect(await total({ employee: a.id, dataType: "Online" })).toBe(0);
  });

  it("shows status at insertion separately from the current status; legacy null is Unknown", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const lead = await seed(at("2026-11-10"));
    await makeLead({ createdAt: at("2026-11-10"), initialStatus: null, phone: "8000000001" });
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "Converted" } });
    const page = await getLeadInsertionLeads(admin, { preset: "custom", from: "2026-11-10", to: "2026-11-10" }, { period: "2026-11-10" }, NOW);
    const row = page.rows.find((r) => r.id === lead.id);
    expect(row).toMatchObject({ statusAtInsertion: "New Lead", currentStatus: "Converted", insertedAtIst: "2026-11-10 10:00:00" });
    expect(page.rows.map((r) => r.statusAtInsertion).sort()).toEqual(["New Lead", "Unknown (legacy)"]);
    expect((await getLeadInsertionReport(admin, { preset: "custom", from: "2026-11-10", to: "2026-11-10", initialStatus: "New Lead", status: "Converted" }, NOW)).summary.total).toBe(1);
  });

  it("counts a multi-assignee lead once in the total and once per assignee", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const a = await makeUser({ name: "Asha" });
    const b = await makeUser({ name: "Bela" });
    const d = at("2026-11-10");
    await makeLead({ createdAt: d }, [{ userId: a.id }, { userId: b.id }]);
    await makeLead({ createdAt: d }, [{ userId: a.id }]);
    await makeLead({ createdAt: d });
    const r = await getLeadInsertionReport(admin, { preset: "custom", from: "2026-11-10", to: "2026-11-10" }, NOW);
    expect(r.summary).toMatchObject({ total: 3, assigned: 2, unassigned: 1, employeeAssignmentTotal: 4 });
    expect(Object.fromEntries(r.employees.map((e) => [e.name, e.leads]))).toEqual({ Asha: 2, Bela: 1, Unassigned: 1 });
    const page = await getLeadInsertionLeads(admin, { preset: "custom", from: "2026-11-10", to: "2026-11-10" }, {}, NOW);
    expect(page.total).toBe(3);
    expect(page.rows.find((x) => x.assignees.length === 2)?.assignees).toEqual(["Asha", "Bela"]);
  });

  it("paginates the drill-down server-side with a stable order and a 200 cap", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    // 130 leads sharing the same instant: ordering must still be deterministic.
    await prisma.lead.createMany({ data: Array.from({ length: 130 }, (_, i) => ({ name: `P${i}`, phone: String(6_000_000_000 + i), createdAt: at("2026-11-10") })) });
    const q = { preset: "custom" as const, from: "2026-11-10", to: "2026-11-10" };
    const p1 = await getLeadInsertionLeads(admin, q, { period: "2026-11-10" }, NOW);
    expect(p1).toMatchObject({ total: 130, page: 1, pageSize: 50, pageCount: 3 });
    expect(p1.rows).toHaveLength(50);
    const p2 = await getLeadInsertionLeads(admin, q, { period: "2026-11-10", page: 2 }, NOW);
    const p3 = await getLeadInsertionLeads(admin, q, { period: "2026-11-10", page: 3 }, NOW);
    expect(p3.rows).toHaveLength(30);
    const ids = [...p1.rows, ...p2.rows, ...p3.rows].map((r) => r.id);
    expect(new Set(ids).size).toBe(130);
    expect((await getLeadInsertionLeads(admin, q, { period: "2026-11-10", page: 2 }, NOW)).rows.map((r) => r.id)).toEqual(p2.rows.map((r) => r.id));
    expect((await getLeadInsertionLeads(admin, q, { pageSize: 5000 }, NOW)).pageSize).toBe(200);
    expect((await getLeadInsertionLeads(admin, q, { pageSize: 200 }, NOW)).rows).toHaveLength(130);
  });

  it("drills a week or month period down only to leads inside the selected range", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    for (const d of ["2026-11-01", "2026-11-03", "2026-11-04"]) await seed(at(d));
    const q = { preset: "custom" as const, from: "2026-11-03", to: "2026-11-30", grouping: "week" as const };
    const report = await getLeadInsertionReport(admin, q, NOW);
    expect(days(report)).toEqual({ "2026-11-02": 2 });
    const page = await getLeadInsertionLeads(admin, q, { period: "2026-11-02" }, NOW);
    expect(page.total).toBe(2);
  });

  it("renders an empty range as zero rows", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    await seed(at("2026-11-10"));
    const r = await getLeadInsertionReport(admin, { preset: "custom", from: "2025-01-01", to: "2025-01-31" }, NOW);
    expect(r.periods).toEqual([]);
    expect(r.summary.total).toBe(0);
    expect(r.employees).toEqual([]);
    const page = await getLeadInsertionLeads(admin, { preset: "custom", from: "2025-01-01", to: "2025-01-31" }, {}, NOW);
    expect(page).toMatchObject({ total: 0, rows: [], pageCount: 0 });
  });
});
