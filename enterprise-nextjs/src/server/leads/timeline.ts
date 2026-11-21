import { prisma } from "@/lib/prisma/client";
import { leadScope, type Actor } from "@/server/actor";
import { notFound } from "@/server/errors";
import { ACTIVITY_TYPE_LABELS } from "@/server/activities/service";

export type TimelineEntry = {
  id: string;
  kind: "created" | "status" | "ownership" | "activity";
  at: string;
  title: string;
  detail?: string;
  actor?: string | null;
  /** For activities: type, status and id so the UI can offer actions. */
  activity?: { id: string; type: string; status: string; dueAt: string | null; priority: string; createdById: string | null; assigneeId: string | null };
};

const REASON: Record<string, string> = { create: "on creation", import: "on import", assign: "by bulk assign", transfer: "by transfer", unassign: "by unassign", edit: "by edit" };

/**
 * One chronological feed for a lead: creation, status/call-status changes, ownership changes and
 * activities (calls, meetings, notes, tasks…). Same visibility as the lead itself. Newest first.
 * Each source is capped, so a very old, busy lead still loads quickly.
 */
export async function getLeadTimeline(actor: Actor, leadId: string, cap = 200): Promise<TimelineEntry[]> {
  const lead = await prisma.lead.findFirst({ where: { AND: [{ id: leadId }, leadScope(actor)] }, select: { id: true, createdAt: true, source: true, createdBy: { select: { name: true } } } });
  if (!lead) throw notFound("Lead not found.");
  const [statuses, events, activities] = await Promise.all([
    prisma.leadStatusHistory.findMany({ where: { leadId }, orderBy: { changedAt: "desc" }, take: cap }),
    prisma.leadAssignmentEvent.findMany({ where: { leadId }, orderBy: { createdAt: "desc" }, take: cap, include: { user: { select: { name: true } }, actor: { select: { name: true } } } }),
    prisma.activity.findMany({ where: { leadId }, orderBy: { createdAt: "desc" }, take: cap, include: { createdBy: { select: { name: true } }, assignee: { select: { name: true } } } }),
  ]);
  const userIds = [...new Set(statuses.map((s) => s.changedById).filter((v): v is string => Boolean(v)))];
  const names = new Map((await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));

  const out: TimelineEntry[] = [{ id: `created-${lead.id}`, kind: "created", at: lead.createdAt.toISOString(), title: "Lead created", detail: `Source: ${lead.source.toLowerCase()}`, actor: lead.createdBy?.name ?? null }];
  for (const s of statuses) {
    if (s.fromStatus === null) continue; // the initial row duplicates "Lead created"
    const parts: string[] = [];
    if (s.fromStatus !== s.toStatus) parts.push(`Status: ${s.fromStatus} → ${s.toStatus}`);
    if ((s.fromCallStatus ?? "") !== (s.toCallStatus ?? "")) parts.push(`Call status: ${s.fromCallStatus ?? "—"} → ${s.toCallStatus ?? "—"}`);
    out.push({ id: `status-${s.id}`, kind: "status", at: s.changedAt.toISOString(), title: parts[0] ?? "Status updated", detail: parts[1], actor: s.changedById ? names.get(s.changedById) ?? null : null });
  }
  for (const e of events) {
    const who = e.user?.name ?? "a removed user";
    const title = e.action === "ASSIGNED" ? `Assigned to ${who}` : e.action === "UNASSIGNED" ? `Unassigned from ${who}` : `Access changed for ${who}`;
    const access = e.canUpdate === null ? "" : e.canUpdate ? "view + update" : "view only";
    out.push({ id: `own-${e.id}`, kind: "ownership", at: e.createdAt.toISOString(), title, detail: [access, REASON[e.reason] ?? e.reason].filter(Boolean).join(" · "), actor: e.actor?.name ?? null });
  }
  for (const a of activities) {
    const label = ACTIVITY_TYPE_LABELS[a.type];
    out.push({
      id: `act-${a.id}`, kind: "activity", at: (a.completedAt ?? a.createdAt).toISOString(),
      title: `${label}: ${a.subject}`,
      detail: [a.status !== "OPEN" && a.type !== "NOTE" ? a.status.toLowerCase() : "", a.outcome ? `Outcome: ${a.outcome}` : "", a.body].filter(Boolean).join(" · ") || undefined,
      actor: a.createdBy?.name ?? null,
      activity: { id: a.id, type: a.type, status: a.status, dueAt: a.dueAt?.toISOString() ?? null, priority: a.priority, createdById: a.createdById, assigneeId: a.assigneeId },
    });
  }
  return out.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0)).slice(0, cap);
}
