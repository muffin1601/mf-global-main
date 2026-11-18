// Pure helpers for the MongoDB -> PostgreSQL migration. No I/O, so they are unit-tested
// (tests/migration.lib.test.ts) without Mongo or a database.
import { ObjectId, type Document } from "mongodb";

export type LeadSourceValue = "MANUAL" | "IMPORT" | "INDIAMART" | "TRADEINDIA" | "WEBHOOK" | "LEGACY";

/**
 * The CRM insertion timestamp. Mongoose `createdAt` when present and valid;
 * otherwise the time embedded in the ObjectId (the real insertion time). Never
 * the migration time and never the Unix epoch.
 */
export function createdAtOf(doc: Document): Date {
  const value = doc.createdAt;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const id = doc._id;
  if (id instanceof ObjectId) return id.getTimestamp();
  return new Date(0);
}

/**
 * Legacy leads carry no explicit source. Attribute one only from hard evidence and
 * ALWAYS flag it as inferred, so the Lead Insertion Report never presents a guess
 * as fact. No evidence => LEGACY (unclassified), not MANUAL.
 */
export function inferLeadSource(doc: Document): { source: LeadSourceValue; sourceInferred: true } {
  const fileName = typeof doc.fileName === "string" ? doc.fileName.trim() : "";
  const dataType = String(doc.datatype ?? "").trim().toLowerCase();
  let source: LeadSourceValue = "LEGACY";
  if (fileName) source = "IMPORT";
  else if (dataType === "indiamart") source = "INDIAMART";
  else if (dataType === "tradeindia") source = "TRADEINDIA";
  else if (dataType === "webportals") source = "WEBHOOK";
  else if (doc.createdBy) source = "MANUAL";
  return { source, sourceInferred: true };
}

/** Resolve a product's `cat_id`: it holds the category ObjectId (string); older rows may hold the code. */
export function resolveCategoryRef(catId: unknown, known: { objectIds: ReadonlySet<string>; codes: ReadonlySet<string> }) {
  const key = String(catId ?? "");
  if (!key) return { kind: "none" as const, key };
  if (known.objectIds.has(key)) return { kind: "objectId" as const, key };
  if (known.codes.has(key)) return { kind: "code" as const, key };
  return { kind: "unresolved" as const, key };
}

// ---- quotation money: exact port of backend/utils/quotationCalc.js -------------------
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};
const clamp = (v: unknown, min: number, max: number) => Math.min(Math.max(num(v), min), max);
export const round2 = (v: unknown) => Math.round((num(v) + Number.EPSILON) * 100) / 100;

export function legacyQuotationTotals(items: Document[], summary: Document) {
  let subtotal = 0;
  let totalTax = 0;
  for (const it of items) {
    const qty = Math.max(0, num(it.qty));
    const price = Math.max(0, num(it.price));
    const amount = qty * price;
    const discountAmount = amount * (clamp(it.discount, 0, 100) / 100);
    const taxableValue = amount - discountAmount;
    const taxAmount = taxableValue * (clamp(it.tax, 0, 100) / 100);
    // MERN rounds each line BEFORE summing; skipping this drifts totals by paise.
    subtotal += round2(taxableValue);
    totalTax += round2(taxAmount);
  }
  subtotal = round2(subtotal);
  totalTax = round2(totalTax);
  const discount = summary.discountType === "%"
    ? round2(subtotal * (clamp(summary.discount, 0, 100) / 100))
    : Math.max(0, round2(num(summary.discount)));
  const additionalCharges = Math.max(0, round2(num(summary.additionalCharges)));
  const preRoundTotal = round2(subtotal + totalTax + additionalCharges - discount);
  const roundOff = summary.autoRoundOff ? (summary.roundOffSign === "+" ? 1 : -1) * Math.max(0, round2(num(summary.roundOffAmount))) : 0;
  const grandTotal = Math.max(0, round2(preRoundTotal + roundOff));
  return { subtotal, totalTax, discount, additionalCharges, roundOff: round2(roundOff), grandTotal };
}

/**
 * Hosts that are real Supabase projects. Writing to one requires an explicit,
 * deliberate acknowledgement so a stray `--apply` can never touch production.
 */
export function assertSafeWriteTarget(databaseUrl: string, env: Record<string, string | undefined> = process.env) {
  let host = "";
  try { host = new URL(databaseUrl).hostname; } catch { throw new Error("DATABASE_URL is not a valid URL"); }
  const isSupabase = /(^|\.)supabase\.(co|com)$/.test(host) || host.includes("pooler.supabase");
  if (isSupabase && env.ALLOW_PRODUCTION_WRITE !== "I_HAVE_WRITTEN_APPROVAL") {
    throw new Error(`Refusing to write to a Supabase database (${host}) without ALLOW_PRODUCTION_WRITE=I_HAVE_WRITTEN_APPROVAL. Use an isolated staging database for rehearsals.`);
  }
  return { host, isSupabase };
}
