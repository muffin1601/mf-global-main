import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft, ChevronRight, History, Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { listActivity, listActivityUsers } from "@/server/activity/service";
import { HttpError } from "@/server/errors";
import { isDateString } from "@/lib/time/ist";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge, type Tone } from "@/components/ui/status-badge";
import { EmptyRow } from "@/components/ui/empty-state";

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

export default async function ActivityLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdmin();
  const actor = { id: user.id, role: user.role, name: user.name, userId: user.userId, email: user.email };
  const sp = await searchParams;
  const userId = one(sp.user), q = one(sp.q);
  const from = isDateString(one(sp.from)) ? one(sp.from) : "";
  const to = isDateString(one(sp.to)) ? one(sp.to) : "";
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);

  const users = await listActivityUsers(actor);
  let result: Awaited<ReturnType<typeof listActivity>> | null = null;
  let error = "";
  try {
    result = await listActivity(actor, { userId: userId || undefined, from: from || undefined, to: to || undefined, q: q || undefined, page });
  } catch (e) {
    if (e instanceof HttpError && e.status === 400) error = e.message; else throw e;
  }
  const link = (p: number) => {
    const params = new URLSearchParams({ ...(userId && { user: userId }), ...(q && { q }), ...(from && { from }), ...(to && { to }), page: String(p) });
    return `/crm/activity-log?${params.toString()}`;
  };
  const filtered = Boolean(userId || q || from || to);

  return (
    <main className="page">
      <PageHeader eyebrow="Administration" title="Activity log" description="An append-only audit trail of changes made in the CRM. Times are Asia/Kolkata." />
      <form method="get" className="filter-bar" role="search" aria-label="Filter activity">
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
        <section className="table-card">
          <div className="table-scroll">
            <table style={{ minWidth: 820 }}>
              <thead><tr><th>When (IST)</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>
                {result.items.map((r) => (
                  <tr key={r.id} style={{ verticalAlign: "top" }}>
                    <td className="muted" style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{r.occurredAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" })}</td>
                    <td><span className="cell-primary">{r.name}</span><span className="sub">{[r.userCode, r.role?.toLowerCase()].filter(Boolean).join(" · ") || "—"}</span></td>
                    <td><StatusBadge value={r.action} tone={actionTone(r.action)} dot={false}><span className="mono" style={{ fontSize: ".75rem" }}>{r.action}</span></StatusBadge></td>
                    <td>
                      {r.details == null ? <span className="muted">—</span> : (
                        <details className="details-json">
                          <summary>View details</summary>
                          <pre>{JSON.stringify(r.details, null, 2)}</pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
                {result.items.length === 0 && <EmptyRow colSpan={4} icon={History} title="No activity found" description={filtered ? "Try a different user, date range or search." : "Changes will be recorded here as people use the CRM."} />}
              </tbody>
            </table>
          </div>
          <div className="table-foot">
            <span>{result.total.toLocaleString("en-IN")} entries · page {result.page} of {result.pages}</span>
            <div className="pager">
              {result.page > 1 && <Link className="icon-btn bordered" href={link(result.page - 1) as Route} aria-label="Previous page"><ChevronLeft size={15} /></Link>}
              {result.page < result.pages && <Link className="icon-btn bordered" href={link(result.page + 1) as Route} aria-label="Next page"><ChevronRight size={15} /></Link>}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
