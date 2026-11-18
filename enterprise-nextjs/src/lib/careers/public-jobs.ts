import "server-only";
import type { Prisma } from "@/generated/prisma/client";

// Original publicFilter(): Active, published, not archived, deadline not passed.
export const publicJobFilter = (): Prisma.CareerJobWhereInput => ({
  status: "ACTIVE",
  isPublished: true,
  archivedAt: null,
  deadline: { gte: new Date() },
});

export const publicJobOrder: Prisma.CareerJobOrderByWithRelationInput[] = [
  { displayOrder: "asc" },
  { publishedAt: { sort: "desc", nulls: "last" } },
  { createdAt: "desc" },
];
