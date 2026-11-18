import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { conflict, notFound } from "@/server/errors";
import { audit, authorize, failIf, loadVendor, num, pageParams, requireId, type Db, type MaybeActor } from "./common";
import { has, isUuid, parseDate, validateVendorProductPayload, type Input } from "./fields";

const money = (v: unknown) => new Prisma.Decimal(Number(v).toFixed(2));
const dec = (v: unknown, dp: number, fallback = 0) => new Prisma.Decimal((has(v) ? Number(v) : fallback).toFixed(dp));

const include = {
  product: { select: { id: true, code: true, name: true, hsnCode: true } },
  priceTiers: { orderBy: { minQty: "asc" as const } },
};
type Row = Prisma.VendorProductGetPayload<{ include: typeof include }>;

function present(r: Row) {
  return {
    id: r.id, vendorId: r.vendorId, product: r.product, vendorItemCode: r.vendorItemCode, currency: r.currency,
    purchasePrice: num(r.purchasePrice) as number, moq: num(r.moq) as number, leadTimeDays: r.leadTimeDays, taxRate: num(r.taxRate) as number,
    discountPercent: num(r.discountPercent) as number, effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo, notes: r.notes,
    isActive: r.isActive, isPreferred: r.isPreferred,
    priceTiers: r.priceTiers.map((t) => ({ id: t.id, minQty: num(t.minQty) as number, maxQty: num(t.maxQty), unitPrice: num(t.unitPrice) as number, discountPercent: num(t.discountPercent) as number })),
  };
}

/** Rows for the same vendor+product whose effective window intersects [from, to). Open end = null. */
async function findOverlap(db: Db, vendorId: string, productId: string, from: Date, to: Date | null, excludeId?: string) {
  const rows = await db.vendorProduct.findMany({ where: { vendorId, productId, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { effectiveFrom: true, effectiveTo: true } });
  return rows.find((r) => (r.effectiveTo === null || from < r.effectiveTo) && (to === null || to > r.effectiveFrom)) ?? null;
}

export async function listVendorProducts(actor: MaybeActor, vendorId: string, query: { active?: string; page?: unknown; limit?: unknown } = {}) {
  authorize(actor, "vendor.view");
  const v = await loadVendor(vendorId);
  const { page, limit, skip } = pageParams(query, 100);
  const where = { vendorId: v.id, ...(query.active === "true" ? { isActive: true } : query.active === "false" ? { isActive: false } : {}) };
  const [rows, total] = await Promise.all([
    prisma.vendorProduct.findMany({ where, include, orderBy: [{ isPreferred: "desc" }, { effectiveFrom: "desc" }], skip, take: limit }),
    prisma.vendorProduct.count({ where }),
  ]);
  return { items: rows.map(present), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** Reverse lookup: which vendors supply a product (cheapest first). */
export async function vendorsByProduct(actor: MaybeActor, productId: string) {
  authorize(actor, "vendor.view");
  const rows = await prisma.vendorProduct.findMany({
    where: { productId: requireId(productId, "product"), isActive: true, vendor: { archivedAt: null } },
    orderBy: { purchasePrice: "asc" }, take: 100,
    select: { id: true, purchasePrice: true, currency: true, leadTimeDays: true, vendor: { select: { id: true, vendorCode: true, name: true, status: true, performanceScore: true } } },
  });
  return rows.map((r) => ({ id: r.id, purchasePrice: num(r.purchasePrice) as number, currency: r.currency, leadTimeDays: r.leadTimeDays, vendor: { ...r.vendor, performanceScore: num(r.vendor.performanceScore) } }));
}

/** Product picker for the pricing form. */
export async function searchProducts(actor: MaybeActor, q: string, limit = 25) {
  authorize(actor, "vendor.view");
  const term = q.trim();
  return prisma.product.findMany({
    where: { status: "ACTIVE", ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { code: { contains: term, mode: "insensitive" } }] } : {}) },
    orderBy: { name: "asc" }, take: Math.min(500, Math.max(1, limit)), select: { id: true, code: true, name: true },
  });
}

const tiersOf = (input: Input) => ((Array.isArray(input.priceTiers) ? input.priceTiers : []) as Input[]).map((t) => ({
  minQty: dec(t.minQty, 3), maxQty: has(t.maxQty) ? dec(t.maxQty, 3) : null, unitPrice: money(t.unitPrice), discountPercent: dec(t.discountPercent, 3),
}));

