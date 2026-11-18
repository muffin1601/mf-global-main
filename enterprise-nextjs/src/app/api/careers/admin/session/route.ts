import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { randomToken, sha256, withCareerAdmin } from "@/lib/careers/admin-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withCareerAdmin(request, async (session) => {
    const csrf = randomToken();
    await prisma.careerAdminSession.update({ where: { id: session.id }, data: { csrfHash: sha256(csrf) } });
    return NextResponse.json({ authenticated: true, csrfToken: csrf });
  });
}
