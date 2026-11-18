import { createHash, randomUUID } from "node:crypto";
import { parse } from "csv-parse/sync";
import { Prisma } from "@/generated/prisma/client";
import type { VendorStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma/client";
import { BUCKETS, storage } from "@/lib/storage";
import { toCsv, type Column } from "@/lib/export/tabular";
import { detectFileType } from "@/lib/files/signature";
import { HttpError, badRequest, forbidden, notFound } from "@/server/errors";
import { audit, authorize, requireId, type MaybeActor } from "./common";
import {
  canonicalUrl, has, isPincode, normalizeCode, normalizeCompanyName, normalizeEmail, normalizePhone, parseStatus, performanceBand,
  validateVendorPayload, STATUS_LABEL, type Input,
} from "./fields";
import { buildVendorWhere, codeLetter, formatCode, type VendorListQuery } from "./vendors";

export const MAX_IMPORT_BYTES = 4 * 1024 * 1024; // Vercel request body limit is 4.5 MB (MERN allowed 15 MB)
export const MAX_IMPORT_ROWS = 20_000;
export const INSERT_BATCH = 500;
export const DEFAULT_BATCHES_PER_CALL = 4; // ~2,000 rows per invocation keeps a Vercel function short
const REPORT_ROW_CAP = 5000;
const PREVIEW_ROWS = 50;
export const EXPORT_ROW_CAP = 50_000;

/* --------------------------------------------------------------- mapping */
export const HEADER_ALIASES: Record<string, string[]> = {
  name: ["vendor name", "name", "supplier name", "company", "company name", "firm"],
  legalName: ["legal name", "legal business name", "registered name"],
  vendorType: ["vendor type", "type", "supplier type"],
  categoryName: ["category", "vendor category", "segment"],
  status: ["status", "vendor status"],
  priority: ["priority", "vendor priority"],
  email: ["email", "email address", "e-mail", "mail"],
  phone: ["phone", "phone number", "mobile", "mobile number", "contact number"],
  contactName: ["contact person", "contact name", "primary contact", "contact"],
  website: ["website", "web site", "url"],
  gstin: ["gstin", "gst", "gst number", "gst no"],
  pan: ["pan", "pan number", "pan no"],
  cin: ["cin", "cin number"],
  industry: ["industry", "sector"],
  description: ["description", "about", "notes"],
  addressLine1: ["address", "address line 1", "address1", "street"],
  addressLine2: ["address line 2", "address2"],
  city: ["city", "town"],
  state: ["state", "region"],
  postalCode: ["pincode", "pin code", "postal code", "zip", "zip code"],
  tags: ["tags", "labels"],
};
export const MAPPABLE_FIELDS = Object.keys(HEADER_ALIASES);
export const TEMPLATE_HEADERS = [
  "Vendor Name", "Legal Name", "Vendor Type", "Category", "Status", "Priority", "Contact Person", "Phone", "Email", "Website", "GSTIN", "PAN", "CIN",
  "Industry", "Address Line 1", "Address Line 2", "City", "State", "Pincode", "Tags",
];
const normHeader = (h: string) => h.trim().toLowerCase().replace(/\s+/g, " ");

/** Header detection: suggest a field for each CSV header from the alias table (first match wins per field). */
export function suggestMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const h of headers) {
    mapping[h] = "";
    const key = normHeader(h);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (!used.has(field) && aliases.includes(key)) { mapping[h] = field; used.add(field); break; }
    }
  }
  return mapping;
}

type Mapped = Record<string, string | string[]> & { tags?: string[] };

function mapRow(row: Record<string, string>, mapping: Record<string, string>): Mapped {
  const out: Record<string, string | string[]> = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (!field || !MAPPABLE_FIELDS.includes(field)) continue;
    const v = row[header];
    if (v === undefined || v === null) continue;
    out[field] = String(v).trim();
  }
  if (typeof out.tags === "string") out.tags = out.tags.split(/[;,|]/).map((t) => t.trim()).filter(Boolean).slice(0, 25);
  if (typeof out.gstin === "string") out.gstin = normalizeCode(out.gstin);
  if (typeof out.pan === "string") out.pan = normalizeCode(out.pan);
  if (typeof out.cin === "string") out.cin = normalizeCode(out.cin);
  if (typeof out.email === "string") out.email = out.email.toLowerCase();
  return out as Mapped;
}
const s = (m: Mapped, k: string) => (typeof m[k] === "string" ? (m[k] as string) : "");

