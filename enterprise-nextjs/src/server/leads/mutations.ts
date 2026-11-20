import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { CALL_STATUSES, LEAD_PRIORITIES, LEAD_STATUSES, MAX_TAG_LENGTH, normalizeTags } from "@/lib/crm/constants";
import { prisma } from "@/lib/prisma/client";
import { assertAdmin, isAdmin, leadScope, type Actor } from "@/server/actor";
import { badRequest, conflict, forbidden, notFound } from "@/server/errors";
import { createLead, recordStatusChange } from "./ingest";
import { rotateFollowUp, type LeadFilter, type LeadPreset } from "./filter-schema";
import { buildLeadWhere } from "./where";
import { recordAssignmentChanges, snapshotAssignments } from "./assignment-history";

type Tx = Prisma.TransactionClient;

function parse<S extends z.ZodType>(schema: S, raw: unknown): z.output<S> {
  const r = schema.safeParse(raw);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw badRequest(issue ? `${issue.path.join(".") || "input"}: ${issue.message}` : "Invalid input.");
  }
  return r.data;
}

async function log(tx: Tx, actor: Actor, action: string, details: Prisma.InputJsonObject, leadId?: string) {
  await tx.activityLog.create({
    data: { userId: actor.id, actorUserCode: actor.userId ?? null, actorName: actor.name, actorRole: actor.role, action, details, ...(leadId ? { entityType: "lead", entityId: leadId } : {}) },
  });
}

// ---------- schemas ----------
const txt = z.string().max(5000).nullish().transform((v) => (v === undefined ? undefined : v?.trim() || null));
const email = txt.refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email address.");
const phoneText = z.string().max(40).nullish().transform((v) => (v === undefined ? undefined : v?.trim() || null));
const addressSchema = z.object({
  street: z.string().max(500).default(""), city: z.string().max(200).default(""), state: z.string().max(200).default(""),
  postalCode: z.string().max(40).default(""), country: z.string().max(200).default(""),
}).nullish();
const idList = z.array(z.uuid()).min(1, "Select at least one lead.").max(5000);

const baseFields = {
  name: txt, company: txt, email, countryCode: txt, phone: phoneText, contact: phoneText, location: txt, state: txt, category: txt,
  dataType: txt, requirements: txt, remarks: txt, address: txt, inquiryDate: txt,
  quantity: z.number().nonnegative().max(1e9).nullish(),
  status: z.enum(LEAD_STATUSES).optional(), callStatus: z.enum(CALL_STATUSES).optional(),
  followUpDate: z.date().nullish(), callingDate: z.date().nullish(),
};
const createSchema = z.object({ ...baseFields, assignedUserId: z.uuid().nullish() });
const updateSchema = z.object({
  ...baseFields,
  priority: z.enum(LEAD_PRIORITIES).nullish(),
  tags: z.array(z.string().max(MAX_TAG_LENGTH * 4)).max(100).optional(),
  billingAddress: addressSchema, shippingAddress: addressSchema,
  assignedTo: z.array(z.object({ userId: z.uuid(), canUpdate: z.boolean().default(false) })).optional(),
});
const contactSchema = z.object({ name: z.string().trim().max(200).default(""), contact: z.string().trim().min(1, "Contact is required.").max(60), details: z.string().trim().max(1000).default("") });

export type CreateLeadInput = z.input<typeof createSchema>;
export type UpdateLeadInput = z.input<typeof updateSchema>;

