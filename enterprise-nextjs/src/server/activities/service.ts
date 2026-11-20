import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { ActivityPriority, ActivityStatus, ActivityType } from "@/generated/prisma/enums";
import { can } from "@/lib/permissions";
import { literalContains } from "@/lib/db/like";
import { prisma } from "@/lib/prisma/client";
import { addDaysIst, istDayStart, todayIst } from "@/lib/time/ist";
import { assertCan, isAdmin, leadScope, type Actor } from "@/server/actor";
import { recordAudit } from "@/server/audit/log";
import { badRequest, forbidden, notFound } from "@/server/errors";

/**
 * Unified activities (Enterprise CRM 2.0 §8/§9): calls, emails, meetings, follow-ups, tasks and notes.
 *
 * Rules
 * - Records are entered by people. Logging a CALL or EMAIL never means the system placed or sent it.
 * - An activity is completed only by an explicit user action (complete, or "log as done" when creating
 *   a past call/meeting). Nothing auto-completes.
 * - Visibility: admin (activities.view_all) sees all; a user sees activities they created or are
 *   assigned, plus every activity on a lead they can see (lead timeline).
 * - Linking to a lead requires edit access to that lead (admin, or assignment with canUpdate).
 * - Assigning to someone else requires activities.assign (admin).
 * - Notes have no due date and are excluded from the Today/Upcoming/Overdue/Completed views.
 */

export const ACTIVITY_TYPES = ["CALL", "EMAIL", "MEETING", "FOLLOW_UP", "TASK", "NOTE", "OTHER"] as const satisfies readonly ActivityType[];
export const ACTIVITY_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const satisfies readonly ActivityPriority[];
export const ACTIVITY_VIEWS = ["today", "upcoming", "overdue", "completed", "all"] as const;
export type ActivityView = (typeof ACTIVITY_VIEWS)[number];
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CALL: "Call", EMAIL: "Email", MEETING: "Meeting", FOLLOW_UP: "Follow-up", TASK: "Task", NOTE: "Note", OTHER: "Other",
};

type Tx = Prisma.TransactionClient;

function parse<S extends z.ZodType>(schema: S, raw: unknown): z.output<S> {
  const r = schema.safeParse(raw);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw badRequest(issue ? `${issue.path.join(".") || "input"}: ${issue.message}` : "Invalid input.");
  }
  return r.data;
}

const dateish = z.union([z.date(), z.string().min(1)]).transform((v, ctx) => {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) { ctx.addIssue({ code: "custom", message: "Invalid date." }); return z.NEVER; }
  return d;
});

const createSchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  subject: z.string().trim().min(1, "Subject is required.").max(200),
  body: z.string().max(10_000).optional().default(""),
  priority: z.enum(ACTIVITY_PRIORITIES).optional().default("MEDIUM"),
  dueAt: dateish.nullish(),
  leadId: z.uuid().nullish(),
  assigneeId: z.uuid().nullish(),
  /** The user explicitly records this as already done (e.g. a call that just happened). */
  completed: z.boolean().optional().default(false),
  outcome: z.string().trim().max(1000).nullish(),
});
export type CreateActivityInput = z.input<typeof createSchema>;

const updateSchema = z.object({
  subject: z.string().trim().min(1).max(200).optional(),
  body: z.string().max(10_000).optional(),
  priority: z.enum(ACTIVITY_PRIORITIES).optional(),
  dueAt: dateish.nullish(),
  assigneeId: z.uuid().nullish(),
  outcome: z.string().trim().max(1000).nullish(),
});
export type UpdateActivityInput = z.input<typeof updateSchema>;

// ---------------------------------------------------------------- access helpers

/** The lead must be visible, and (for non-admins) editable through the actor's assignment. */
async function assertLeadEditable(tx: Tx, actor: Actor, leadId: string) {
  const lead = await tx.lead.findFirst({ where: { AND: [{ id: leadId }, leadScope(actor)] }, select: { id: true, assignments: { where: { userId: actor.id }, select: { canUpdate: true } } } });
  if (!lead) throw notFound("Lead not found.");
  if (!isAdmin(actor) && !lead.assignments[0]?.canUpdate) throw forbidden("You only have view access to this lead.");
}

