// Product catalogue service. Parity: backend/routes/Products/product.js, models/ProductData.js,
// services/productCode.js. Writes are admin-only; reads need any signed-in user.
import type { Prisma } from "@/generated/prisma/client";
import { escapeLike } from "@/lib/db/like";
import { prisma } from "@/lib/prisma/client";
import { badRequest, conflict, notFound } from "@/server/errors";
import { advisoryLock, isUuid, logActivity, requireActor, requireAdminActor, type MaybeActor } from "./common";
import { deleteProductImage, saveProductImage, type ImageUpload } from "./images";
import { parsePrice } from "./price";

type Tx = Prisma.TransactionClient;
const productInclude = { category: true, price: true } satisfies Prisma.ProductInclude;
type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d.toString()));
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type ProductView = ReturnType<typeof toView>;
export function toView(p: ProductRow) {
  return {
    id: p.id,
    code: p.code,
    secondaryCode: p.secondaryCode,
    name: p.name,
    category: p.category ? { id: p.category.id, code: p.category.code, name: p.category.name } : null,
    imagePath: p.imagePath,
    description: p.description,
    type: p.type,
    color: p.color,
    hsnCode: p.hsnCode,
    gstRate: num(p.gstRate) ?? num(p.price?.gstRate),
    dimension: p.dimension,
    status: p.status,
    archivedAt: p.archivedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    /** Concurrency token: send back unchanged on update. */
    updatedAt: p.updatedAt.toISOString(),
    price: p.price
      ? {
          priceCode: p.price.priceCode,
          purchasePrice: num(p.price.purchasePrice),
          basicAmount: num(p.price.basicAmount),
          gstRate: num(p.price.gstRate),
          netAmount: num(p.price.netAmount),
          sales5To50: num(p.price.sales5To50),
          sales50To100: num(p.price.sales50To100),
          sales100Above: num(p.price.sales100Above),
        }
      : null,
  };
}

/* ------------------------------ product codes ------------------------------ */

/** First two letters (any script) of the category name, upper-cased. Parity: productCodePrefix. */
export function productCodePrefix(categoryName: string) {
  const prefix = (categoryName.match(/\p{L}/gu) ?? []).slice(0, 2).join("").toUpperCase();
  if (!prefix) throw badRequest("A product category must contain at least one alphabetic character.");
  return prefix;
}

async function highestSequence(db: Tx | typeof prisma, prefix: string) {
  const re = new RegExp(`^${escapeRegex(prefix)}-(\\d+)$`);
  const rows = await db.product.findMany({ where: { code: { startsWith: `${prefix}-` } }, select: { code: true } });
  return rows.reduce((m, r) => Math.max(m, Number(re.exec(r.code ?? "")?.[1] ?? 0)), 0);
}
const formatCode = (prefix: string, n: number) => `${prefix}-${String(n).padStart(3, "0")}`;

/** Informational only; never reserves a code (as MERN previewProductCode). */
export async function previewProductCode(actor: MaybeActor, categoryId: string) {
  requireActor(actor);
  if (!isUuid(categoryId)) throw badRequest("Please select a valid category.");
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw badRequest("Please select a valid category.");
  const prefix = productCodePrefix(category.name);
  return formatCode(prefix, (await highestSequence(prisma, prefix)) + 1);
}

async function nextPriceCode(tx: Tx) {
  const rows = await tx.productPrice.findMany({ where: { priceCode: { startsWith: "RS" } }, select: { priceCode: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number(/^RS(\d+)$/.exec(r.priceCode ?? "")?.[1] ?? 0)), 0);
  return `RS${String(max + 1).padStart(3, "0")}`;
}

/* --------------------------------- inputs --------------------------------- */

export type ProductInput = {
  name: string;
  secondaryCode: string;
  categoryId: string;
  description?: string | null;
  type?: string | null;
  color?: string | null;
  hsnCode?: string | null;
  dimension?: string | null;
  price: unknown;
};

const text = (v: string | null | undefined) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? null : t;
};

