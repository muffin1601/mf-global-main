import { addDaysIst, isDateString, istDayEndExclusive, istDayStart, istMonthStart, istWeekStart, todayIst } from "@/lib/time/ist";
import { badRequest } from "@/server/errors";

export const PERFORMANCE_RANGES = ["today", "week", "month", "all", "custom"] as const;
export type PerformanceRange = (typeof PERFORMANCE_RANGES)[number];
export type DateWindow = { gte?: Date; lt?: Date };

/** Resolve a dashboard date preset (IST) to a half-open UTC window. `all` has no bounds. */
export function resolveRange(range: PerformanceRange, from?: string, to?: string, now: Date = new Date()): DateWindow {
  const today = todayIst(now);
  switch (range) {
    case "today":
      return { gte: istDayStart(today), lt: istDayEndExclusive(today) };
    case "week":
      return { gte: istDayStart(istWeekStart(today)), lt: istDayEndExclusive(today) };
    case "month":
      return { gte: istDayStart(istMonthStart(today)), lt: istDayEndExclusive(today) };
    case "all":
      return {};
    case "custom": {
      if (from && !isDateString(from)) throw badRequest("Invalid from date.");
      if (to && !isDateString(to)) throw badRequest("Invalid to date.");
      if (from && to && from > to) throw badRequest("From date must not be after To date.");
      return { ...(from ? { gte: istDayStart(from) } : {}), ...(to ? { lt: istDayEndExclusive(to) } : {}) };
    }
  }
}

export const parseRange = (value: unknown): PerformanceRange =>
  (PERFORMANCE_RANGES as readonly string[]).includes(value as string) ? (value as PerformanceRange) : "all";

export function lastNDaysIst(n: number, now: Date = new Date()) {
  const end = todayIst(now);
  const start = addDaysIst(end, -(n - 1));
  return { start, end, days: Array.from({ length: n }, (_, i) => addDaysIst(start, i)) };
}
