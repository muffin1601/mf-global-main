import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { CareerAdminSession } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { clientIp } from "./shared";

// Port of the original Express careers-admin auth (backend/routes/main/careersRoutes.js):
// httpOnly cookie `career_admin` scoped to /api/careers/admin, 30-minute sliding
// expiry, SHA-256 hashed token + CSRF token stored server-side.
export const COOKIE_NAME = "career_admin";
export const SESSION_MS = 30 * 60 * 1000;

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const randomToken = () => randomBytes(32).toString("hex");

export const audit = (request: Request, action: string, detail = "") =>
  console.info(JSON.stringify({ event: "careers_admin", action, detail, ipHash: sha256(clientIp(request)), at: new Date().toISOString() }));

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/careers/admin",
    maxAge: SESSION_MS / 1000,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/careers/admin", maxAge: 0 });
  return response;
}

const readCookie = (request: Request) =>
  (request.headers.get("cookie") ?? "").split(";").map((value) => value.trim()).find((value) => value.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);

const allowedOrigins = (request: Request) => {
  const origins = new Set([new URL(request.url).origin]);
  if (process.env.NEXT_PUBLIC_APP_URL) origins.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
  return origins;
};

type Guard = { ok: true; session: CareerAdminSession; token: string } | { ok: false; response: NextResponse };

export async function requireCareerAdmin(request: Request): Promise<Guard> {
  const token = readCookie(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return { ok: false, response: NextResponse.json({ message: "Admin session required." }, { status: 401 }) };
  const session = await prisma.careerAdminSession.findFirst({ where: { tokenHash: sha256(token), expiresAt: { gt: new Date() } } });
  if (!session) return { ok: false, response: NextResponse.json({ message: "Admin session expired." }, { status: 401 }) };
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const csrf = request.headers.get("x-csrf-token") ?? "";
    if (!/^[a-f0-9]{64}$/.test(csrf) || sha256(csrf) !== session.csrfHash) return { ok: false, response: NextResponse.json({ message: "Invalid CSRF token." }, { status: 403 }) };
    const origin = request.headers.get("origin");
    if (origin && !allowedOrigins(request).has(origin)) return { ok: false, response: NextResponse.json({ message: "Origin rejected." }, { status: 403 }) };
  }
  const refreshed = await prisma.careerAdminSession.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() + SESSION_MS) } });
  return { ok: true, session: refreshed, token };
}

/** Runs `handler` behind the careers-admin guard and refreshes the sliding cookie. */
export async function withCareerAdmin(request: Request, handler: (session: CareerAdminSession) => Promise<NextResponse>) {
  const guard = await requireCareerAdmin(request);
  if (!guard.ok) return guard.response;
  const response = await handler(guard.session);
  return setSessionCookie(response, guard.token);
}

export async function configuredPinHash() {
  const setting = await prisma.careerAdminSetting.findUnique({ where: { key: "admin" } });
  return setting?.pinHash || process.env.CAREERS_ADMIN_PIN_HASH || null;
}
