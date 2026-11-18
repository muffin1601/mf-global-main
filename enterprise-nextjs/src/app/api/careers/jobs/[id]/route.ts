import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { publicJobFilter } from "@/lib/careers/public-jobs";
import { isUuid, legacyJob } from "@/lib/careers/shared";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse("Not Found", { status: 404 });
  const job = await prisma.careerJob.findFirst({ where: { id, ...publicJobFilter() } });
  return job ? NextResponse.json(legacyJob(job)) : new NextResponse("Not Found", { status: 404 });
}
