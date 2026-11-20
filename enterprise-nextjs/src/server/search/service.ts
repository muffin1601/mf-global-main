import { Prisma } from "@/generated/prisma/client";
import { can, hasVendorPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma/client";
import { isAdmin, leadScope, type Actor } from "@/server/actor";

/**
 * Global search (command palette). Permission-aware: every entity applies the SAME scope as its own
 * list page, so search can never reveal a record the actor could not open:
 *   leads       leadScope(actor): admin sees all, USER only assignments with canView
 *   quotations  admin sees all, USER only quotations they own (quotations/service.ts listQuotations)
 *   products    products.view (any signed-in user, as /api/products/search); archived are excluded
 *   vendors     vendor.view; archived are excluded
 * Each group is capped and queried in parallel on the server; the browser never receives more than
 * `limit` rows per entity. Queries use the same case-insensitive `contains` semantics as the list
 * pages. Trigram indexes for these columns are proposed in docs/enterprise/IMPLEMENTATION_PLAN.md (M1).
 */

export type SearchEntity = "lead" | "quotation" | "product" | "vendor";
export type SearchHit = { type: SearchEntity; id: string; title: string; subtitle: string; href: string; badge?: string };
export type SearchGroup = { type: SearchEntity; label: string; hits: SearchHit[] };
export type SearchResult = { query: string; groups: SearchGroup[] };

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

const LABELS: Record<SearchEntity, string> = { lead: "Leads", quotation: "Quotations", product: "Products", vendor: "Vendors" };

/** Collapse whitespace and cap the length; returns "" for queries too short to search. */
export function normalizeQuery(raw: unknown): string {
  const q = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_LENGTH);
  return q.length >= SEARCH_MIN_LENGTH ? q : "";
}

/** Escape LIKE wildcards (and the escape character) so user input is matched literally. */
export const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);
/** Escaped `%term%` pattern for raw-SQL ILIKE. */
export const likePattern = (q: string) => `%${escapeLike(q)}%`;
/**
 * Prisma `contains` filter that matches literally. Prisma does NOT escape % and _ for PostgreSQL
 * (pinned by tests/search.global.test.ts); PostgreSQL's default LIKE escape character is backslash.
 */
const literalContains = (q: string) => ({ contains: escapeLike(q), mode: "insensitive" as const });

const join = (...parts: (string | null | undefined)[]) => parts.map((p) => p?.trim()).filter(Boolean).join(" · ");

async function searchLeads(actor: Actor, q: string, take: number): Promise<SearchHit[]> {
  const contains = literalContains(q);
  const rows = await prisma.lead.findMany({
    where: { AND: [leadScope(actor), { OR: [{ name: contains }, { company: contains }, { phone: contains }, { contact: contains }, { email: contains }] }] },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take,
    select: { id: true, name: true, company: true, phone: true, contact: true, email: true, status: true },
  });
  return rows.map((l) => ({
    type: "lead",
    id: l.id,
    title: l.name?.trim() || l.company?.trim() || l.phone || "Unnamed lead",
    subtitle: join(l.name?.trim() ? l.company : null, l.phone ?? l.contact, l.email),
    href: `/crm/lead-management/${l.id}`,
    badge: l.status,
  }));
}

async function searchQuotations(actor: Actor, q: string, take: number): Promise<SearchHit[]> {
  const pattern = likePattern(q);
  const owner = isAdmin(actor) ? Prisma.sql`TRUE` : Prisma.sql`q.user_id = ${actor.id}::uuid`;
  const rows = await prisma.$queryRaw<{ id: string; number: string; name: string | null; company: string | null; grand_total: Prisma.Decimal }[]>(Prisma.sql`
    SELECT q.id::text AS id,
           coalesce(q.invoice_details->>'prefix', '') || coalesce(q.invoice_details->>'number', '') AS number,
           q.party->>'name' AS name, q.party->>'company' AS company, q.grand_total
    FROM quotations q
    WHERE ${owner}
      AND (q.party->>'name' ILIKE ${pattern}
        OR q.party->>'company' ILIKE ${pattern}
        OR q.party->>'phone' ILIKE ${pattern}
        OR coalesce(q.invoice_details->>'prefix', '') || coalesce(q.invoice_details->>'number', '') ILIKE ${pattern})
    ORDER BY q.created_at DESC, q.id
    LIMIT ${take}`);
  const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  return rows.map((r) => ({
    type: "quotation",
    id: r.id,
    title: r.number || "Quotation",
    subtitle: join(r.name, r.company, inr.format(Number(r.grand_total))),
    href: `/crm/quotations/${r.id}/edit`,
  }));
}

async function searchProducts(q: string, take: number): Promise<SearchHit[]> {
  const contains = literalContains(q);
  const rows = await prisma.product.findMany({
    where: { status: { not: "ARCHIVED" }, OR: [{ code: contains }, { name: contains }, { secondaryCode: contains }, { hsnCode: contains }] },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take,
    select: { id: true, code: true, name: true, type: true, color: true, status: true, category: { select: { name: true } } },
  });
  return rows.map((p) => ({
    type: "product",
    id: p.id,
    title: p.name?.trim() || p.code || "Product",
    subtitle: join(p.code, p.category?.name, p.type, p.color),
    href: `/crm/product-management?query=${encodeURIComponent(p.code || p.name || "")}`,
    badge: p.status === "INACTIVE" ? "Inactive" : undefined,
  }));
}

async function searchVendors(q: string, take: number): Promise<SearchHit[]> {
  const contains = literalContains(q);
  const rows = await prisma.vendor.findMany({
    where: { archivedAt: null, status: { not: "ARCHIVED" }, OR: [{ name: contains }, { legalName: contains }, { vendorCode: contains }, { email: contains }, { phone: { contains: escapeLike(q) } }, { gstin: contains }] },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take,
    select: { id: true, vendorCode: true, name: true, status: true, email: true, phone: true },
  });
  return rows.map((v) => ({
    type: "vendor",
    id: v.id,
    title: v.name,
    subtitle: join(v.vendorCode, v.phone, v.email),
    href: `/crm/vendors/${v.id}`,
    badge: v.status.charAt(0) + v.status.slice(1).toLowerCase(),
  }));
}

export async function globalSearch(actor: Actor, rawQuery: unknown, options: { limit?: number } = {}): Promise<SearchResult> {
  const q = normalizeQuery(rawQuery);
  if (!q) return { query: "", groups: [] };
  const take = Math.min(Math.max(Math.trunc(options.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const jobs: Promise<SearchHit[]>[] = [];
  const order: SearchEntity[] = [];
  const add = (type: SearchEntity, run: () => Promise<SearchHit[]>) => { order.push(type); jobs.push(run()); };
  if (can(actor.role, "leads.view_own") || can(actor.role, "leads.view_all")) add("lead", () => searchLeads(actor, q, take));
  if (can(actor.role, "quotations.create") || can(actor.role, "quotations.view_all")) add("quotation", () => searchQuotations(actor, q, take));
  if (can(actor.role, "products.view")) add("product", () => searchProducts(q, take));
  if (hasVendorPermission(actor.role, "vendor.view")) add("vendor", () => searchVendors(q, take));

  const results = await Promise.all(jobs);
  const groups = order.map((type, i) => ({ type, label: LABELS[type], hits: results[i] ?? [] })).filter((g) => g.hits.length > 0);
  return { query: q, groups };
}
