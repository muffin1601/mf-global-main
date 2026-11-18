import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { audit, configuredPinHash, withCareerAdmin } from "@/lib/careers/admin-session";

export async function POST(request: Request) {
  return withCareerAdmin(request, async (session) => {
    const body = (await request.json().catch(() => null)) as { currentPin?: unknown; newPin?: unknown } | null;
    const currentPin = typeof body?.currentPin === "string" ? body.currentPin : "";
    const newPin = typeof body?.newPin === "string" ? body.newPin : "";
    const currentHash = await configuredPinHash();
    if (!/^\d{6}$/.test(currentPin) || !/^\d{6}$/.test(newPin) || !currentHash || !(await bcrypt.compare(currentPin, currentHash)) || currentPin === newPin) {
      return NextResponse.json({ message: "Invalid current or new PIN." }, { status: 400 });
    }
    const pinHash = await bcrypt.hash(newPin, 12);
    await prisma.careerAdminSetting.upsert({ where: { key: "admin" }, create: { key: "admin", pinHash }, update: { pinHash } });
    await prisma.careerAdminSession.deleteMany({ where: { id: { not: session.id } } });
    audit(request, "pin_changed");
    return NextResponse.json({ success: true });
  });
}
