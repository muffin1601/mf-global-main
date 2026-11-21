import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { CalendarCheck, Search } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { parseTableState, tableHref } from "@/lib/table-params";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge, type Tone } from "@/components/ui/status-badge";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { LogActivityButton } from "@/components/activities/activity-dialog";
import { TYPE_OPTIONS } from "@/components/activities/options";
import { ActivityRowActions } from "@/components/activities/activity-row-actions";
import {
  ACTIVITY_TYPE_LABELS, ACTIVITY_VIEWS, activityCounts, assignableUsers, listActivities, type ActivityListRow, type ActivityView,
} from "@/server/activities/service";
import type { Actor } from "@/server/actor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activities" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const fmt = (d: Date | null) => (d ? d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "—");
const VIEW_LABELS: Record<ActivityView, string> = { today: "Today", upcoming: "Upcoming", overdue: "Overdue", completed: "Completed", all: "All" };
const PRIORITY_TONE: Record<string, Tone> = { HIGH: "danger", MEDIUM: "warning", LOW: "neutral" };
const STATUS_TONE: Record<string, Tone> = { OPEN: "info", COMPLETED: "success", CANCELLED: "neutral" };
const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const actor: Actor = { id: user.id, role: user.role, name: user.name, userId: user.userId, email: user.email };
  const sp = await searchParams;
  const view = (ACTIVITY_VIEWS as readonly string[]).includes(one(sp.view)) ? (one(sp.view) as ActivityView) : "today";
  const seeAll = can(actor.role, "activities.view_all");
  const assigneeId = seeAll ? one(sp.assignee) : "";
  const type = one(sp.type), q = one(sp.q);
  const defaultSort = view === "completed" ? "completed" : view === "all" ? "created" : "due";
  const state = parseTableState(sp, { sortKeys: ["due", "created", "completed"], defaultSort, defaultDir: defaultSort === "due" ? "asc" : "desc" });

  const [result, counts, users] = await Promise.all([
    listActivities(actor, { view, assigneeId: assigneeId || undefined, type: type || undefined, q: q || undefined, page: state.page, pageSize: state.pageSize, sort: state.sort as never, dir: state.dir }),
    activityCounts(actor, { assigneeId: assigneeId || undefined }),
    assignableUsers(actor),
  ]);

  const columns: DataColumn<ActivityListRow>[] = [
    {
      id: "when", header: view === "completed" ? "Completed (IST)" : view === "all" ? "Created (IST)" : "Due (IST)", required: true,
      sortKey: view === "completed" ? "completed" : view === "all" ? "created" : "due", firstDir: view === "upcoming" || view === "today" ? "asc" : "desc",
      cell: (r) => <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }} className={view === "overdue" ? "error" : "muted"}>{fmt(view === "completed" ? r.completedAt : view === "all" ? r.createdAt : r.dueAt)}</span>,
    },
    { id: "type", header: "Type", required: true, cell: (r) => <StatusBadge value={r.type} tone="primary" dot={false}>{ACTIVITY_TYPE_LABELS[r.type]}</StatusBadge> },
    {
      id: "subject", header: "Subject", required: true,
      cell: (r) => <><span className="cell-primary">{r.subject}</span>{r.body ? <span className="sub" style={{ maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.body}</span> : null}{r.outcome ? <span className="sub">Outcome: {r.outcome}</span> : null}</>,
    },
    {
      id: "lead", header: "Lead",
      cell: (r) => r.lead ? <Link className="link" href={`/crm/lead-management/${r.lead.id}` as Route}>{r.lead.name || r.lead.company || "Lead"}</Link> : <span className="muted">—</span>,
    },
    { id: "assignee", header: "Assigned to", cell: (r) => r.assignee?.name ?? <span className="muted">—</span> },
    { id: "priority", header: "Priority", cell: (r) => r.type === "NOTE" ? <span className="muted">—</span> : <StatusBadge value={r.priority} tone={PRIORITY_TONE[r.priority]}>{title(r.priority)}</StatusBadge> },
    { id: "status", header: "Status", defaultHidden: view !== "all", cell: (r) => r.type === "NOTE" ? <span className="muted">Note</span> : <StatusBadge value={r.status} tone={STATUS_TONE[r.status]}>{title(r.status)}</StatusBadge> },
    { id: "createdBy", header: "Created by", defaultHidden: true, cell: (r) => r.createdBy?.name ?? "—" },
    {
      id: "actions", header: "", required: true, align: "right",
      cell: (r) => (
        <ActivityRowActions id={r.id} status={r.status} type={r.type} subject={r.subject} leadId={r.leadId}
          canChange={user.role === "ADMIN" || r.createdById === user.id || r.assigneeId === user.id}
          canDelete={user.role === "ADMIN" || r.createdById === user.id} />
      ),
    },
  ];

  const tabHref = (v: ActivityView) => tableHref("/crm/activities", { ...(q && { q }), ...(type && { type }), ...(assigneeId && { assignee: assigneeId }) }, { view: v }) as Route;
  const badge = (v: ActivityView) => (v === "today" ? counts.today : v === "upcoming" ? counts.upcoming : v === "overdue" ? counts.overdue : null);
  const filtered = Boolean(q || type || assigneeId);

  return (
    <main className="page">
      <PageHeader
        eyebrow="My work" title="Activities"
        description="Calls, meetings, follow-ups, tasks and notes. Due times are Asia/Kolkata."
        actions={<LogActivityButton users={users} currentUserId={user.id} defaultType="TASK" label="New activity" />}
      />
      <nav className="tabs" aria-label="Activity views">
        {ACTIVITY_VIEWS.map((v) => {
          const n = badge(v);
          return (
            <Link key={v} className="tab" href={tabHref(v)} aria-current={v === view ? "page" : undefined}>
              {VIEW_LABELS[v]}{n !== null ? <span className={`badge ${v === "overdue" && n > 0 ? "tone-danger" : "tone-neutral"}`} style={{ marginLeft: 6 }}>{n}</span> : null}
            </Link>
          );
        })}
      </nav>
      <form method="get" className="filter-bar" role="search" aria-label="Filter activities">
        <input type="hidden" name="view" value={view} />
        {(["sort", "dir", "size", "density", "cols"] as const).flatMap((k) => { const v = sp[k]; return (Array.isArray(v) ? v : v ? [v] : []).map((x, i) => <input key={`${k}${i}`} type="hidden" name={k} value={x} />); })}
        <div className="field grow">
          <label htmlFor="act-q">Search</label>
          <div className="search-input"><Search size={15} aria-hidden="true" /><input id="act-q" type="search" name="q" defaultValue={q} placeholder="Subject, details or lead" /></div>
        </div>
        <div className="field">
          <label htmlFor="act-type">Type</label>
          <select id="act-type" name="type" defaultValue={type}>
            <option value="">All types</option>
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {seeAll ? (
          <div className="field">
            <label htmlFor="act-assignee">Assigned to</label>
            <select id="act-assignee" name="assignee" defaultValue={assigneeId}>
              <option value="">Everyone</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        ) : null}
        <div className="actions">
          <button className="button" type="submit">Apply</button>
          {filtered ? <Link className="button ghost" href={`/crm/activities?view=${view}` as Route}>Reset</Link> : null}
        </div>
      </form>
      <DataTable
        label={`${VIEW_LABELS[view]} activities`} columns={columns} rows={result.rows} rowKey={(r) => r.id}
        basePath="/crm/activities" searchParams={{ ...sp, view }} state={{ ...state, page: result.page }} total={result.total} pages={result.pages} minWidth={900}
        empty={{
          title: view === "overdue" ? "Nothing overdue" : view === "today" ? "Nothing due today" : "No activities",
          description: filtered ? "Try different filters." : "Log a call or create a task to plan your work.", icon: CalendarCheck,
        }}
      />
    </main>
  );
}
