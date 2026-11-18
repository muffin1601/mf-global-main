import { Prisma } from "@/generated/prisma/client";
import type { VendorStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma/client";
import { vendorPermissions } from "@/lib/permissions";
import { istDayEndExclusive, istDayStart, isDateString } from "@/lib/time/ist";
import type { Actor } from "@/server/actor";
import { HttpError, badRequest, conflict, notFound } from "@/server/errors";
import { storage, BUCKETS } from "@/lib/storage";
import {
  ACTIVITY_TYPES, ADDRESS_TYPES, CURRENCIES, DOCUMENT_TYPES, PAYMENT_METHODS, VENDOR_PRIORITIES, VENDOR_TYPES,
  canonicalUrl, clean, has, isMasked, isUuid, maskTail, normalizeCode, normalizeCompanyName, normalizeEmail, normalizePhone,
  parseStatus, performanceBand, validateVendorPayload, STATUS_VALUES, type Input,
} from "./fields";
import { audit, authorize, can, failIf, loadVendor, num, pageParams, requireId, scrub, type Db, type MaybeActor } from "./common";

/* ------------------------------------------------------------------ meta */
export async function vendorMeta(actor: MaybeActor) {
  const a = authorize(actor, "vendor.view");
  const [categories, owners] = await Promise.all([
    prisma.vendorCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { enabled: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    statuses: STATUS_VALUES, priorities: VENDOR_PRIORITIES, types: VENDOR_TYPES, addressTypes: ADDRESS_TYPES,
    documentTypes: DOCUMENT_TYPES, activityTypes: ACTIVITY_TYPES, paymentMethods: PAYMENT_METHODS, currencies: CURRENCIES,
    categories, owners, permissions: vendorPermissions.filter((p) => can(a, p)),
  };
}

/* ------------------------------------------------------------------ list */
export type VendorListQuery = {
  search?: string; status?: string; priority?: string; type?: string; category?: string; owner?: string; tag?: string;
  createdFrom?: string; createdTo?: string; archived?: string | boolean; page?: number | string; limit?: number | string;
  sortBy?: string; sortDir?: string;
};

const SORTABLE: Record<string, string> = {
  name: "name", vendorCode: "vendorCode", status: "status", priority: "priority", createdAt: "createdAt",
  updatedAt: "updatedAt", lastActivityAt: "lastActivityAt", performance: "performanceScore",
};
const csv = (v: unknown) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export async function buildVendorWhere(query: VendorListQuery): Promise<Prisma.VendorWhereInput> {
  const and: Prisma.VendorWhereInput[] = [];
  const archived = query.archived === true || String(query.archived ?? "") === "true";
  and.push(archived ? { archivedAt: { not: null } } : { archivedAt: null });

  if (query.status) {
    const statuses = csv(query.status).map(parseStatus).filter((s): s is VendorStatus => !!s);
    if (statuses.length) and.push({ status: { in: statuses } });
  }
  if (query.priority) {
    const p = csv(query.priority).filter((x) => (VENDOR_PRIORITIES as readonly string[]).includes(x));
    if (p.length) and.push({ priority: { in: p } });
  }
  if (query.type && has(query.type)) and.push({ vendorType: String(query.type) });
  if (query.category) {
    const ids = csv(query.category).filter(isUuid);
    if (ids.length) and.push({ categoryId: { in: ids } });
  }
  if (query.owner) {
    if (String(query.owner) === "unassigned") and.push({ ownerId: null });
    else {
      const ids = csv(query.owner).filter(isUuid);
      if (ids.length) and.push({ ownerId: { in: ids } });
    }
  }
  if (query.tag && has(query.tag)) and.push({ tags: { has: String(query.tag).trim() } });

  const created: Prisma.DateTimeFilter = {};
  if (isDateString(query.createdFrom)) created.gte = istDayStart(query.createdFrom);
  if (isDateString(query.createdTo)) created.lt = istDayEndExclusive(query.createdTo);
  if (created.gte || created.lt) and.push({ createdAt: created });

  const term = String(query.search ?? "").trim();
  if (term) {
    const or: Prisma.VendorWhereInput[] = [
      { name: { contains: term, mode: "insensitive" } },
      { legalName: { contains: term, mode: "insensitive" } },
      { vendorCode: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term } },
      { contacts: { some: { OR: [{ name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }] } } },
    ];
    const code = normalizeCode(term);
    if (code) {
      or.push({ gstin: { startsWith: code, mode: "insensitive" } }, { pan: { startsWith: code, mode: "insensitive" } });
    }
    const digits = term.replace(/\D/g, "");
    if (digits.length >= 4) {
      const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        select id::text as id from vendors where regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g') like ${`%${digits}%`}
        union select vendor_id::text from vendor_contacts where regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g') like ${`%${digits}%`}
        limit 2000`);
      if (rows.length) or.push({ id: { in: rows.map((r) => r.id) } });
    }
    and.push({ OR: or });
  }
  return { AND: and };
}

function buildOrderBy(query: VendorListQuery): Prisma.VendorOrderByWithRelationInput[] {
  const key = SORTABLE[String(query.sortBy ?? "")] ?? "createdAt";
  const dir = String(query.sortDir ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";
  const nullable = key === "lastActivityAt" || key === "performanceScore";
  const primary = nullable ? { [key]: { sort: dir, nulls: "last" } } : { [key]: dir };
  return [primary as Prisma.VendorOrderByWithRelationInput, { id: "desc" }];
}

export async function listVendors(actor: MaybeActor, query: VendorListQuery = {}) {
  authorize(actor, "vendor.view");
  const { page, limit, skip } = pageParams(query);
  const where = await buildVendorWhere(query);
  const [rows, total] = await Promise.all([
    prisma.vendor.findMany({
      where, orderBy: buildOrderBy(query), skip, take: limit,
      select: {
        id: true, vendorCode: true, name: true, legalName: true, vendorType: true, status: true, priority: true, industry: true,
        tags: true, email: true, phone: true, archivedAt: true, lastActivityAt: true, createdAt: true, updatedAt: true,
        performanceScore: true, evaluationCount: true,
        category: { select: { id: true, name: true } }, owner: { select: { id: true, name: true } },
        contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }], take: 1, select: { name: true, email: true, phone: true, designation: true } },
        addresses: { orderBy: [{ isPrimary: "desc" }], take: 1, select: { city: true, state: true } },
        _count: { select: { products: { where: { isActive: true } } } },
      },
    }),
    prisma.vendor.count({ where }),
  ]);
  const vendors = rows.map((v) => {
    const { contacts, addresses, _count, performanceScore, ...rest } = v;
    const score = num(performanceScore);
    return { ...rest, performanceScore: score, performanceBand: performanceBand(score), city: addresses[0]?.city ?? "", primaryContact: contacts[0] ?? null, productCount: _count.products };
  });
  return { vendors, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit };
}

/* --------------------------------------------------------------- summary */
export async function vendorSummary(actor: MaybeActor) {
  authorize(actor, "vendor.view");
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const horizon = new Date(now.getTime() + 30 * 86_400_000);
  const live = { archivedAt: null };
  const [byStatusRows, archived, recent, expiring, rating, leadTime, neverEvaluated] = await Promise.all([
    prisma.vendor.groupBy({ by: ["status"], where: live, _count: { _all: true } }),
    prisma.vendor.count({ where: { archivedAt: { not: null } } }),
    prisma.vendor.count({ where: { ...live, createdAt: { gte: since } } }),
    prisma.vendorDocument.findMany({ where: { status: "ACTIVE", expiryDate: { not: null, lte: horizon }, vendor: live }, distinct: ["vendorId"], select: { vendorId: true } }),
    prisma.vendor.aggregate({ where: { ...live, performanceScore: { not: null } }, _avg: { performanceScore: true }, _count: { _all: true } }),
    prisma.vendorProduct.aggregate({ where: { isActive: true, leadTimeDays: { gt: 0 } }, _avg: { leadTimeDays: true } }),
    prisma.vendor.count({ where: { ...live, status: "ACTIVE", performanceScore: null } }),
  ]);
  const byStatus: Record<string, number> = { ACTIVE: 0, PENDING: 0, INACTIVE: 0, BLOCKED: 0 };
  let total = 0;
  for (const r of byStatusRows) { byStatus[r.status] = (byStatus[r.status] ?? 0) + r._count._all; total += r._count._all; }
  const avg = num(rating._avg.performanceScore);
  const lead = leadTime._avg.leadTimeDays;
  return {
    total, active: byStatus.ACTIVE ?? 0, pending: byStatus.PENDING ?? 0, inactive: byStatus.INACTIVE ?? 0, blocked: byStatus.BLOCKED ?? 0, archived,
    addedLast30Days: recent, vendorsWithExpiringDocuments: expiring.length,
    requiringReview: (byStatus.PENDING ?? 0) + neverEvaluated,
    averageRating: avg == null ? null : Math.round(avg * 100) / 100, ratedVendors: rating._count._all,
    averageLeadTimeDays: lead == null ? null : Math.round(lead),
  };
}

/* ------------------------------------------------------------ duplicates */
export class DuplicateError extends HttpError {
  constructor(message: string, public duplicates: DuplicateMatch[], public blocking: boolean) {
    super(409, message, blocking ? "DUPLICATE_BLOCKING" : "DUPLICATE_WARNING");
  }
}
export type DuplicateMatch = { id: string; vendorCode: string; name: string; status: string; archived: boolean; matchedOn: string[]; reason: string };
const LABELS: Record<string, string> = { gstin: "GSTIN", pan: "PAN", name: "vendor name", email: "email address", phone: "phone number" };

export async function findDuplicates(candidate: Input, excludeId: string | null = null, db: Db = prisma) {
  const keys = {
    name: normalizeCompanyName(candidate.name), gstin: normalizeCode(candidate.gstin), pan: normalizeCode(candidate.pan),
    email: normalizeEmail(candidate.email), phone: normalizePhone(candidate.phone),
  };
  const conds: Prisma.Sql[] = [];
  if (keys.name) conds.push(Prisma.sql`lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) like ${`${keys.name}%`}`);
  if (keys.gstin) conds.push(Prisma.sql`upper(regexp_replace(coalesce(gstin,''), '[^a-zA-Z0-9]', '', 'g')) = ${keys.gstin}`);
  if (keys.pan) conds.push(Prisma.sql`upper(regexp_replace(coalesce(pan,''), '[^a-zA-Z0-9]', '', 'g')) = ${keys.pan}`);
  if (keys.email) conds.push(Prisma.sql`lower(trim(coalesce(email,''))) = ${keys.email}`);
  if (keys.phone) conds.push(Prisma.sql`regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g') like ${`%${keys.phone}`}`);
  if (!conds.length) return { blocking: [] as DuplicateMatch[], warnings: [] as DuplicateMatch[] };
  const exclude = excludeId && isUuid(excludeId) ? Prisma.sql`and id <> ${excludeId}::uuid` : Prisma.empty;
  const rows = await db.$queryRaw<{ id: string; vendor_code: string; name: string; status: string; archived_at: Date | null; gstin: string | null; pan: string | null; email: string | null; phone: string | null }[]>(Prisma.sql`
    select id::text as id, vendor_code, name, status::text as status, archived_at, gstin, pan, email, phone
    from vendors where (${Prisma.join(conds, " or ")}) ${exclude} limit 30`);
  const blocking: DuplicateMatch[] = [];
  const warnings: DuplicateMatch[] = [];
  for (const m of rows) {
    const matched: string[] = [];
    if (keys.name && normalizeCompanyName(m.name) === keys.name) matched.push("name");
    if (keys.gstin && normalizeCode(m.gstin) === keys.gstin) matched.push("gstin");
    if (keys.pan && normalizeCode(m.pan) === keys.pan) matched.push("pan");
    if (keys.email && normalizeEmail(m.email) === keys.email) matched.push("email");
    if (keys.phone && normalizePhone(m.phone) === keys.phone) matched.push("phone");
    if (!matched.length) continue;
    const entry: DuplicateMatch = {
      id: m.id, vendorCode: m.vendor_code, name: m.name, status: m.status, archived: !!m.archived_at, matchedOn: matched,
      reason: `Matches an existing vendor on ${matched.map((f) => LABELS[f]).join(" and ")}`,
    };
    (matched.some((f) => f === "gstin" || f === "pan") ? blocking : warnings).push(entry);
  }
  return { blocking, warnings };
}

export async function checkDuplicates(actor: MaybeActor, candidate: Input) {
  authorize(actor, "vendor.view");
  return findDuplicates(candidate, isUuid(candidate.excludeId) ? candidate.excludeId : null);
}

/* ------------------------------------------------------------- vendor code */
export async function nextVendorSeq(db: Db, letter: string): Promise<number> {
  const rows = await db.$queryRaw<{ max: number | null }[]>(Prisma.sql`
    select max(cast(substring(vendor_code from 3) as int)) as max from vendors where vendor_code ~ ${`^V${letter}[0-9]{1,8}$`}`);
  return rows[0]?.max ?? 0;
}
export const codeLetter = (name: string) => (/[A-Za-z]/.test(name[0] ?? "") ? (name[0] ?? "X").toUpperCase() : "X");
export const formatCode = (letter: string, seq: number) => `V${letter}${String(seq).padStart(3, "0")}`;

/* ------------------------------------------------------------- presentation */
const BANKISH = /bank|account|ifsc|upi|swift|password|token|cvv/i;
function legacyView(value: unknown, canBank: boolean): unknown {
  if (value == null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => legacyView(v, canBank));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (BANKISH.test(k)) out[k] = canBank ? (typeof v === "string" ? maskTail(v) : "[masked]") : "[restricted]";
    else out[k] = legacyView(v, canBank);
  }
  return out;
}

type BankJson = { bankName?: string; accountHolderName?: string; accountNumber?: string; ifsc?: string; branch?: string; upi?: string; creditPeriodDays?: number | string; preferredPaymentMethod?: string };

function presentBank(actor: Actor, v: { bankDetails: Prisma.JsonValue | null; currency: string; paymentTerms: string | null }) {
  const bank = (v.bankDetails && typeof v.bankDetails === "object" && !Array.isArray(v.bankDetails) ? v.bankDetails : {}) as BankJson;
  if (!can(actor, "vendor.view_bank")) {
    return { restricted: true as const, currency: v.currency, paymentTerms: v.paymentTerms, creditPeriodDays: bank.creditPeriodDays ?? null };
  }
  const { accountNumber, ...rest } = bank;
  return { restricted: false as const, ...rest, accountNumberMasked: maskTail(accountNumber), hasAccountNumber: !!accountNumber, currency: v.currency, paymentTerms: v.paymentTerms };
}

export async function getVendor(actor: MaybeActor, id: string) {
  const a = authorize(actor, "vendor.view");
  const vid = requireId(id);
  const v = await prisma.vendor.findUnique({
    where: { id: vid },
    include: {
      category: { select: { id: true, name: true } }, owner: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } },
      _count: { select: { products: { where: { isActive: true } }, documents: { where: { status: "ACTIVE" } }, activities: true, evaluations: true, contacts: true, addresses: true } },
    },
  });
  if (!v) throw notFound("Vendor not found");
  const { bankDetails, legacyData, customFields, performanceScore, _count, ...rest } = v;
  const score = num(performanceScore);
  const canBank = can(a, "vendor.view_bank");
  return {
    ...rest,
    performanceScore: score,
    performanceBand: performanceBand(score),
    bank: presentBank(a, { bankDetails, currency: v.currency, paymentTerms: v.paymentTerms }),
    legacyData: legacyView(legacyData, canBank),
    customFields: legacyView(customFields, canBank),
    counts: { products: _count.products, documents: _count.documents, activities: _count.activities, evaluations: _count.evaluations, contacts: _count.contacts, addresses: _count.addresses },
  };
}