async function validateCommon(db: Tx | typeof prisma, input: ProductInput, excludeId?: string) {
  const name = text(input.name);
  const sCode = text(input.secondaryCode);
  if (!name || !sCode || !input.categoryId) throw badRequest("Product name, style code, and category are required.");
  const price = parsePrice(input.price);
  if (!isUuid(input.categoryId) || !(await db.category.findUnique({ where: { id: input.categoryId } }))) throw badRequest("Please select a valid category.");
  const dup = await db.product.findFirst({
    where: { secondaryCode: { equals: sCode, mode: "insensitive" }, status: { not: "ARCHIVED" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (dup) throw conflict("A product with this style/SKU code already exists.");
  return { name, sCode, price };
}

const priceData = (p: ReturnType<typeof parsePrice>) => ({
  purchasePrice: p.purchasePrice ?? null,
  basicAmount: p.basicAmount,
  gstRate: p.gstRate,
  netAmount: p.netAmount,
  sales5To50: p.sales5To50 ?? null,
  sales50To100: p.sales50To100 ?? null,
  sales100Above: p.sales100Above ?? null,
});

/* ---------------------------------- create --------------------------------- */

export async function createProduct(actor: MaybeActor, input: ProductInput, image?: ImageUpload | null): Promise<ProductView> {
  const admin = requireAdminActor(actor);
  await validateCommon(prisma, input); // cheap checks first so a bad form never uploads an image
  const imagePath = image ? await saveProductImage(image) : null;
  try {
    const created = await prisma.$transaction(async (tx) => {
      await advisoryLock(tx, "product-code");
      const checked = await validateCommon(tx, input); // re-check under the lock
      const category = await tx.category.findUniqueOrThrow({ where: { id: input.categoryId } });
      const prefix = productCodePrefix(category.name);
      const code = formatCode(prefix, (await highestSequence(tx, prefix)) + 1);
      const product = await tx.product.create({
        data: {
          code,
          secondaryCode: checked.sCode,
          name: checked.name,
          categoryId: category.id,
          imagePath,
          description: text(input.description),
          type: text(input.type),
          color: text(input.color),
          hsnCode: text(input.hsnCode),
          gstRate: checked.price.gstRate,
          dimension: text(input.dimension) ?? "",
          price: { create: { priceCode: await nextPriceCode(tx), ...priceData(checked.price) } },
        },
        include: productInclude,
      });
      await logActivity(tx, admin, "product.created", { productId: product.id, productCode: code });
      return product;
    });
    return toView(created);
  } catch (error) {
    await deleteProductImage(imagePath).catch(() => {});
    throw error;
  }
}

/* ---------------------------------- update --------------------------------- */

export type UpdateInput = ProductInput & {
  /** The `updatedAt` the client loaded. Required: stale values fail with 409. */
  expectedUpdatedAt: string | Date;
  removeImage?: boolean;
};

export async function updateProduct(actor: MaybeActor, id: string, input: UpdateInput, image?: ImageUpload | null): Promise<ProductView> {
  const admin = requireAdminActor(actor);
  if (!isUuid(id)) throw notFound("Product not found.");
  const expected = new Date(input.expectedUpdatedAt);
  if (!input.expectedUpdatedAt || Number.isNaN(expected.getTime())) throw badRequest("The product version is required. Refresh and try again.");

  const existing = await prisma.product.findUnique({ where: { id }, include: productInclude });
  if (!existing) throw notFound("Product not found.");
  if (existing.status === "ARCHIVED") throw conflict("Archived products cannot be edited.");
  if (existing.updatedAt.getTime() !== expected.getTime()) throw conflict("This product was changed by another user. Refresh and try again.");
  const checked = await validateCommon(prisma, input, id);

  const changeImage = Boolean(image) || Boolean(input.removeImage);
  const newImagePath = image ? await saveProductImage(image) : null;
  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Atomic compare-and-set on updatedAt: a concurrent writer makes count 0.
      const { count } = await tx.product.updateMany({
        where: { id, updatedAt: expected, status: { not: "ARCHIVED" } },
        data: {
          secondaryCode: checked.sCode,
          name: checked.name,
          categoryId: input.categoryId,
          description: text(input.description),
          type: text(input.type),
          color: text(input.color),
          hsnCode: text(input.hsnCode),
          gstRate: checked.price.gstRate,
          dimension: text(input.dimension) ?? "",
          ...(changeImage ? { imagePath: newImagePath } : {}),
        },
      });
      if (count === 0) throw conflict("This product was changed by another user. Refresh and try again.");
      await advisoryLock(tx, "product-code"); // price codes are allocated under the same lock
      const pd = priceData(checked.price);
      await tx.productPrice.upsert({ where: { productId: id }, update: pd, create: { productId: id, priceCode: await nextPriceCode(tx), ...pd } });
      await logActivity(tx, admin, "product.updated", { productId: id, imageChanged: changeImage });
      return tx.product.findUniqueOrThrow({ where: { id }, include: productInclude });
    });
    if (changeImage && existing.imagePath && existing.imagePath !== updated.imagePath) {
      await deleteProductImage(existing.imagePath).catch(() => {});
    }
    return toView(updated);
  } catch (error) {
    await deleteProductImage(newImagePath).catch(() => {});
    throw error;
  }
}

/* --------------------------------- archive --------------------------------- */

export async function archiveProduct(actor: MaybeActor, id: string): Promise<ProductView> {
  const admin = requireAdminActor(actor);
  if (!isUuid(id)) throw notFound("Product not found");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { id } });
    if (!existing) throw notFound("Product not found");
    if (existing.status === "ARCHIVED") throw conflict("Product is already archived.");
    const vendorReferenceCount = await tx.vendorProduct.count({ where: { productId: id } });
    const product = await tx.product.update({ where: { id }, data: { status: "ARCHIVED", archivedAt: new Date() }, include: productInclude });
    await logActivity(tx, admin, "product.archived", { productId: id, vendorReferenceCount });
    return toView(product);
  });
}

