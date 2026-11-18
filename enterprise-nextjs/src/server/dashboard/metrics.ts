import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { WON_STATUS, TRENDING_STATUS } from "@/lib/crm/constants";
import { istToday, istDayStart, istDayEndExclusive, istDateString } from "@/lib/time/ist";
import { isAdmin, leadScope, type Actor } from "@/server/actor";
import { lastNDaysIst, type DateWindow } from "./range";

const LOST_STATUS = "Lost Lead";
const and = (...w: Prisma.LeadWhereInput[]): Prisma.LeadWhereInput => ({ AND: w });
const scopeOf = (actor: Actor) => leadScope(actor) as Prisma.LeadWhereInput;

export type Kpis = {
  total: number; newToday: number; assigned: number; unassigned: number;
  converted: number; trending: number; lost: number; conversionRate: number;
  followUpsToday: number; upcoming: number; overdue: number;
};

/** Percent with 2 dp (MERN: ((won/total)*100).toFixed(2)); 0 when there are no leads. */
export const conversionRate = (won: number, total: number) => (total > 0 ? Math.round((won / total) * 10000) / 100 : 0);

/** All KPIs. Admin = every lead; user = leads assigned to them (leadScope). `now` is injectable for IST boundary tests. */
export async function getKpis(actor: Actor, now: Date = new Date()): Promise<Kpis> {
  const scope = scopeOf(actor);
  const today = istToday(now);
  const w = (extra: Prisma.LeadWhereInput = {}) => and(scope, extra);
  const [total, newToday, assigned, unassigned, converted, trending, lost, followUpsToday, upcoming, overdue] = await Promise.all([
    prisma.lead.count({ where: w() }),
    prisma.lead.count({ where: w({ createdAt: { gte: today.gte, lt: today.lt } }) }),
    prisma.lead.count({ where: w({ assignments: { some: {} } }) }),
    prisma.lead.count({ where: w({ assignments: { none: {} } }) }),
    prisma.lead.count({ where: w({ status: WON_STATUS }) }),
    prisma.lead.count({ where: w({ status: TRENDING_STATUS }) }),
    prisma.lead.count({ where: w({ status: LOST_STATUS }) }),
    prisma.lead.count({ where: w({ followUpDate: { gte: today.gte, lt: today.lt } }) }),
    prisma.lead.count({ where: w({ followUpDate: { gte: today.lt } }) }),
    prisma.lead.count({ where: w({ followUpDate: { lt: today.gte }, status: { notIn: [WON_STATUS, LOST_STATUS] } }) }),
  ]);
  return { total, newToday, assigned, unassigned, converted, trending, lost, conversionRate: conversionRate(converted, total), followUpsToday, upcoming, overdue };
}

export type PerformanceRow = { userId: string; name: string; leads: number; deals: number; closePct: number };

/**
 * Per-assignee performance. The window filters on lead.createdAt (IST window). Admin sees
 * every assignee, a user only themself. Only canView assignments count (same as leadScope).
 */
export async function getPerformance(actor: Actor, window: DateWindow = {}): Promise<PerformanceRow[]> {
  const createdAt = window.gte || window.lt ? { ...(window.gte ? { gte: window.gte } : {}), ...(window.lt ? { lt: window.lt } : {}) } : undefined;
  const base: Prisma.LeadAssignmentWhereInput = {
    canView: true,
    ...(isAdmin(actor) ? {} : { userId: actor.id }),
    ...(createdAt ? { lead: { createdAt } } : {}),
  };
  const won: Prisma.LeadAssignmentWhereInput = { ...base, lead: { ...(createdAt ? { createdAt } : {}), status: WON_STATUS } };
  const [all, wins] = await Promise.all([
    prisma.leadAssignment.groupBy({ by: ["userId"], where: base, _count: { _all: true } }),
    prisma.leadAssignment.groupBy({ by: ["userId"], where: won, _count: { _all: true } }),
  ]);
  const winMap = new Map(wins.map((r) => [r.userId, r._count._all]));
  const users = await prisma.user.findMany({ where: { id: { in: all.map((r) => r.userId) } }, select: { id: true, name: true } });
  const names = new Map(users.map((u) => [u.id, u.name]));
  return all
    .map((r) => {
      const leads = r._count._all;
      const deals = winMap.get(r.userId) ?? 0;
      return { userId: r.userId, name: names.get(r.userId) ?? "Unknown", leads, deals, closePct: conversionRate(deals, leads) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getStatusBreakdown(actor: Actor) {
  const rows = await prisma.lead.groupBy({ by: ["status"], where: scopeOf(actor), _count: { _all: true } });
  return rows.map((r) => ({ status: r.status, count: r._count._all })).sort((a, b) => b.count - a.count);
}

/** Leads created per IST day over the last `days` days (zero-filled). */
export async function getLeadsPerDay(actor: Actor, days = 30, now: Date = new Date()) {
  const { start, end, days: list } = lastNDaysIst(days, now);
  const rows = await prisma.lead.findMany({
    where: and(scopeOf(actor), { createdAt: { gte: istDayStart(start), lt: istDayEndExclusive(end) } }),
    select: { createdAt: true },
  });
  const counts = new Map<string, number>(list.map((d) => [d, 0]));
  for (const r of rows) {
    const d = istDateString(r.createdAt);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return list.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

export async function getRecentLeads(actor: Actor, take = 8) {
  return prisma.lead.findMany({
    where: scopeOf(actor), orderBy: { createdAt: "desc" }, take,
    select: { id: true, name: true, company: true, status: true, callStatus: true, createdAt: true },
  });
}
