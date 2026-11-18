import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/server/errors";
import { audit, authorize, failIf, requireId, type MaybeActor } from "./common";
import { isUuid, validateCategoryPayload, type Input } from "./fields";

export async function listCategories(actor: MaybeActor, query: { active?: string } = {}) {
  authorize(actor, "vendor.view");
  const where = query.active === "true" ? { isActive: true } : query.active === "false" ? { isActive: false } : {};
  const rows = await prisma.vendorCategory.findMany({ where, orderBy: { name: "asc" }, include: { _count: { select: { vendors: true } } } });
  return rows.map(({ _count, ...c }) => ({ ...c, vendorCount: _count.vendors }));
}

async function nameClash(name: string, excludeId?: string) {
  return prisma.vendorCategory.findFirst({
    where: { name: { equals: name.trim(), mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { name: true },
  });
}

export async function createCategory(actor: MaybeActor, input: Input) {
  const a = authorize(actor, "vendor.manage_categories");
  failIf(validateCategoryPayload(input));
  const name = String(input.name).trim();
  const clash = await nameClash(name);
  if (clash) throw conflict(`A category named "${clash.name}" already exists`);
  try {
    return await prisma.$transaction(async (tx) => {
      const c = await tx.vendorCategory.create({ data: { name, description: String(input.description ?? "").trim(), isActive: input.isActive !== false } });
      await audit(tx, a, "vendor.category_created", null, { categoryId: c.id, categoryName: c.name });
      return c;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw conflict(`A category named "${name}" already exists`);
    throw e;
  }
}

export async function updateCategory(actor: MaybeActor, id: string, input: Input) {
  const a = authorize(actor, "vendor.manage_categories");
  const cid = requireId(id, "category");
  failIf(validateCategoryPayload(input, { partial: true }));
  const cat = await prisma.vendorCategory.findUnique({ where: { id: cid } });
  if (!cat) throw notFound("Category not found");
  if (typeof input.name === "string") {
    const clash = await nameClash(input.name, cid);
    if (clash) throw conflict(`A category named "${clash.name}" already exists`);
  }
  return prisma.$transaction(async (tx) => {
    const u = await tx.vendorCategory.update({
      where: { id: cid },
      data: {
        ...(typeof input.name === "string" ? { name: input.name.trim() } : {}),
        ...("description" in input ? { description: String(input.description ?? "").trim() } : {}),
        ...(typeof input.isActive === "boolean" ? { isActive: input.isActive } : {}),
      },
    });
    await audit(tx, a, "vendor.category_updated", null, { categoryId: cid, from: { name: cat.name, isActive: cat.isActive }, to: { name: u.name, isActive: u.isActive } });
    return u;
  });
}

/** A category in use is never silently removed: supply `reassignTo` to move its vendors, or deactivate it instead. */
export async function deleteCategory(actor: MaybeActor, id: string, reassignTo?: unknown) {
  const a = authorize(actor, "vendor.manage_categories");
  const cid = requireId(id, "category");
  const cat = await prisma.vendorCategory.findUnique({ where: { id: cid } });
  if (!cat) throw notFound("Category not found");
  const inUse = await prisma.vendor.count({ where: { categoryId: cid } });
  let target: { id: string; name: string } | null = null;
  if (inUse > 0) {
    if (!isUuid(reassignTo)) {
      throw conflict(`${inUse} vendor${inUse === 1 ? " is" : "s are"} using this category. Choose a category to move them to, or deactivate this one instead.`);
    }
    if (reassignTo === cid) throw badRequest("Choose a different category to move the vendors to");
    target = await prisma.vendorCategory.findUnique({ where: { id: reassignTo }, select: { id: true, name: true } });
    if (!target) throw notFound("The category to move vendors to no longer exists");
  }
  await prisma.$transaction(async (tx) => {
    if (target) await tx.vendor.updateMany({ where: { categoryId: cid }, data: { categoryId: target.id } });
    await tx.vendorCategory.delete({ where: { id: cid } });
    await audit(tx, a, "vendor.category_deleted", null, { categoryId: cid, categoryName: cat.name, vendorsReassigned: inUse, ...(target ? { reassignedTo: target.name } : {}) });
  });
  return { deleted: true as const, vendorsReassigned: inUse };
}
