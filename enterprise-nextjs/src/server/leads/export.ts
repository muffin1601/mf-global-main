import { prisma } from "@/lib/prisma/client";
import { toCsv, toXlsx, type Column } from "@/lib/export/tabular";
import { istDateString } from "@/lib/time/ist";
import type { Actor } from "@/server/actor";
import { badRequest } from "@/server/errors";
import { recordAudit } from "@/server/audit/log";
import { EXPORT_ROW_CAP, type LeadFilter, type LeadPreset } from "./filter-schema";
import { buildLeadWhere, leadOrderBy } from "./where";
import type { Prisma } from "@/generated/prisma/client";

const exportInclude = { assignments: { include: { user: { select: { name: true } } } } } satisfies Prisma.LeadInclude;
type ExportLead = Prisma.LeadGetPayload<{ include: typeof exportInclude }>;

/** IST wall-clock, e.g. "2026-03-07 09:15" (MERN formatDate). */
const ist = (d: Date | null) => (d ? `${istDateString(d)} ${new Date(d.getTime() + 330 * 60_000).toISOString().slice(11, 16)}` : "");
const addressText = (v: unknown) => {
  if (!v || typeof v !== "object") return "";
  const o = v as Record<string, unknown>;
  return ["street", "city", "state", "postalCode", "country"].map((k) => (typeof o[k] === "string" ? o[k] : "")).filter(Boolean).join(", ");
};

// Columns follow clientwork.js:216 (plus callStatus, quantity and source).
export const LEAD_EXPORT_COLUMNS: Column<ExportLead>[] = [
  { key: "name", header: "name", value: (l) => l.name ?? "" },
  { key: "company", header: "company", value: (l) => l.company ?? "" },
  { key: "phone", header: "phone", value: (l) => l.phone ?? "" },
  { key: "contact", header: "contact", value: (l) => l.contact ?? "" },
  { key: "email", header: "email", value: (l) => l.email ?? "" },
  { key: "category", header: "category", value: (l) => l.category ?? "" },
  { key: "datatype", header: "datatype", value: (l) => l.dataType ?? "" },
  { key: "location", header: "location", value: (l) => l.location ?? "" },
  { key: "state", header: "state", value: (l) => l.state ?? "" },
  { key: "address", header: "address", value: (l) => l.address ?? "" },
  { key: "status", header: "status", value: (l) => l.status },
  { key: "callStatus", header: "callStatus", value: (l) => l.callStatus },
  { key: "remarks", header: "remarks", value: (l) => l.remarks ?? "" },
  { key: "followUpDate", header: "followUpDate", value: (l) => ist(l.followUpDate) },
  { key: "followUpDateOne", header: "followUpDateOne", value: (l) => ist(l.followUpDateOne) },
  { key: "followUpDateTwo", header: "followUpDateTwo", value: (l) => ist(l.followUpDateTwo) },
  { key: "followUpDateThree", header: "followUpDateThree", value: (l) => ist(l.followUpDateThree) },
  { key: "createdAt", header: "createdAt", value: (l) => ist(l.createdAt) },
  { key: "callingdate", header: "callingdate", value: (l) => ist(l.callingDate) },
  { key: "billingAddress", header: "billingAddress", value: (l) => addressText(l.billingAddress) },
  { key: "assignedTo", header: "assignedTo", value: (l) => l.assignments.map((a) => a.user.name).join(", ") },
  { key: "source", header: "source", value: (l) => l.source },
];

export type LeadExportInput = {
  format: "csv" | "xlsx";
  filter?: LeadFilter;
  preset?: LeadPreset;
  now?: Date;
};

/**
 * Executes the export as a database query using the SAME filter object and the caller's scope as the list.
 * Never accepts client-supplied id lists. Capped at EXPORT_ROW_CAP rows.
 */
export async function exportLeads(actor: Actor, input: LeadExportInput): Promise<{ filename: string; body: string | Buffer; contentType: "csv" | "xlsx"; rows: number; truncated: boolean }> {
  if (input.format !== "csv" && input.format !== "xlsx") throw badRequest("Unsupported export format.");
  const filter = { ...(input.filter ?? {}) };
  if ((filter.from || filter.to) && !filter.dateType) filter.dateType = "createdAt";
  const where = buildLeadWhere(actor, filter, input.preset ?? "all", input.now);
  const rows = await prisma.lead.findMany({ where, orderBy: leadOrderBy(input.preset ?? "all"), take: EXPORT_ROW_CAP + 1, include: exportInclude });
  const truncated = rows.length > EXPORT_ROW_CAP;
  if (truncated) rows.pop();
  const stamp = istDateString(input.now ?? new Date());
  const filename = `leads-${stamp}.${input.format}`;
  const body = input.format === "csv" ? toCsv(LEAD_EXPORT_COLUMNS, rows) : await toXlsx("Leads", LEAD_EXPORT_COLUMNS, rows);
  // Data exports are audited (Enterprise CRM 2.0 §19): who, what scope/filters, how many rows. Never the rows.
  await recordAudit(actor, "lead.exported", { format: input.format, rows: rows.length, truncated, preset: input.preset ?? "all", filter });
  return { filename, body, contentType: input.format, rows: rows.length, truncated };
}
