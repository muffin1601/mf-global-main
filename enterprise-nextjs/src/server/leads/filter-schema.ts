// Pure (client-safe) lead filter model shared by the list, the exports and the UI.
export const PAGE_SIZES = [25, 50, 100, 200] as const;
export const EXPORT_ROW_CAP = 50_000;

export const LEAD_PRESETS = ["all", "unassigned", "assigned", "new", "trending", "won", "mine", "myTrending", "conversions", "today", "upcoming"] as const;
export type LeadPreset = (typeof LEAD_PRESETS)[number];
export const isLeadPreset = (v: unknown): v is LeadPreset => typeof v === "string" && (LEAD_PRESETS as readonly string[]).includes(v);

export type LeadDateType = "createdAt" | "followUpDate";

/**
 * Server-side sort keys for lead lists (multi-column: up to 3, applied in order, id as final tiebreak).
 * Priority is deliberately not sortable: it is stored as text, so the order would be High, Low, Medium.
 */
export const LEAD_SORT_FIELDS = ["createdAt", "updatedAt", "followUpDate", "lastActivityAt", "name", "company", "status", "callStatus", "location"] as const;
export type LeadSortField = (typeof LEAD_SORT_FIELDS)[number];
export type LeadSort = { field: LeadSortField; dir: "asc" | "desc" };
export const MAX_SORT_KEYS = 3;

/** The single typed filter object. Multi-value fields: "" means blank/missing. */
export type LeadFilter = {
  q?: string;
  category?: string[];
  location?: string[];
  state?: string[];
  dataType?: string[];
  fileName?: string[];
  status?: string[];
  callStatus?: string[];
  /** Low | Medium | High; "" = not set. */
  priority?: string[];
  /** Any of these tags. */
  tag?: string[];
  assigned?: "assigned" | "unassigned";
  /** User ids (any of). */
  assignedTo?: string[];
  dateType?: LeadDateType;
  /** Inclusive IST dates, YYYY-MM-DD. */
  from?: string;
  to?: string;
  /** Explicit sort; absent = the preset's default order. */
  sort?: LeadSort[];
};

export const MULTI_FIELDS = ["category", "location", "state", "dataType", "fileName", "status", "callStatus", "priority", "tag", "assignedTo"] as const;

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;
function getAll(src: ParamSource, key: string): string[] {
  if (src instanceof URLSearchParams) return src.getAll(key);
  const v = src[key];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseLeadFilter(src: ParamSource): LeadFilter {
  const f: LeadFilter = {};
  const q = getAll(src, "q")[0]?.trim();
  if (q) f.q = q.slice(0, 200);
  for (const key of MULTI_FIELDS) {
    const vals = getAll(src, key).map((v) => v.trim()).slice(0, 200);
    if (vals.length) f[key] = [...new Set(vals)];
  }
  const assigned = getAll(src, "assigned")[0];
  if (assigned === "assigned" || assigned === "unassigned") f.assigned = assigned;
  const dateType = getAll(src, "dateType")[0];
  if (dateType === "createdAt" || dateType === "followUpDate") f.dateType = dateType;
  const from = getAll(src, "from")[0], to = getAll(src, "to")[0];
  if (from && DATE_RE.test(from)) f.from = from;
  if (to && DATE_RE.test(to)) f.to = to;
  const sort = parseSort(getAll(src, "sort"));
  if (sort.length) f.sort = sort;
  return f;
}

/** "field:dir" tokens -> validated sort keys (unknown fields dropped, duplicates ignored, max 3). */
export function parseSort(tokens: string[]): LeadSort[] {
  const out: LeadSort[] = [];
  for (const token of tokens.flatMap((t) => t.split(","))) {
    const [field, dir] = token.trim().split(":");
    if (!(LEAD_SORT_FIELDS as readonly string[]).includes(field ?? "") || out.some((s) => s.field === field)) continue;
    out.push({ field: field as LeadSortField, dir: dir === "asc" ? "asc" : "desc" });
    if (out.length === MAX_SORT_KEYS) break;
  }
  return out;
}

export function filterToParams(f: LeadFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  for (const key of MULTI_FIELDS) for (const v of f[key] ?? []) p.append(key, v);
  if (f.assigned) p.set("assigned", f.assigned);
  if (f.dateType) p.set("dateType", f.dateType);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  for (const s of f.sort ?? []) p.append("sort", `${s.field}:${s.dir}`);
  return p;
}

export const activeFilterCount = (f: LeadFilter) =>
  MULTI_FIELDS.reduce((n, k) => n + ((f[k]?.length ?? 0) > 0 ? 1 : 0), 0) + (f.assigned ? 1 : 0);

/**
 * MERN 3-slot follow-up rotation (client.js:161): fill slot 1, 2, 3 in order,
 * then overwrite the slot holding the OLDEST date. `followUpDate` always mirrors the newest entry.
 */
export function rotateFollowUp(
  slots: { followUpDateOne: Date | null; followUpDateTwo: Date | null; followUpDateThree: Date | null },
  next: Date,
): { followUpDate: Date; followUpDateOne?: Date; followUpDateTwo?: Date; followUpDateThree?: Date } {
  if (!slots.followUpDateOne) return { followUpDate: next, followUpDateOne: next };
  if (!slots.followUpDateTwo) return { followUpDate: next, followUpDateTwo: next };
  if (!slots.followUpDateThree) return { followUpDate: next, followUpDateThree: next };
  const a = slots.followUpDateOne.getTime(), b = slots.followUpDateTwo.getTime(), c = slots.followUpDateThree.getTime();
  const oldest = Math.min(a, b, c);
  if (a === oldest) return { followUpDate: next, followUpDateOne: next };
  if (b === oldest) return { followUpDate: next, followUpDateTwo: next };
  return { followUpDate: next, followUpDateThree: next };
}