export async function addVendorProduct(actor: MaybeActor, vendorId: string, input: Input) {
  const a = authorize(actor, "vendor.edit");
  const v = await loadVendor(vendorId);
  failIf(validateVendorProductPayload(input));
  if (!isUuid(input.productId)) throw notFound("The selected product no longer exists");
  const product = await prisma.product.findUnique({ where: { id: input.productId }, select: { id: true, name: true, code: true } });
  if (!product) throw notFound("The selected product no longer exists");
  const from = parseDate(input.effectiveFrom) ?? new Date();
  const to = parseDate(input.effectiveTo);
  if (await findOverlap(prisma, v.id, product.id, from, to)) {
    throw conflict(`A price record for ${product.name ?? product.code} already covers these dates. Close the existing record first or choose a later effective-from date.`);
  }
  return prisma.$transaction(async (tx) => {
    const r = await tx.vendorProduct.create({
      data: {
        vendorId: v.id, productId: product.id, vendorItemCode: String(input.vendorItemCode ?? "").trim(), purchasePrice: money(input.purchasePrice),
        currency: has(input.currency) ? String(input.currency) : "INR", moq: dec(input.moq, 3, 1), leadTimeDays: has(input.leadTimeDays) ? Math.round(Number(input.leadTimeDays)) : 0,
        taxRate: dec(input.taxRate, 3), discountPercent: dec(input.discountPercent, 3), effectiveFrom: from, effectiveTo: to, notes: String(input.notes ?? "").trim(),
        isActive: input.isActive !== false, isPreferred: input.isPreferred === true, priceTiers: { create: tiersOf(input) },
      },
      include,
    });
    await audit(tx, a, "vendor.product_added", v, { product: product.name, productCode: product.code });
    return present(r);
  });
}

async function ownRecord(vendorId: string, itemId: string) {
  const v = await loadVendor(vendorId);
  const r = await prisma.vendorProduct.findUnique({ where: { id: requireId(itemId, "pricing record") }, include });
  if (!r || r.vendorId !== v.id) throw notFound("Pricing record not found for this vendor");
  return { v, r };
}

export async function updateVendorProduct(actor: MaybeActor, vendorId: string, itemId: string, input: Input) {
  const a = authorize(actor, "vendor.edit");
  const { v, r } = await ownRecord(vendorId, itemId);
  const merged: Input = { productId: r.productId, ...present(r), ...input };
  failIf(validateVendorProductPayload(merged, { partial: true }));
  const from = has(input.effectiveFrom) ? (parseDate(input.effectiveFrom) as Date) : r.effectiveFrom;
  const to = "effectiveTo" in input ? parseDate(input.effectiveTo) : r.effectiveTo;
  if (await findOverlap(prisma, v.id, r.productId, from, to, r.id)) throw conflict("Another price record for this product already covers these dates.");
  return prisma.$transaction(async (tx) => {
    if (Array.isArray(input.priceTiers)) await tx.vendorPriceTier.deleteMany({ where: { vendorProductId: r.id } });
    const u = await tx.vendorProduct.update({
      where: { id: r.id },
      data: {
        ...(has(input.vendorItemCode) || "vendorItemCode" in input ? { vendorItemCode: String(input.vendorItemCode ?? "").trim() } : {}),
        ...(has(input.purchasePrice) ? { purchasePrice: money(input.purchasePrice) } : {}),
        ...(has(input.currency) ? { currency: String(input.currency) } : {}),
        ...(has(input.moq) ? { moq: dec(input.moq, 3) } : {}),
        ...(has(input.leadTimeDays) ? { leadTimeDays: Math.round(Number(input.leadTimeDays)) } : {}),
        ...(has(input.taxRate) ? { taxRate: dec(input.taxRate, 3) } : {}),
        ...(has(input.discountPercent) ? { discountPercent: dec(input.discountPercent, 3) } : {}),
        effectiveFrom: from, effectiveTo: to,
        ...("notes" in input ? { notes: String(input.notes ?? "").trim() } : {}),
        ...(typeof input.isActive === "boolean" ? { isActive: input.isActive } : {}),
        ...(typeof input.isPreferred === "boolean" ? { isPreferred: input.isPreferred } : {}),
        ...(Array.isArray(input.priceTiers) ? { priceTiers: { create: tiersOf(input) } } : {}),
      },
      include,
    });
    const priceChanged = num(r.purchasePrice) !== num(u.purchasePrice);
    await audit(tx, a, "vendor.pricing_updated", v, { recordId: r.id, ...(priceChanged ? { priceChanged: { from: num(r.purchasePrice), to: num(u.purchasePrice) } } : {}) });
    return present(u);
  });
}

export async function deleteVendorProduct(actor: MaybeActor, vendorId: string, itemId: string) {
  const a = authorize(actor, "vendor.edit");
  const { v, r } = await ownRecord(vendorId, itemId);
  await prisma.$transaction(async (tx) => {
    await tx.vendorProduct.delete({ where: { id: r.id } });
    await audit(tx, a, "vendor.product_removed", v, { product: r.product.name });
  });
  return { ok: true as const };
}