/* ---------------------------------------------------------------- create */
const AUDITED = ["name", "legalName", "vendorType", "priority", "website", "gstin", "pan", "cin", "industry", "categoryId", "ownerId", "phone", "email", "tags", "taxRegistration", "description", "notes"] as const;

async function assertRefs(categoryId: string | null | undefined, ownerId: string | null | undefined) {
  if (categoryId) {
    if (!isUuid(categoryId) || !(await prisma.vendorCategory.findUnique({ where: { id: categoryId }, select: { id: true } }))) throw badRequest("Select a valid category");
  }
  if (ownerId) {
    if (!isUuid(ownerId) || !(await prisma.user.findFirst({ where: { id: ownerId, enabled: true }, select: { id: true } }))) throw badRequest("Select a valid owner");
  }
}

const tagList = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map((t) => String(t).trim()).filter(Boolean))];

function bankFrom(input: Input, existing: BankJson = {}): { bank: BankJson; currency?: string; paymentTerms?: string | null } {
  const raw = (input.bank ?? {}) as Input;
  const next: BankJson = { ...existing };
  for (const k of ["bankName", "accountHolderName", "ifsc", "branch", "upi", "preferredPaymentMethod"] as const) {
    if (k in raw) { const v = clean(raw[k]); if (v) next[k] = k === "ifsc" ? normalizeCode(v) : v; else delete next[k]; }
  }
  if ("creditPeriodDays" in raw) { if (has(raw.creditPeriodDays)) next.creditPeriodDays = Number(raw.creditPeriodDays); else delete next.creditPeriodDays; }
  // A blank or masked account number means "leave as is": the UI never round-trips the real value.
  if (has(raw.accountNumber) && !isMasked(raw.accountNumber)) next.accountNumber = String(raw.accountNumber).replace(/\s/g, "");
  const out: { bank: BankJson; currency?: string; paymentTerms?: string | null } = { bank: next };
  if (has(raw.currency)) out.currency = String(raw.currency);
  if ("paymentTerms" in raw) out.paymentTerms = clean(raw.paymentTerms);
  return out;
}

