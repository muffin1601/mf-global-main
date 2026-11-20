import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;
export type AssignmentReason = "create" | "import" | "assign" | "transfer" | "unassign" | "edit";
type Snapshot = Map<string, Map<string, boolean>>; // leadId -> userId -> canUpdate

/** Current assignees (with update access flag) for the given leads. Call before AND after a change. */
export async function snapshotAssignments(tx: Tx, leadIds: string[]): Promise<Snapshot> {
  const snap: Snapshot = new Map(leadIds.map((id) => [id, new Map()]));
  if (!leadIds.length) return snap;
  const rows = await tx.leadAssignment.findMany({ where: { leadId: { in: leadIds } }, select: { leadId: true, userId: true, canUpdate: true } });
  for (const r of rows) snap.get(r.leadId)?.set(r.userId, r.canUpdate);
  return snap;
}

/**
 * Write ownership-history rows for the difference between two snapshots: ASSIGNED for new assignees,
 * UNASSIGNED for removed ones, ACCESS_CHANGED when only the update flag changed. Deriving history from
 * the actual before/after state (rather than from the request) means it cannot drift from reality.
 */
export async function recordAssignmentChanges(tx: Tx, before: Snapshot, after: Snapshot, actorId: string | null, reason: AssignmentReason) {
  const data: Prisma.LeadAssignmentEventCreateManyInput[] = [];
  for (const leadId of new Set([...before.keys(), ...after.keys()])) {
    const prev = before.get(leadId) ?? new Map<string, boolean>();
    const next = after.get(leadId) ?? new Map<string, boolean>();
    for (const [userId, canUpdate] of next) {
      if (!prev.has(userId)) data.push({ leadId, userId, action: "ASSIGNED", canUpdate, reason, actorId });
      else if (prev.get(userId) !== canUpdate) data.push({ leadId, userId, action: "ACCESS_CHANGED", canUpdate, reason, actorId });
    }
    for (const userId of prev.keys()) if (!next.has(userId)) data.push({ leadId, userId, action: "UNASSIGNED", canUpdate: null, reason, actorId });
  }
  if (data.length) await tx.leadAssignmentEvent.createMany({ data });
  return data.length;
}
