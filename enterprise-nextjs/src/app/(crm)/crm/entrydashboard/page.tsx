import Link from "next/link";
import type { Route } from "next";
import { requireUser } from "@/lib/auth/session";
import { isAdmin, type Actor } from "@/server/actor";
import { getKpis, getLeadsPerDay, getPerformance, getRecentLeads, getStatusBreakdown } from "@/server/dashboard/metrics";
import { parseRange, resolveRange, type PerformanceRange } from "@/server/dashboard/range";
import { isDateString } from "@/lib/time/ist";
import { DashboardCharts } from "@/components/dashboard/charts";

export const dynamic = "force-dynamic";

const RANGES: { value: PerformanceRange; label: string }[] = [
  { value: "today", label: "Today" }, { value: "week", label: "This week" }, { value: "month", label: "This month" },
  { value: "all", label: "All time" }, { value: "custom", label: "Custom" },
];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function Kpi({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = (<><span>{label}</span><strong>{value}</strong></>);
  return href ? <Link className="kpi" href={href as Route}>{body}</Link> : <div className="kpi">{body}</div>;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const actor: Actor = { id: user.id, role: user.role, name: user.name, userId: user.userId, email: user.email };
  const admin = isAdmin(actor);
  const sp = await searchParams;
  const range = parseRange(one(sp.range));
  const rawFrom = one(sp.from), rawTo = one(sp.to);
  const from = rawFrom && isDateString(rawFrom) ? rawFrom : undefined;
  const to = rawTo && isDateString(rawTo) ? rawTo : undefined;
  const customInvalid = range === "custom" && !!from && !!to && from > to;
  const window = customInvalid ? {} : resolveRange(range, from, to);

  const [kpis, recent, performance, statusData, perDay, overall] = await Promise.all([
    getKpis(actor), getRecentLeads(actor), getPerformance(actor, window), getStatusBreakdown(actor), getLeadsPerDay(actor, 30),
    admin ? getPerformance(actor, {}) : Promise.resolve([]),
  ]);

  return (
    <main className="page">
      <div className="page-head"><div><div className="eyebrow">Sales workspace</div><h1>Dashboard</h1>
        <p style={{ color: "var(--muted)" }}>{admin ? "Live metrics across all leads." : "Live metrics for leads assigned to you."} Days are Asia/Kolkata.</p></div></div>
      <section className="kpis" style={{ marginBottom: "1rem" }}>
        {admin ? (<>
          <Kpi label="Total leads" value={kpis.total} href="/crm/lead-management" />
          <Kpi label="New today" value={kpis.newToday} href="/crm/new-leads" />
          <Kpi label="Assigned" value={kpis.assigned} href="/crm/assigned-leads" />
          <Kpi label="Unassigned" value={kpis.unassigned} href="/crm/unassigned-leads" />
          <Kpi label="Converted (Won)" value={kpis.converted} href="/crm/won-leads" />
          <Kpi label="Trending (In Progress)" value={kpis.trending} href="/crm/trending-leads" />
          <Kpi label="Lost" value={kpis.lost} />
          <Kpi label="Conversion rate" value={`${kpis.conversionRate.toFixed(2)}%`} />
          <Kpi label="Follow-ups today" value={kpis.followUpsToday} href="/crm/today-followups" />
          <Kpi label="Upcoming follow-ups" value={kpis.upcoming} href="/crm/upcoming-followups" />
          <Kpi label="Overdue follow-ups" value={kpis.overdue} />
        </>) : (<>
          <Kpi label="My leads" value={kpis.total} href="/crm/my-leads" />
          <Kpi label="New today" value={kpis.newToday} />
          <Kpi label="My trending leads" value={kpis.trending} href="/crm/my-trending-leads" />
          <Kpi label="My conversions" value={`${kpis.conversionRate.toFixed(2)}%`} href="/crm/conversions" />
          <Kpi label="Follow-ups today" value={kpis.followUpsToday} href="/crm/today-followups" />
          <Kpi label="Upcoming follow-ups" value={kpis.upcoming} href="/crm/upcoming-followups" />
          <Kpi label="Overdue follow-ups" value={kpis.overdue} />
        </>)}
      </section>

      <DashboardCharts statusData={statusData} perDay={perDay} perEmployee={admin ? overall.map((r) => ({ name: r.name, deals: r.deals })) : undefined} />

      <section className="table-card">
        <div style={{ padding: "1rem", display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", alignItems: "center" }}>
          <strong>{admin ? "Employee performance" : "My performance"}</strong>
          <form method="get" style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center" }}>
            <select name="range" defaultValue={range} aria-label="Date range">
              {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <input type="date" name="from" defaultValue={from ?? ""} aria-label="From date" />
            <input type="date" name="to" defaultValue={to ?? ""} aria-label="To date" />
            <button className="button secondary" type="submit">Apply</button>
          </form>
        </div>
        {customInvalid && <p className="error" style={{ padding: "0 1rem" }}>From date must not be after To date.</p>}
        <p style={{ padding: "0 1rem", color: "var(--muted)", fontSize: ".8rem" }}>Counts leads created in the selected period. From/To apply when range is Custom.</p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Employee</th><th>Leads</th><th>Deals (Won)</th><th>Close %</th></tr></thead>
            <tbody>
              {performance.map((r) => <tr key={r.userId}><td>{r.name}</td><td>{r.leads}</td><td>{r.deals}</td><td>{r.closePct.toFixed(2)}%</td></tr>)}
              {performance.length === 0 && <tr><td colSpan={4}>No assigned leads in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="table-card">
        <div style={{ padding: "1rem" }}><strong>Recently added leads</strong></div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Contact</th><th>Company</th><th>Status</th><th>Call status</th><th>Created</th></tr></thead>
            <tbody>
              {recent.map((lead) => <tr key={lead.id}><td>{lead.name || "-"}</td><td>{lead.company || "-"}</td><td><span className="badge">{lead.status}</span></td><td>{lead.callStatus}</td><td>{lead.createdAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td></tr>)}
              {recent.length === 0 && <tr><td colSpan={5}>No leads in your authorized dataset.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