function scalarData(input: Input) {
  const d: Prisma.VendorUncheckedCreateInput = { name: "", vendorCode: "" };
  const set = <K extends keyof Prisma.VendorUncheckedCreateInput>(k: K, v: Prisma.VendorUncheckedCreateInput[K]) => { d[k] = v; };
  if ("name" in input) set("name", String(input.name).trim().replace(/\s+/g, " "));
  if ("legalName" in input) set("legalName", clean(input.legalName));
  if ("email" in input) set("email", has(input.email) ? normalizeEmail(input.email) : null);
  if ("phone" in input) set("phone", clean(input.phone));
  if ("website" in input) set("website", has(input.website) ? canonicalUrl(input.website) : null);
  if ("gstin" in input) set("gstin", has(input.gstin) ? normalizeCode(input.gstin) : null);
  if ("pan" in input) set("pan", has(input.pan) ? normalizeCode(input.pan) : null);
  if ("cin" in input) set("cin", has(input.cin) ? normalizeCode(input.cin) : null);
  if ("taxRegistration" in input) set("taxRegistration", clean(input.taxRegistration));
  if ("vendorType" in input) set("vendorType", clean(input.vendorType));
  if ("industry" in input) set("industry", clean(input.industry));
  if ("description" in input) set("description", String(input.description ?? "").trim());
  if ("notes" in input) set("notes", String(input.notes ?? "").trim());
  if (has(input.priority)) set("priority", String(input.priority));
  if ("tags" in input) set("tags", tagList(input.tags));
  if ("categoryId" in input) set("categoryId", clean(input.categoryId));
  if ("ownerId" in input) set("ownerId", clean(input.ownerId));
  return d;
}

