import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { publicJobFilter, publicJobOrder } from "@/lib/careers/public-jobs";
import { legacyJob, pageOptions, text } from "@/lib/careers/shared";

export const dynamic = "force-dynamic";

// GET /api/careers/jobs — same filters, ordering and response shape as the original.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const { page, limit } = pageOptions(url);
  const where = publicJobFilter();
  const search = text(url.searchParams.get("search"), 100);
  if (search) where.title = { contains: search, mode: "insensitive" };
  const department = text(url.searchParams.get("department"), 120);
  if (department) where.department = department;
  const location = text(url.searchParams.get("location"), 120);
  if (location) where.location = location;
  const employmentType = text(url.searchParams.get("employmentType"), 120);
  if (employmentType) where.employmentType = employmentType;
  const [jobs, total] = await Promise.all([
    prisma.careerJob.findMany({ where, orderBy: publicJobOrder, skip: (page - 1) * limit, take: limit }),
    prisma.careerJob.count({ where }),
  ]);
  return NextResponse.json({ jobs: jobs.map(legacyJob), total, page, pages: Math.ceil(total / limit) });
}
