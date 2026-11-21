import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { addDaysIst, istToday } from "@/lib/time/ist";
import { isAdmin, type Actor } from "@/server/actor";
import { badRequest, forbidden, notFound } from "@/server/errors";
import { calculateQuotationTotals, num, round2, validateQuotationPayload, type QuotationTotals } from "./calc";

export const DEFAULT_PREFIX = "MF/Q/25-26/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TOTAL = 9e13; // Decimal(16,2) head-room

// ---- input validation ------------------------------------------------------
const text = (max: number) => z.string().max(max).nullish();
const numLike = z.union([z.number(), z.string().max(40)]).nullish();
const ship = z.object({ name: text(300), address: text(2000), state: text(100) });
const partySchema = z.object({
  name: text(300), company: text(300), phone: text(60), billToAddress: text(2000), state: text(100), pan: text(40),
  shippingAddresses: z.array(ship).max(50).nullish(), selectedShippingAddress: ship.nullish(),
});
const itemSchema = z.object({ name: text(500), description: text(5000), hsn: text(60), image: text(500), qty: numLike, price: numLike, discount: numLike, tax: numLike });
const summarySchema = z.object({
  discount: numLike, discountType: text(4), additionalCharges: numLike, applyTCS: z.boolean().nullish(), autoRoundOff: z.boolean().nullish(),
  roundOffSign: text(1), roundOffAmount: numLike, amountReceived: numLike, paymentMethod: text(60),
});
const bankSchema = z.object({ accountHolder: text(200), accountNumber: text(60), ifscCode: text(40), bankName: text(300), upiId: text(100) });
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be YYYY-MM-DD");
const invoiceSchema = z.object({
  prefix: text(40), number: text(40), date: isoDay.nullish().or(z.literal("")), validityDays: numLike,
  validityDate: isoDay.nullish().or(z.literal("")), poNo: text(100), placeOfSupply: text(100),
});

export const quotationInputSchema = z.object({
  party: partySchema, items: z.array(itemSchema).max(200),
  terms: text(10000), notes: text(10000), bankDetails: bankSchema.nullish(), invoiceDetails: invoiceSchema.nullish(), summary: summarySchema.nullish(),
});
export type QuotationInput = z.input<typeof quotationInputSchema>;

const clampN = (v: unknown, min: number, max: number) => Math.min(Math.max(num(v), min), max);
const round3 = (v: number) => Math.round((v + Number.EPSILON) * 1000) / 1000;

function prepare(raw: unknown) {
  const parsed = quotationInputSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw badRequest(`Invalid quotation: ${issue?.path.join(".") ?? ""} ${issue?.message ?? ""}`.trim());
  }
  const input = parsed.data;
  const check = validateQuotationPayload(input.party, input.items);
  if (!check.isValid) throw badRequest(check.errors[0] ?? "Invalid quotation.");

  // Normalise to exactly what the DB can store so stored totals always equal calc(items).
  const items = input.items.map((it) => {
    const qty = round3(Math.max(0, num(it.qty)));
    const price = round2(Math.max(0, num(it.price)));
    if (qty > 1e5 || price > 1e8) throw badRequest("Item quantity or price is out of range.");
    return {
      name: (it.name || it.description || "").trim(), description: it.description?.trim() || null, hsn: it.hsn?.trim() || null, image: it.image?.trim() || null,
      qty, price, discount: round3(clampN(it.discount, 0, 100)), tax: round3(clampN(it.tax, 0, 100)),
    };
  });
  const s = input.summary ?? {};
  const summary = {
    discount: Math.max(0, round2(num(s.discount))), discountType: s.discountType === "%" ? "%" : "₹",
    additionalCharges: Math.max(0, round2(num(s.additionalCharges))), applyTCS: Boolean(s.applyTCS), autoRoundOff: Boolean(s.autoRoundOff),
    roundOffSign: s.roundOffSign === "-" ? "-" : "+", roundOffAmount: Math.max(0, round2(num(s.roundOffAmount))),
    amountReceived: Math.max(0, round2(num(s.amountReceived))), paymentMethod: s.paymentMethod?.trim() || "Cash",
  };
  const totals = calculateQuotationTotals(items, summary);
  if (totals.grandTotal > MAX_TOTAL || totals.subtotal > MAX_TOTAL || totals.amountReceived > MAX_TOTAL) throw badRequest("Quotation total is out of range.");
  return { input, items, summary, totals };
}

// ---- invoice numbering -----------------------------------------------------
type Tx = Prisma.TransactionClient;

/**
 * Atomically reserve the next number for `prefix`. The counter row is created on
 * first use, seeded after the highest number already present in quotations for
 * that prefix (migrated data) and CompanySettings.invoiceStart. The UPDATE ...
 * RETURNING takes a row lock, so concurrent transactions are serialised and can
 * never receive the same value.
 */
