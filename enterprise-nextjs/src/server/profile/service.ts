import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { BUCKETS, storage } from "@/lib/storage";
import { EXTENSION, MIME, detectFileType } from "@/lib/files/signature";
import { rateLimit } from "@/lib/rate-limit";
import { passwordProblems } from "@/lib/auth/password-policy";
import { recordAudit } from "@/server/audit/log";
import type { Actor } from "@/server/actor";
import { HttpError, badRequest, notFound } from "@/server/errors";

/*
 * My profile — every signed-in user manages their OWN profile only. Identity fields that drive sign-in or
 * authorisation (email, username, role, user code, enabled) stay administrator-controlled in User management.
 */

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_KINDS = new Set(["jpeg", "png", "webp"]);

export type ProfileDto = {
  id: string; userId: string; name: string; username: string | null; email: string | null; role: "ADMIN" | "USER";
  location: string | null; phone: string | null; designation: string | null; hasAvatar: boolean; avatarVersion: number | null;
  createdAt: string; passwordChangedAt: string | null; canChangePassword: boolean;
};

export async function getProfile(actor: Actor): Promise<ProfileDto> {
  const u = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!u) throw notFound("Profile not found.");
  return {
    id: u.id, userId: u.userId, name: u.name, username: u.username, email: u.email, role: u.role,
    location: u.location, phone: u.phone, designation: u.designation,
    hasAvatar: Boolean(u.avatarPath), avatarVersion: u.avatarUpdatedAt?.getTime() ?? null,
    createdAt: u.createdAt.toISOString(), passwordChangedAt: u.passwordChangedAt?.toISOString() ?? null,
    canChangePassword: Boolean(u.authUserId && u.email),
  };
}

/* ------------------------------------------------------------------ details */
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120, "Name is too long."),
  phone: z.string().trim().max(20).optional()
    .refine((v) => !v || /^\+?[0-9][0-9\s\-()]{6,18}$/.test(v), "Enter a valid phone number (digits, spaces, + - ( ) only).")
    .transform((v) => (v ? v : null)),
  designation: optionalText(80),
  location: optionalText(120),
});

export async function updateProfile(actor: Actor, raw: unknown) {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid details.");
  const next = parsed.data;
  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id: actor.id }, select: { name: true, phone: true, designation: true, location: true } });
    if (!before) throw notFound("Profile not found.");
    const changes = Object.fromEntries(
      (Object.keys(next) as (keyof typeof next)[]).filter((k) => (before[k] ?? null) !== next[k]).map((k) => [k, { old: before[k] ?? null, new: next[k] }]),
    );
    if (!Object.keys(changes).length) return { changed: [] as string[] };
    await tx.user.update({ where: { id: actor.id }, data: next });
    await recordAudit(actor, "profile.updated", { targetUserId: actor.id, changes }, tx);
    return { changed: Object.keys(changes) };
  });
}

/* ------------------------------------------------------------------ photo */
export async function setAvatar(actor: Actor, file: { buffer: Buffer; size: number } | null) {
  if (!file || file.size === 0) throw badRequest("Choose an image to upload.");
  if (file.size > MAX_AVATAR_BYTES) throw badRequest("The photo must be 2 MB or smaller.");
  // Trust the file's own bytes, never the browser-supplied name or MIME type.
  const kind = detectFileType(file.buffer);
  if (!kind || !AVATAR_KINDS.has(kind)) throw badRequest("Use a JPEG, PNG or WebP image.");
  const path = `${actor.id}/${randomUUID()}.${EXTENSION[kind]}`;
  await storage.upload(BUCKETS.avatars, path, file.buffer, MIME[kind]).catch(() => { throw new HttpError(503, "The photo could not be stored. Please try again.", "STORAGE_UNAVAILABLE"); });
  let previous: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const [before] = await tx.$queryRaw<{ path: string | null }[]>`SELECT avatar_path AS path FROM users WHERE id = ${actor.id}::uuid FOR UPDATE`;
      previous = before?.path ?? null;
      await tx.user.update({ where: { id: actor.id }, data: { avatarPath: path, avatarUpdatedAt: new Date() } });
      await recordAudit(actor, "profile.photo_updated", { targetUserId: actor.id, bytes: file.size, type: kind }, tx);
    });
  } catch (error) {
    // Roll back the upload so storage never keeps an orphaned object.
    await storage.remove(BUCKETS.avatars, [path]).catch(() => undefined);
    throw error;
  }
  if (previous) await storage.remove(BUCKETS.avatars, [previous]).catch(() => undefined);
  return { ok: true as const };
}