function validateRow(m: Mapped): string[] {
  const payload: Input = {
    name: s(m, "name"), legalName: s(m, "legalName"), email: s(m, "email"), phone: s(m, "phone"), website: s(m, "website"), gstin: s(m, "gstin"),
    pan: s(m, "pan"), cin: s(m, "cin"), status: s(m, "status"), priority: s(m, "priority"), vendorType: s(m, "vendorType"), tags: m.tags ?? [],
  };
  const errors = validateVendorPayload(payload);
  if (has(s(m, "postalCode")) && !isPincode(s(m, "postalCode"))) errors.push(`Invalid PIN code "${s(m, "postalCode")}"`);
  return errors;
}

/* ------------------------------------------------------------------ parse */
function parseCsv(buffer: Buffer): { headers: string[]; rows: Record<string, string>[] } {
  const records = parse(buffer, { bom: true, skip_empty_lines: false, relax_column_count: true, relax_quotes: true, trim: false }) as string[][];
  if (!records.length) return { headers: [], rows: [] };
  const headers = (records[0] ?? []).map((h) => String(h ?? "").trim());
  const rows: Record<string, string>[] = [];
  for (const rec of records.slice(1)) {
    if (rec.every((c) => !String(c ?? "").trim())) { rows.push({}); continue; } // keep numbering aligned with the file's physical rows
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { if (h) row[h] = String(rec[i] ?? ""); });
    rows.push(row);
  }
  return { headers, rows };
}
const isBlank = (r: Record<string, string>) => Object.values(r).every((v) => !String(v ?? "").trim());

async function loadJob(actor: { id: string; role: string }, jobId: string) {
  const job = await prisma.vendorImportJob.findUnique({ where: { id: requireId(jobId, "import job") } });
  if (!job) throw notFound("Import job not found. Upload the file again.");
  if (job.userId !== actor.id && actor.role !== "ADMIN") throw forbidden("This import was started by another user");
  return job;
}

async function readJobFile(storagePath: string) {
  const buf = storagePath ? await storage.download(BUCKETS.vendorDocuments, storagePath) : null;
  if (!buf) throw new HttpError(410, "The uploaded file is no longer available. Please upload it again.", "GONE");
  return buf;
}

/* -------------------------------------------------------------- 1. upload */
export async function uploadImport(actor: MaybeActor, input: { fileName: string; buffer: Buffer; idempotencyKey?: string }) {
  const a = authorize(actor, "vendor.import");
  const { fileName, buffer } = input;
  if (!/\.csv$/i.test(fileName)) throw badRequest("Upload a .csv file to import vendors");
  if (!buffer.length) throw badRequest("The file is empty");
  if (buffer.length > MAX_IMPORT_BYTES) throw new HttpError(413, `The file is too large. The maximum size is ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`, "TOO_LARGE");
  if (detectFileType(buffer) || buffer.subarray(0, 4096).includes(0)) throw new HttpError(415, "That does not look like a CSV file", "UNSUPPORTED_TYPE");

  // Idempotent upload: the same client key from the same user returns the same job (safe retry).
  const retryKey = input.idempotencyKey ? `${a.id}:${createHash("sha256").update(input.idempotencyKey).digest("hex")}` : randomUUID();
  const existing = await prisma.vendorImportJob.findUnique({ where: { retryKey } });
  if (existing) return jobView(existing, []);

  let parsed: ReturnType<typeof parseCsv>;
  try { parsed = parseCsv(buffer); } catch { throw badRequest("The CSV could not be read. Check the file and try again."); }
  const dataRows = parsed.rows.filter((r) => !isBlank(r));
  if (!parsed.headers.length || !dataRows.length) throw badRequest("The file has no data rows. Check the file and try again.");
  if (parsed.rows.length > MAX_IMPORT_ROWS) throw badRequest(`This file has more than ${MAX_IMPORT_ROWS.toLocaleString()} rows. Split it into smaller files and import them one at a time.`);

  const path = `imports/${randomUUID()}.csv`;
  await storage.upload(BUCKETS.vendorDocuments, path, buffer, "text/csv");
  try {
    const job = await prisma.vendorImportJob.create({
      data: { userId: a.id, userName: a.name, fileName: fileName.slice(0, 200), storagePath: path, headers: parsed.headers, mapping: suggestMapping(parsed.headers), totalRows: dataRows.length, status: "uploaded", retryKey },
    });
    return jobView(job, dataRows.slice(0, 5));
  } catch (e) {
    await storage.remove(BUCKETS.vendorDocuments, [path]).catch(() => undefined);
    throw e;
  }
}

