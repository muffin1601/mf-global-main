import type { Prisma } from "@/generated/prisma/client";
import { TRENDING_STATUS, WON_STATUS } from "@/lib/crm/constants";
import { addDaysIst, istDayStart, todayIst } from "@/lib/time/ist";
import { forbidden } from "@/server/errors";
import { isAdmin, type Actor } from "@/server/actor";
import type { LeadPreset } from "./filter-schema";

export const PRESET_META: Record<LeadPreset, { title: string; eyebrow: string; adminOnly: boolean; followUpOrder?: boolean }> = {
  all: { title: "Lead management", eyebrow: "Pipeline", adminOnly: false },
  unassigned: { title: "Unassigned leads", eyebrow: "Pipeline", adminOnly: true },
  assigned: { title: "Assigned leads", eyebrow: "Pipeline", adminOnly: true },
  new: { title: "New leads (last 24 hours)", eyebrow: "Pipeline", adminOnly: true },
  trending: { title: "Trending leads", eyebrow: "Pipeline", adminOnly: true },
  won: { title: "Won leads", eyebrow: "Pipeline", adminOnly: true },
  mine: { title: "My leads", eyebrow: "Workspace", adminOnly: false },
  myTrending: { title: "My trending leads", eyebrow: "Workspace", adminOnly: false },
  conversions: { title: "My conversions", eyebrow: "Workspace", adminOnly: false },
  today: { title: "Today's follow-ups", eyebrow: "Workspace", adminOnly: false, followUpOrder: true },
  upcoming: { title: "Upcoming follow-ups", eyebrow: "Workspace", adminOnly: false, followUpOrder: true },
};

/**
 * The preset's own constraint, ANDed with the caller's scope and filters.
 * "today"/"upcoming" use Asia/Kolkata days (server runs UTC); upcoming is
 * `>=` start of tomorrow IST (MERN mixed $gte and $gt; $gte is the correct one).
 */
export function presetWhere(preset: LeadPreset, actor: Actor, now: Date = new Date()): Prisma.LeadWhereInput {
  if (PRESET_META[preset].adminOnly && !isAdmin(actor)) throw forbidden("Administrator access required.");
  const mine: Prisma.LeadWhereInput = { assignments: { some: { userId: actor.id } } };
  const today = todayIst(now);
  const tomorrowStart = istDayStart(addDaysIst(today, 1));
  switch (preset) {
    case "all": return {};
    case "unassigned": return { assignments: { none: {} } };
    case "assigned": return { assignments: { some: {} } };
    case "new": return { createdAt: { gte: new Date(now.getTime() - 24 * 3_600_000) } };
    case "trending": return { status: TRENDING_STATUS };
    case "won": return { status: WON_STATUS };
    case "mine": return mine;
    case "myTrending": return { AND: [mine, { status: TRENDING_STATUS }] };
    case "conversions": return { AND: [mine, { status: WON_STATUS }] };
    case "today": return { AND: [mine, { followUpDate: { gte: istDayStart(today), lt: tomorrowStart } }] };
    case "upcoming": return { AND: [mine, { followUpDate: { gte: tomorrowStart } }] };
  }
}