async function resolveAssignee(tx: Tx, actor: Actor, assigneeId: string | null | undefined): Promise<string> {
  const target = assigneeId ?? actor.id;
  if (target !== actor.id) {
    assertCan(actor, "activities.assign");
    const user = await tx.user.findFirst({ where: { id: target, enabled: true }, select: { id: true } });
    if (!user) throw notFound("The selected user was not found or is disabled.");
  }
  return target;
}

/** Records the actor may see in lists. Lead-linked records are additionally visible via the lead (see canView). */
const listScope = (actor: Actor): Prisma.ActivityWhereInput =>
  can(actor.role, "activities.view_all") ? {} : { OR: [{ assigneeId: actor.id }, { createdById: actor.id }] };

/** Single-record visibility: list scope OR the related lead is visible to the actor. */
const viewScope = (actor: Actor): Prisma.ActivityWhereInput =>
  can(actor.role, "activities.view_all") ? {} : { OR: [{ assigneeId: actor.id }, { createdById: actor.id }, { lead: leadScope(actor) as Prisma.LeadWhereInput }] };

async function loadForChange(tx: Tx, actor: Actor, id: string) {
  const row = await tx.activity.findFirst({ where: { AND: [{ id }, viewScope(actor)] } });
  if (!row) throw notFound("Activity not found.");
  if (!isAdmin(actor) && row.createdById !== actor.id && row.assigneeId !== actor.id) throw forbidden("Only the owner, the assignee or an administrator can change this activity.");
  return row;
}

const touchLead = (tx: Tx, leadId: string | null, at: Date) =>
  leadId ? tx.lead.update({ where: { id: leadId }, data: { lastActivityAt: at } }) : Promise.resolve(null);

// ---------------------------------------------------------------- mutations

export async function createActivity(actor: Actor, raw: CreateActivityInput) {
  assertCan(actor, "activities.create");
  const input = parse(createSchema, raw);
  if (input.type === "FOLLOW_UP" && !input.dueAt) throw badRequest("A follow-up needs a due date and time.");
  if (input.type === "NOTE" && input.completed) throw badRequest("Notes are not tasks and cannot be completed.");
  return prisma.$transaction(async (tx) => {
    if (input.leadId) await assertLeadEditable(tx, actor, input.leadId);
    const assigneeId = await resolveAssignee(tx, actor, input.assigneeId);
    const now = new Date();
    const row = await tx.activity.create({
      data: {
        type: input.type, subject: input.subject, body: input.body, priority: input.priority,
        dueAt: input.type === "NOTE" ? null : (input.dueAt ?? null), leadId: input.leadId ?? null,
        createdById: actor.id, assigneeId, outcome: input.outcome ?? null,
        ...(input.completed ? { status: "COMPLETED" as ActivityStatus, completedAt: now, completedById: actor.id } : {}),
      },
    });
    await touchLead(tx, row.leadId, now);
    await recordAudit(actor, "activity.created", { activityId: row.id, type: row.type, leadId: row.leadId, assigneeId, completed: input.completed }, tx);
    return row;
  });
}

export async function updateActivity(actor: Actor, id: string, raw: UpdateActivityInput) {
  const input = parse(updateSchema, raw);
  return prisma.$transaction(async (tx) => {
    const row = await loadForChange(tx, actor, id);
    const data: Prisma.ActivityUncheckedUpdateInput = {};
    if (input.subject !== undefined) data.subject = input.subject;
    if (input.body !== undefined) data.body = input.body;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.outcome !== undefined) data.outcome = input.outcome;
    if (input.dueAt !== undefined) {
      if (row.type === "NOTE" && input.dueAt) throw badRequest("Notes do not have a due date.");
      if (row.type === "FOLLOW_UP" && !input.dueAt) throw badRequest("A follow-up needs a due date and time.");
      data.dueAt = input.dueAt;
    }
    if (input.assigneeId !== undefined && input.assigneeId !== row.assigneeId) data.assigneeId = await resolveAssignee(tx, actor, input.assigneeId);
    if (!Object.keys(data).length) return row;
    const updated = await tx.activity.update({ where: { id }, data });
    await recordAudit(actor, "activity.updated", { activityId: id, changed: Object.keys(data) }, tx);
    return updated;
  });
}

