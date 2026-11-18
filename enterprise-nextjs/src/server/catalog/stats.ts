// Real figures only for the product dashboard (the MERN low-stock / top-selling / returns
// cards and charts had no data source and are intentionally not reproduced).
import { prisma } from "@/lib/prisma/client";
import { requireActor, type MaybeActor } from "./common";

export async function getCatalogStats(actor: MaybeActor) {
  requireActor(actor);
  const [byStatus, byCategory, categories, vendors] = await Promise.all([
    prisma.product.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.product.groupBy({ by: ["categoryId"], where: { status: { not: "ARCHIVED" } }, _count: { _all: true } }),
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.vendor.count({ where: { archivedAt: null } }),
  ]);
  const status = { ACTIVE: 0, INACTIVE: 0, ARCHIVED: 0 } as { ACTIVE: number; INACTIVE: number; ARCHIVED: number } & Record<string, number>;
  for (const r of byStatus) status[r.status] = r._count._all;
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const productsByCategory = byCategory
    .map((r) => ({ category: r.categoryId ? (names.get(r.categoryId) ?? "Unknown") : "Uncategorised", count: r._count._all }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  return {
    totalProducts: (status.ACTIVE ?? 0) + (status.INACTIVE ?? 0), // non-archived
    totalVendors: vendors, // non-archived vendors
    productsByStatus: status,
    productsByCategory,
  };
}
