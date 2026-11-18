import { prisma } from "@/lib/prisma/client";
import { HttpError, notFound } from "@/server/errors";
import { audit, authorize, failIf, loadVendor, pageParams, requireId, type MaybeActor } from "./common";
import { ACTIVITY_TYPES, clean, has, parseDate, validateActivityPayload, type Input } from "./fields";

export async function listActivities(actor: MaybeActor, vendorId: string, query: { type?: string; page?: unknown; limit?: unknown } = {}) {
  authorize(actor, "vendor.view");
  const v = await loadVendor(vendorId);
  const { page, limit, skip } = pageParams(query);
  const where = { vendorId: v.id, ...(query.type && (ACTIVITY_TYPES as readonly string[]).includes(query.type) ? { type: query.type } : {}) };
  const [items, total] = await Promise.all([
    prisma.vendorActivity.findMany({ where, orderBy: { occurredAt: "desc" }, skip, take: limit, include: { createdBy: { select: { id: true, name: true } } } }),
    prisma.vendorActivity.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function addActivity(actor: MaybeActor, vendorId: string, input: Input) {
  const a = authorize(actor, "vendor.edit");
  const v = await loadVendor(vendorId);
  failIf(validateActivityPayload(input));
  return prisma.$transaction(async (tx) => {
    const act = await tx.vendorActivity.create({
      data: {
        vendorId: v.id, type: has(input.type) ? String(input.type) : "Note", subject: clean(input.subject), description: String(input.description).trim(),
        occurredAt: parseDate(input.occurredAt) ?? new Date(), createdById: a.id,
      },
    });
    await tx.vendor.update({ where: { id: v.id }, data: { lastActivityAt: act.occurredAt } });
    await audit(tx, a, "vendor.activity_added", v, { activityType: act.type });
    return act;
  });
}

async function ownActivity(a: { id: string; role: string }, vendorId: string, activityId: string) {
  const v = await loadVendor(vendorId);
  const act = await prisma.vendorActivity.findUnique({ where: { id: requireId(activityId, "activity") } });
  if (!act || act.vendorId !== v.id) throw notFound("Activity not found for this vendor");
  if (act.createdById !== a.id && a.role !== "ADMIN") throw new HttpError(403, "You can only change activities you created", "FORBIDDEN");
  return { v, act };
}

export async function updateActivity(actor: MaybeActor, vendorId: string, activityId: string, input: Input) {
  const a = authorize(actor, "vendor.edit");
  const { v, act } = await ownActivity(a, vendorId, activityId);
  failIf(validateActivityPayload({ ...act, ...input }));
  const u = await prisma.vendorActivity.update({
    where: { id: act.id },
    data: {
      ...(has(input.type) ? { type: String(input.type) } : {}),
      ...("subject" in input ? { subject: clean(input.subject) } : {}),
      ...("description" in input ? { description: String(input.description).trim() } : {}),
      ...(has(input.occurredAt) ? { occurredAt: parseDate(input.occurredAt) ?? act.occurredAt } : {}),
    },
  });
  await audit(prisma, a, "vendor.activity_updated", v, { activityType: u.type });
  return u;
}

export async function deleteActivity(actor: MaybeActor, vendorId: string, activityId: string) {
  const a = authorize(actor, "vendor.edit");
  const { v, act } = await ownActivity(a, vendorId, activityId);
  await prisma.$transaction(async (tx) => {
    await tx.vendorActivity.delete({ where: { id: act.id } });
    const last = await tx.vendorActivity.findFirst({ where: { vendorId: v.id }, orderBy: { occurredAt: "desc" }, select: { occurredAt: true } });
    await tx.vendor.update({ where: { id: v.id }, data: { lastActivityAt: last?.occurredAt ?? null } });
    await audit(tx, a, "vendor.activity_deleted", v, { activityType: act.type });
  });
  return { ok: true as const };
}
