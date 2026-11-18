import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { explainLeadInsertionAggregate, getLeadInsertionFilterOptions, getLeadInsertionLeads, getLeadInsertionReport } from "@/server/reports/lead-insertion";
import { exportLeadInsertion } from "@/server/reports/lead-insertion-export";
import { actorOf, makeLead, makeUser, prisma, resetDb } from "./helpers/db";

const NOW = new Date("2026-11-18T06:00:00Z");
const at = (istDate: string, hhmm = "10:00") => new Date(Date.parse(`${istDate}T${hhmm}:00Z`) - 330 * 60_000);
const Q = { preset: "custom" as const, from: "2026-11-01", to: "2026-11-30" };

async function world() {
  const admin = actorOf(await makeUser({ role: "ADMIN" }));
  const asha = await makeUser({ name: "Asha" });
  const bela = await makeUser({ name: "Bela" });
  const loner = await makeUser({ name: "Loner" });
  await makeLead({ createdAt: at("2026-11-10"), name: "=cmd()", source: "IMPORT", fileName: "a.csv" }, [{ userId: asha.id }]);
  await makeLead({ createdAt: at("2026-11-11") }, [{ userId: asha.id }, { userId: bela.id }]);
  await makeLead({ createdAt: at("2026-11-12") }, [{ userId: bela.id }]);
  await makeLead({ createdAt: at("2026-11-12", "11:00") }); // unassigned
  return { admin, asha: actorOf(asha), bela: actorOf(bela), loner: actorOf(loner) };
}

const csvRows = (csv: string) => csv.replace(/^﻿/, "").trim().split("\r\n").length - 1;

describe("lead insertion report: access control", () => {
  beforeEach(resetDb);

  it("admin sees everything; an assigned user only their leads; an unassigned user nothing", async () => {
    const { admin, asha, bela, loner } = await world();
    expect((await getLeadInsertionReport(admin, Q, NOW)).summary.total).toBe(4);
    expect((await getLeadInsertionReport(asha, Q, NOW)).summary.total).toBe(2);
    expect((await getLeadInsertionReport(bela, Q, NOW)).summary.total).toBe(2);
    const none = await getLeadInsertionReport(loner, Q, NOW);
    expect(none.summary.total).toBe(0);
    expect(none.periods).toEqual([]);
  });

  it("scopes drill-down, per-employee table, filter options and 'unassigned' for users", async () => {
    const { asha, loner } = await world();
    const page = await getLeadInsertionLeads(asha, Q, {}, NOW);
    expect(page.total).toBe(2);
    expect(page.rows.every((r) => r.assignees.includes("Asha"))).toBe(true);
    const r = await getLeadInsertionReport(asha, Q, NOW);
    expect(r.employees).toEqual([{ userId: asha.id, name: "Asha", leads: 2 }]); // no other employees leaked
    expect((await getLeadInsertionReport(asha, { ...Q, employee: "unassigned" }, NOW)).summary.total).toBe(0);
    expect((await getLeadInsertionLeads(loner, Q, {}, NOW)).total).toBe(0);
    const opts = await getLeadInsertionFilterOptions(asha);
    expect(opts.employees).toEqual([{ id: asha.id, name: "Asha" }]);
    expect(opts.files).toEqual(["a.csv"]);
    expect((await getLeadInsertionFilterOptions(loner)).files).toEqual([]);
  });

  it("scopes every export format to the user", async () => {
    const { admin, bela, loner } = await world();
    expect(csvRows((await exportLeadInsertion(bela, Q, "csv", NOW)).body as string)).toBe(2);
    expect(csvRows((await exportLeadInsertion(loner, Q, "csv", NOW)).body as string)).toBe(0);
    expect(csvRows((await exportLeadInsertion(admin, Q, "csv", NOW)).body as string)).toBe(4);
    const ws = (await readXlsx((await exportLeadInsertion(bela, Q, "xlsx", NOW)).body as Buffer));
    expect((ws?.rowCount ?? 0) - 1).toBe(2);
  });
});

