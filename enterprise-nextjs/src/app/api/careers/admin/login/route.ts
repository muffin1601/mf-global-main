import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { audit, configuredPinHash, randomToken, setSessionCookie, sha256, SESSION_MS } from "@/lib/careers/admin-session";
import { clientIp } from "@/lib/careers/shared";

const LOCKED = "PIN access is temporarily locked. Try again later.";

export async function POST(request: Request) {
  const ipHash = sha256(clientIp(request));
  const attempt = await prisma.careerLoginAttempt.findUnique({ where: { ipHash } });
  if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) return NextResponse.json({ message: LOCKED }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { pin?: unknown } | null;
  const pin = body?.pin;
  const pinHash = await configuredPinHash();
  if (!pinHash) return NextResponse.json({ message: "Careers admin PIN is not configured." }, { status: 503 });

  const valid = typeof pin === "string" && /^\d{6}$/.test(pin) && (await bcrypt.compare(pin, pinHash));
  if (!valid) {
    // Attempts older than 24h are forgotten (original TTL index on updatedAt).
    const stale = attempt && attempt.updatedAt < new Date(Date.now() - 24 * 60 * 60 * 1000);
    const failures = (stale ? 0 : attempt?.failures ?? 0) + 1;
    const lockedUntil = failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await prisma.careerLoginAttempt.upsert({ where: { ipHash }, create: { ipHash, failures, lockedUntil }, update: { failures, lockedUntil } });
    audit(request, "login_failed");
    return NextResponse.json({ message: failures >= 5 ? LOCKED : "Invalid PIN." }, { status: failures >= 5 ? 429 : 401 });
  }

  await prisma.careerLoginAttempt.deleteMany({ where: { ipHash } });
  await prisma.careerAdminSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  const token = randomToken();
  const csrf = randomToken();
  await prisma.careerAdminSession.create({ data: { tokenHash: sha256(token), csrfHash: sha256(csrf), expiresAt: new Date(Date.now() + SESSION_MS) } });
  audit(request, "login_success");
  return setSessionCookie(NextResponse.json({ authenticated: true, csrfToken: csrf }), token);
}
