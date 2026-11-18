import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
    const { data, error } = await createSupabaseAdminClient().storage.from("career-resumes").download(item.resumePath);
    if (error || !data) return notFound();
    const ext = (item.resumeFileName.split(".").pop() ?? "").toLowerCase();
    const contentType = contentTypes[ext] ?? data.type ?? "application/octet-stream";
    const filename = contentTypes[ext] ? `resume.${ext}` : "resume";
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new NextResponse(await data.arrayBuffer(), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
