import Link from "next/link";
import { History, Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { listActivity, listActivityUsers } from "@/server/activity/service";
import { HttpError } from "@/server/errors";
import { isDateString } from "@/lib/time/ist";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge, type Tone } from "@/components/ui/status-badge";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { parseTableState } from "@/lib/table-params";

export const dynamic = "force-dynamic";
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Tone by the verb at the end of the action key (e.g. "lead.deleted"); purely visual. */
const actionTone = (action: string): Tone => {
  const verb = action.split(".").pop() ?? "";
  if (/delet|remov|disabl|archiv|block/.test(verb)) return "danger";
  if (/creat|add|enabl|import|restor/.test(verb)) return "success";
  if (/updat|chang|assign|transfer|edit|rename/.test(verb)) return "info";
  if (/login|logout|sign/.test(verb)) return "violet";
  return "neutral";
};

type Entry = Awaited<ReturnType<typeof listActivity>>["items"][number];
const columns: DataColumn<Entry>[] = [
  {
    id: "when", header: "When (IST)", sortKey: "occurredAt", firstDir: "desc", required: true,
    cell: (r) => <span className="muted" style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{r.occurredAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" })}</span>,
  },
  { id: "user", header: "User", required: true, cell: (r) => <><span className="cell-primary">{r.name}</span><span className="sub">{[r.userCode, r.role?.toLowerCase()].filter(Boolean).join(" · ") || "—"}</span></> },
  { id: "action", header: "Action", required: true, cell: (r) => <StatusBadge value={r.action} tone={actionTone(r.action)} dot={false}><span className="mono" style={{ fontSize: ".75rem" }}>{r.action}</span></StatusBadge> },
  {
    id: "details", header: "Details",
    cell: (r) => r.details == null ? <span className="muted">—</span> : (
      <details className="details-json"><summary>View details</summary><pre>{JSON.stringify(r.details, null, 2)}</pre></details>
    ),
  },
];

export default async function ActivityLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdmin();
  const actor = { id: user.id, role: user.role, name: user.name, userId: user.userId, email: user.email };
  const sp = await searchParams;
  const userId = one(sp.user), q = one(sp.q);
  const from = isDateString(one(sp.from)) ? one(sp.from) : "";
  const to = isDateString(one(sp.to)) ? one(sp.to) : "";
  const state = parseTableState(sp, { sortKeys: ["occurredAt"], defaultSort: "occurredAt", defaultDir: "desc", pageSizes: [25, 50, 100] });

  const users = await listActivityUsers(actor);
  let result: Awaited<ReturnType<typeof listActivity>> | null = null;
  let error = "";
  try {
    result = await listActivity(actor, { userId: userId || undefined, from: from || undefined, to: to || undefined, q: q || undefined, page: state.page, pageSize: state.pageSize, sortDir: state.dir });
  } catch (e) {
    if (e instanceof HttpError && e.status === 400) error = e.message; else throw e;
  }
  const filtered = Boolean(userId || q || from || to);

  return (
    <main className="page">
      <PageHeader eyebrow="Administration" title="Activity log" description="An append-only audit trail of changes made in the CRM. Times are Asia/Kolkata." />
      <form method="get" className="filter-bar" role="search" aria-label="Filter activity">
        {/* keep table preferences (sort, page size, columns, density) when filters change; page resets to 1 */}
        {(["sort", "dir", "size", "density", "cols"] as const).flatMap((k) => { const v = sp[k]; return (Array.isArray(v) ? v : v ? [v] : []).map((x, i) => <input key={`${k}${i}`} type="hidden" name={k} value={x} />); })}
        <div className="field grow">
          <label htmlFor="al-q">Search</label>
          <div className="search-input"><Search size={15} aria-hidden="true" /><input id="al-q" type="search" name="q" defaultValue={q} placeholder="Action or user name" /></div>
        </div>
        <div className="field">
          <label htmlFor="al-user">User</label>
          <select id="al-user" name="user" defaultValue={userId}>
            <option value="">All users</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.userId})</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="al-from">From</label><input id="al-from" type="date" name="from" defaultValue={from} /></div>
        <div className="field"><label htmlFor="al-to">To</label><input id="al-to" type="date" name="to" defaultValue={to} /></div>
        <div className="actions">
          <button className="button" type="submit">Apply filters</button>
          {filtered ? <Link className="button ghost" href="/crm/activity-log">Reset</Link> : null}
        </div>
      </form>
      {error && <div className="callout tone-danger" role="alert">{error}</div>}
      {result && (
        <DataTable
          label="Activity log entries"
          columns={columns}
          rows={result.items}
          rowKey={(r) => r.id}
          basePath="/crm/activity-log"
          searchParams={sp}
          state={state}
          total={result.total}
          pages={result.pages}
          minWidth={820}
          rowStyle={{ verticalAlign: "top" }}
          empty={{ title: "No activity found", icon: History, description: filtered ? "Try a different user, date range or search." : "Changes will be recorded here as people use the CRM." }}
        />
      )}
    </main>
  );
}
