import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { withCareerAdmin } from "@/lib/careers/admin-session";
import { applicationFilter } from "@/lib/careers/application-filter";
import { legacyApplication, pageOptions } from "@/lib/careers/shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withCareerAdmin(request, async () => {
    const url = new URL(request.url);
    const { page, limit } = pageOptions(url);
    const where = applicationFilter(url);
    const [items, total] = await Promise.all([
      prisma.careerApplication.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.careerApplication.count({ where }),
    ]);
    return NextResponse.json({ applications: items.map(legacyApplication), total, page, pages: Math.ceil(total / limit) });
  });
}
