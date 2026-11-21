import type { Prisma } from "@/generated/prisma/client";
import { escapeLike } from "@/lib/db/like";
import { prisma } from "@/lib/prisma/client";
import { leadScope, type Actor } from "@/server/actor";

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// MERN QuotationCreate.formatAddress
function formatAddress(a: unknown) {
  if (typeof a === "string") return a;
  const o = obj(a);
  if (!Object.keys(o).length) return "";
  return [o.street, o.city, o.state, o.postalCode, o.country].map((p) => s(p)).join(", ");
}

/** Build the quotation `party` exactly as MERN's handleAddParty did from a client record. */
export function partyFromLead(lead: { name: string | null; company: string | null; phone: string | null; contact: string | null; state: string | null; address?: string | null; billingAddress: unknown; shippingAddress: unknown }, pan = "") {
  const billing = obj(lead.billingAddress);
  const billAddress = formatAddress(lead.billingAddress) || s(lead.address);
  const state = s(billing.state) || s(lead.state) || "Uttar Pradesh";
  const shippingAddresses = [{ name: "Billing Address", address: billAddress, state }];
  if (lead.shippingAddress && Object.keys(obj(lead.shippingAddress)).length) {
    shippingAddresses.push({ name: "Shipping Address", address: formatAddress(lead.shippingAddress), state: s(obj(lead.shippingAddress).state) || state });
  }
  return {
    name: lead.name || lead.company || lead.contact || "Unnamed Contact",
    company: lead.company || "Unnamed Company",
    phone: lead.phone || lead.contact || "—",
    billToAddress: billAddress, state, pan, shippingAddresses, selectedShippingAddress: shippingAddresses[0],
  };
}

/** Server-side client picker: leads the actor may see (admin all, user assigned). */
export async function searchQuotationClients(actor: Actor, params: { q?: string; page?: number; limit?: number } = {}) {
  const limit = Math.min(Math.max(Math.floor(params.limit ?? 10) || 10, 1), 50);
  const page = Math.max(Math.floor(params.page ?? 1) || 1, 1);
  const q = (params.q ?? "").trim().slice(0, 100);
  const where: Prisma.LeadWhereInput = {
    ...leadScope(actor),
    ...(q ? { OR: (["name", "company", "phone", "contact"] as const).map((f) => ({ [f]: { contains: escapeLike(q), mode: "insensitive" as const } })) } : {}),
  };
  const [total, rows, settings] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * limit, take: limit,
      select: { id: true, name: true, company: true, phone: true, contact: true, state: true, address: true, billingAddress: true, shippingAddress: true },
    }),
    prisma.companySettings.findFirst({ select: { pan: true } }),
  ]);
  const data = rows.map((l) => ({
    id: l.id, name: l.name, company: l.company, phone: l.phone, contact: l.contact, state: l.state,
    billingAddress: l.billingAddress, shippingAddress: l.shippingAddress, party: partyFromLead(l, settings?.pan ?? ""),
  }));
  return { data, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}