/**
 * Explicit state transitions. Each is a conditional UPDATE on the current status, so double clicks and
 * concurrent requests are safe: the second call finds nothing to change and returns the current row.
 */
async function transition(actor: Actor, id: string, from: ActivityStatus[], to: ActivityStatus, action: string, outcome?: string | null) {
  return prisma.$transaction(async (tx) => {
    const row = await loadForChange(tx, actor, id);
    if (row.type === "NOTE") throw badRequest("Notes are not tasks and have no status.");
    const now = new Date();
    const data: Prisma.ActivityUncheckedUpdateManyInput = to === "COMPLETED"
      ? { status: to, completedAt: now, completedById: actor.id, ...(outcome !== undefined ? { outcome } : {}) }
      : { status: to, completedAt: null, completedById: null };
    const { count } = await tx.activity.updateMany({ where: { id, status: { in: from } }, data });
    if (count) {
      if (to === "COMPLETED") await touchLead(tx, row.leadId, now);
      await recordAudit(actor, action, { activityId: id, from: row.status, to }, tx);
    }
    return tx.activity.findUniqueOrThrow({ where: { id } });
  });
}

const outcomeSchema = z.string().trim().max(1000).nullish();
export const completeActivity = (actor: Actor, id: string, outcome?: string | null) =>
  transition(actor, id, ["OPEN"], "COMPLETED", "activity.completed", parse(outcomeSchema, outcome));
export const reopenActivity = (actor: Actor, id: string) => transition(actor, id, ["COMPLETED", "CANCELLED"], "OPEN", "activity.reopened");
export const cancelActivity = (actor: Actor, id: string) => transition(actor, id, ["OPEN"], "CANCELLED", "activity.cancelled");

export async function deleteActivity(actor: Actor, id: string) {
  await prisma.$transaction(async (tx) => {
    const row = await tx.activity.findFirst({ where: { AND: [{ id }, viewScope(actor)] } });
    if (!row) throw notFound("Activity not found.");
    if (!isAdmin(actor) && row.createdById !== actor.id) throw forbidden("Only the creator or an administrator can delete this activity.");
    await tx.activity.delete({ where: { id } });
    await recordAudit(actor, "activity.deleted", { activityId: id, type: row.type, subject: row.subject, leadId: row.leadId }, tx);
  });
}

export async function addActivityComment(actor: Actor, id: string, body: unknown) {
  const text = parse(z.string().trim().min(1, "Comment is empty.").max(5000), body);
  const row = await prisma.activity.findFirst({ where: { AND: [{ id }, viewScope(actor)] }, select: { id: true } });
  if (!row) throw notFound("Activity not found.");
  return prisma.activityComment.create({ data: { activityId: id, authorId: actor.id, body: text } });
}

// ---------------------------------------------------------------- queries

