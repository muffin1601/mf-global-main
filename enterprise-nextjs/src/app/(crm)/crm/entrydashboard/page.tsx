import Link from "next/link";
import type { Route } from "next";
import {
  AlarmClock, BriefcaseBusiness, CalendarCheck, CalendarClock, CircleX, Clock, FileText, Flame, IndianRupee, Inbox, ListChecks, Percent, Sparkles, Trophy, UserCheck,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { isAdmin, type Actor } from "@/server/actor";
import { getKpis, getLeadsPerDay, getPerformance, getQuotationKpis, getRecentLeads, getStatusBreakdown } from "@/server/dashboard/metrics";
import { activityCounts } from "@/server/activities/service";
import { parseRange, resolveRange, type PerformanceRange } from "@/server/dashboard/range";
import { isDateString } from "@/lib/time/ist";
import { DashboardCharts } from "@/components/dashboard/charts";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyRow } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

const RANGES: { value: PerformanceRange; label: string }[] = [
  { value: "today", label: "Today" }, { value: "week", label: "This week" }, { value: "month", label: "This month" },
  { value: "all", label: "All time" }, { value: "custom", label: "Custom" },
];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const n = (v: number) => v.toLocaleString("en-IN");
const greeting = () => {
  const h = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

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

  const [kpis, recent, performance, statusData, perDay, overall, quotes, myActivities] = await Promise.all([
    getKpis(actor), getRecentLeads(actor), getPerformance(actor, window), getStatusBreakdown(actor), getLeadsPerDay(actor, 30),
    admin ? getPerformance(actor, {}) : Promise.resolve([]),
    getQuotationKpis(actor), activityCounts(actor, { assigneeId: actor.id }),
  ]);
  const inr = (v: number) => v.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const leadsHref = admin ? "/crm/lead-management" : "/crm/my-leads";
  const rangeHref = (r: PerformanceRange) => (r === "all" ? "/crm/entrydashboard" : `/crm/entrydashboard?range=${r}`) as Route;
  const firstName = user.name.split(/\s+/)[0] ?? user.name;

  return (
    <main className="page">
      <PageHeader
        eyebrow={`${greeting()}, ${firstName}`}
        title="Dashboard"
        description={admin ? "Live metrics across all leads. Days follow Asia/Kolkata time." : "Live metrics for the leads assigned to you. Days follow Asia/Kolkata time."}
        actions={<>
          <Link className="button secondary" href={leadsHref as Route}>View leads</Link>
          <Link className="button" href={`${leadsHref}?create=lead` as Route}>New lead</Link>
        </>}
      />

      {one(sp.error) === "forbidden" ? (
        <div className="callout tone-warning" role="alert"><span>That page is restricted to administrators, so you were brought back to your dashboard.</span></div>
      ) : null}

      <section aria-labelledby="kpi-pipeline">
        <h2 id="kpi-pipeline" className="sr-only">Key metrics</h2>
        <div className="kpis">
          {admin ? (<>
            <MetricCard label="Total leads" value={n(kpis.total)} icon={ListChecks} href="/crm/lead-management" />
            <MetricCard label="New today" value={n(kpis.newToday)} icon={Sparkles} tone="info" href="/crm/new-leads" hint="Created since midnight IST" />
            <MetricCard label="Assigned" value={n(kpis.assigned)} icon={UserCheck} tone="violet" href="/crm/assigned-leads" />
            <MetricCard label="Unassigned" value={n(kpis.unassigned)} icon={Inbox} tone={kpis.unassigned > 0 ? "warning" : "neutral"} href="/crm/unassigned-leads" />
            <MetricCard label="In progress" value={n(kpis.trending)} icon={Flame} tone="warning" href="/crm/trending-leads" />
            <MetricCard label="Won" value={n(kpis.converted)} icon={Trophy} tone="success" href="/crm/won-leads" />
            <MetricCard label="Lost" value={n(kpis.lost)} icon={CircleX} tone="danger" />
            <MetricCard label="Conversion rate" value={`${kpis.conversionRate.toFixed(2)}%`} icon={Percent} tone="success" hint="Won ÷ total leads" />
          </>) : (<>
            <MetricCard label="My leads" value={n(kpis.total)} icon={BriefcaseBusiness} href="/crm/my-leads" />
            <MetricCard label="New today" value={n(kpis.newToday)} icon={Sparkles} tone="info" hint="Created since midnight IST" />
            <MetricCard label="In progress" value={n(kpis.trending)} icon={Flame} tone="warning" href="/crm/my-trending-leads" />
            <MetricCard label="Won" value={n(kpis.converted)} icon={Trophy} tone="success" href="/crm/conversions" />
            <MetricCard label="Conversion rate" value={`${kpis.conversionRate.toFixed(2)}%`} icon={Percent} tone="success" href="/crm/conversions" hint="Won ÷ my leads" />
          </>)}
        </div>
      </section>

      <section aria-labelledby="kpi-followups">
        <div className="section-title-row"><h2 id="kpi-followups">Follow-ups</h2></div>
        <div className="kpis">
          <MetricCard label="Due today" value={n(kpis.followUpsToday)} icon={Clock} tone="info" href="/crm/today-followups" />
          <MetricCard label="Upcoming" value={n(kpis.upcoming)} icon={CalendarClock} tone="violet" href="/crm/upcoming-followups" />
          <MetricCard
            label="Overdue" value={n(kpis.overdue)} icon={AlarmClock} tone={kpis.overdue > 0 ? "danger" : "neutral"}
            hint={kpis.overdue > 0 ? "Past date, still open (not won/lost)" : "Nothing overdue"}
          />
        </div>
      </section>

      <section aria-labelledby="kpi-work">
        <div className="section-title-row"><h2 id="kpi-work">My activities &amp; quotations</h2></div>
        <div className="kpis">
          <MetricCard label="My activities due today" value={n(myActivities.today)} icon={CalendarCheck} tone="info" href="/crm/activities?view=today" />
          <MetricCard
            label="My overdue activities" value={n(myActivities.overdue)} icon={AlarmClock} tone={myActivities.overdue > 0 ? "danger" : "neutral"}
            href="/crm/activities?view=overdue" hint={myActivities.overdue > 0 ? "Open, due before today (IST)" : "Nothing overdue"}
          />
          <MetricCard
            label={admin ? "Quotations this month" : "My quotations this month"} value={inr(quotes.monthTotal)} icon={IndianRupee} tone="success"
            href="/crm/quotations" hint={`${n(quotes.monthCount)} quotation${quotes.monthCount === 1 ? "" : "s"} · grand totals incl. tax`}
          />
          <MetricCard
            label={admin ? "All quotations" : "All my quotations"} value={inr(quotes.total)} icon={FileText} tone="neutral"
            href="/crm/quotations" hint={`${n(quotes.count)} quotation${quotes.count === 1 ? "" : "s"} · quoted value, not revenue`}
          />
        </div>
      </section>

      <DashboardCharts statusData={statusData} perDay={perDay} perEmployee={admin ? overall.map((r) => ({ name: r.name, deals: r.deals })) : undefined} />

      <div className="grid-dashboard-2">
        <section className="table-card" aria-labelledby="perf-title">
          <div className="section-head">
            <div>
              <h3 id="perf-title">{admin ? "Team performance" : "My performance"}</h3>
              <p>Leads created in the selected period and how many are won.</p>
            </div>
            <nav className="segmented" aria-label="Performance period">
              {RANGES.filter((r) => r.value !== "custom").map((r) => (
                <Link key={r.value} href={rangeHref(r.value)} aria-current={range === r.value ? "page" : undefined}>{r.label}</Link>
              ))}
            </nav>
          </div>
          <form method="get" className="toolbar" style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <input type="hidden" name="range" value="custom" />
            <label className="muted" htmlFor="perf-from" style={{ fontSize: 13 }}>Custom range</label>
            <input id="perf-from" type="date" name="from" defaultValue={range === "custom" ? from ?? "" : ""} aria-label="From date" required />
            <span className="muted" aria-hidden="true">–</span>
            <input type="date" name="to" defaultValue={range === "custom" ? to ?? "" : ""} aria-label="To date" required />
            <button className={`button small ${range === "custom" ? "" : "secondary"}`} type="submit">Apply</button>
            {customInvalid && <span className="error" role="alert">From date must not be after To date.</span>}
          </form>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Employee</th><th className="num">Leads</th><th className="num">Won</th><th style={{ width: "34%" }}>Close rate</th></tr></thead>
              <tbody>
                {performance.map((r) => (
                  <tr key={r.userId}>
                    <td className="cell-primary">{r.name}</td>
                    <td className="num">{n(r.leads)}</td>
                    <td className="num">{n(r.deals)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="progress" style={{ flex: 1 }} aria-hidden="true"><span style={{ width: `${Math.min(100, r.closePct)}%`, background: "var(--success)" }} /></div>
                        <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 52, textAlign: "right" }}>{r.closePct.toFixed(2)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {performance.length === 0 && <EmptyRow colSpan={4} title="No assigned leads in this period" description="Choose a wider period to see performance." />}
              </tbody>
            </table>
          </div>
        </section>

        <section className="table-card" aria-labelledby="recent-title">
          <div className="section-head">
            <div><h3 id="recent-title">Recently added leads</h3><p>The newest leads in your scope.</p></div>
            <Link className="button ghost small" href={leadsHref as Route}>View all</Link>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Lead</th><th>Status</th><th>Call status</th><th className="num">Created</th></tr></thead>
              <tbody>
                {recent.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <Link className="cell-primary link" href={`/crm/lead-management/${lead.id}` as Route} style={{ color: "var(--text)" }}>{lead.name || "Unnamed lead"}</Link>
                      <span className="sub">{lead.company || "—"}</span>
                    </td>
                    <td><StatusBadge value={lead.status} kind="lead" /></td>
                    <td><StatusBadge value={lead.callStatus} kind="call" dot={false} /></td>
                    <td className="num muted">{lead.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" })}</td>
                  </tr>
                ))}
                {recent.length === 0 && <EmptyRow colSpan={4} title="No leads yet" description="Leads you create or import will appear here." />}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