// ---------- create ----------
export async function createManualLead(actor: Actor, raw: CreateLeadInput): Promise<{ id: string }> {
  const input = parse(createSchema, raw);
  if (!input.phone && !input.contact) throw badRequest("A phone or contact number is required.");
  let assignTo: { userId: string; canView: boolean; canUpdate: boolean }[] = [];
  if (isAdmin(actor)) {
    if (input.assignedUserId) {
      const u = await prisma.user.findFirst({ where: { id: input.assignedUserId, enabled: true }, select: { id: true } });
      if (!u) throw notFound("The selected user was not found.");
      assignTo = [{ userId: u.id, canView: true, canUpdate: true }];
    }
  } else {
    // client.js:11 - a regular user's new lead always belongs to them, with update permission.
    assignTo = [{ userId: actor.id, canView: true, canUpdate: true }];
  }
  const res = await createLead(
    {
      name: input.name, company: input.company, email: input.email, countryCode: input.countryCode, phone: input.phone, contact: input.contact,
      location: input.location, state: input.state, category: input.category, quantity: input.quantity, requirements: input.requirements,
      remarks: input.remarks, dataType: input.dataType, callStatus: input.callStatus, status: input.status, inquiryDate: input.inquiryDate,
      address: input.address, followUpDate: input.followUpDate ?? null,
    },
    { source: "MANUAL", createdById: actor.id, assignTo, assignedBy: actor.id },
  );
  if (res.status === "duplicate") throw conflict("A lead with that phone or contact already exists.");
  if (input.followUpDate || input.callingDate) {
    await prisma.lead.update({
      where: { id: res.leadId },
      data: { ...(input.followUpDate ? { followUpDateOne: input.followUpDate } : {}), ...(input.callingDate ? { callingDate: input.callingDate } : {}) },
    });
  }
  return { id: res.leadId };
}