export async function nextInvoiceNumber(tx: Tx, prefix: string): Promise<number> {
  const existing = await tx.invoiceCounter.findUnique({ where: { prefix } });
  if (!existing) {
    const rows = await tx.$queryRaw<{ max: string | null }[]>`
      SELECT max(regexp_replace(invoice_details->>'number', '[^0-9]', '', 'g')::bigint)::text AS max
      FROM quotations
      WHERE invoice_details->>'prefix' = ${prefix}
        AND length(regexp_replace(invoice_details->>'number', '[^0-9]', '', 'g')) BETWEEN 1 AND 9`;
    const settings = await tx.companySettings.findFirst({ select: { invoiceStart: true } });
    const seed = Math.max(Number(rows[0]?.max ?? 0), (settings?.invoiceStart ?? 1) - 1, 0);
    await tx.$executeRaw`INSERT INTO invoice_counters (prefix, seq, updated_at) VALUES (${prefix}, ${seed}, now()) ON CONFLICT (prefix) DO NOTHING`;
  }
  const out = await tx.$queryRaw<{ seq: number }[]>`UPDATE invoice_counters SET seq = seq + 1, updated_at = now() WHERE prefix = ${prefix} RETURNING seq`;
  return out[0]!.seq;
}

// ---- DTO -------------------------------------------------------------------
type Row = Prisma.QuotationGetPayload<{ include: { items: true; user: { select: { name: true } } } }>;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Migrated quotations are shown exactly as stored: totals are read, never recomputed. */
export function toDto(q: Row) {
  const snap = obj(q.summarySnapshot);
  const snapTotals = obj(snap.totals);
  const summary = obj(snap.summary);
  const grandTotal = q.grandTotal.toNumber();
  const amountReceived = num(snapTotals.amountReceived ?? summary.amountReceived);
  const totals: QuotationTotals = {
    subtotal: q.subtotal.toNumber(), totalTax: q.tax.toNumber(), totalDiscount: q.discount.toNumber(),
    additionalCharges: num(snapTotals.additionalCharges ?? summary.additionalCharges), roundOff: q.roundOff.toNumber(), grandTotal,
    amountReceived, balanceAmount: snapTotals.balanceAmount !== undefined ? num(snapTotals.balanceAmount) : round2(grandTotal - amountReceived),
  };
  return {
    id: q.id, userId: q.userId, ownerName: q.user.name,
    party: obj(q.party), bankDetails: obj(q.bankDetails), invoiceDetails: obj(q.invoiceDetails),
    terms: q.terms ?? "", notes: q.notes ?? "", summary, totals, createdAt: q.createdAt.toISOString(), updatedAt: q.updatedAt.toISOString(),
    items: [...q.items].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({
      name: i.name, description: i.description ?? "", hsn: i.hsn ?? "", image: i.image ?? "",
      qty: i.quantity.toNumber(), price: i.price.toNumber(), discount: i.discount.toNumber(), tax: i.tax.toNumber(),
    })),
  };
}
export type QuotationDto = ReturnType<typeof toDto>;

export const quotationNumber = (invoiceDetails: Record<string, unknown>) =>
  `${String(invoiceDetails.prefix ?? "")}${String(invoiceDetails.number ?? "")}`;

const include = { items: true, user: { select: { name: true } } } as const;

async function load(id: string): Promise<Row> {
  if (!UUID.test(id)) throw badRequest("Invalid quotation id");
  const q = await prisma.quotation.findUnique({ where: { id }, include });
  if (!q) throw notFound("Quotation not found");
  return q;
}

const itemRows = (items: ReturnType<typeof prepare>["items"]) =>
  items.map((it, i) => ({ name: it.name, description: it.description, hsn: it.hsn, image: it.image, quantity: it.qty, price: it.price, discount: it.discount, tax: it.tax, sortOrder: i }));

// ---- create / update / get / list / delete --------------------------------
export async function createQuotation(actor: Actor, raw: unknown): Promise<QuotationDto> {
  const { input, items, summary, totals } = prepare(raw);
  const settings = await prisma.companySettings.findFirst();
  const inv = input.invoiceDetails ?? {};
  // Only administrators may open a new numbering series; a user-typed prefix could imitate another branch's series.
  const prefix = (isAdmin(actor) ? inv.prefix?.trim() : undefined) || settings?.quotationPrefix || DEFAULT_PREFIX;
  const date = inv.date || istToday().date;
  const days = inv.validityDays === undefined || inv.validityDays === null || inv.validityDays === "" ? 30 : Math.max(0, Math.floor(num(inv.validityDays)));
  const invoiceDetails = {
    prefix, number: "", date, validityDays: String(days), validityDate: inv.validityDate || addDaysIst(date, days),
    poNo: inv.poNo ?? "", placeOfSupply: inv.placeOfSupply ?? "",
  };

  const id = await prisma.$transaction(async (tx) => {
    // The client-sent number is ignored; the prefix is kept (MERN).
    invoiceDetails.number = String(await nextInvoiceNumber(tx, prefix));
    const q = await tx.quotation.create({
      data: {
        userId: actor.id, party: input.party as Prisma.InputJsonValue, bankDetails: (input.bankDetails ?? undefined) as Prisma.InputJsonValue | undefined,
        invoiceDetails, summarySnapshot: { summary, totals, items } as Prisma.InputJsonValue, terms: input.terms ?? null, notes: input.notes ?? null,
        subtotal: totals.subtotal, discount: totals.totalDiscount, tax: totals.totalTax, roundOff: totals.roundOff, grandTotal: totals.grandTotal,
        items: { create: itemRows(items) },
      },
      select: { id: true },
    });
    await tx.activityLog.create({ data: { userId: actor.id, action: "quotation.created", details: { quotationId: q.id, number: `${prefix}${invoiceDetails.number}` } } });
    return q.id;
  }, { maxWait: 30_000, timeout: 30_000 });
  return toDto(await load(id));
}

