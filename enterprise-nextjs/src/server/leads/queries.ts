import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { isAdmin, leadScope, type Actor } from "@/server/actor";
import { badRequest, forbidden, notFound } from "@/server/errors";
import { PAGE_SIZES, type LeadFilter, type LeadPreset } from "./filter-schema";
import type { Address, AdditionalContact, DuplicateCheck, FilterMeta, LeadDetail, LeadListResult, LeadRow } from "./types";
import { buildLeadWhere, leadOrderBy } from "./where";

export const rowInclude = {
  assignments: { include: { user: { select: { id: true, name: true } } }, orderBy: { assignedAt: "asc" } },
} satisfies Prisma.LeadInclude;
type RowLead = Prisma.LeadGetPayload<{ include: typeof rowInclude }>;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function toRow(lead: RowLead, actor: Actor): LeadRow {
  const own = lead.assignments.find((a) => a.userId === actor.id);
  return {
    id: lead.id, name: lead.name, company: lead.company, email: lead.email, phone: lead.phone, contact: lead.contact,
    location: lead.location, state: lead.state, category: lead.category, dataType: lead.dataType, fileName: lead.fileName,
    status: lead.status, callStatus: lead.callStatus, followUpDate: iso(lead.followUpDate), createdAt: lead.createdAt.toISOString(),
    source: lead.source,
    priority: lead.priority, tags: lead.tags ?? [], lastActivityAt: iso(lead.lastActivityAt), updatedAt: lead.updatedAt.toISOString(),
    assignees: lead.assignments.map((a) => ({ userId: a.userId, name: a.user.name, canView: a.canView, canUpdate: a.canUpdate })),
    canUpdate: isAdmin(actor) || Boolean(own?.canUpdate && own.canView),
  };
}

export async function listLeads(
  actor: Actor,
  input: { filter?: LeadFilter; preset?: LeadPreset; page?: number; pageSize?: number; now?: Date } = {},
): Promise<LeadListResult> {
  const pageSize = (PAGE_SIZES as readonly number[]).includes(input.pageSize ?? 0) ? (input.pageSize as number) : PAGE_SIZES[0];
  const preset = input.preset ?? "all";
  const where = buildLeadWhere(actor, input.filter ?? {}, preset, input.now);
  const total = await prisma.lead.count({ where });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.trunc(input.page ?? 1) || 1), pages);
  const rows = await prisma.lead.findMany({ where, orderBy: leadOrderBy(preset, input.filter?.sort), skip: (page - 1) * pageSize, take: pageSize, include: rowInclude });
  return { rows: rows.map((r) => toRow(r, actor)), total, page, pageSize, pages };
}

const addr = (v: unknown): Address | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  return { street: s("street"), city: s("city"), state: s("state"), postalCode: s("postalCode"), country: s("country") };
};
const contacts = (v: unknown): AdditionalContact[] =>
  Array.isArray(v)
    ? v.filter((c): c is Record<string, unknown> => !!c && typeof c === "object").map((c) => ({
        name: String(c.name ?? ""), contact: String(c.contact ?? ""), details: String(c.details ?? ""),
      }))
    : [];