function jobView(job: { id: string; fileName: string; headers: string[]; mapping: Prisma.JsonValue; totalRows: number; status: string }, sampleRows: Record<string, string>[]) {
  return { jobId: job.id, fileName: job.fileName, headers: job.headers, mapping: job.mapping as Record<string, string>, mappableFields: MAPPABLE_FIELDS, totalRows: job.totalRows, status: job.status, sampleRows };
}

/* ------------------------------------------------------- classification */
type Existing = { name: Set<string>; gstin: Set<string>; pan: Set<string>; email: Set<string>; phone: Set<string> };
async function loadExisting(): Promise<Existing> {
  const rows = await prisma.vendor.findMany({ select: { name: true, gstin: true, pan: true, email: true, phone: true } });
  const e: Existing = { name: new Set(), gstin: new Set(), pan: new Set(), email: new Set(), phone: new Set() };
  for (const r of rows) {
    e.name.add(normalizeCompanyName(r.name));
    if (r.gstin) e.gstin.add(normalizeCode(r.gstin));
    if (r.pan) e.pan.add(normalizeCode(r.pan));
    if (r.email) e.email.add(normalizeEmail(r.email));
    if (r.phone) e.phone.add(normalizePhone(r.phone));
  }
  e.name.delete(""); e.phone.delete("");
  return e;
}

type Classified = { rowNumber: number; vendorName: string; status: "Ready" | "Error" | "Duplicate"; reason: string; mapped: Mapped };

function classify(rows: Record<string, string>[], mapping: Record<string, string>, existing: Existing, skip: Set<number>): Classified[] {
  const seen = { name: new Set<string>(), gstin: new Set<string>(), pan: new Set<string>() };
  const out: Classified[] = [];
  rows.forEach((raw, index) => {
    const rowNumber = index + 2; // header is row 1
    if (isBlank(raw) || skip.has(rowNumber)) return;
    const m = mapRow(raw, mapping);
    const vendorName = s(m, "name");
    const errors = validateRow(m);
    if (errors.length) { out.push({ rowNumber, vendorName, status: "Error", reason: errors.join("; "), mapped: m }); return; }
    const k = { name: normalizeCompanyName(vendorName), gstin: normalizeCode(s(m, "gstin")), pan: normalizeCode(s(m, "pan")), email: normalizeEmail(s(m, "email")), phone: normalizePhone(s(m, "phone")) };
    const reasons: string[] = [];
    if (k.gstin && (existing.gstin.has(k.gstin) || seen.gstin.has(k.gstin))) reasons.push("GSTIN already exists");
    if (k.pan && (existing.pan.has(k.pan) || seen.pan.has(k.pan))) reasons.push("PAN already exists");
    if (k.name && (existing.name.has(k.name) || seen.name.has(k.name))) reasons.push("A vendor with this name already exists");
    if (k.email && existing.email.has(k.email)) reasons.push("Email already used by another vendor");
    if (k.phone && existing.phone.has(k.phone)) reasons.push("Phone already used by another vendor");
    if (reasons.length) { out.push({ rowNumber, vendorName, status: "Duplicate", reason: reasons.join("; "), mapped: m }); return; }
    if (k.name) seen.name.add(k.name);
    if (k.gstin) seen.gstin.add(k.gstin);
    if (k.pan) seen.pan.add(k.pan);
    out.push({ rowNumber, vendorName, status: "Ready", reason: "", mapped: m });
  });
  return out;
}

