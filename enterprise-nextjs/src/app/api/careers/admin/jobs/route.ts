import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { audit, withCareerAdmin } from "@/lib/careers/admin-session";
import { pickJobFields, validateJob } from "@/lib/careers/job-payload";
import { jobStatusFromLabel, legacyJob, pageOptions, text } from "@/lib/careers/shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withCareerAdmin(request, async () => {
    const url = new URL(request.url);
    const { page, limit } = pageOptions(url);
    const where: Prisma.CareerJobWhereInput = {};
    const status = jobStatusFromLabel[url.searchParams.get("status") ?? ""];
    if (status) where.status = status;
    const search = text(url.searchParams.get("search"), 100);
    if (search) where.title = { contains: search, mode: "insensitive" };
    const [jobs, total] = await Promise.all([
      prisma.careerJob.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.careerJob.count({ where }),
    ]);
    const counts = await prisma.careerApplication.groupBy({ by: ["jobId"], where: { jobId: { in: jobs.map((job) => job.id) } }, _count: { _all: true } });
    const countMap = new Map(counts.map((count) => [count.jobId, count._count._all]));
    return NextResponse.json({ jobs: jobs.map((job) => ({ ...legacyJob(job), applicationCount: countMap.get(job.id) ?? 0 })), total, page, pages: Math.ceil(total / limit) });
  });
}

export async function POST(request: Request) {
  return withCareerAdmin(request, async () => {
    const result = validateJob(pickJobFields(await request.json().catch(() => null)));
    if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });
    const publishedAt = result.data.isPublished && result.data.status === "ACTIVE" ? new Date() : null;
    const job = await prisma.careerJob.create({ data: { ...result.data, publishedAt } });
    audit(request, "job_created", job.id);
    return NextResponse.json(legacyJob(job), { status: 201 });
  });
}
