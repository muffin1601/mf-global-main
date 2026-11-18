import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { isDateString, istDayEndExclusive, istDayStart } from "@/lib/time/ist";
import { assertAdmin, isAdmin, type Actor } from "@/server/actor";
import { badRequest, forbidden, notFound } from "@/server/errors";

export const MAX_ACTION_LENGTH = 100;
export const MAX_DETAILS_BYTES = 8 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ActivityQuery = { userId?: string; from?: string; to?: string; q?: string; page?: number; pageSize?: number };

/** Admin-only, paginated, IST-date-filtered activity listing. Handles legacy rows (no user link). */
export async function listActivity(actor: Actor, input: ActivityQuery = {}) {
  assertAdmin(actor);
  const { userId, from, to, q } = input;
  if (from && !isDateString(from)) throw badRequest("Invalid from date.");
  if (to && !isDateString(to)) throw badRequest("Invalid to date.");
  if (from && to && from > to) throw badRequest("From date must not be after To date.");
  if (userId && !UUID_RE.test(userId)) throw badRequest("Invalid user.");
  const pageSize = Math.min(200, Math.max(1, Math.floor(input.pageSize ?? 25)));
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const and: Prisma.ActivityLogWhereInput[] = [];
  if (userId) {
    // Migrated rows have no user link: also match them by the user's code.
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { userId: true } });
    and.push({ OR: [{ userId }, ...(u ? [{ userId: null, actorUserCode: u.userId }] : [])] });
  }
  if (from || to) and.push({ occurredAt: { ...(from ? { gte: istDayStart(from) } : {}), ...(to ? { lt: istDayEndExclusive(to) } : {}) } });
  const text = q?.trim().slice(0, 100);
  if (text) {
    const c = { contains: text, mode: "insensitive" as const };
    and.push({ OR: [{ action: c }, { actorName: c }, { actorUserCode: c }, { user: { name: c } }, { user: { userId: c } }] });
  }
  const where: Prisma.ActivityLogWhereInput = and.length ? { AND: and } : {};
  const [total, rows] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize,
      include: { user: { select: { id: true, name: true, userId: true, role: true } } },
    }),
  ]);
  const items = rows.map((r) => ({
    id: r.id, action: r.action, details: r.details, occurredAt: r.occurredAt,
    userId: r.userId,
    name: r.user?.name ?? r.actorName ?? "Unknown",
    userCode: r.user?.userId ?? r.actorUserCode ?? null,
    role: r.user?.role ?? r.actorRole ?? null,
  }));
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Users selectable in the activity log filter (admin only). */
export async function listActivityUsers(actor: Actor) {
  assertAdmin(actor);
  return prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, userId: true } });
}

/**
 * Client-side activity logging (MERN POST /activity/log). Non-admins may only log as themself;
 * an admin may log on behalf of another user (as MERN allowed). `userRef` is a user code or id.
 */
export async function recordClientActivity(actor: Actor, input: { action: unknown; details?: unknown; userRef?: string }) {
  const action = typeof input.action === "string" ? input.action.trim() : "";
  if (!action) throw badRequest("Action is required.");
  if (action.length > MAX_ACTION_LENGTH) throw badRequest(`Action must be at most ${MAX_ACTION_LENGTH} characters.`);
  let details: Prisma.InputJsonValue | undefined;
  if (input.details !== undefined && input.details !== null) {
    let json: string | undefined;
    try { json = JSON.stringify(input.details); } catch { json = undefined; }
    if (json === undefined) throw badRequest("Details must be JSON-serialisable.");
    if (Buffer.byteLength(json) > MAX_DETAILS_BYTES) throw badRequest(`Details must be at most ${MAX_DETAILS_BYTES} bytes.`);
    details = JSON.parse(json) as Prisma.InputJsonValue;
  }
  let targetId = actor.id;
  if (input.userRef && input.userRef !== actor.id && input.userRef !== actor.userId) {
    if (!isAdmin(actor)) throw forbidden("You may only log activity for yourself.");
    const target = await prisma.user.findFirst({
      where: { OR: [{ userId: input.userRef }, ...(UUID_RE.test(input.userRef) ? [{ id: input.userRef }] : [])] },
      select: { id: true },
    });
    if (!target) throw notFound("User not found.");
    targetId = target.id;
  }
  const row = await prisma.activityLog.create({ data: { userId: targetId, action, ...(details !== undefined ? { details } : {}) } });
  return { id: row.id };
}
