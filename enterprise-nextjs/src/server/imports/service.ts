import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { toCsv } from "@/lib/export/tabular";
import {
  BATCH_SIZE, MAX_IMPORT_ROWS, PREVIEW_CAP, analyzeRows, parseLeadCsv, validateRow,
  type CanonicalRow,
} from "@/lib/imports/lead-csv";
import { createLeadTx } from "@/server/leads/ingest";
import { isAdmin, type Actor } from "@/server/actor";
import { badRequest, conflict, forbidden, notFound } from "@/server/errors";

/*
 * Stateless CSV import (Vercel-safe). Nothing is kept in memory between requests:
 *  - the browser parses/validates the file and keeps it;
 *  - `startImportJob` stores one LeadImportJob whose unique `retryKey` encodes
 *    `<userId>|<sha256 of the file>|<client key>|<assignee id or empty>`
 *    (integrity + idempotent start + the assignee are therefore server-held and
 *    cannot be changed by later requests);
 *  - every batch request carries <= 500 rows; each row is committed in ONE
 *    transaction that creates the lead (createLeadTx, externalKey
 *    `import:<jobId>:<rowNumber>`) and its LeadImportRow. The LeadImportRow
 *    unique (jobId,rowNumber) + the lead externalKey make replays no-ops;
 *  - job counters are recomputed from LeadImportRow, never incremented.
 */

export const IMPORT_CSV_COLUMNS = ["Row Number", "Company", "Status", "Reason", "Imported Lead ID"] as const;
const SHA_RE = /^[a-f0-9]{64}$/;
const KEY_RE = /^[A-Za-z0-9-]{8,64}$/;
const lc = (s: string) => s.toLowerCase();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------- duplicate lookup
export async function findExistingContacts(phones: string[], emails: string[]) {
  const foundPhones = new Set<string>();
  const foundEmails = new Set<string>();
  const uniquePhones = [...new Set(phones.filter(Boolean))];
  const uniqueEmails = [...new Set(emails.filter(Boolean).map(lc))];
  for (let i = 0; i < uniquePhones.length; i += 2000) {
    const chunk = uniquePhones.slice(i, i + 2000);
    const rows = await prisma.lead.findMany({
      where: { OR: [{ phone: { in: chunk } }, { contact: { in: chunk } }] }, select: { phone: true, contact: true },
    });
    const want = new Set(chunk);
    for (const r of rows) {
      if (r.phone && want.has(r.phone)) foundPhones.add(r.phone);
      if (r.contact && want.has(r.contact)) foundPhones.add(r.contact);
    }
  }
  for (let i = 0; i < uniqueEmails.length; i += 2000) {
    const chunk = uniqueEmails.slice(i, i + 2000);
    const rows = await prisma.lead.findMany({ where: { email: { in: chunk, mode: "insensitive" } }, select: { email: true } });
    for (const r of rows) if (r.email) foundEmails.add(lc(r.email));
  }
  return { phones: foundPhones, emails: foundEmails };
}

// ---------------------------------------------------------------- preview
/** Server-side parse + validate + dedupe (file and DB). The browser does the same locally via the shared module. */
export async function previewCsv(_actor: Actor, input: { fileName: string; csv: string }) {
  const parsed = parseLeadCsv(input.csv);
  if (!parsed.ok) throw badRequest(parsed.error);
  if (parsed.rows.length > MAX_IMPORT_ROWS) throw badRequest(`Files are limited to ${MAX_IMPORT_ROWS} rows.`);
  const phones: string[] = [];
  const emails: string[] = [];
  for (const r of parsed.rows) {
    const v = validateRow(r.data);
    if (v.ok) { phones.push(v.lead.phone); if (v.lead.email) emails.push(v.lead.email); }
  }
  const existing = await findExistingContacts(phones, emails);
  const analysis = analyzeRows(parsed.rows, existing);
  const skipped = analysis.rows.filter((r) => r.status !== "Valid");
  const valid = analysis.rows.filter((r) => r.status === "Valid");
  return {
    fileName: input.fileName,
    summary: analysis.summary,
    skippedPreview: skipped.slice(0, PREVIEW_CAP).map((r) => ({ rowNumber: r.rowNumber, company: r.company, status: r.status, reason: r.reason })),
    validPreview: valid.slice(0, PREVIEW_CAP).map((r) => ({ rowNumber: r.rowNumber, company: r.company })),
    previewCap: PREVIEW_CAP,
  };
}

// ---------------------------------------------------------------- job start
export type StartJobInput = { fileName: string; totalRows: number; sha256: string; clientKey: string; assignTo?: string | null };

