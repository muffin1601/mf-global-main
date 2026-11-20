import "server-only";
import type { Prisma, LeadSource } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";

/**
 * The ONE way a lead is inserted (manual entry, CSV import, IndiaMART,
 * TradeIndia, webhooks). Guarantees, in a single transaction:
 *  - duplicate protection that holds under concurrency (advisory locks),
 *  - `source` / `importJobId` / `externalKey` attribution for the insertion report,
 *  - the initial status is recorded (`initialStatus` + status history),
 *  - an activity log entry.
 * `createdAt` is never accepted from callers: it is the DB insertion time and is
 * immutable afterwards (trigger `leads_created_at_immutable`).
 */
export type NewLeadInput = {
  name?: string | null; company?: string | null; email?: string | null; countryCode?: string | null;
  phone?: string | null; contact?: string | null; location?: string | null; state?: string | null;
  category?: string | null; quantity?: number | null; requirements?: string | null; remarks?: string | null;
  dataType?: string | null; callStatus?: string; status?: string; followUpDate?: Date | null;
  inquiryDate?: string | null; address?: string | null; fileName?: string | null;
};

export type IngestContext = {
  source: LeadSource;
  createdById?: string | null;
  importJobId?: string | null;
  /** Provider-scoped idempotency key, e.g. `indiamart:<UNIQUE_QUERY_ID>`. */
  externalKey?: string | null;
  assignTo?: { userId: string; canView?: boolean; canUpdate?: boolean; canDelete?: boolean }[];
  assignedBy?: string | null;
  /** Fields that count as a duplicate. MERN manual entry: phone OR contact. */
  dedupe?: { phone?: boolean; contact?: boolean; email?: boolean };
};

export type CreateLeadResult =
  | { status: "created"; leadId: string }
  | { status: "duplicate"; existingId: string; field: "phone" | "contact" | "email" | "externalKey" };

type Tx = Prisma.TransactionClient;
const clean = (v: string | null | undefined) => { const t = v?.trim(); return t ? t : null; };

export async function createLeadTx(tx: Tx, input: NewLeadInput, ctx: IngestContext): Promise<CreateLeadResult> {
  const phone = clean(input.phone), contact = clean(input.contact), email = clean(input.email)?.toLowerCase() ?? null;
  const dedupe = ctx.dedupe ?? { phone: true, contact: true };

  // Serialise concurrent inserts of the same identity. Locks are taken in a
  // stable order so two transactions can never deadlock.
  const lockKeys = [
    ctx.externalKey && `ext:${ctx.externalKey}`,
    dedupe.phone && phone && `phone:${phone}`,
    dedupe.contact && contact && `contact:${contact}`,
    dedupe.email && email && `email:${email}`,
  ].filter((k): k is string => Boolean(k)).sort();
  for (const key of lockKeys) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;

  if (ctx.externalKey) {
    const hit = await tx.lead.findUnique({ where: { externalKey: ctx.externalKey }, select: { id: true } });
    if (hit) return { status: "duplicate", existingId: hit.id, field: "externalKey" };
  }
  if (dedupe.phone && phone) {
    const hit = await tx.lead.findFirst({ where: { OR: [{ phone }, { contact: phone }] }, select: { id: true } });
    if (hit) return { status: "duplicate", existingId: hit.id, field: "phone" };
  }
  if (dedupe.contact && contact) {
    const hit = await tx.lead.findFirst({ where: { OR: [{ contact }, { phone: contact }] }, select: { id: true } });
    if (hit) return { status: "duplicate", existingId: hit.id, field: "contact" };
  }
  if (dedupe.email && email) {
    const hit = await tx.lead.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
    if (hit) return { status: "duplicate", existingId: hit.id, field: "email" };
  }

  const status = input.status ?? "New Lead";
  const callStatus = input.callStatus ?? "Not Called";
  const lead = await tx.lead.create({
    data: {
      createdById: ctx.createdById ?? null, importJobId: ctx.importJobId ?? null, externalKey: ctx.externalKey ?? null,
      source: ctx.source, initialStatus: status, status, callStatus,
      name: clean(input.name), company: clean(input.company), email, countryCode: clean(input.countryCode),
      phone, contact, location: clean(input.location), state: clean(input.state), category: clean(input.category),
      quantity: input.quantity ?? null, requirements: clean(input.requirements), remarks: clean(input.remarks),
      dataType: clean(input.dataType), followUpDate: input.followUpDate ?? null, inquiryDate: clean(input.inquiryDate),
      address: clean(input.address), fileName: clean(input.fileName),
    },
    select: { id: true },
  });
  await tx.leadStatusHistory.create({ data: { leadId: lead.id, fromStatus: null, toStatus: status, toCallStatus: callStatus, changedById: ctx.createdById ?? null } });
  for (const a of ctx.assignTo ?? []) {
    await tx.leadAssignment.create({ data: { leadId: lead.id, userId: a.userId, canView: a.canView ?? true, canUpdate: a.canUpdate ?? true, canDelete: a.canDelete ?? false, assignedBy: ctx.assignedBy ?? ctx.createdById ?? null } });
  }
  // Ownership history (Phase 2): the initial assignees of a new lead.
  if (ctx.assignTo?.length) {
    await tx.leadAssignmentEvent.createMany({
      data: ctx.assignTo.map((a) => ({ leadId: lead.id, userId: a.userId, action: "ASSIGNED", canUpdate: a.canUpdate ?? true, reason: ctx.source === "IMPORT" ? "import" : "create", actorId: ctx.assignedBy ?? ctx.createdById ?? null })),
    });
  }
  await tx.activityLog.create({ data: { userId: ctx.createdById ?? null, action: "lead.created", entityType: "lead", entityId: lead.id, details: { leadId: lead.id, source: ctx.source, importJobId: ctx.importJobId ?? null } } });
  return { status: "created", leadId: lead.id };
}

export const createLead = (input: NewLeadInput, ctx: IngestContext) =>
  prisma.$transaction((tx) => createLeadTx(tx, input, ctx), { maxWait: 15_000, timeout: 30_000 });

/** Record a status/call-status transition. Call inside the same tx as the update. */
export async function recordStatusChange(
  tx: Tx, leadId: string,
  before: { status: string; callStatus: string }, after: { status: string; callStatus: string },
  changedById: string | null,
) {
  if (before.status === after.status && before.callStatus === after.callStatus) return;
  await tx.leadStatusHistory.create({
    data: { leadId, fromStatus: before.status, toStatus: after.status, fromCallStatus: before.callStatus, toCallStatus: after.callStatus, changedById },
  });
}
