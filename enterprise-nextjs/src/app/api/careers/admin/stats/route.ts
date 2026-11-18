import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { withCareerAdmin } from "@/lib/careers/admin-session";
import { applicationStatusLabels, legacyApplication, legacyJob } from "@/lib/careers/shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withCareerAdmin(request, async () => {
    const [totalJobs, activeJobs, draftJobs, closedJobs, totalApplications, newApplications, shortlistedCandidates, hiredCandidates, recentApplications, recentJobs, byJob, byStatus] = await Promise.all([
      prisma.careerJob.count(),
      prisma.careerJob.count({ where: { status: "ACTIVE" } }),
      prisma.careerJob.count({ where: { status: "DRAFT" } }),
      prisma.careerJob.count({ where: { status: "CLOSED" } }),
      prisma.careerApplication.count(),
      prisma.careerApplication.count({ where: { status: "NEW" } }),
      prisma.careerApplication.count({ where: { status: "SHORTLISTED" } }),
      prisma.careerApplication.count({ where: { status: "HIRED" } }),
      prisma.careerApplication.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.careerJob.findMany({ where: { isPublished: true }, orderBy: { publishedAt: { sort: "desc", nulls: "last" } }, take: 5 }),
      prisma.careerApplication.groupBy({ by: ["jobTitle"], _count: { _all: true }, orderBy: { _count: { jobTitle: "desc" } }, take: 10 }),
      prisma.careerApplication.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    return NextResponse.json({
      totalJobs, activeJobs, draftJobs, closedJobs, totalApplications, newApplications, shortlistedCandidates, hiredCandidates,
      recentApplications: recentApplications.map(legacyApplication),
      recentJobs: recentJobs.map(legacyJob),
      byJob: byJob.map((row) => ({ _id: row.jobTitle, count: row._count._all })),
      byStatus: byStatus.map((row) => ({ _id: applicationStatusLabels[row.status], count: row._count._all })),
    });
  });
}
