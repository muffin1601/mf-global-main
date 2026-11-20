import type { Prisma } from "@/generated/prisma/client";
import { escapeLike } from "@/lib/db/like";
import { istRange } from "@/lib/time/ist";
import { leadScope, type Actor } from "@/server/actor";
import { badRequest } from "@/server/errors";
import type { LeadFilter, LeadPreset, LeadSort } from "./filter-schema";
import { PRESET_META, presetWhere } from "./presets";

type TextField = "category" | "location" | "state" | "dataType" | "fileName" | "status" | "callStatus" | "priority";

/** Case-insensitive equality on any of the values; "" matches NULL or empty. */
function fieldClause(field: TextField, values: string[]): Prisma.LeadWhereInput {
  const ors: Prisma.LeadWhereInput[] = [];
  for (const v of values.filter((x) => x !== "")) ors.push({ [field]: { equals: v, mode: "insensitive" } });
  if (values.includes("")) ors.push({ [field]: null }, { [field]: "" });
  return ors.length === 1 ? (ors[0] ?? {}) : { OR: ors };
}

/** Filter-only clause (no scope, no preset). */
export function filterWhere(f: LeadFilter): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [];
  if (f.q) {
    const contains = { contains: escapeLike(f.q), mode: "insensitive" as const };
    and.push({ OR: [{ name: contains }, { company: contains }, { phone: contains }, { contact: contains }, { email: contains }] });
  }
  for (const key of ["category", "location", "state", "dataType", "fileName", "status", "callStatus", "priority"] as const) {
    const vals = f[key];
    if (vals?.length) and.push(fieldClause(key, vals));
  }
  if (f.tag?.length) and.push({ tags: { hasSome: f.tag } });
  if (f.assigned === "assigned") and.push({ assignments: { some: {} } });
  if (f.assigned === "unassigned") and.push({ assignments: { none: {} } });
  if (f.assignedTo?.length) and.push({ assignments: { some: { userId: { in: f.assignedTo } } } });
  if (f.from || f.to) {
    const field = f.dateType ?? "createdAt";
    if (f.from && f.to && f.from > f.to) throw badRequest("The start date must not be after the end date.");
    const range: { gte?: Date; lt?: Date } = {};
    if (f.from) range.gte = istRange(f.from, f.from).gte;
    if (f.to) range.lt = istRange(f.to, f.to).lt;
    and.push({ [field]: range });
  }
  return and.length ? { AND: and } : {};
}

/** Scope (what the actor may see) AND preset AND filters. The only place a lead query is assembled. */
export function buildLeadWhere(actor: Actor, filter: LeadFilter, preset: LeadPreset = "all", now: Date = new Date()): Prisma.LeadWhereInput {
  return { AND: [leadScope(actor), presetWhere(preset, actor, now), filterWhere(filter)] };
}

const NULLABLE_SORT = new Set(["followUpDate", "lastActivityAt", "name", "company", "location"]);

/** Explicit multi-column sort when given (nulls last), else the preset default. Always ends with id for stable paging. */
export function leadOrderBy(preset: LeadPreset, sort?: LeadSort[]): Prisma.LeadOrderByWithRelationInput[] {
  if (sort?.length) {
    return [
      ...sort.map((s) => (NULLABLE_SORT.has(s.field) ? { [s.field]: { sort: s.dir, nulls: "last" } } : { [s.field]: s.dir }) as Prisma.LeadOrderByWithRelationInput),
      { id: "asc" },
    ];
  }
  return PRESET_META[preset].followUpOrder ? [{ followUpDate: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "asc" }];
}
