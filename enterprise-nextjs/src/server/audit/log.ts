import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import type { Actor } from "@/server/actor";

type Db = Pick<Prisma.TransactionClient, "activityLog">;

/**
 * Append one audit row to `activity_logs` with the actor's identity snapshot (name, code, role), so
 * the entry stays readable if the user is later renamed or removed. Pass a transaction client to
 * write the entry atomically with the change it describes.
 *
 * Details must be metadata only: counts, ids, formats, filters. Never put exported rows, secrets,
 * passwords or document contents here.
 */
export async function recordAudit(actor: Actor, action: string, details: Record<string, unknown>, db: Db = prisma) {
  const safe = JSON.parse(JSON.stringify(details)) as Prisma.InputJsonObject; // drops undefined, Dates -> ISO
  await db.activityLog.create({
    data: { userId: actor.id, actorUserCode: actor.userId ?? null, actorName: actor.name, actorRole: actor.role, action, details: safe },
  });
}