export async function updateQuotation(actor: Actor, id: string, raw: unknown): Promise<QuotationDto> {
  const existing = await load(id);
  if (!isAdmin(actor) && existing.userId !== actor.id) throw forbidden("Access denied");
  const { input, items, summary, totals } = prepare(raw);

  // Number + prefix are immutable once issued (MERN); everything else may change.
  const old = obj(existing.invoiceDetails);
  const inv = input.invoiceDetails;
  const date = inv?.date || (typeof old.date === "string" ? old.date.slice(0, 10) : istToday().date);
  const days = inv?.validityDays === undefined || inv?.validityDays === null || inv?.validityDays === "" ? num(old.validityDays) : Math.max(0, Math.floor(num(inv.validityDays)));
  const invoiceDetails = inv
    ? { ...old, date, validityDays: String(days), validityDate: inv.validityDate || addDaysIst(date, days), poNo: inv.poNo ?? "", placeOfSupply: inv.placeOfSupply ?? "", number: old.number, prefix: old.prefix ?? inv.prefix }
    : old;

  await prisma.$transaction(async (tx) => {
    await tx.quotationItem.deleteMany({ where: { quotationId: id } });
    await tx.quotation.update({
      where: { id },
      data: {
        party: input.party as Prisma.InputJsonValue, bankDetails: (input.bankDetails ?? undefined) as Prisma.InputJsonValue | undefined,
        invoiceDetails: invoiceDetails as Prisma.InputJsonValue, summarySnapshot: { summary, totals, items } as Prisma.InputJsonValue,
        terms: input.terms ?? null, notes: input.notes ?? null,
        subtotal: totals.subtotal, discount: totals.totalDiscount, tax: totals.totalTax, roundOff: totals.roundOff, grandTotal: totals.grandTotal,
        items: { create: itemRows(items) },
      },
    });
    await tx.activityLog.create({ data: { userId: actor.id, action: "quotation.updated", details: { quotationId: id } } });
  }, { maxWait: 30_000, timeout: 30_000 });
  return toDto(await load(id));
}

export async function getQuotation(actor: Actor, id: string): Promise<QuotationDto> {
  const q = await load(id);
  if (!isAdmin(actor) && q.userId !== actor.id) throw forbidden("Access denied");
  return toDto(q);
}

export async function listQuotations(actor: Actor, params: { page?: number; pageSize?: number } = {}) {
  const pageSize = Math.min(Math.max(Math.floor(params.pageSize ?? 20) || 20, 1), 200);
  const page = Math.max(Math.floor(params.page ?? 1) || 1, 1);
  const where: Prisma.QuotationWhereInput = isAdmin(actor) ? {} : { userId: actor.id };
  const [total, rows] = await Promise.all([
    prisma.quotation.count({ where }),
    prisma.quotation.findMany({ where, include: { user: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  const data = rows.map((q) => {
    const inv = obj(q.invoiceDetails);
    const party = obj(q.party);
    return {
      id: q.id, number: quotationNumber(inv), date: String(inv.date ?? q.createdAt.toISOString()),
      customer: String(party.name ?? ""), company: String(party.company ?? ""), phone: String(party.phone ?? ""),
      grandTotal: q.grandTotal.toNumber(), createdBy: q.user.name, userId: q.userId,
    };
  });
  return { data, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function deleteQuotation(actor: Actor, id: string) {
  if (!isAdmin(actor)) throw forbidden("Administrator access required.");
  const q = await load(id);
  await prisma.$transaction([
    prisma.quotation.delete({ where: { id } }),
    prisma.activityLog.create({ data: { userId: actor.id, action: "quotation.deleted", details: { quotationId: id, number: quotationNumber(obj(q.invoiceDetails)) } } }),
  ]);
}

export async function getFormDefaults() {
  const s = await prisma.companySettings.findFirst();
  return {
    prefix: s?.quotationPrefix || DEFAULT_PREFIX,
    pan: s?.pan ?? "",
    companyName: s?.companyName ?? "",
    bankDetails: obj(s?.bankDetails) as Record<string, string>,
  };
}