function cleanMapping(headers: string[], mapping: unknown): Record<string, string> {
  const given = (mapping && typeof mapping === "object" ? mapping : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const h of headers) out[h] = MAPPABLE_FIELDS.includes(String(given[h])) ? String(given[h]) : "";
  return out;
}

async function persistReport(jobId: string, rows: { rowNumber: number; vendorName: string; status: string; reason: string }[]) {
  const capped = rows.slice(0, REPORT_ROW_CAP);
  for (let i = 0; i < capped.length; i += 1000) {
    await prisma.vendorImportRow.createMany({ data: capped.slice(i, i + 1000).map((r) => ({ jobId, rowNumber: r.rowNumber, vendorName: r.vendorName.slice(0, 200), status: r.status, reason: r.reason.slice(0, 1000) })), skipDuplicates: true });
  }
  return rows.length > REPORT_ROW_CAP;
}

/* ------------------------------------------------------ 2. map & validate */
export async function validateImport(actor: MaybeActor, jobId: string, mappingInput?: unknown) {
  const a = authorize(actor, "vendor.import");
  const job = await loadJob(a, jobId);
  if (job.status === "completed" || job.status === "committing") throw new HttpError(409, "This import has already been processed", "CONFLICT");
  const mapping = cleanMapping(job.headers, mappingInput ?? job.mapping);
  if (!Object.values(mapping).includes("name")) throw badRequest('Map a column to "Vendor Name" before continuing.');

  const { rows } = parseCsv(await readJobFile(job.storagePath));
  const classified = classify(rows, mapping, await loadExisting(), new Set());
  const count = (st: string) => classified.filter((c) => c.status === st).length;

  await prisma.vendorImportRow.deleteMany({ where: { jobId: job.id } });
  const truncated = await persistReport(job.id, classified);
  await prisma.vendorImportJob.update({
    where: { id: job.id },
    data: { mapping, totalRows: classified.length, imported: 0, duplicates: count("Duplicate"), errorCount: count("Error"), status: "validated", reportTruncated: truncated },
  });
  return {
    jobId: job.id, mapping,
    summary: { totalRows: classified.length, readyToImport: count("Ready"), duplicates: count("Duplicate"), errors: count("Error") },
    preview: classified.slice(0, PREVIEW_ROWS).map(({ mapped, ...r }) => (void mapped, r)),
    previewTruncated: classified.length > PREVIEW_ROWS,
  };
}

/* --------------------------------------------------------------- 3. commit */
function vendorCreate(c: Classified, id: string, code: string, actorId: string, categoryByName: Map<string, string>) {
  const m = c.mapped;
  const status: VendorStatus = parseStatus(s(m, "status")) ?? "PENDING";
  const category = s(m, "categoryName").trim().toLowerCase();
  return {
    id, vendorCode: code, name: s(m, "name").replace(/\s+/g, " "), legalName: s(m, "legalName") || null, vendorType: s(m, "vendorType") || null,
    categoryId: category ? categoryByName.get(category) ?? null : null, status, priority: s(m, "priority") || "Medium", email: s(m, "email") || null,
    phone: s(m, "phone") || null, website: s(m, "website") ? canonicalUrl(s(m, "website")) : null, gstin: s(m, "gstin") || null, pan: s(m, "pan") || null,
    cin: s(m, "cin") || null, industry: s(m, "industry") || null, description: s(m, "description"), tags: m.tags ?? [], createdById: actorId,
  };
}

