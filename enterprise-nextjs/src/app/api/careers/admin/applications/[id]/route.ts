import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { BUCKETS, storage } from "@/lib/storage";
import { audit, withCareerAdmin } from "@/lib/careers/admin-session";
import { applicationStatusFromLabel, isUuid, legacyApplication, text } from "@/lib/careers/shared";

type Context = { params: Promise<{ id: string }> };
const notFound = () => new NextResponse("Not Found", { status: 404 });

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: Context) {
  return withCareerAdmin(request, async () => {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const item = await prisma.careerApplication.findUnique({ where: { id } });
    return item ? NextResponse.json(legacyApplication(item)) : notFound();
  });
}

export async function PATCH(request: Request, { params }: Context) {
  return withCareerAdmin(request, async () => {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const data: Prisma.CareerApplicationUpdateInput = {};
    if (Object.hasOwn(body, "status")) {
      const status = applicationStatusFromLabel[String(body.status)];
      if (!status) return NextResponse.json({ message: "Invalid status." }, { status: 400 });
      data.status = status;
    }
    if (Object.hasOwn(body, "adminNotes")) data.adminNotes = text(body.adminNotes, 5000);
    const exists = await prisma.careerApplication.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return notFound();
    const item = await prisma.careerApplication.update({ where: { id }, data });
    audit(request, "application_updated", id);
    return NextResponse.json(legacyApplication(item));
  });
}

export async function DELETE(request: Request, { params }: Context) {
  return withCareerAdmin(request, async () => {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const item = await prisma.careerApplication.findUnique({ where: { id }, select: { id: true, resumePath: true } });
    if (!item) return notFound();
    await prisma.careerApplication.delete({ where: { id } });
    // The original stored the resume inside the application document, so deleting
    // the application also deleted the resume. Remove the stored file as well.
    if (item.resumePath) {
      try {
        await storage.remove(BUCKETS.resumes, [item.resumePath]);
      } catch (error) {
        console.error("careers: resume cleanup failed", { applicationId: id, error: String(error) });
      }
    }
    audit(request, "application_deleted", id);
    return NextResponse.json({ success: true });
  });
}
