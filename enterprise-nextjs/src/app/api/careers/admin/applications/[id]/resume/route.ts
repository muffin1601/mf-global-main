import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { BUCKETS, storage } from "@/lib/storage";
import { withCareerAdmin } from "@/lib/careers/admin-session";
import { isUuid } from "@/lib/careers/shared";

const contentTypes: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const notFound = () => new NextResponse("Not Found", { status: 404 });

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withCareerAdmin(request, async () => {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const item = await prisma.careerApplication.findUnique({ where: { id }, select: { resumePath: true, resumeFileName: true } });
    if (!item?.resumePath) return notFound();
    const data = await storage.download(BUCKETS.resumes, item.resumePath);
    if (!data) return notFound();
    const ext = (item.resumeFileName.split(".").pop() ?? "").toLowerCase();
    const contentType = contentTypes[ext] ?? "application/octet-stream";
    const filename = contentTypes[ext] ? `resume.${ext}` : "resume";
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "no-store",
        // Applicant-supplied file served inline from the app origin: never let it run script (same as vendor docs).
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; object-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