/** Detail of one lead. 404 when the lead is outside the actor's scope (existence is not disclosed). */
export async function getLeadDetail(actor: Actor, id: string): Promise<LeadDetail> {
  const lead = await prisma.lead.findFirst({
    where: { AND: [{ id }, leadScope(actor)] },
    include: { ...rowInclude, statusHistory: { orderBy: { changedAt: "desc" }, take: 200 } },
  });
  if (!lead) throw notFound("Lead not found.");
  const ids = [...new Set(lead.statusHistory.map((h) => h.changedById).filter((v): v is string => !!v))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return {
    ...toRow(lead, actor),
    countryCode: lead.countryCode, quantity: lead.quantity === null ? null : Number(lead.quantity), requirements: lead.requirements,
    remarks: lead.remarks, inquiryDate: lead.inquiryDate, address: lead.address, callingDate: iso(lead.callingDate), updatedAt: lead.updatedAt.toISOString(),
    followUps: { one: iso(lead.followUpDateOne), two: iso(lead.followUpDateTwo), three: iso(lead.followUpDateThree) },
    billingAddress: addr(lead.billingAddress), shippingAddress: addr(lead.shippingAddress), additionalContacts: contacts(lead.additionalContacts),
    history: lead.statusHistory.map((h) => ({
      id: h.id, fromStatus: h.fromStatus, toStatus: h.toStatus, fromCallStatus: h.fromCallStatus, toCallStatus: h.toCallStatus,
      changedAt: h.changedAt.toISOString(), changedByName: h.changedById ? names.get(h.changedById) ?? null : null,
    })),
    assignedAtByUser: Object.fromEntries(lead.assignments.map((a) => [a.userId, a.assignedAt.toISOString()])),
  };
}

export type MetaScope = { scope: "all" } | { scope: "assigned"; userId: string } | { scope: "unassigned" };

/** Distinct filter values (blank is reported as "" first). Scopes as in assignment-routes.js:215-255. */
export async function getFilterMeta(actor: Actor, input: MetaScope = { scope: "all" }): Promise<FilterMeta> {
  let where: Prisma.LeadWhereInput;
  if (input.scope === "unassigned") {
    if (!isAdmin(actor)) throw forbidden("Administrator access required.");
    where = { assignments: { none: {} } };
  } else if (input.scope === "assigned") {
    if (!isAdmin(actor) && input.userId !== actor.id) throw forbidden("Access denied.");
    where = { assignments: { some: { userId: input.userId } } };
  } else {
    where = leadScope(actor);
  }
  const distinct = async (field: "category" | "location" | "state" | "fileName" | "dataType") => {
    const rows = await prisma.lead.findMany({ where, distinct: [field], select: { [field]: true } as Record<typeof field, true> });
    const values = new Set<string>();
    let blank = false;
    for (const r of rows) {
      const v = (r[field] as string | null | undefined)?.trim();
      if (v) values.add(v); else blank = true;
    }
    const sorted = [...values].sort((a, b) => a.localeCompare(b));
    return blank ? ["", ...sorted] : sorted;
  };
  // Tags: distinct values from tagged leads in scope (capped read; tag lists are short by design).
  const tagged = async () => {
    const rows = await prisma.lead.findMany({ where: { AND: [where, { NOT: { tags: { isEmpty: true } } }] }, select: { tags: true }, take: 5000 });
    return [...new Set(rows.flatMap((r) => r.tags ?? []))].sort((a, b) => a.localeCompare(b));
  };
  const [categories, locations, states, fileNames, dataTypes, tags] = await Promise.all([
    distinct("category"), distinct("location"), distinct("state"), distinct("fileName"), distinct("dataType"), tagged(),
  ]);
  return { categories, locations, states, fileNames, dataTypes, tags };
}

/** Live duplicate check (client.js:60,83). Details are only disclosed for leads the actor may see. */
export async function checkDuplicate(actor: Actor, input: { phone?: string | null; contact?: string | null; excludeId?: string }): Promise<DuplicateCheck> {
  const phone = input.phone?.trim(), contact = input.contact?.trim();
  if (!phone && !contact) throw badRequest("A phone or contact number is required.");
  const notSelf: Prisma.LeadWhereInput = input.excludeId ? { id: { not: input.excludeId } } : {};
  for (const [field, value] of [["phone", phone], ["contact", contact]] as const) {
    if (!value) continue;
    const hit = await prisma.lead.findFirst({
      where: { AND: [notSelf, { OR: [{ phone: value }, { contact: value }] }] },
      select: { id: true, name: true, company: true, phone: true, assignments: { where: { userId: actor.id, canView: true }, select: { userId: true } } },
    });
    if (hit) {
      const visible = isAdmin(actor) || hit.assignments.length > 0;
      return { exists: true, field, lead: visible ? { id: hit.id, name: hit.name, company: hit.company, phone: hit.phone } : null };
    }
  }
  return { exists: false };
}
