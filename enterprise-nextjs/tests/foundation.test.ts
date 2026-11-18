import { beforeEach, describe, expect, it } from "vitest";
import { addDaysIst, istDateString, istDayEndExclusive, istDayStart, istRange, istToday, istWeekStart } from "@/lib/time/ist";
import { rateLimit } from "@/lib/rate-limit";
import { toCsv, toXlsx } from "@/lib/export/tabular";
import { makeLead, prisma, resetDb } from "./helpers/db";
import ExcelJS from "exceljs";

describe("IST business dates", () => {
  it("places the day boundary at 18:30 UTC", () => {
    expect(istDateString(new Date("2026-11-17T18:29:59Z"))).toBe("2026-11-17");
    expect(istDateString(new Date("2026-11-17T18:30:00Z"))).toBe("2026-11-18");
  });
  it("converts a date to its UTC instants", () => {
    expect(istDayStart("2026-11-18").toISOString()).toBe("2026-11-17T18:30:00.000Z");
    expect(istDayEndExclusive("2026-11-18").toISOString()).toBe("2026-11-18T18:30:00.000Z");
  });
  it("gives the same answer regardless of server timezone (UTC server, IST evening)", () => {
    // 23:30 IST on 18 Nov is 18:00 UTC on 18 Nov: still the 18th in India.
    expect(istToday(new Date("2026-11-18T18:00:00Z")).date).toBe("2026-11-18");
    // 00:15 IST on 19 Nov is 18:45 UTC on 18 Nov: UTC says the 18th, India says the 19th.
    expect(istToday(new Date("2026-11-18T18:45:00Z")).date).toBe("2026-11-19");
  });
  it("builds inclusive ranges and week starts", () => {
    const r = istRange("2026-11-01", "2026-11-30");
    expect(r.gte.toISOString()).toBe("2026-10-31T18:30:00.000Z");
    expect(r.lt.toISOString()).toBe("2026-11-30T18:30:00.000Z");
    expect(istWeekStart("2026-11-18")).toBe("2026-11-16"); // Wednesday -> Monday
    expect(istWeekStart("2026-11-22")).toBe("2026-11-16"); // Sunday -> Monday
    expect(addDaysIst("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("rejects malformed dates", () => {
    expect(() => istDayStart("18-11-2026")).toThrow();
    expect(() => istDayStart("2026-13-45")).toThrow();
  });
});

describe("database guarantees (real PostgreSQL)", () => {
  beforeEach(resetDb);

  it("makes leads.created_at immutable but allows other updates", async () => {
    const lead = await makeLead({ createdAt: new Date("2026-06-23T05:00:00Z") });
    await expect(prisma.lead.update({ where: { id: lead.id }, data: { createdAt: new Date() } })).rejects.toThrow(/immutable/);
    const updated = await prisma.lead.update({ where: { id: lead.id }, data: { status: "In Progress" } });
    expect(updated.status).toBe("In Progress");
    expect(updated.createdAt.toISOString()).toBe("2026-06-23T05:00:00.000Z");
  });

  it("keeps RLS enabled and gives the Data API roles no table access", async () => {
    const noRls = await prisma.$queryRaw<{ n: number }[]>`select count(*)::int n from pg_tables where schemaname='public' and tablename <> '_prisma_migrations' and not rowsecurity`;
    expect(noRls[0]!.n).toBe(0);
    const grants = await prisma.$queryRaw<{ n: number }[]>`select count(*)::int n from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated')`;
    expect(grants[0]!.n).toBe(0);
  });

  it("enforces a unique external key for idempotent integrations", async () => {
    await makeLead({ externalKey: "indiamart:Q1" });
    await expect(makeLead({ externalKey: "indiamart:Q1" })).rejects.toThrow();
  });
});

describe("persistent rate limiter", () => {
  beforeEach(resetDb);

  it("allows up to the limit then blocks, per key", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await rateLimit("t:a", 3, 60_000)).allowed);
    expect(results).toEqual([true, true, true, false]);
    expect((await rateLimit("t:b", 3, 60_000)).allowed).toBe(true);
  });

  it("starts a fresh window once the old one has expired", async () => {
    await rateLimit("t:c", 1, 60_000);
    expect((await rateLimit("t:c", 1, 60_000)).allowed).toBe(false);
    await prisma.rateLimitBucket.update({ where: { key: "t:c" }, data: { windowStart: new Date(Date.now() - 120_000) } });
    expect((await rateLimit("t:c", 1, 60_000)).allowed).toBe(true);
  });

  it("is atomic under concurrency", async () => {
    const out = await Promise.all(Array.from({ length: 10 }, () => rateLimit("t:d", 4, 60_000)));
    expect(out.filter((r) => r.allowed)).toHaveLength(4);
  });
});

describe("exports", () => {
  const cols = [
    { key: "name", header: "Name", value: (r: { name: string; n: number }) => r.name },
    { key: "n", header: "Qty", value: (r: { name: string; n: number }) => r.n },
  ];
  it("neutralises formula injection in CSV and XLSX and keeps a BOM", async () => {
    const rows = [{ name: '=HYPERLINK("http://evil")', n: 5 }, { name: 'say "hi", ok', n: 6 }];
    const csv = toCsv(cols, rows);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain(`"say ""hi"", ok",6`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await toXlsx("Leads", cols, rows)) as never);
    const ws = wb.worksheets[0]!;
    expect(ws.getRow(2).getCell(1).value).toBe(`'=HYPERLINK("http://evil")`);
    expect(ws.getRow(2).getCell(2).value).toBe(5);
  });
});
