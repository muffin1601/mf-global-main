import { z } from "zod";
import { addDaysIst, isDateString, istMonthStart, istWeekStart, todayIst } from "@/lib/time/ist";
import { badRequest } from "@/server/errors";

export const SOURCES = ["MANUAL", "IMPORT", "INDIAMART", "TRADEINDIA", "COACHINGPROMO", "PRINTKEE", "WEBHOOK", "LEGACY"] as const;
export type SourceKey = (typeof SOURCES)[number];
export const SOURCE_LABELS: Record<SourceKey, string> = {
  MANUAL: "Manual", IMPORT: "Import (file)", INDIAMART: "IndiaMART", TRADEINDIA: "TradeIndia",
  COACHINGPROMO: "Coachingpromo", PRINTKEE: "Printkee", WEBHOOK: "Webhook", LEGACY: "Legacy",
};
/** Pseudo source filter: every lead that is not entered manually. */
export const ANY_IMPORTED = "IMPORTED";
export const UNASSIGNED = "unassigned";
export const UNKNOWN_STATUS = "Unknown (legacy)";
export const PRESETS = ["today", "yesterday", "week", "month", "custom"] as const;
export const GROUPINGS = ["day", "week", "month"] as const;
export const MAX_PAGE_SIZE = 200;
export const DEFAULT_PAGE_SIZE = 50;

const optText = z.string().trim().max(200).optional().transform((v) => (v ? v : undefined));

export const filterSchema = z.object({
  preset: z.enum(PRESETS).default("month"),
  from: z.string().optional(),
  to: z.string().optional(),
  grouping: z.enum(GROUPINGS).default("day"),
  employee: optText, // user uuid or "unassigned"
  source: z.enum([...SOURCES, ANY_IMPORTED]).optional().or(z.literal("").transform(() => undefined)),
  status: optText,
  initialStatus: optText, // UNKNOWN_STATUS matches legacy null
  assignment: z.enum(["assigned", "unassigned"]).optional().or(z.literal("").transform(() => undefined)),
  fileName: optText,
  importJobId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  dataType: optText,
});
export type ReportFilters = z.input<typeof filterSchema>;
export type ParsedFilters = z.output<typeof filterSchema>;

export function parseFilters(input: Record<string, string | string[] | undefined> | URLSearchParams): ParsedFilters {
  const raw: Record<string, string | undefined> = {};
  const get = (k: string) => (input instanceof URLSearchParams ? input.get(k) : Array.isArray(input[k]) ? (input[k] as string[])[0] : (input[k] as string | undefined));
  for (const key of Object.keys(filterSchema.shape)) {
    const v = get(key);
    if (v !== null && v !== undefined && v !== "") raw[key] = v;
  }
  const parsed = filterSchema.safeParse(raw);
  if (!parsed.success) throw badRequest(`Invalid filter: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  return parsed.data;
}

/** Resolve the preset to an inclusive IST date range. */
export function resolveRange(f: ParsedFilters, now: Date = new Date()): { from: string; to: string } {
  const today = todayIst(now);
  switch (f.preset) {
    case "today": return { from: today, to: today };
    case "yesterday": { const y = addDaysIst(today, -1); return { from: y, to: y }; }
    case "week": return { from: istWeekStart(today), to: today };
    case "month": return { from: istMonthStart(today), to: today };
    case "custom": {
      if (!isDateString(f.from) || !isDateString(f.to)) throw badRequest("Custom range needs valid from and to dates (YYYY-MM-DD).");
      if (f.from > f.to) throw badRequest("The from date must not be after the to date.");
      return { from: f.from, to: f.to };
    }
  }
}
