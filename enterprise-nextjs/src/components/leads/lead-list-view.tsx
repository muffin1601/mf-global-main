import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import type { Actor } from "@/server/actor";
import { parseLeadFilter, type LeadPreset } from "@/server/leads/filter-schema";
import { PRESET_META } from "@/server/leads/presets";
import { getFilterMeta, listLeads, type MetaScope } from "@/server/leads/queries";
import { todayIst } from "@/lib/time/ist";
import { LeadsClient } from "./leads-client";

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The ONE list page behind every lead route; presets only change the constraint, title and ordering. */
export async function LeadListView({ preset, searchParams }: { preset: LeadPreset; searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const meta = PRESET_META[preset];
  if (meta.adminOnly && user.role !== "ADMIN") redirect("/crm/entrydashboard?error=forbidden");
  const actor: Actor = { id: user.id, role: user.role, name: user.name, userId: user.userId, email: user.email };
  const sp = await searchParams;
  const filter = parseLeadFilter(sp);
  const page = Number.parseInt(first(sp.page) ?? "1", 10) || 1;
  const pageSize = Number.parseInt(first(sp.pageSize) ?? "25", 10) || 25;
  const own = ["mine", "myTrending", "conversions", "today", "upcoming"].includes(preset);
  const metaScope: MetaScope = preset === "unassigned" ? { scope: "unassigned" } : own ? { scope: "assigned", userId: user.id } : { scope: "all" };
  const isAdmin = user.role === "ADMIN";

  const [result, filterMeta, users] = await Promise.all([
    listLeads(actor, { filter, preset, page, pageSize }),
    getFilterMeta(actor, metaScope),
    isAdmin ? prisma.user.findMany({ where: { enabled: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <main className="page">
      <LeadsClient
        preset={preset} title={meta.title} isAdmin={isAdmin} result={result} filter={filter} meta={filterMeta} users={users}
        today={todayIst()} openCreate={first(sp.create) === "lead"}
      />
    </main>
  );
}
