import type { Prisma } from "@/generated/prisma/client";
import { assertAdmin, type Actor } from "@/server/actor";
import { HttpError } from "@/server/errors";

export type MaybeActor = Actor | null | undefined;

/** Any authenticated, signed-in user. Unauthenticated callers are rejected at the service layer. */
export function requireActor(actor: MaybeActor): Actor {
  if (!actor) throw new HttpError(401, "Authentication required", "UNAUTHENTICATED");
  return actor;
}
export function requireAdminActor(actor: MaybeActor): Actor {
  const a = requireActor(actor);
  assertAdmin(a);
  return a;
}

export const logActivity = (tx: Prisma.TransactionClient, actor: Actor, action: string, details: Prisma.InputJsonValue) =>
  tx.activityLog.create({ data: { userId: actor.id, actorUserCode: actor.userId ?? null, actorName: actor.name, actorRole: actor.role.toLowerCase(), action, details } });

/** Serialises code allocation across concurrent transactions (released at commit). */
export const advisoryLock = (tx: Prisma.TransactionClient, key: string) =>
  tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${key}))`;

export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