export async function startImportJob(actor: Actor, input: StartJobInput) {
  if (!SHA_RE.test(input.sha256)) throw badRequest("Invalid file checksum.");
  if (!KEY_RE.test(input.clientKey)) throw badRequest("Invalid import session key.");
  if (!Number.isInteger(input.totalRows) || input.totalRows < 1 || input.totalRows > MAX_IMPORT_ROWS) {
    throw badRequest(`A file must contain between 1 and ${MAX_IMPORT_ROWS} rows.`);
  }
  // MERN: only admins can assign on import; a user's value is ignored (leads stay unassigned).
  let assigneeId = "";
  let assignedToName: string | null = null;
  if (isAdmin(actor) && input.assignTo) {
    const assignee = await prisma.user.findUnique({ where: { id: input.assignTo }, select: { id: true, name: true, enabled: true } }).catch(() => null);
    if (!assignee || !assignee.enabled) throw badRequest("The selected user does not exist or is disabled.");
    assigneeId = assignee.id;
    assignedToName = assignee.name;
  }
  const retryKey = [actor.id, input.sha256, input.clientKey, assigneeId].join("|");
  const existing = await prisma.leadImportJob.findUnique({ where: { retryKey } });
  if (existing) return { job: existing, resumed: true };
  try {
    const job = await prisma.leadImportJob.create({
      data: {
        userId: actor.id, userName: actor.name, role: actor.role.toLowerCase(), fileName: input.fileName.slice(0, 255),
        totalRows: input.totalRows, status: "IN_PROGRESS", assignedToName, retryKey,
      },
    });
    return { job, resumed: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { job: await prisma.leadImportJob.findUniqueOrThrow({ where: { retryKey } }), resumed: true };
    }
    throw e;
  }
}

// ---------------------------------------------------------------- batch
export type BatchEntry =
  | { kind: "row"; rowNumber: number; data: CanonicalRow }
  | { kind: "report"; rowNumber: number; company: string; status: "Skipped" | "Duplicate"; reason: string };

export type BatchDeps = { createLeadTx: typeof createLeadTx };

const DUP_REASON = { phone: "Duplicate Mobile Number", contact: "Duplicate Mobile Number", email: "Duplicate Email" } as const;