export async function createVendor(actor: MaybeActor, input: Input) {
  const a = authorize(actor, "vendor.create");
  failIf(validateVendorPayload(input));
  const data = scalarData(input);
  await assertRefs(data.categoryId, data.ownerId);

  const { blocking, warnings } = await findDuplicates(input, null);
  if (blocking.length) throw new DuplicateError(blocking[0]?.reason ?? "Duplicate vendor", blocking, true);
  if (warnings.length && input.confirmDuplicate !== true) {
    throw new DuplicateError("This vendor looks like a possible duplicate. Review the matches and confirm to continue.", warnings, false);
  }

  const status = parseStatus(input.status) ?? "PENDING";
  if (status === "BLOCKED" && !can(a, "vendor.archive")) throw new HttpError(403, "Only an administrator can blacklist a vendor", "FORBIDDEN");

  let bank: ReturnType<typeof bankFrom> | null = null;
  if (input.bank && typeof input.bank === "object" && can(a, "vendor.edit_bank")) bank = bankFrom(input);

  const contacts = (Array.isArray(input.contacts) ? input.contacts : []) as Input[];
  const addresses = (Array.isArray(input.addresses) ? input.addresses : []) as Input[];
  const letter = codeLetter(data.name);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const seq = (await nextVendorSeq(tx, letter)) + 1;
        const vendor = await tx.vendor.create({
          data: {
            ...data, vendorCode: formatCode(letter, seq), status, createdById: a.id, ownerId: data.ownerId ?? null,
            ...(bank ? { bankDetails: bank.bank as Prisma.InputJsonValue, ...(bank.currency ? { currency: bank.currency } : {}), ...(bank.paymentTerms !== undefined ? { paymentTerms: bank.paymentTerms } : {}) } : {}),
            contacts: { create: contacts.map((c, i) => ({ name: String(c.name).trim(), designation: clean(c.designation), email: has(c.email) ? normalizeEmail(c.email) : null, phone: clean(c.phone), isPrimary: c.isPrimary === true || (i === 0 && !contacts.some((x) => x.isPrimary === true)) })) },
            addresses: { create: addresses.map((x, i) => ({ type: has(x.type) ? String(x.type) : "Registered Office", line1: clean(x.line1), line2: clean(x.line2), city: clean(x.city), state: clean(x.state), postalCode: clean(x.postalCode), country: clean(x.country) ?? "India", isPrimary: x.isPrimary === true || (i === 0 && !addresses.some((y) => y.isPrimary === true)) })) },
          },
          select: { id: true, vendorCode: true, name: true, status: true },
        });
        await audit(tx, a, "vendor.created", vendor, { status: vendor.status });
        return vendor;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 5) continue; // concurrent code allocation
      throw e;
    }
  }
  throw conflict("Could not allocate a vendor code. Try again.");
}