async function insertBatch(jobId: string, actorId: string, batch: Classified[], categoryByName: Map<string, string>) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const lock = await tx.$queryRaw<{ ok: boolean }[]>(Prisma.sql`select pg_try_advisory_xact_lock(hashtext(${jobId})) as ok`);
        if (!lock[0]?.ok) return { busy: true as const, inserted: 0 };
        // Rows already imported by an earlier (possibly retried) call are skipped: this is what makes commit idempotent.
        const done = await tx.vendorImportRow.findMany({ where: { jobId, rowNumber: { in: batch.map((b) => b.rowNumber) }, status: "Imported" }, select: { rowNumber: true } });
        const doneSet = new Set(done.map((d) => d.rowNumber));
        const todo = batch.filter((b) => !doneSet.has(b.rowNumber));
        if (!todo.length) return { busy: false as const, inserted: 0 };

        const counters = new Map<string, number>();
        for (const letter of new Set(todo.map((t) => codeLetter(s(t.mapped, "name"))))) {
          const r = await tx.$queryRaw<{ max: number | null }[]>(Prisma.sql`select max(cast(substring(vendor_code from 3) as int)) as max from vendors where vendor_code ~ ${`^V${letter}[0-9]{1,8}$`}`);
          counters.set(letter, r[0]?.max ?? 0);
        }
        const vendors: ReturnType<typeof vendorCreate>[] = [];
        const contacts: Prisma.VendorContactCreateManyInput[] = [];
        const addresses: Prisma.VendorAddressCreateManyInput[] = [];
        const rowRecords: Prisma.VendorImportRowCreateManyInput[] = [];
        for (const t of todo) {
          const letter = codeLetter(s(t.mapped, "name"));
          const seq = (counters.get(letter) ?? 0) + 1;
          counters.set(letter, seq);
          const id = randomUUID();
          vendors.push(vendorCreate(t, id, formatCode(letter, seq), actorId, categoryByName));
          if (s(t.mapped, "contactName")) contacts.push({ vendorId: id, name: s(t.mapped, "contactName").slice(0, 120), email: s(t.mapped, "email") || null, phone: s(t.mapped, "phone") || null, isPrimary: true });
          if (s(t.mapped, "addressLine1")) addresses.push({ vendorId: id, type: "Registered Office", line1: s(t.mapped, "addressLine1"), line2: s(t.mapped, "addressLine2") || null, city: s(t.mapped, "city") || null, state: s(t.mapped, "state") || null, postalCode: s(t.mapped, "postalCode") || null, country: "India", isPrimary: true });
          rowRecords.push({ jobId, rowNumber: t.rowNumber, vendorName: t.vendorName.slice(0, 200), status: "Imported", reason: "", vendorId: id });
        }
        await tx.vendor.createMany({ data: vendors });
        if (contacts.length) await tx.vendorContact.createMany({ data: contacts });
        if (addresses.length) await tx.vendorAddress.createMany({ data: addresses });
        await tx.vendorImportRow.deleteMany({ where: { jobId, rowNumber: { in: todo.map((t) => t.rowNumber) } } });
        await tx.vendorImportRow.createMany({ data: rowRecords });
        return { busy: false as const, inserted: todo.length };
      }, { timeout: 30_000 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 3) continue; // vendor_code taken concurrently
      throw e;
    }
  }
  throw new HttpError(409, "Could not allocate vendor codes. Try again.", "CONFLICT");
}

/**
 * Commit in batches of 500. Each call processes at most `maxBatches` batches and reports `done`;
 * the client simply calls again until done. Safe to retry at any point (idempotent per row).
 */