export async function removeAvatar(actor: Actor) {
  const previous = await prisma.$transaction(async (tx) => {
    const [before] = await tx.$queryRaw<{ path: string | null }[]>`SELECT avatar_path AS path FROM users WHERE id = ${actor.id}::uuid FOR UPDATE`;
    if (!before?.path) return null;
    await tx.user.update({ where: { id: actor.id }, data: { avatarPath: null, avatarUpdatedAt: new Date() } });
    await recordAudit(actor, "profile.photo_removed", { targetUserId: actor.id }, tx);
    return before.path;
  });
  if (!previous) return { ok: true as const, removed: false };
  await storage.remove(BUCKETS.avatars, [previous]).catch(() => undefined);
  return { ok: true as const, removed: true };
}

/** Bytes of any colleague's photo, for signed-in users (avatars appear next to owners and assignees). */
export async function readAvatar(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { avatarPath: true } });
  if (!u?.avatarPath) return null;
  const bytes = await storage.download(BUCKETS.avatars, u.avatarPath);
  if (!bytes) return null;
  const kind = detectFileType(bytes);
  return kind && AVATAR_KINDS.has(kind) ? { bytes, contentType: MIME[kind] } : null;
}

/* ------------------------------------------------------------------ password */
export type PasswordVerifier = (email: string, password: string, expectedUserId: string) => Promise<boolean>;
export type PasswordSetter = (authUserId: string, password: string) => Promise<{ error?: string }>;

export async function changeOwnPassword(
  actor: Actor,
  input: { current?: unknown; next?: unknown; confirm?: unknown },
  deps: { verify: PasswordVerifier; set: PasswordSetter },
) {
  const current = typeof input.current === "string" ? input.current : "";
  const next = typeof input.next === "string" ? input.next : "";
  const confirm = typeof input.confirm === "string" ? input.confirm : "";
  if (!current) throw badRequest("Enter your current password.");
  if (current.length > 256) throw badRequest("Current password is too long.");
  if (next !== confirm) throw badRequest("The new passwords do not match.");
  if (next === current) throw badRequest("The new password must be different from the current one.");
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { authUserId: true, email: true, username: true, name: true, enabled: true } });
  if (!user?.enabled) throw new HttpError(403, "This account is disabled.", "DISABLED");
  if (!user.authUserId || !user.email) throw badRequest("Your account has no sign-in email. Ask an administrator to reset your password.");
  const problems = passwordProblems(next, user);
  if (problems.length) throw badRequest(`Choose a stronger password: ${problems.join("; ")}.`);
  // Throttle guesses of the current password (5 per 15 minutes per account).
  const limit = await rateLimit(`profile-password:${actor.id}`, 5, 15 * 60_000);
  if (!limit.allowed) throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSec / 60)} minute(s).`, "RATE_LIMITED");
  if (!(await deps.verify(user.email, current, user.authUserId))) {
    await recordAudit(actor, "profile.password_change_failed", { targetUserId: actor.id, reason: "wrong_current_password" });
    throw badRequest("Your current password is incorrect.");
  }
  const result = await deps.set(user.authUserId, next);
  if (result.error) throw new HttpError(502, "The password could not be changed. Please try again.", "AUTH_UPDATE_FAILED");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { passwordChangedAt: new Date() } });
    await recordAudit(actor, "profile.password_changed", { targetUserId: actor.id }, tx);
  });
  return { ok: true as const };
}