/* ---------------------------------------------------------------- update */
export async function updateVendor(actor: MaybeActor, id: string, input: Input) {
  const a = authorize(actor, "vendor.edit");
  const vid = requireId(id);
  const before = await prisma.vendor.findUnique({ where: { id: vid } });
  if (!before) throw notFound("Vendor not found");
  failIf(validateVendorPayload(input, { partial: true, currentType: before.vendorType }));

  if (has(input.updatedAt)) {
    const sent = new Date(String(input.updatedAt)).getTime();
    if (!Number.isNaN(sent) && sent !== before.updatedAt.getTime()) throw conflict("This vendor was changed by someone else. Reload and try again.");
  }

  const data = scalarData(input);
  delete (data as Partial<typeof data>).vendorCode;
  if (!("name" in input)) delete (data as Partial<typeof data>).name;
  await assertRefs(data.categoryId, data.ownerId);

  const identity = ["name", "gstin", "pan", "email", "phone"].some((k) => k in input);
  if (identity) {
    const { blocking, warnings } = await findDuplicates(
      { name: data.name ?? before.name, gstin: "gstin" in data ? data.gstin : before.gstin, pan: "pan" in data ? data.pan : before.pan, email: "email" in data ? data.email : before.email, phone: "phone" in data ? data.phone : before.phone },
      vid,
    );
    if (blocking.length) throw new DuplicateError(blocking[0]?.reason ?? "Duplicate vendor", blocking, true);
    if (warnings.length && input.confirmDuplicate !== true) throw new DuplicateError("These details match another vendor. Review the matches and confirm to continue.", warnings, false);
  }

  let bankChanged = false;
  const update: Prisma.VendorUncheckedUpdateInput = { ...(data as Prisma.VendorUncheckedUpdateInput) };
  if ("bank" in input && input.bank && typeof input.bank === "object" && can(a, "vendor.edit_bank")) {
    const existing = (before.bankDetails && typeof before.bankDetails === "object" && !Array.isArray(before.bankDetails) ? before.bankDetails : {}) as BankJson;
    const b = bankFrom(input, existing);
    update.bankDetails = b.bank as Prisma.InputJsonValue;
    if (b.currency) update.currency = b.currency;
    if (b.paymentTerms !== undefined) update.paymentTerms = b.paymentTerms;
    bankChanged = true;
  }
  // Status transitions go through setVendorStatus so they are audited as such.

  return prisma.$transaction(async (tx) => {
    const after = await tx.vendor.update({ where: { id: vid }, data: update });
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const f of AUDITED) {
      const x = before[f] ?? null;
      const y = after[f] ?? null;
      if (JSON.stringify(x) !== JSON.stringify(y)) changes[f] = { from: x, to: y };
    }
    if (bankChanged) changes.bank = { from: "[redacted]", to: "[redacted]" };
    if (Object.keys(changes).length) await audit(tx, a, "vendor.updated", after, { changes });
    return { id: after.id, vendorCode: after.vendorCode, name: after.name, updatedAt: after.updatedAt, changed: Object.keys(changes) };
  });
}

