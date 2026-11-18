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
import { InsertionCharts } from "./charts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lead insertion report" };

type SP = Record<string, string | string[] | undefined>;
const COLORS = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#dc2626", "#0891b2", "#64748b", "#ca8a04"];
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
    return <main className="page"><div className="error">{errorText(e)}</div></main>;
  }
  const period = first(sp.period);
  const pageNo = Math.max(1, Number(first(sp.page)) || 1);
  let leads = null;
  try {
    leads = period ? await getLeadInsertionLeads(actor, filters, { period, page: pageNo }) : null;
  } catch (e) {
    return <main className="page"><div className="error">{errorText(e)}</div></main>;
  }

  const series = SOURCES.filter((s) => report.summary.bySource[s] > 0).map((s, i) => ({ key: s, label: SOURCE_LABELS[s], color: COLORS[i % COLORS.length] ?? "#64748b" }));
  const chartRows = report.periods.map((p) => ({ label: p.label, total: p.total, ...p.bySource }));
  const s = report.summary;
  const exportHref = (format: string) => `/api/reports/lead-insertion/export?${qs({ format, period: undefined, page: undefined })}`;
  const imported = SOURCES.filter((k) => k !== "MANUAL");

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Reports</div>
          <h1>Lead insertion report</h1>
          <p style={{ color: "var(--muted)" }}>
            Leads grouped by the day they were inserted (Asia/Kolkata). {isAdminUser ? "All leads." : "Showing only leads assigned to you."}
          </p>
        </div>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
          {["csv", "xlsx", "pdf"].map((f) => <a key={f} className="button secondary" href={exportHref(f)}>Export {f.toUpperCase()}</a>)}
        </div>
      </div>

      <form method="get" className="card form-grid" style={{ marginBottom: "1rem" }}>
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
        <div style={{ display: "flex", gap: ".5rem", alignItems: "end" }}>
          <button className="button" type="submit">Apply</button>
          <Link className="button secondary" href="/crm/reports/lead-insertion">Reset</Link>
        </div>
      </form>

      <p style={{ color: "var(--muted)" }}>Range: {report.range.from} to {report.range.to} (IST, inclusive)</p>

      <section className="kpis">
        <div className="kpi"><span>Total leads</span><strong>{s.total}</strong></div>
        <div className="kpi"><span>Manual</span><strong>{s.manual}</strong></div>
        <div className="kpi"><span>Imported</span><strong>{s.imported}</strong></div>
        <div className="kpi"><span>Assigned</span><strong>{s.assigned}</strong></div>
        <div className="kpi"><span>Unassigned</span><strong>{s.unassigned}</strong></div>
        {imported.filter((k) => s.bySource[k] > 0).map((k) => <div className="kpi" key={k}><span>{SOURCE_LABELS[k]}</span><strong>{s.bySource[k]}</strong></div>)}
      </section>

      {s.total === 0 ? (
        <section className="card" role="status">
          <strong>No leads were inserted in this selection.</strong>
          <p style={{ color: "var(--muted)" }}>Try a wider date range or clear some filters.</p>
        </section>
      ) : (
        <>
          <InsertionCharts rows={chartRows} series={series} />
          <section className="table-card" style={{ marginTop: "1rem" }}>
            <div style={{ padding: "1rem" }}><strong>Insertions per period</strong> (click a period to see its leads)</div>
            <table>
              <thead><tr><th>Period</th><th>Total</th><th>Manual</th><th>Imported</th>{imported.map((k) => <th key={k}>{SOURCE_LABELS[k]}</th>)}<th>Assigned</th><th>Unassigned</th></tr></thead>
              <tbody>
                {report.periods.map((p) => (
                  <tr key={p.period}>
                    <td><Link href={`?${qs({ period: p.period, page: undefined })}#leads`}>{p.label}</Link></td>
                    <td>{p.total}</td><td>{p.manual}</td><td>{p.imported}</td>
                    {imported.map((k) => <td key={k}>{p.bySource[k]}</td>)}
                    <td>{p.assigned}</td><td>{p.unassigned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="table-card" style={{ marginTop: "1rem" }}>
            <div style={{ padding: "1rem" }}>
              <strong>Per employee</strong>
              <p style={{ color: "var(--muted)" }}>{report.employeeNote} Distinct leads: {s.total}. Assignment rows: {s.employeeAssignmentTotal}.</p>
            </div>
            <table>
              <thead><tr><th>Employee</th><th>Leads</th></tr></thead>
              <tbody>
                {report.employees.map((e) => <tr key={e.userId ?? "unassigned"}><td>{e.name}</td><td>{e.leads}</td></tr>)}
                {report.employees.length === 0 && <tr><td colSpan={2}>No assigned leads.</td></tr>}
              </tbody>
            </table>
          </section>
        </>
      )}

      {leads && (
        <section className="table-card" style={{ marginTop: "1rem" }} id="leads">
          <div style={{ padding: "1rem", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem" }}>
            <strong>Leads inserted in {period} ({leads.total})</strong>
            <Link className="button secondary" href={`?${qs({ period: undefined, page: undefined })}`}>Close</Link>
          </div>
          <table>
            <thead><tr><th>Lead</th><th>Phone</th><th>Source</th><th>Inserted at (IST)</th><th>Status at insertion</th><th>Current status</th><th>Assignee(s)</th><th>File name</th></tr></thead>
            <tbody>
              {leads.rows.map((r) => (
                <tr key={r.id}>
                  <td>{[r.name, r.company].filter(Boolean).join(" - ") || "-"}</td><td>{r.phone ?? "-"}</td><td>{SOURCE_LABELS[r.source]}</td>
                  <td>{r.insertedAtIst}</td><td>{r.statusAtInsertion}</td><td>{r.currentStatus}</td>
                  <td>{r.assignees.join(", ") || "Unassigned"}</td><td>{r.fileName ?? "-"}</td>
                </tr>
              ))}
              {leads.rows.length === 0 && <tr><td colSpan={8}>No leads for this period.</td></tr>}
            </tbody>
          </table>
          {leads.pageCount > 1 && (
            <div style={{ padding: "1rem", display: "flex", gap: ".5rem", alignItems: "center" }}>
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
