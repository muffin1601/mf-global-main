import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { audit, clearSessionCookie, requireCareerAdmin } from "@/lib/careers/admin-session";

export async function POST(request: Request) {
  const guard = await requireCareerAdmin(request);
  if (!guard.ok) return guard.response;
  await prisma.careerAdminSession.delete({ where: { id: guard.session.id } });
  audit(request, "logout");
  return clearSessionCookie(NextResponse.json({ success: true }));
}