/* ---------------------------------------------------------------- status */
function statusFor(a: Actor, value: unknown): VendorStatus {
  const status = parseStatus(value);
  if (!status) throw badRequest("Status must be one of: Active, Pending, Inactive, Blacklisted");
  if (status === "BLOCKED" && !can(a, "vendor.archive")) throw new HttpError(403, "Only an administrator can blacklist a vendor", "FORBIDDEN");
  return status;
}

export async function setVendorStatus(actor: MaybeActor, id: string, statusValue: unknown, reason?: string) {
  const a = authorize(actor, "vendor.edit");
  const status = statusFor(a, statusValue);
  const v = await loadVendor(id);
  if (v.status === status) return { ...v, unchanged: true };
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.vendor.update({ where: { id: v.id }, data: { status }, select: { id: true, vendorCode: true, name: true, status: true } });
    await audit(tx, a, "vendor.status_changed", u, { from: v.status, to: status, ...(reason ? { reason: String(reason).slice(0, 500) } : {}) });
    return u;
  });
  return { ...updated, unchanged: false };
}

const MAX_BULK = 200;
function bulkIds(ids: unknown): string[] {
  const list = (Array.isArray(ids) ? ids : []).filter(isUuid);
  if (!list.length) throw badRequest("Select at least one vendor");
  if (list.length > MAX_BULK) throw badRequest(`Select at most ${MAX_BULK} vendors at a time`);
  return [...new Set(list)];
}