const listInclude = {
  lead: { select: { id: true, name: true, company: true } },
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.ActivityInclude;
export type ActivityListRow = Prisma.ActivityGetPayload<{ include: typeof listInclude }>;

/** IST-day boundaries for the workspace views (the server runs UTC). */
export function viewWhere(view: ActivityView, now: Date = new Date()): Prisma.ActivityWhereInput {
  const today = todayIst(now);
  const start = istDayStart(today), tomorrow = istDayStart(addDaysIst(today, 1));
  const task: Prisma.ActivityWhereInput = { type: { not: "NOTE" } };
  switch (view) {
    case "today": return { AND: [task, { status: "OPEN", dueAt: { gte: start, lt: tomorrow } }] };
    case "upcoming": return { AND: [task, { status: "OPEN", dueAt: { gte: tomorrow } }] };
    case "overdue": return { AND: [task, { status: "OPEN", dueAt: { lt: start } }] };
    case "completed": return { AND: [task, { status: "COMPLETED" }] };
    case "all": return {};
  }
}

export type ActivityListQuery = {
  view?: ActivityView; assigneeId?: string; type?: string; leadId?: string; q?: string;
  page?: number; pageSize?: number; sort?: "due" | "created" | "completed"; dir?: "asc" | "desc"; now?: Date;
};

export async function listActivities(actor: Actor, query: ActivityListQuery = {}) {
  const view = (ACTIVITY_VIEWS as readonly string[]).includes(query.view ?? "") ? (query.view as ActivityView) : "today";
  const and: Prisma.ActivityWhereInput[] = [listScope(actor), viewWhere(view, query.now)];
  if (query.assigneeId) {
    if (!/^[0-9a-f-]{36}$/i.test(query.assigneeId)) throw badRequest("Invalid assignee.");
    and.push({ assigneeId: query.assigneeId });
  }
  if (query.type && (ACTIVITY_TYPES as readonly string[]).includes(query.type)) and.push({ type: query.type as ActivityType });
  if (query.leadId) and.push({ leadId: query.leadId });
  const q = query.q?.trim().slice(0, 100);
  if (q) and.push({ OR: [{ subject: literalContains(q) }, { body: literalContains(q) }, { lead: { OR: [{ name: literalContains(q) }, { company: literalContains(q) }] } }] });
  const where: Prisma.ActivityWhereInput = { AND: and };

  const defaultSort = view === "completed" ? "completed" : view === "all" ? "created" : "due";
  const sort = query.sort ?? defaultSort;
  const dir = query.dir ?? (sort === "due" ? "asc" : "desc"); // soonest due first; newest created/completed first
  const orderBy: Prisma.ActivityOrderByWithRelationInput[] = [
    sort === "due" ? { dueAt: { sort: dir, nulls: "last" } } : sort === "completed" ? { completedAt: { sort: dir, nulls: "last" } } : { createdAt: dir },
    { id: "asc" },
  ];
  const pageSize = Math.min(Math.max(Math.trunc(query.pageSize ?? 25) || 25, 1), 200);
  const total = await prisma.activity.count({ where });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Math.trunc(query.page ?? 1) || 1, 1), pages);
  const rows = await prisma.activity.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, include: listInclude });
  return { rows, total, page, pageSize, pages, view };
}

/** Counts for the workspace tabs and the dashboard "my tasks" widget, within the actor's list scope. */
export async function activityCounts(actor: Actor, opts: { assigneeId?: string; now?: Date } = {}) {
  const base: Prisma.ActivityWhereInput[] = [listScope(actor), ...(opts.assigneeId ? [{ assigneeId: opts.assigneeId }] : [])];
  const count = (view: ActivityView) => prisma.activity.count({ where: { AND: [...base, viewWhere(view, opts.now)] } });
  const [today, upcoming, overdue] = await Promise.all([count("today"), count("upcoming"), count("overdue")]);
  return { today, upcoming, overdue };
}

export async function getActivity(actor: Actor, id: string) {
  const row = await prisma.activity.findFirst({
    where: { AND: [{ id }, viewScope(actor)] },
    include: { ...listInclude, completedBy: { select: { name: true } }, comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } } },
  });
  if (!row) throw notFound("Activity not found.");
  return row;
}

/** Enabled users the actor may assign to: everyone for admins, only themself otherwise. */
export async function assignableUsers(actor: Actor) {
  if (!can(actor.role, "activities.assign")) return [{ id: actor.id, name: actor.name }];
  return prisma.user.findMany({ where: { enabled: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}
