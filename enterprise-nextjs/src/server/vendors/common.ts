import { hasVendorPermission, type VendorPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/server/actor";
import { HttpError, badRequest, forbidden, notFound } from "@/server/errors";
import { isUuid } from "./fields";

export type Db = Prisma.TransactionClient | typeof prisma;
export type MaybeActor = Actor | null | undefined;

/**
 * Server-side permission gate used by EVERY vendor service call.
 * No actor => 401, missing capability => 403.
 */
export function authorize(actor: MaybeActor, permission: VendorPermission): Actor {
  if (!actor) throw new HttpError(401, "Authentication required", "UNAUTHENTICATED");
  if (!hasVendorPermission(actor.role, permission)) throw forbidden("You do not have permission to perform this action");
  return actor;
}

export const can = (actor: Actor, permission: VendorPermission) => hasVendorPermission(actor.role, permission);

export function requireId(id: unknown, label = "vendor"): string {
  if (!isUuid(id)) throw badRequest(`Invalid ${label} id`);
  return id;
}

export const failIf = (errors: string[]) => {
  if (errors.length) throw new HttpError(400, errors[0] ?? "Invalid input", "VALIDATION");
};

export async function loadVendor(vendorId: string, db: Db = prisma) {
  const id = requireId(vendorId);
  const vendor = await db.vendor.findUnique({ where: { id }, select: { id: true, vendorCode: true, name: true, archivedAt: true, status: true } });
  if (!vendor) throw notFound("Vendor not found");
  return vendor;
}

export type VendorRef = { id: string; vendorCode: string; name: string };

const SENSITIVE_KEYS = /account(number)?|ifsc|upi|password|token|cvv/i;
export function scrub(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(scrub);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE_KEYS.test(k) ? "[redacted]" : scrub(v);
  return out;
}

/** Writes the vendor audit row (ActivityLog, details.module = 'vendor'). Pass a tx to make it atomic. */
export async function audit(db: Db, actor: Actor, action: string, vendor: Partial<VendorRef> | null, extra: Record<string, unknown> = {}) {
  await db.activityLog.create({
    data: {
      userId: actor.id,
      actorUserCode: actor.userId ?? null,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      details: scrub({
        module: "vendor",
        ...(vendor?.id ? { vendorId: vendor.id } : {}),
        ...(vendor?.vendorCode ? { vendorCode: vendor.vendorCode } : {}),
        ...(vendor?.name ? { name: vendor.name } : {}),
        ...extra,
      }) as Prisma.InputJsonValue,
    },
  });
}

export function pageParams(input: { page?: unknown; limit?: unknown }, defaultLimit = 25) {
  const page = Math.max(1, Math.floor(Number(input.page)) || 1);
  const limit = Math.min(200, Math.max(1, Math.floor(Number(input.limit)) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export const num = (d: { toString(): string } | null | undefined): number | null => (d == null ? null : Number(d.toString()));
