import Link from "next/link";
import type { Route } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { listActivity, listActivityUsers } from "@/server/activity/service";
import { HttpError } from "@/server/errors";
import { isDateString } from "@/lib/time/ist";

export const dynamic = "force-dynamic";
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

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

  return (
    <main className="page">
      <div className="page-head"><div><div className="eyebrow">Administration</div><h1>Activity log</h1>
        <p style={{ color: "var(--muted)" }}>Dates are Asia/Kolkata days.</p></div></div>
      <form method="get" className="card" style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center", padding: "1rem" }}>
        <select name="user" defaultValue={userId} aria-label="User">
          <option value="">All users</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.userId})</option>)}
        </select>
        <input type="date" name="from" defaultValue={from} aria-label="From date" />
        <input type="date" name="to" defaultValue={to} aria-label="To date" />
        <input type="search" name="q" defaultValue={q} placeholder="Search action or user" aria-label="Search" />
        <button className="button" type="submit">Filter</button>
        <Link className="button secondary" href="/crm/activity-log">Reset</Link>
      </form>
      {error && <p className="error">{error}</p>}
      {result && (
        <section className="table-card">
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>When (IST)</th><th>User</th><th>Role</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>
                {result.items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.occurredAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                    <td>{r.name}{r.userCode ? ` (${r.userCode})` : ""}</td>
                    <td>{r.role ?? "-"}</td>
                    <td>{r.action}</td>
                    <td>{r.details == null ? "-" : <details><summary>View</summary><pre style={{ whiteSpace: "pre-wrap", maxWidth: 480 }}>{JSON.stringify(r.details, null, 2)}</pre></details>}</td>
                  </tr>
                ))}
                {result.items.length === 0 && <tr><td colSpan={5}>No activity found.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "1rem", display: "flex", gap: "1rem", alignItems: "center" }}>
            <span>{result.total} entries, page {result.page} of {result.pages}</span>
            {result.page > 1 && <Link className="button secondary" href={link(result.page - 1) as Route}>Previous</Link>}
            {result.page < result.pages && <Link className="button secondary" href={link(result.page + 1) as Route}>Next</Link>}
          </div>
        </section>
      )}
    </main>
  );
}
