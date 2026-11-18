import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { applicationStatusFromLabel, isUuid, text } from "./shared";

// Port of applicationFilter() from the original careers routes.
export function applicationFilter(url: URL): Prisma.CareerApplicationWhereInput {
  const q = url.searchParams;
  const where: Prisma.CareerApplicationWhereInput = {};
  const jobId = q.get("jobId");
  if (isUuid(jobId)) where.jobId = jobId;
  const department = text(q.get("department"), 100);
  if (department) where.department = department;
  const status = applicationStatusFromLabel[q.get("status") ?? ""];
  if (status) where.status = status;
  const from = q.get("from");
  const to = q.get("to");
  const createdAt: Prisma.DateTimeFilter = {};
  if (from && !Number.isNaN(Date.parse(from))) createdAt.gte = new Date(from);
  if (to && !Number.isNaN(Date.parse(to))) createdAt.lte = new Date(to);
  if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;
  const search = text(q.get("search"), 100);
  if (search) {
    const contains = { contains: search, mode: "insensitive" as const };
    where.OR = [{ fullName: contains }, { email: contains }, { phone: contains }, { jobTitle: contains }, ...(isUuid(search) ? [{ id: search }] : [])];
  }
  return where;
}