export async function commitImport(actor: MaybeActor, jobId: string, opts: { maxBatches?: number } = {}) {
  const a = authorize(actor, "vendor.import");
  let job = await loadJob(a, jobId);
  if (job.status === "completed") return commitSummary(job.id, true);
  if (job.status !== "validated" && job.status !== "committing") throw badRequest("Validate the import before confirming it");
  if (job.status === "validated") {
    await prisma.vendorImportJob.updateMany({ where: { id: job.id, status: "validated" }, data: { status: "committing" } });
    job = await loadJob(a, jobId);
  }

  const mapping = cleanMapping(job.headers, job.mapping);
  const { rows } = parseCsv(await readJobFile(job.storagePath));
  const importedRows = await prisma.vendorImportRow.findMany({ where: { jobId: job.id, status: "Imported" }, select: { rowNumber: true } });
  const classified = classify(rows, mapping, await loadExisting(), new Set(importedRows.map((r) => r.rowNumber)));
  const ready = classified.filter((c) => c.status === "Ready");

  const categories = await prisma.vendorCategory.findMany({ select: { id: true, name: true } });
  const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));

  const maxBatches = Math.max(1, opts.maxBatches ?? DEFAULT_BATCHES_PER_CALL);
  let processed = 0;
  let busy = false;
  for (let i = 0; i < ready.length && i < maxBatches * INSERT_BATCH; i += INSERT_BATCH) {
    const res = await insertBatch(job.id, a.id, ready.slice(i, i + INSERT_BATCH), categoryByName);
    if (res.busy) { busy = true; break; }
    processed += Math.min(INSERT_BATCH, ready.length - i);
  }
  const remaining = Math.max(0, ready.length - processed);
  if (busy || remaining > 0) return { ...(await commitSummary(job.id, false)), remaining, busy };

  // Finalise: persist the non-imported rows, close the job, remove the stored CSV.
  const rest = classified.filter((c) => c.status !== "Ready");
  await prisma.vendorImportRow.deleteMany({ where: { jobId: job.id, status: { not: "Imported" } } });
  const truncated = await persistReport(job.id, rest);
  const imported = await prisma.vendorImportRow.count({ where: { jobId: job.id, status: "Imported" } });
  const duplicates = rest.filter((r) => r.status === "Duplicate").length;
  const errors = rest.filter((r) => r.status === "Error").length;
  const closed = await prisma.vendorImportJob.updateMany({
    where: { id: job.id, status: "committing" },
    data: { status: "completed", imported, duplicates, errorCount: errors, reportTruncated: truncated, storagePath: "" },
  });
  if (closed.count) {
    await storage.remove(BUCKETS.vendorDocuments, [job.storagePath]).catch(() => undefined);
    await audit(prisma, a, "vendor.imported", null, { jobId: job.id, fileName: job.fileName, totalRows: job.totalRows, imported, duplicates, errors });
  }
  return { ...(await commitSummary(job.id, true)), remaining: 0, busy: false };
}

async function commitSummary(jobId: string, done: boolean) {
  const job = await prisma.vendorImportJob.findUniqueOrThrow({ where: { id: jobId } });
  const imported = done ? job.imported : await prisma.vendorImportRow.count({ where: { jobId, status: "Imported" } });
  return { jobId, done, summary: { totalRows: job.totalRows, imported, duplicates: job.duplicates, errors: job.errorCount } };
}

/* ---------------------------------------------------------------- reports */
export async function importReportCsv(actor: MaybeActor, jobId: string) {
  const a = authorize(actor, "vendor.import");
  const job = await loadJob(a, jobId);
  const rows = await prisma.vendorImportRow.findMany({ where: { jobId: job.id }, orderBy: { rowNumber: "asc" } });
  if (!rows.length) throw notFound("There is no report for this import");
  type R = (typeof rows)[number];
  const cols: Column<R>[] = [
    { key: "row", header: "Row Number", value: (r) => r.rowNumber }, { key: "name", header: "Vendor Name", value: (r) => r.vendorName },
    { key: "status", header: "Status", value: (r) => r.status }, { key: "reason", header: "Reason", value: (r) => r.reason }, { key: "vid", header: "Vendor ID", value: (r) => r.vendorId ?? "" },
  ];
  return { csv: toCsv(cols, rows), fileName: `vendor-import-report-${job.id}.csv` };
}

export function importTemplateCsv(actor: MaybeActor) {
  authorize(actor, "vendor.import");
  return { csv: `${TEMPLATE_HEADERS.join(",")}\r\n`, fileName: "vendor-import-template.csv" };
}

/* ----------------------------------------------------------------- export */
type ExportRow = {
  vendorCode: string; name: string; legalName: string | null; vendorType: string | null; status: string; priority: string; industry: string | null; website: string | null;
  gstin: string | null; pan: string | null; cin: string | null; email: string | null; phone: string | null; tags: string[]; archivedAt: Date | null; createdAt: Date;
  performanceScore: Prisma.Decimal | null; category: { name: string } | null; owner: { name: string } | null;
  contacts: { name: string; designation: string | null; email: string | null; phone: string | null }[];
  addresses: { line1: string | null; line2: string | null; city: string | null; state: string | null; postalCode: string | null; country: string | null }[];
  _count: { products: number };
};