async function readXlsx(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb.worksheets[0];
}

describe("lead insertion report: exports", () => {
  beforeEach(resetDb);

  it("export row count equals the summary total for csv and xlsx, with filters applied", async () => {
    const { admin } = await world();
    for (const filters of [Q as Record<string, string>, { ...Q, source: "IMPORT" }, { ...Q, assignment: "unassigned" }, { ...Q, preset: "custom" as const, from: "2025-01-01", to: "2025-01-02" }]) {
      const total = (await getLeadInsertionReport(admin, filters, NOW)).summary.total;
      const csv = await exportLeadInsertion(admin, filters, "csv", NOW);
      const xlsx = await exportLeadInsertion(admin, filters, "xlsx", NOW);
      expect(csvRows(csv.body as string)).toBe(total);
      expect(((await readXlsx(xlsx.body as Buffer))?.rowCount ?? 0) - 1).toBe(total);
      expect(csv.rowCount).toBe(total);
    }
  });

  it("neutralises formula injection and uses IST insertion time", async () => {
    const { admin } = await world();
    const csv = (await exportLeadInsertion(admin, { ...Q, source: "IMPORT" }, "csv", NOW)).body as string;
    expect(csv).toContain("'=cmd()");
    expect(csv).toContain("2026-11-10 10:00:00");
    expect(csv.split("\r\n")[0]).toContain("Status at insertion");
  });

  it("produces a valid, non-empty PDF with the summary", async () => {
    const { admin } = await world();
    const pdf = await exportLeadInsertion(admin, Q, "pdf", NOW);
    const buf = pdf.body as Buffer;
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(1000);
    expect(pdf.rowCount).toBe(4);
    const empty = await exportLeadInsertion(admin, { ...Q, from: "2025-01-01", to: "2025-01-02" }, "pdf", NOW);
    expect((empty.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("rejects an unknown format", async () => {
    const { admin } = await world();
    await expect(exportLeadInsertion(admin, Q, "doc", NOW)).rejects.toMatchObject({ status: 400 });
  });
});

describe("lead insertion report: scale and indexes", () => {
  beforeEach(resetDb);

  it("aggregates 5,000 leads correctly and quickly, using the created_at index for a narrow range", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const sources = ["MANUAL", "IMPORT", "INDIAMART", "TRADEINDIA"] as const;
    const base = Date.parse("2026-01-01T00:00:00Z");
    const data = Array.from({ length: 5000 }, (_, i) => ({
      name: `S${i}`, phone: String(5_000_000_000 + i), source: sources[i % 4],
      createdAt: new Date(base + i * 3_600_000 * 1.7),
    }));
    await prisma.lead.createMany({ data });
    await prisma.$executeRawUnsafe("ANALYZE leads");
    const started = Date.now();
    const r = await getLeadInsertionReport(admin, { preset: "custom", from: "2025-12-01", to: "2027-12-31" }, NOW);
    const ms = Date.now() - started;
    expect(r.summary.total).toBe(5000);
    expect(r.periods.reduce((n, p) => n + p.total, 0)).toBe(5000);
    expect(r.summary.manual + r.summary.imported).toBe(5000);
    expect(r.summary.bySource.MANUAL).toBe(1250);
    expect(ms).toBeLessThan(3000);
    const expected = new Map<string, number>();
    for (const d of data) {
      const k = new Date(d.createdAt.getTime() + 330 * 60_000).toISOString().slice(0, 10);
      expected.set(k, (expected.get(k) ?? 0) + 1);
    }
    expect(Object.fromEntries(r.periods.map((p) => [p.period, p.total]))).toEqual(Object.fromEntries(expected));
    const plan = await explainLeadInsertionAggregate(admin, { preset: "custom", from: "2026-03-01", to: "2026-03-02" }, NOW);
    expect(plan).toMatch(/leads_created_at_idx|leads_source_created_at_idx|leads_status_created_at_idx/);
    expect(plan).not.toMatch(/Seq Scan on leads/);
  });
});
