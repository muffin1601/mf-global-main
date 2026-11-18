// Parity: backend/routes/Products/Category.js and models/Category.js.
import { prisma } from "@/lib/prisma/client";
import { badRequest, conflict, notFound } from "@/server/errors";
import { advisoryLock, isUuid, logActivity, requireActor, requireAdminActor, type MaybeActor } from "./common";

export type CategoryRow = { id: string; code: string; name: string; productCount: number };

export async function listCategories(actor: MaybeActor): Promise<CategoryRow[]> {
  requireActor(actor);
  const rows = await prisma.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });
  return rows.map((c) => ({ id: c.id, code: c.code, name: c.name, productCount: c._count.products }));
}

const cleanName = (name: unknown) => {
  const v = typeof name === "string" ? name.trim() : "";
  if (!v) throw badRequest("Category name is required.");
  if (v.length > 80) throw badRequest("Category name must be 80 characters or fewer.");
  return v;
};

/** 'C{FIRST LETTER}{nnn}', e.g. CB001. Allocated under a lock so concurrent creates never collide. */
async function nextCategoryCode(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], name: string) {
  const letter = (name[0] ?? "").toUpperCase();
  const prefix = `C${letter}`;
  const rows = await tx.category.findMany({ where: { code: { startsWith: prefix } }, select: { code: true } });
  const max = rows.reduce((m, r) => {
    const digits = r.code.slice(prefix.length);
    return /^\d+$/.test(digits) ? Math.max(m, Number(digits)) : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export async function createCategory(actor: MaybeActor, input: { name: string }) {
  const admin = requireAdminActor(actor);
  const name = cleanName(input.name);
  return prisma.$transaction(async (tx) => {
    await advisoryLock(tx, "category-code");
    if (await tx.category.findFirst({ where: { name: { equals: name, mode: "insensitive" } } })) throw badRequest("Category already exists.");
    const category = await tx.category.create({ data: { name, code: await nextCategoryCode(tx, name) } });
    await logActivity(tx, admin, "category.created", { categoryId: category.id, name });
    return category;
  });
}

export async function renameCategory(actor: MaybeActor, id: string, input: { name: string }) {
  const admin = requireAdminActor(actor);
  if (!isUuid(id)) throw notFound("Category not found");
  const name = cleanName(input.name);
  return prisma.$transaction(async (tx) => {
    await advisoryLock(tx, "category-code");
    const existing = await tx.category.findUnique({ where: { id } });
    if (!existing) throw notFound("Category not found");
    if (await tx.category.findFirst({ where: { id: { not: id }, name: { equals: name, mode: "insensitive" } } })) throw badRequest("Category already exists.");
    const category = await tx.category.update({ where: { id }, data: { name } });
    await logActivity(tx, admin, "category.renamed", { categoryId: id, from: existing.name, to: name });
    return category;
  });
}

export async function deleteCategory(actor: MaybeActor, id: string) {
  const admin = requireAdminActor(actor);
  if (!isUuid(id)) throw notFound("Category not found");
  await prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({ where: { id } });
    if (!category) throw notFound("Category not found");
    const count = await tx.product.count({ where: { categoryId: id } });
    if (count) throw conflict(`This category is used by ${count} product${count === 1 ? "" : "s"}. Move those products to another category before deleting it.`);
    await tx.category.delete({ where: { id } });
    await logActivity(tx, admin, "category.deleted", { categoryId: id, name: category.name });
  });
}