const EXPORT_COLUMNS: Column<ExportRow>[] = [
  { key: "vendorCode", header: "Vendor Code", value: (v) => v.vendorCode },
  { key: "name", header: "Vendor Name", value: (v) => v.name },
  { key: "legalName", header: "Legal Name", value: (v) => v.legalName ?? "" },
  { key: "type", header: "Type", value: (v) => v.vendorType ?? "" },
  { key: "category", header: "Category", value: (v) => v.category?.name ?? "" },
  { key: "status", header: "Status", value: (v) => STATUS_LABEL[v.status] ?? v.status },
  { key: "priority", header: "Priority", value: (v) => v.priority },
  { key: "contact", header: "Primary Contact", value: (v) => v.contacts[0]?.name ?? "" },
  { key: "designation", header: "Contact Designation", value: (v) => v.contacts[0]?.designation ?? "" },
  { key: "phone", header: "Phone", value: (v) => v.contacts[0]?.phone || v.phone || "" },
  { key: "email", header: "Email", value: (v) => v.contacts[0]?.email || v.email || "" },
  { key: "website", header: "Website", value: (v) => v.website ?? "" },
  { key: "gstin", header: "GSTIN", value: (v) => v.gstin ?? "" },
  { key: "pan", header: "PAN", value: (v) => v.pan ?? "" },
  { key: "cin", header: "CIN", value: (v) => v.cin ?? "" },
  { key: "industry", header: "Industry", value: (v) => v.industry ?? "" },
  { key: "address", header: "Address", value: (v) => [v.addresses[0]?.line1, v.addresses[0]?.line2].filter(Boolean).join(", ") },
  { key: "city", header: "City", value: (v) => v.addresses[0]?.city ?? "" },
  { key: "state", header: "State", value: (v) => v.addresses[0]?.state ?? "" },
  { key: "pincode", header: "Pincode", value: (v) => v.addresses[0]?.postalCode ?? "" },
  { key: "country", header: "Country", value: (v) => v.addresses[0]?.country ?? "" },
  { key: "tags", header: "Tags", value: (v) => v.tags.join("; ") },
  { key: "owner", header: "Owner", value: (v) => v.owner?.name ?? "" },
  { key: "products", header: "Products Supplied", value: (v) => v._count.products },
  { key: "score", header: "Performance Score", value: (v) => (v.performanceScore == null ? "" : Number(v.performanceScore.toString())) },
  { key: "band", header: "Performance Band", value: (v) => performanceBand(v.performanceScore == null ? null : Number(v.performanceScore.toString())) },
  { key: "archived", header: "Archived", value: (v) => (v.archivedAt ? "Yes" : "No") },
  { key: "created", header: "Created Date", value: (v) => v.createdAt.toISOString().slice(0, 10) },
];

/** CSV of exactly the vendors the current filter selects (bank details are never exported). */
export async function exportVendors(actor: MaybeActor, query: VendorListQuery = {}) {
  const a = authorize(actor, "vendor.export");
  const where = await buildVendorWhere(query);
  const total = await prisma.vendor.count({ where });
  if (!total) throw notFound("There are no vendors matching the current filters");
  const rows = await prisma.vendor.findMany({
    where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: EXPORT_ROW_CAP,
    select: {
      vendorCode: true, name: true, legalName: true, vendorType: true, status: true, priority: true, industry: true, website: true, gstin: true, pan: true, cin: true,
      email: true, phone: true, tags: true, archivedAt: true, createdAt: true, performanceScore: true, category: { select: { name: true } }, owner: { select: { name: true } },
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }], take: 1, select: { name: true, designation: true, email: true, phone: true } },
      addresses: { orderBy: { isPrimary: "desc" }, take: 1, select: { line1: true, line2: true, city: true, state: true, postalCode: true, country: true } },
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });
  await audit(prisma, a, "vendor.exported", null, { rows: rows.length, truncated: total > EXPORT_ROW_CAP });
  return { csv: toCsv(EXPORT_COLUMNS, rows as ExportRow[]), count: rows.length, truncated: total > EXPORT_ROW_CAP, fileName: `vendors-${new Date().toISOString().slice(0, 10)}.csv` };
}
