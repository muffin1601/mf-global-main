// Business dates are Asia/Kolkata (UTC+05:30, no DST). Storage is always UTC.
// All "today / yesterday / this week" logic MUST go through these helpers: a
// serverless runtime (Vercel) runs in UTC, so `new Date().setHours(0)` is wrong.
export const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isDateString = (value: unknown): value is string =>
  typeof value === "string" && DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** YYYY-MM-DD of the IST calendar day containing `instant`. */
export function istDateString(instant: Date): string {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export const todayIst = (now: Date = new Date()) => istDateString(now);

/** UTC instant of 00:00:00 IST on the given IST date. */
export function istDayStart(date: string): Date {
  if (!isDateString(date)) throw new RangeError(`Invalid IST date: ${date}`);
  return new Date(Date.parse(`${date}T00:00:00Z`) - IST_OFFSET_MS);
}

/** Exclusive end: 00:00:00 IST of the following day. */
export const istDayEndExclusive = (date: string): Date => new Date(istDayStart(date).getTime() + DAY_MS);

export function addDaysIst(date: string, days: number): string {
  return istDateString(new Date(istDayStart(date).getTime() + days * DAY_MS + 1));
}

/** Inclusive IST date range -> half-open UTC range suitable for `{ gte, lt }`. */
export function istRange(from: string, to: string): { gte: Date; lt: Date } {
  return { gte: istDayStart(from), lt: istDayEndExclusive(to) };
}

/** Monday (ISO week start) of the IST week containing `date`. */
export function istWeekStart(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDaysIst(date, -((dow + 6) % 7));
}

export const istMonthStart = (date: string) => `${date.slice(0, 7)}-01`;

export function istToday(now: Date = new Date()) {
  const date = todayIst(now);
  return { date, gte: istDayStart(date), lt: istDayEndExclusive(date) };
}