export async function processImportBatch(
  actor: Actor, jobId: string, input: { sha256: string; entries: BatchEntry[] }, deps: BatchDeps = { createLeadTx },
) {
  if (!UUID_RE.test(jobId)) throw notFound("Import record not found.");
  const job = await prisma.leadImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw notFound("Import record not found.");
  if (job.userId !== actor.id) throw forbidden("You can only commit your own import.");
  const [, sha, , assigneeId] = job.retryKey.split("|");
  if (!sha || sha !== input.sha256) throw conflict("The file does not match this import. Start over.");
  if (input.entries.length > BATCH_SIZE) throw badRequest(`At most ${BATCH_SIZE} rows per request.`);
  const seen = new Set<number>();
  for (const e of input.entries) {
    if (!Number.isInteger(e.rowNumber) || e.rowNumber < 2 || e.rowNumber > job.totalRows + 1) throw badRequest(`Row ${e.rowNumber} is outside this file.`);
    if (seen.has(e.rowNumber)) throw badRequest(`Row ${e.rowNumber} appears twice in the batch.`);
    seen.add(e.rowNumber);
  }
  if (assigneeId && !(await prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true } }))) {
    throw conflict("The user this import was assigned to no longer exists.");
  }

  const done = new Set(
    (await prisma.leadImportRow.findMany({ where: { jobId, rowNumber: { in: [...seen] } }, select: { rowNumber: true } })).map((r) => r.rowNumber),
  );
  const ctxBase = {
    source: "IMPORT" as const, createdById: actor.id, importJobId: job.id,
    assignTo: assigneeId ? [{ userId: assigneeId, canView: true, canUpdate: false, canDelete: false }] : undefined,
    assignedBy: actor.id, dedupe: { phone: true, email: true },
  };
  const reportRows: { jobId: string; rowNumber: number; company: string | null; status: string; reason: string }[] = [];
  let insertedThisBatch = 0, duplicatesThisBatch = 0, alreadyProcessed = 0, failed = 0;

  for (const entry of input.entries) {
    if (done.has(entry.rowNumber)) { alreadyProcessed++; continue; }
    if (entry.kind === "report") {
      reportRows.push({ jobId, rowNumber: entry.rowNumber, company: entry.company.slice(0, 150) || null, status: entry.status, reason: entry.reason.slice(0, 200) });
      continue;
    }
    const v = validateRow(entry.data);
    const company = entry.data.company?.slice(0, 150) || null;
    if (!v.ok) { reportRows.push({ jobId, rowNumber: entry.rowNumber, company, status: "Skipped", reason: v.reason }); continue; }
    try {
      const outcome = await prisma.$transaction(async (tx) => {
        const result = await deps.createLeadTx(tx, {
          name: v.lead.name, company: v.lead.company, email: v.lead.email, phone: v.lead.phone, contact: v.lead.contact,
          location: v.lead.location, state: v.lead.state, category: v.lead.category, quantity: v.lead.quantity,
          requirements: v.lead.requirements, remarks: v.lead.remarks, dataType: v.lead.dataType, address: v.lead.address,
          inquiryDate: new Date().toISOString(), fileName: job.fileName, callStatus: "Not Called", status: "New Lead",
        }, { ...ctxBase, externalKey: `import:${job.id}:${entry.rowNumber}` });
        if (result.status === "created") {
          await tx.leadImportRow.create({ data: { jobId, rowNumber: entry.rowNumber, company, status: "Imported", reason: "", leadId: result.leadId } });
          return "created" as const;
        }
        if (result.field === "externalKey") {
          // The lead exists for this exact row (earlier attempt): just ensure the report row.
          await tx.leadImportRow.create({ data: { jobId, rowNumber: entry.rowNumber, company, status: "Imported", reason: "", leadId: result.existingId } });
          return "replayed" as const;
        }
        await tx.leadImportRow.create({ data: { jobId, rowNumber: entry.rowNumber, company, status: "Duplicate", reason: DUP_REASON[result.field], leadId: null } });
        return "duplicate" as const;
      }, { maxWait: 15_000, timeout: 30_000 });
      if (outcome === "created") insertedThisBatch++;
      else if (outcome === "duplicate") duplicatesThisBatch++;
    } catch (e) {
      // A concurrent replay already stored this row: nothing to do.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") { alreadyProcessed++; continue; }
      // Transient failure: nothing was persisted for this row, so re-sending the batch retries it.
      failed++;
      console.error("lead-import: row failed", { jobId, rowNumber: entry.rowNumber, error: e instanceof Error ? e.name : "unknown" });
    }
  }
  if (reportRows.length) await prisma.leadImportRow.createMany({ data: reportRows, skipDuplicates: true });

  const counts = await prisma.leadImportRow.groupBy({ by: ["status"], where: { jobId }, _count: { _all: true } });
  const by = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const processed = counts.reduce((n, c) => n + c._count._all, 0);
  const complete = processed >= job.totalRows;
  const data: Prisma.LeadImportJobUpdateManyMutationInput = { imported: by("Imported"), skipped: by("Skipped"), duplicates: by("Duplicate") };
  if (complete) data.status = "COMPLETED";
  const updated = await prisma.leadImportJob.updateMany({ where: { id: jobId }, data });
  if (complete && updated.count && job.status !== "COMPLETED") {
    const finishedNow = await prisma.leadImportJob.findUnique({ where: { id: jobId }, select: { imported: true, skipped: true, duplicates: true } });
    await prisma.activityLog.create({
      data: { userId: actor.id, actorUserCode: actor.userId ?? null, actorName: actor.name, actorRole: actor.role.toLowerCase(), action: "lead.import.completed", details: { jobId, fileName: job.fileName, ...finishedNow } },
    });
  }
  return {
    jobId, processed, total: job.totalRows, imported: by("Imported"), skipped: by("Skipped"), duplicates: by("Duplicate"),
    insertedThisBatch, dupThisBatch: duplicatesThisBatch, alreadyProcessed, failed, done: complete,
  };
}

// ---------------------------------------------------------------- history + report
export async function listImportHistory(actor: Actor, limit = 50) {
  return prisma.leadImportJob.findMany({
    where: isAdmin(actor) ? {} : { userId: actor.id }, orderBy: { createdAt: "desc" }, take: Math.min(200, Math.max(1, limit)),
  });
}

export async function buildImportReportCsv(actor: Actor, jobId: string) {
  if (!UUID_RE.test(jobId)) throw notFound("Import record not found.");
  const job = await prisma.leadImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw notFound("Import record not found.");
  if (!isAdmin(actor) && job.userId !== actor.id) throw forbidden("Access denied.");
  const rows = await prisma.leadImportRow.findMany({ where: { jobId }, orderBy: { rowNumber: "asc" } });
  const csv = toCsv(
    [
      { key: "row", header: IMPORT_CSV_COLUMNS[0], value: (r: (typeof rows)[number]) => r.rowNumber },
      { key: "company", header: IMPORT_CSV_COLUMNS[1], value: (r) => r.company ?? "" },
      { key: "status", header: IMPORT_CSV_COLUMNS[2], value: (r) => r.status },
      { key: "reason", header: IMPORT_CSV_COLUMNS[3], value: (r) => r.reason },
      { key: "lead", header: IMPORT_CSV_COLUMNS[4], value: (r) => r.leadId ?? "" },
    ],
    rows,
  );
  return { csv, fileName: `import_report_${job.id}.csv` };
}
