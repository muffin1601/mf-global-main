import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import type { Actor } from "@/server/actor";
import { HttpError } from "@/server/errors";
import {
  getLeadInsertionFilterOptions, getLeadInsertionLeads, getLeadInsertionReport,
} from "@/server/reports/lead-insertion";
import {
  ANY_IMPORTED, GROUPINGS, PRESETS, SOURCES, SOURCE_LABELS, UNASSIGNED, UNKNOWN_STATUS, parseFilters,
} from "@/server/reports/lead-insertion-filters";
import { CalendarDays, Download, LineChart, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { InsertionCharts } from "./charts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lead insertion report" };

type SP = Record<string, string | string[] | undefined>;
// Fixed categorical order per source (validated palette tokens); colour follows the source, never its rank.
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)"];
const FILTER_KEYS = ["preset", "from", "to", "grouping", "employee", "source", "status", "initialStatus", "assignment", "fileName", "importJobId", "dataType"];
const PRESET_LABELS = { today: "Today", yesterday: "Yesterday", week: "This week", month: "This month", custom: "Custom" };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const errorText = (e: unknown) => (e instanceof HttpError ? e.message : "Could not load the report.");

export default async function LeadInsertionPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const actor: Actor = { id: user.id, role: user.role, name: user.name, userId: user.userId, email: user.email };
  const sp = await searchParams;
  const isAdminUser = actor.role === "ADMIN";

  const qs = (extra: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    for (const k of FILTER_KEYS) { const v = first(sp[k]); if (v) p.set(k, v); }
    for (const [k, v] of Object.entries(extra)) { if (v) p.set(k, v); else p.delete(k); }
    return p.toString();
  };

  let filters, report, options;
  try {
    filters = parseFilters(sp);
    [report, options] = await Promise.all([getLeadInsertionReport(actor, filters), getLeadInsertionFilterOptions(actor)]);
  } catch (e) {
    return <main className="page"><div className="callout tone-danger" role="alert">{errorText(e)}</div></main>;
  }
  const period = first(sp.period);
  const pageNo = Math.max(1, Number(first(sp.page)) || 1);
  let leads = null;
  try {
    leads = period ? await getLeadInsertionLeads(actor, filters, { period, page: pageNo }) : null;
  } catch (e) {
    return <main className="page"><div className="callout tone-danger" role="alert">{errorText(e)}</div></main>;
  }

  const series = SOURCES.map((s, i) => ({ key: s, label: SOURCE_LABELS[s], color: COLORS[i % COLORS.length] ?? "var(--chart-7)" })).filter((x) => report.summary.bySource[x.key] > 0);
  const chartRows = report.periods.map((p) => ({ label: p.label, total: p.total, ...p.bySource }));
  const s = report.summary;
  const exportHref = (format: string) => `/api/reports/lead-insertion/export?${qs({ format, period: undefined, page: undefined })}`;
  const imported = SOURCES.filter((k) => k !== "MANUAL");
  // Website sources are always shown (even at 0) so each site is visible on its own.
  const WEBSITE_SOURCES: string[] = ["PRINTKEE", "GIFTAGURU", "COACHINGPROMO"];

  return (
    <main className="page">
      <PageHeader
        eyebrow="Reports"
        title="Lead insertion report"
        description={<>Leads grouped by the day they were inserted (Asia/Kolkata). {isAdminUser ? "All leads." : "Showing only leads assigned to you."} Exports use the filters below.</>}
        actions={["csv", "xlsx", "pdf"].map((f) => <a key={f} className="button secondary" href={exportHref(f)}><Download size={15} aria-hidden="true" />{f.toUpperCase()}</a>)}
      />

      <form method="get" className="card report-filters" aria-label="Report filters">
        <label className="field">Range
          <select name="preset" defaultValue={filters.preset}>
            {PRESETS.map((p) => <option key={p} value={p}>{PRESET_LABELS[p]}</option>)}
          </select>
        </label>
        <label className="field">From (custom)<input type="date" name="from" defaultValue={filters.from ?? ""} /></label>
        <label className="field">To (custom)<input type="date" name="to" defaultValue={filters.to ?? ""} /></label>
        <label className="field">Group by
          <select name="grouping" defaultValue={filters.grouping}>{GROUPINGS.map((g) => <option key={g} value={g}>{g}</option>)}</select>
        </label>
        <label className="field">Employee
          <select name="employee" defaultValue={filters.employee ?? ""}>
            <option value="">All</option>
            {isAdminUser && <option value={UNASSIGNED}>Unassigned</option>}
            {options.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label className="field">Source
          <select name="source" defaultValue={filters.source ?? ""}>
            <option value="">All</option>
            <option value={ANY_IMPORTED}>Any imported (non-manual)</option>
            {SOURCES.map((k) => <option key={k} value={k}>{SOURCE_LABELS[k]}</option>)}
          </select>
        </label>
        <label className="field">Current status
          <select name="status" defaultValue={filters.status ?? ""}><option value="">All</option>{options.statuses.map((v) => <option key={v}>{v}</option>)}</select>
        </label>
        <label className="field">Status at insertion
          <select name="initialStatus" defaultValue={filters.initialStatus ?? ""}>
            <option value="">All</option><option value={UNKNOWN_STATUS}>{UNKNOWN_STATUS}</option>
            {options.initialStatuses.map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        <label className="field">Assignment
          <select name="assignment" defaultValue={filters.assignment ?? ""}>
            <option value="">All</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option>
          </select>
        </label>
        <label className="field">Import file
          <select name="fileName" defaultValue={filters.fileName ?? ""}><option value="">All</option>{options.files.map((v) => <option key={v}>{v}</option>)}</select>
        </label>
        <label className="field">Import batch
          <select name="importJobId" defaultValue={filters.importJobId ?? ""}>
            <option value="">All</option>
            {options.importJobs.map((j) => <option key={j.id} value={j.id}>{j.fileName ?? "(no name)"} - {j.id.slice(0, 8)}</option>)}
          </select>
        </label>
        <label className="field">Data type
          <select name="dataType" defaultValue={filters.dataType ?? ""}><option value="">All</option>{options.dataTypes.map((v) => <option key={v}>{v}</option>)}</select>
        </label>
        <div className="report-filter-actions">
          <button className="button" type="submit">Apply filters</button>
          <Link className="button ghost" href="/crm/reports/lead-insertion">Reset</Link>
        </div>
      </form>

      <p className="muted" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".8125rem" }}><CalendarDays size={14} aria-hidden="true" />Range: <strong style={{ color: "var(--text)" }}>{report.range.from}</strong> to <strong style={{ color: "var(--text)" }}>{report.range.to}</strong> (IST, inclusive)</p>

      <section className="kpis">
        <div className="kpi"><span>Total leads</span><strong>{s.total}</strong></div>
        <div className="kpi"><span>Manual</span><strong>{s.manual}</strong></div>
        <div className="kpi"><span>Imported</span><strong>{s.imported}</strong></div>
        <div className="kpi"><span>Assigned</span><strong>{s.assigned}</strong></div>
        <div className="kpi"><span>Unassigned</span><strong>{s.unassigned}</strong></div>
        {imported.filter((k) => s.bySource[k] > 0 || WEBSITE_SOURCES.includes(k)).map((k) => <div className="kpi" key={k}><span>{SOURCE_LABELS[k]}</span><strong>{s.bySource[k]}</strong></div>)}
      </section>

      {s.total === 0 ? (
        <section className="card flush"><EmptyState icon={LineChart} title="No leads were inserted in this selection" description="Try a wider date range or clear some filters." /></section>
      ) : (
        <>
          <InsertionCharts rows={chartRows} series={series} />
          <section className="table-card" style={{ marginTop: "1rem" }}>
            <div className="section-head"><div><h3>Insertions per period</h3><p>Select a period to list its leads.</p></div></div>
            <div className="table-scroll"><table>
              <thead><tr><th>Period</th><th className="num">Total</th><th className="num">Manual</th><th className="num">Imported</th>{imported.map((k) => <th className="num" key={k}>{SOURCE_LABELS[k]}</th>)}<th className="num">Assigned</th><th className="num">Unassigned</th></tr></thead>
              <tbody>
                {report.periods.map((p) => (
                  <tr key={p.period}>
                    <td><Link className="link" href={`?${qs({ period: p.period, page: undefined })}#leads`} aria-current={period === p.period ? "true" : undefined}>{p.label}</Link></td>
                    <td className="num" style={{ fontWeight: 600 }}>{p.total}</td><td className="num">{p.manual}</td><td className="num">{p.imported}</td>
                    {imported.map((k) => <td className="num" key={k}>{p.bySource[k]}</td>)}
                    <td className="num">{p.assigned}</td><td className="num">{p.unassigned}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </section>
          <section className="table-card">
            <div className="section-head">
              <div><h3>Per employee</h3><p>{report.employeeNote} Distinct leads: {s.total}. Assignment rows: {s.employeeAssignmentTotal}.</p></div>
            </div>
            <div className="table-scroll"><table>
              <thead><tr><th>Employee</th><th className="num">Leads</th></tr></thead>
              <tbody>
                {report.employees.map((e) => <tr key={e.userId ?? "unassigned"}><td className="cell-primary">{e.name}</td><td className="num">{e.leads}</td></tr>)}
                {report.employees.length === 0 && <tr><td colSpan={2} className="cell-empty">No assigned leads.</td></tr>}
              </tbody>
            </table></div>
          </section>
        </>
      )}

      {leads && (
        <section className="table-card" id="leads">
          <div className="section-head">
            <div><h3>Leads inserted in {period}</h3><p>{leads.total.toLocaleString("en-IN")} lead{leads.total === 1 ? "" : "s"}</p></div>
            <Link className="button secondary small" href={`?${qs({ period: undefined, page: undefined })}`}><X size={14} aria-hidden="true" />Close</Link>
          </div>
          <div className="table-scroll"><table style={{ minWidth: 980 }}>
            <thead><tr><th>Lead</th><th>Phone</th><th>Source</th><th>Inserted at (IST)</th><th>Status at insertion</th><th>Current status</th><th>Assignee(s)</th><th>File name</th></tr></thead>
            <tbody>
              {leads.rows.map((r) => (
                <tr key={r.id}>
                  <td><span className="cell-primary">{r.name || "—"}</span>{r.company ? <span className="sub">{r.company}</span> : null}</td><td>{r.phone ?? "—"}</td><td>{SOURCE_LABELS[r.source]}</td>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>{r.insertedAtIst}</td><td><StatusBadge value={r.statusAtInsertion} kind="lead" /></td><td><StatusBadge value={r.currentStatus} kind="lead" /></td>
                  <td>{r.assignees.join(", ") || "Unassigned"}</td><td>{r.fileName ?? "-"}</td>
                </tr>
              ))}
              {leads.rows.length === 0 && <tr><td colSpan={8} className="cell-empty">No leads for this period.</td></tr>}
            </tbody>
          </table></div>
          {leads.pageCount > 1 && (
            <div className="table-foot" style={{ justifyContent: "flex-end", gap: 8 }}>
              {leads.page > 1 && <Link className="button secondary" href={`?${qs({ period, page: String(leads.page - 1) })}#leads`}>Previous</Link>}
              <span>Page {leads.page} of {leads.pageCount}</span>
              {leads.page < leads.pageCount && <Link className="button secondary" href={`?${qs({ period, page: String(leads.page + 1) })}#leads`}>Next</Link>}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