export async function bulkSetStatus(actor: MaybeActor, ids: unknown, statusValue: unknown) {
  const a = authorize(actor, "vendor.edit");
  const list = bulkIds(ids);
  const status = statusFor(a, statusValue);
  return prisma.$transaction(async (tx) => {
    const res = await tx.vendor.updateMany({ where: { id: { in: list }, status: { not: status } }, data: { status } });
    await audit(tx, a, "vendor.status_changed_bulk", null, { count: res.count, to: status, vendorIds: list.slice(0, 50) });
    return { updated: res.count };
  });
}

/* --------------------------------------------------------- archive/delete */
export async function archiveVendor(actor: MaybeActor, id: string, reason?: string) {
  const a = authorize(actor, "vendor.archive");
  const v = await loadVendor(id);
  if (v.archivedAt) return { ...v, unchanged: true };
  await prisma.$transaction(async (tx) => {
    await tx.vendor.update({ where: { id: v.id }, data: { archivedAt: new Date() } });
    await audit(tx, a, "vendor.archived", v, reason ? { reason: String(reason).slice(0, 500) } : {});
  });
  return { ...v, unchanged: false };
}

export async function restoreVendor(actor: MaybeActor, id: string) {
  const a = authorize(actor, "vendor.archive");
  const v = await loadVendor(id);
  if (!v.archivedAt) return { ...v, unchanged: true };
  await prisma.$transaction(async (tx) => {
    await tx.vendor.update({ where: { id: v.id }, data: { archivedAt: null } });
    await audit(tx, a, "vendor.restored", v);
  });
  return { ...v, unchanged: false };
}

