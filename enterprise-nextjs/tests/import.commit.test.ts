import { createHash, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { analyzeRows, parseLeadCsv, type AnalyzedRow } from "@/lib/imports/lead-csv";
import {
  buildImportReportCsv, listImportHistory, processImportBatch, startImportJob, type BatchEntry,
} from "@/server/imports/service";
import { createLeadTx } from "@/server/leads/ingest";
import { actorOf, makeLead, makeUser, prisma, resetDb } from "./helpers/db";

const HEADER = "Company Name,Contact Person,Mobile Number,Email,City,State,Category,Requirements,Remarks";
const csvOf = (n: number, extra: string[] = []) =>
  [HEADER, ...Array.from({ length: n }, (_, i) => `Co${i},Person${i},${9100000000 + i},p${i}@x.com,Delhi,Delhi,steel,,`), ...extra].join("\n");
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

function entriesOf(csv: string): { entries: BatchEntry[]; total: number } {
  const parsed = parseLeadCsv(csv);
  if (!parsed.ok) throw new Error(parsed.error);
  const a = analyzeRows(parsed.rows);
  return { total: a.rows.length, entries: a.rows.map((r: AnalyzedRow) => r.status === "Valid"
    ? { kind: "row", rowNumber: r.rowNumber, data: r.data }
    : { kind: "report", rowNumber: r.rowNumber, company: r.company, status: r.status, reason: r.reason }) };
}

async function runImport(actor: ReturnType<typeof actorOf>, csv: string, opts: { assignTo?: string; clientKey?: string; batch?: number } = {}) {
  const { entries, total } = entriesOf(csv);
  const { job } = await startImportJob(actor, { fileName: "leads.csv", totalRows: total, sha256: sha(csv), clientKey: opts.clientKey ?? randomUUID(), assignTo: opts.assignTo });
  let last;
  const size = opts.batch ?? 500;
  for (let i = 0; i < entries.length; i += size) last = await processImportBatch(actor, job.id, { sha256: sha(csv), entries: entries.slice(i, i + size) });
  return { job, last: last! };
}

describe("lead import commit (stateless, idempotent)", () => {
  beforeEach(resetDb);

  it("imports in batches with source IMPORT, importJobId, fileName, externalKey and a row report", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const csv = csvOf(5, ["BadCo,,9123456780,,,,,,", "Dup,Z,9100000000,,,,,,"]);
    const { job, last } = await runImport(admin, csv, { batch: 3 });
    expect(last).toMatchObject({ done: true, imported: 5, skipped: 1, duplicates: 1, processed: 7 });
    const leads = await prisma.lead.findMany({ where: { importJobId: job.id }, orderBy: { phone: "asc" } });
    expect(leads).toHaveLength(5);
    expect(leads[0]).toMatchObject({ source: "IMPORT", fileName: "leads.csv", status: "New Lead", dataType: "Other", category: "Steel", createdById: admin.id });
    expect(leads[0]!.externalKey).toMatch(new RegExp(`^import:${job.id}:\\d+$`));
    const j = await prisma.leadImportJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(j).toMatchObject({ status: "COMPLETED", imported: 5, skipped: 1, duplicates: 1, totalRows: 7 });
    expect(await prisma.leadAssignment.count()).toBe(0);
    expect(await prisma.activityLog.count({ where: { action: "lead.import.completed" } })).toBe(1);
  });

  it("is idempotent when the same batch is replayed", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const csv = csvOf(4);
    const { entries, total } = entriesOf(csv);
    const { job } = await startImportJob(admin, { fileName: "a.csv", totalRows: total, sha256: sha(csv), clientKey: randomUUID() });
    const first = await processImportBatch(admin, job.id, { sha256: sha(csv), entries });
    const second = await processImportBatch(admin, job.id, { sha256: sha(csv), entries });
    expect(first.insertedThisBatch).toBe(4);
    expect(second).toMatchObject({ insertedThisBatch: 0, alreadyProcessed: 4, imported: 4, done: true });
    expect(await prisma.lead.count()).toBe(4);
    expect(await prisma.leadImportRow.count()).toBe(4);
  });

  it("resumes after a partial failure without duplicating or losing rows", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const csv = csvOf(6);
    const { entries, total } = entriesOf(csv);
    const { job } = await startImportJob(admin, { fileName: "a.csv", totalRows: total, sha256: sha(csv), clientKey: randomUUID() });
    let calls = 0;
    const flaky = { createLeadTx: ((...args: Parameters<typeof createLeadTx>) => {
      if (++calls === 4) throw new Error("connection reset");
      return createLeadTx(...args);
    }) as typeof createLeadTx };
    const broken = await processImportBatch(admin, job.id, { sha256: sha(csv), entries }, flaky);
    expect(broken).toMatchObject({ failed: 1, imported: 5, done: false });
    expect(await prisma.lead.count()).toBe(5);
    const resumed = await processImportBatch(admin, job.id, { sha256: sha(csv), entries });
    expect(resumed).toMatchObject({ failed: 0, insertedThisBatch: 1, imported: 6, done: true });
    expect(await prisma.lead.count()).toBe(6);
  });

  it("an identical file imported twice (new session) creates no duplicate leads", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const csv = csvOf(5);
    await runImport(admin, csv);
    const again = await runImport(admin, csv);
    expect(again.last).toMatchObject({ imported: 0, duplicates: 5, done: true });
    expect(await prisma.lead.count()).toBe(5);
    expect(await prisma.leadImportJob.count()).toBe(2);
  });

  it("resuming a job with the same client key reuses the job", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const input = { fileName: "a.csv", totalRows: 3, sha256: sha("x"), clientKey: randomUUID() };
    const a = await startImportJob(admin, input);
    const b = await startImportJob(admin, input);
    expect(b.resumed).toBe(true);
    expect(b.job.id).toBe(a.job.id);
  });

  it("only admins can assign on import; a user's assignTo is ignored (leads stay unassigned)", async () => {
    const adminU = await makeUser({ role: "ADMIN" });
    const userU = await makeUser();
    const target = await makeUser();
    const adminRun = await runImport(actorOf(adminU), csvOf(2), { assignTo: target.id });
    const assigned = await prisma.leadAssignment.findMany({ where: { lead: { importJobId: adminRun.job.id } } });
    expect(assigned).toHaveLength(2);
    expect(assigned[0]).toMatchObject({ userId: target.id, canView: true, canUpdate: false, canDelete: false });
    expect(adminRun.job.assignedToName).toBe(target.name);

    const csv2 = csvOf(2).replace(/9100000000/g, "9200000000").replace(/9100000001/g, "9200000001").replace(/p0@/, "q0@").replace(/p1@/, "q1@");
    const userRun = await runImport(actorOf(userU), csv2, { assignTo: target.id });
    expect(userRun.job.assignedToName).toBeNull();
    expect(await prisma.leadAssignment.count({ where: { lead: { importJobId: userRun.job.id } } })).toBe(0);
  });

  it("rejects an unknown assignee, a checksum mismatch, foreign jobs and out-of-range rows", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const other = actorOf(await makeUser({ role: "ADMIN" }));
    await expect(startImportJob(admin, { fileName: "a.csv", totalRows: 1, sha256: sha("x"), clientKey: randomUUID(), assignTo: randomUUID() })).rejects.toMatchObject({ status: 400 });
    await expect(startImportJob(admin, { fileName: "a.csv", totalRows: 0, sha256: sha("x"), clientKey: randomUUID() })).rejects.toMatchObject({ status: 400 });
    const { job } = await startImportJob(admin, { fileName: "a.csv", totalRows: 1, sha256: sha("x"), clientKey: randomUUID() });
    const row: BatchEntry = { kind: "row", rowNumber: 2, data: { company: "A", name: "B", phone: "9876543210" } };
    await expect(processImportBatch(admin, job.id, { sha256: sha("y"), entries: [row] })).rejects.toMatchObject({ status: 409 });
    await expect(processImportBatch(other, job.id, { sha256: sha("x"), entries: [row] })).rejects.toMatchObject({ status: 403 });
    await expect(processImportBatch(admin, job.id, { sha256: sha("x"), entries: [{ ...row, rowNumber: 9 }] })).rejects.toMatchObject({ status: 400 });
    await expect(processImportBatch(admin, "not-a-uuid", { sha256: sha("x"), entries: [row] })).rejects.toMatchObject({ status: 404 });
    expect(await prisma.lead.count()).toBe(0);
  });

  it("re-validates rows server-side (a tampered client cannot insert invalid data)", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const { job } = await startImportJob(admin, { fileName: "a.csv", totalRows: 1, sha256: sha("x"), clientKey: randomUUID() });
    const r = await processImportBatch(admin, job.id, { sha256: sha("x"), entries: [{ kind: "row", rowNumber: 2, data: { company: "A", name: "B", phone: "123" } }] });
    expect(r).toMatchObject({ imported: 0, skipped: 1 });
    expect(await prisma.lead.count()).toBe(0);
  });

  it("history: admin sees all, user sees own; report CSV is scoped and complete", async () => {
    const adminU = await makeUser({ role: "ADMIN" });
    const u1 = await makeUser();
    const u2 = await makeUser();
    const j1 = await runImport(actorOf(u1), csvOf(2, ["Bad,,9123456780,,,,,,"]));
    const csv2 = csvOf(1).replace("9100000000", "9300000000").replace("p0@", "z@");
    await runImport(actorOf(u2), csv2);
    expect(await listImportHistory(actorOf(adminU))).toHaveLength(2);
    const mine = await listImportHistory(actorOf(u1));
    expect(mine).toHaveLength(1);
    expect(mine[0]!.id).toBe(j1.job.id);

    const report = await buildImportReportCsv(actorOf(u1), j1.job.id);
    expect(report.csv).toContain('"Row Number","Company","Status","Reason","Imported Lead ID"');
    expect(report.csv).toContain('"Skipped","Missing Contact Person"');
    expect(report.csv.match(/"Imported"/g)).toHaveLength(2);
    await expect(buildImportReportCsv(actorOf(u2), j1.job.id)).rejects.toMatchObject({ status: 403 });
    expect((await buildImportReportCsv(actorOf(adminU), j1.job.id)).fileName).toBe(`import_report_${j1.job.id}.csv`);
    await expect(buildImportReportCsv(actorOf(adminU), randomUUID())).rejects.toMatchObject({ status: 404 });
  });

  it("database dedupe at commit time catches leads created after the preview", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const csv = csvOf(2);
    const { entries, total } = entriesOf(csv);
    await makeLead({ phone: "9100000001" });
    const { job } = await startImportJob(admin, { fileName: "a.csv", totalRows: total, sha256: sha(csv), clientKey: randomUUID() });
    const r = await processImportBatch(admin, job.id, { sha256: sha(csv), entries });
    expect(r).toMatchObject({ imported: 1, duplicates: 1 });
  });
});