/* ---------------------------------- reads ---------------------------------- */

export async function getProduct(actor: MaybeActor, id: string): Promise<ProductView> {
  requireActor(actor);
  if (!isUuid(id)) throw badRequest("Invalid product ID.");
  const product = await prisma.product.findUnique({ where: { id }, include: productInclude });
  if (!product) throw notFound("Product not found.");
  return toView(product);
}

export const PRODUCT_SORTS = ["updated_desc", "created_desc", "created_asc", "name_asc", "name_desc", "price_asc", "price_desc"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];
export type ProductStatusFilter = "active" | "inactive" | "archived" | "all";

export type ListProductsInput = {
  query?: string;
  categoryId?: string;
  status?: string;
  sort?: string;
  page?: number;
  limit?: number;
};

function textSearch(term: string): Prisma.ProductWhereInput[] {
  const c = { contains: escapeLike(term), mode: "insensitive" as const };
  const or: Prisma.ProductWhereInput[] = [{ code: c }, { name: c }, { secondaryCode: c }, { type: c }, { color: c }, { dimension: c }];
  const n = Number(term);
  if (Number.isFinite(n) && n >= 0 && n < 1000) or.push({ price: { is: { gstRate: n } } });
  return or;
}

export async function listProducts(actor: MaybeActor, input: ListProductsInput = {}) {
  requireActor(actor);
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 20) || 20, 1), 200);
  const page = Math.max(Math.trunc(input.page ?? 1) || 1, 1);
  const where: Prisma.ProductWhereInput = {};
  const status = input.status ?? "active";
  if (status === "archived") where.status = "ARCHIVED";
  else if (status === "inactive") where.status = "INACTIVE";
  else if (status !== "all") where.status = { not: "ARCHIVED" };
  if (input.categoryId) where.categoryId = isUuid(input.categoryId) ? input.categoryId : "00000000-0000-0000-0000-000000000000";
  const query = (input.query ?? "").trim();
  if (query) {
    where.OR = [...textSearch(query), { description: { contains: escapeLike(query), mode: "insensitive" } }, { category: { is: { name: { contains: escapeLike(query), mode: "insensitive" } } } }];
  }
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = (() => {
    switch (input.sort) {
      case "created_desc": return [{ createdAt: "desc" }];
      case "created_asc": return [{ createdAt: "asc" }];
      case "name_asc": return [{ name: "asc" }];
      case "name_desc": return [{ name: "desc" }];
      case "price_asc": return [{ price: { netAmount: { sort: "asc", nulls: "last" } } }];
      case "price_desc": return [{ price: { netAmount: { sort: "desc", nulls: "last" } } }];
      default: return [{ updatedAt: "desc" }];
    }
  })();
  orderBy.push({ id: "asc" });
  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit, include: productInclude }),
    prisma.product.count({ where }),
  ]);
  return { products: rows.map(toView), total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) };
}

/**
 * Contract used by quotations and vendors: non-archived products matching code, name,
 * style code, type, colour, dimension or exact GST rate. Empty query -> []. limit 1..50.
 */
export async function searchProducts(actor: MaybeActor, query: string, limit = 50): Promise<ProductView[]> {
  requireActor(actor);
  const term = String(query ?? "").trim();
  if (!term) return [];
  const take = Math.min(Math.max(Math.trunc(limit) || 50, 1), 50);
  const rows = await prisma.product.findMany({
    where: { status: { not: "ARCHIVED" }, OR: textSearch(term) },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take,
    include: productInclude,
  });
  return rows.map(toView);
}

/** Re-read products (any status) by id, e.g. for quotations that need current prices. */
export async function getProductsByIds(actor: MaybeActor, ids: string[]): Promise<ProductView[]> {
  requireActor(actor);
  const valid = ids.filter(isUuid);
  if (!valid.length) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: valid } }, include: productInclude });
  return rows.map(toView);
}