export async function bulkArchive(actor: MaybeActor, ids: unknown, restore = false) {
  const a = authorize(actor, "vendor.archive");
  const list = bulkIds(ids);
  return prisma.$transaction(async (tx) => {
    const res = await tx.vendor.updateMany({
      where: { id: { in: list }, archivedAt: restore ? { not: null } : null },
      data: { archivedAt: restore ? null : new Date() },
    });
    await audit(tx, a, restore ? "vendor.restored_bulk" : "vendor.archived_bulk", null, { count: res.count, vendorIds: list.slice(0, 50) });
    return { updated: res.count };
  });
}

export async function deleteVendor(actor: MaybeActor, id: string, confirmCode: unknown) {
  const a = authorize(actor, "vendor.delete");
  const v = await loadVendor(id);
  if (!v.archivedAt) throw badRequest("Archive the vendor before deleting it permanently");
  if (String(confirmCode ?? "").trim().toUpperCase() !== v.vendorCode.toUpperCase()) {
    throw badRequest(`Type the vendor code ${v.vendorCode} to confirm permanent deletion`);
  }
  const docs = await prisma.vendorDocument.findMany({ where: { vendorId: v.id }, select: { storagePath: true } });
  await prisma.$transaction(async (tx) => {
    await tx.vendor.delete({ where: { id: v.id } }); // contacts, addresses, products, tiers, documents, activities, evaluations cascade
    await audit(tx, a, "vendor.deleted", v, { relatedRecordsRemoved: { documents: docs.length } });
  });
  const paths = docs.map((d) => d.storagePath).filter(Boolean);
  if (paths.length) await storage.remove(BUCKETS.vendorDocuments, paths).catch(() => undefined);
  return { deleted: true as const, vendorCode: v.vendorCode };
}

/* ----------------------------------------------------------------- audit */
export async function vendorAudit(actor: MaybeActor, id: string, query: { page?: unknown; limit?: unknown } = {}) {
  authorize(actor, "vendor.view");
  const vid = requireId(id);
  const { page, limit, skip } = pageParams(query);
  const where: Prisma.ActivityLogWhereInput = { AND: [{ details: { path: ["module"], equals: "vendor" } }, { details: { path: ["vendorId"], equals: vid } }] };
  const [entries, total] = await Promise.all([
    prisma.activityLog.findMany({ where, orderBy: { occurredAt: "desc" }, skip, take: limit, select: { id: true, action: true, actorName: true, actorRole: true, actorUserCode: true, details: true, occurredAt: true } }),
    prisma.activityLog.count({ where }),
  ]);
  return { entries: entries.map((e) => ({ ...e, details: scrub(e.details) })), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}
