import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { audit, withCareerAdmin } from "@/lib/careers/admin-session";
import { existingJobInput, pickJobFields, validateJob } from "@/lib/careers/job-payload";
import { isUuid, legacyJob } from "@/lib/careers/shared";

type Context = { params: Promise<{ id: string }> };
const notFound = () => new NextResponse("Not Found", { status: 404 });

export async function PUT(request: Request, { params }: Context) {
  return withCareerAdmin(request, async () => {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const job = await prisma.careerJob.findUnique({ where: { id } });
    if (!job) return notFound();
    const result = validateJob({ ...existingJobInput(job), ...pickJobFields(await request.json().catch(() => null)) });
    if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });
    const publishedAt = result.data.isPublished && !job.isPublished ? new Date() : job.publishedAt;
    const updated = await prisma.careerJob.update({ where: { id }, data: { ...result.data, publishedAt } });
    audit(request, "job_updated", id);
    return NextResponse.json(legacyJob(updated));
  });
}

// Original behaviour: "Delete" archives the job (closed + unpublished), it is not removed.
export async function DELETE(request: Request, { params }: Context) {
  return withCareerAdmin(request, async () => {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const result = await prisma.careerJob.updateMany({ where: { id }, data: { archivedAt: new Date(), status: "CLOSED", isPublished: false } });
    if (!result.count) return notFound();
    audit(request, "job_archived", id);
    return NextResponse.json({ success: true });
  });
}