// ---------- update ----------
async function loadEditable(tx: Tx, actor: Actor, id: string) {
  const lead = await tx.lead.findFirst({ where: { AND: [{ id }, leadScope(actor)] }, include: { assignments: true } });
  if (!lead) throw notFound("Lead not found.");
  if (!isAdmin(actor)) {
    const own = lead.assignments.find((a) => a.userId === actor.id);
    if (!own?.canUpdate) throw forbidden("You only have view access to this lead.");
  }
  return lead;
}
const lock = (tx: Tx, id: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`lead:${id}`}))`;
const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? "") === (b ?? "");

/**
 * Edit a lead (EditLeadModal field set). Phone/company/contact and re-assignment are admin-only;
 * assignees need update permission. A new follow-up date rotates through the 3 slots (client.js:161),
 * but only when it differs from the current follow-up date so re-saving a form does not burn a slot.
 */
export async function updateLead(actor: Actor, id: string, raw: UpdateLeadInput): Promise<{ id: string }> {
  const input = parse(updateSchema, raw);
  await prisma.$transaction(async (tx) => {
    await lock(tx, id);
    const lead = await loadEditable(tx, actor, id);
    if (!isAdmin(actor)) {
      for (const key of ["phone", "company", "contact"] as const) {
        if (input[key] !== undefined && !same(input[key], lead[key])) throw forbidden(`Only an administrator can change the ${key}.`);
      }
      if (input.assignedTo !== undefined) throw forbidden("Only an administrator can change assignments.");
    }
    const data: Prisma.LeadUncheckedUpdateInput = {};
    for (const key of ["name", "company", "email", "countryCode", "phone", "contact", "location", "state", "category", "dataType", "requirements", "remarks", "address", "inquiryDate"] as const) {
      if (input[key] !== undefined) data[key] = key === "email" && input.email ? input.email.toLowerCase() : input[key];
    }
    if (input.quantity !== undefined) data.quantity = input.quantity;
    if (input.callingDate !== undefined) data.callingDate = input.callingDate;
    if (input.billingAddress !== undefined) data.billingAddress = input.billingAddress ?? Prisma.DbNull;
    if (input.shippingAddress !== undefined) data.shippingAddress = input.shippingAddress ?? Prisma.DbNull;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.tags !== undefined) data.tags = normalizeTags(input.tags);
    if (input.status) data.status = input.status;
    if (input.callStatus) data.callStatus = input.callStatus;
    if (input.followUpDate && input.followUpDate.getTime() !== lead.followUpDate?.getTime()) Object.assign(data, rotateFollowUp(lead, input.followUpDate));

    for (const [field, value] of [["phone", data.phone], ["contact", data.contact]] as const) {
      if (typeof value === "string" && value !== lead[field]) {
        const dup = await tx.lead.findFirst({ where: { id: { not: id }, OR: [{ phone: value }, { contact: value }] }, select: { id: true } });
        if (dup) throw conflict("Another lead already uses that phone or contact number.");
      }
    }

    const changed = Object.keys(data).filter((k) => {
      const next = data[k as keyof typeof data], prev = lead[k as keyof typeof lead];
      return JSON.stringify(next) !== JSON.stringify(prev);
    });
    if (Object.keys(data).length) await tx.lead.update({ where: { id }, data });
    await recordStatusChange(
      tx, id, { status: lead.status, callStatus: lead.callStatus },
      { status: input.status ?? lead.status, callStatus: input.callStatus ?? lead.callStatus }, actor.id,
    );
    if (input.assignedTo !== undefined) {
      const before = await snapshotAssignments(tx, [id]);
      await tx.leadAssignment.deleteMany({ where: { leadId: id } });
      if (input.assignedTo.length) {
        await tx.leadAssignment.createMany({ data: input.assignedTo.map((a) => ({ leadId: id, userId: a.userId, canView: true, canUpdate: a.canUpdate, assignedBy: actor.id })) });
      }
      await recordAssignmentChanges(tx, before, await snapshotAssignments(tx, [id]), actor.id, "edit");
      changed.push("assignedTo");
    }
    if (changed.length) await log(tx, actor, "lead.updated", { leadId: id, changed }, id);
  });
  return { id };
}

export async function addAdditionalContact(actor: Actor, id: string, raw: z.input<typeof contactSchema>) {
  const contact = parse(contactSchema, raw);
  await prisma.$transaction(async (tx) => {
    await lock(tx, id);
    const lead = await loadEditable(tx, actor, id);
    const list = Array.isArray(lead.additionalContacts) ? (lead.additionalContacts as Prisma.JsonArray) : [];
    await tx.lead.update({ where: { id }, data: { additionalContacts: [...list, { id: randomUUID(), ...contact }] } });
    await log(tx, actor, "lead.contact_added", { leadId: id, contact: contact.contact });
  });
}

export async function deleteAdditionalContact(actor: Actor, id: string, index: number) {
  await prisma.$transaction(async (tx) => {
    await lock(tx, id);
    const lead = await loadEditable(tx, actor, id);
    const list = Array.isArray(lead.additionalContacts) ? [...(lead.additionalContacts as Prisma.JsonArray)] : [];
    if (!Number.isInteger(index) || index < 0 || index >= list.length) throw notFound("Contact not found.");
    list.splice(index, 1);
    await tx.lead.update({ where: { id }, data: { additionalContacts: list } });
    await log(tx, actor, "lead.contact_deleted", { leadId: id, index });
  });
}

// ---------- delete (admin only, as MERN) ----------
export async function deleteLeads(actor: Actor, ids: string[]): Promise<{ deleted: number }> {
  assertAdmin(actor);
  const list = parse(idList, ids);
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.lead.deleteMany({ where: { id: { in: list } } });
    await log(tx, actor, "lead.deleted", { count, leadIds: list.slice(0, 200) });
    return { deleted: count };
  });
}
export async function deleteLead(actor: Actor, id: string) {
  assertAdmin(actor);
  const r = await deleteLeads(actor, [id]);
  if (r.deleted === 0) throw notFound("Lead not found.");
  return r;
}

/** Delete every lead matching the current filters/preset. Refuses an unfiltered "delete everything". */
export async function deleteAllFiltered(actor: Actor, input: { filter?: LeadFilter; preset?: LeadPreset }): Promise<{ deleted: number }> {
  assertAdmin(actor);
  // Sorting is not a filter: a sort-only request must not count as "filtered" for a bulk delete.
  const { sort: _sort, ...filter } = input.filter ?? {};
  void _sort;
  const preset = input.preset ?? "all";
  if (preset === "all" && Object.values(filter).every((v) => v === undefined || (Array.isArray(v) && v.length === 0) || v === "")) {
    throw badRequest("Apply at least one filter before deleting all matching leads.");
  }
  const where = buildLeadWhere(actor, filter, preset);
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.lead.deleteMany({ where });
    await log(tx, actor, "lead.deleted_filtered", { count, preset, filter: JSON.parse(JSON.stringify(filter)) });
    return { deleted: count };
  }, { timeout: 60_000 });
}

export async function bulkUpdateLeads(actor: Actor, raw: { ids: string[]; category?: string | null; location?: string | null }): Promise<{ updated: number }> {
  assertAdmin(actor);
  const input = parse(z.object({ ids: idList, category: z.string().trim().max(200).nullish(), location: z.string().trim().max(200).nullish() }), raw);
  const data: Prisma.LeadUpdateManyMutationInput = {};
  if (input.category) data.category = input.category;
  if (input.location) data.location = input.location;
  if (!Object.keys(data).length) throw badRequest("Enter a category and/or a location to apply.");
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.lead.updateMany({ where: { id: { in: input.ids } }, data });
    await log(tx, actor, "lead.bulk_updated", { count, ...data } as Prisma.InputJsonObject);
    return { updated: count };
  });
}

// ---------- assignments (admin only) ----------
export type AssignLevel = "view" | "update";

async function activeUsers(tx: Tx, userIds: string[]) {
  const users = await tx.user.findMany({ where: { id: { in: userIds }, enabled: true }, select: { id: true, name: true } });
  if (!users.length) throw notFound("No valid users found to assign.");
  return users;
}

/** Assign leads to many users, MERGING with existing assignees (assignment-routes.js:11). Re-assigning a user updates their level. */
export async function assignLeads(actor: Actor, raw: { leadIds: string[]; userIds: string[]; level: AssignLevel }): Promise<{ leads: number; users: number }> {
  assertAdmin(actor);
  const input = parse(z.object({ leadIds: idList, userIds: z.array(z.uuid()).min(1, "Select at least one user.").max(100), level: z.enum(["view", "update"]) }), raw);
  return prisma.$transaction(async (tx) => {
    const users = await activeUsers(tx, input.userIds);
    const leads = await tx.lead.findMany({ where: { id: { in: input.leadIds } }, select: { id: true } });
    if (!leads.length) throw notFound("No matching leads found.");
    const userIds = users.map((u) => u.id), leadIds = leads.map((l) => l.id);
    const before = await snapshotAssignments(tx, leadIds);
    await tx.leadAssignment.deleteMany({ where: { leadId: { in: leadIds }, userId: { in: userIds } } });
    await tx.leadAssignment.createMany({
      data: leadIds.flatMap((leadId) => userIds.map((userId) => ({ leadId, userId, canView: true, canUpdate: input.level === "update", canDelete: false, assignedBy: actor.id }))),
    });
    await recordAssignmentChanges(tx, before, await snapshotAssignments(tx, leadIds), actor.id, "assign");
    await log(tx, actor, "lead.assigned", { leads: leadIds.length, userIds, level: input.level, leadIds: leadIds.slice(0, 200) });
    return { leads: leadIds.length, users: userIds.length };
  }, { timeout: 60_000 });
}

export async function removeAssignments(actor: Actor, leadIds: string[]): Promise<{ leads: number }> {
  assertAdmin(actor);
  const ids = parse(idList, leadIds);
  return prisma.$transaction(async (tx) => {
    const before = await snapshotAssignments(tx, ids);
    const { count } = await tx.leadAssignment.deleteMany({ where: { leadId: { in: ids } } });
    await recordAssignmentChanges(tx, before, await snapshotAssignments(tx, ids), actor.id, "unassign");
    await log(tx, actor, "lead.unassigned", { leads: ids.length, assignmentsRemoved: count, leadIds: ids.slice(0, 200) });
    return { leads: ids.length };
  }, { timeout: 60_000 });
}

/** Replace all assignees with one target user holding view + update (assignment-routes.js:160). */
export async function transferAssignments(actor: Actor, raw: { leadIds: string[]; targetUserId: string }): Promise<{ leads: number }> {
  assertAdmin(actor);
  const input = parse(z.object({ leadIds: idList, targetUserId: z.uuid() }), raw);
  return prisma.$transaction(async (tx) => {
    const target = (await activeUsers(tx, [input.targetUserId]))[0];
    if (!target) throw notFound("Target user not found.");
    const leads = await tx.lead.findMany({ where: { id: { in: input.leadIds } }, select: { id: true } });
    if (!leads.length) throw notFound("No matching leads found.");
    const leadIds = leads.map((l) => l.id);
    const before = await snapshotAssignments(tx, leadIds);
    await tx.leadAssignment.deleteMany({ where: { leadId: { in: leadIds } } });
    await tx.leadAssignment.createMany({ data: leadIds.map((leadId) => ({ leadId, userId: target.id, canView: true, canUpdate: true, canDelete: false, assignedBy: actor.id })) });
    await recordAssignmentChanges(tx, before, await snapshotAssignments(tx, leadIds), actor.id, "transfer");
    await log(tx, actor, "lead.transferred", { leads: leadIds.length, targetUserId: target.id, leadIds: leadIds.slice(0, 200) });
    return { leads: leadIds.length };
  }, { timeout: 60_000 });
}

// ---------- bulk status / priority / tags (admin, Phase 2) ----------
const bulkFieldsSchema = z.object({
  ids: idList,
  status: z.enum(LEAD_STATUSES).optional(),
  callStatus: z.enum(CALL_STATUSES).optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  addTags: z.array(z.string().max(MAX_TAG_LENGTH * 4)).max(20).optional(),
});

/**
 * Bulk-set status / call status / priority and add tags. Status changes write one LeadStatusHistory
 * row per lead whose value actually changed (same rule as a single edit); unchanged leads get none.
 * Admin-only, like the existing bulk category/location update.
 */
export async function bulkSetLeadFields(actor: Actor, raw: z.input<typeof bulkFieldsSchema>): Promise<{ updated: number; statusChanged: number }> {
  assertAdmin(actor);
  const input = parse(bulkFieldsSchema, raw);
  const addTags = input.addTags ? normalizeTags(input.addTags) : [];
  if (!input.status && !input.callStatus && !input.priority && !addTags.length) throw badRequest("Choose a status, call status, priority or tags to apply.");
  return prisma.$transaction(async (tx) => {
    const leads = await tx.lead.findMany({ where: { id: { in: input.ids } }, select: { id: true, status: true, callStatus: true, tags: true } });
    if (!leads.length) throw notFound("No matching leads found.");
    let statusChanged = 0;
    for (const lead of leads) {
      const next = { status: input.status ?? lead.status, callStatus: input.callStatus ?? lead.callStatus };
      const data: Prisma.LeadUpdateInput = {};
      if (next.status !== lead.status) data.status = next.status;
      if (next.callStatus !== lead.callStatus) data.callStatus = next.callStatus;
      if (input.priority) data.priority = input.priority;
      if (addTags.length) data.tags = normalizeTags([...(lead.tags ?? []), ...addTags]);
      if (!Object.keys(data).length) continue;
      await tx.lead.update({ where: { id: lead.id }, data });
      if (data.status !== undefined || data.callStatus !== undefined) {
        await recordStatusChange(tx, lead.id, { status: lead.status, callStatus: lead.callStatus }, next, actor.id);
        statusChanged++;
      }
    }
    await log(tx, actor, "lead.bulk_fields_updated", {
      count: leads.length, statusChanged, status: input.status ?? null, callStatus: input.callStatus ?? null, priority: input.priority ?? null, addTags, leadIds: leads.map((l) => l.id).slice(0, 200),
    });
    return { updated: leads.length, statusChanged };
  }, { timeout: 60_000 });
}

// ---------- ownership history ----------
export type OwnershipEvent = { id: string; action: string; reason: string; canUpdate: boolean | null; at: Date; user: string | null; actor: string | null };

/** Assignment history for one lead, newest first. Same visibility as the lead itself. */
export async function getLeadOwnershipHistory(actor: Actor, leadId: string, take = 100): Promise<OwnershipEvent[]> {
  const visible = await prisma.lead.findFirst({ where: { AND: [{ id: leadId }, leadScope(actor)] }, select: { id: true } });
  if (!visible) throw notFound("Lead not found.");
  const rows = await prisma.leadAssignmentEvent.findMany({
    where: { leadId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: Math.min(Math.max(take, 1), 500),
    include: { user: { select: { name: true } }, actor: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, action: r.action, reason: r.reason, canUpdate: r.canUpdate, at: r.createdAt, user: r.user?.name ?? null, actor: r.actor?.name ?? null }));
}
