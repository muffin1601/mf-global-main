import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { leaderboard } from "@/server/vendors/performance";
import { STATUS_LABEL } from "@/server/vendors/fields";
import s from "../_components/vendors.module.css";
import { fmtDate, getActor, one, type SP } from "../_lib";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vendor performance" };

export default async function VendorPerformancePage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const actor = await getActor();
  const sp = await searchParams;
  const page = Number(one(sp.page)) || 1;
  const r = await leaderboard(actor, { page, limit: 50 });
  const offset = (r.page - 1) * 50;

  return (
    <main className="page">
      <div className="page-head"><div><div className="eyebrow">Supply intelligence</div><h1>Vendor performance</h1></div></div>
      <section className="kpis">
        <div className="kpi"><span>Rated vendors</span><strong>{r.total}</strong></div>
        <div className="kpi"><span>Not yet evaluated</span><strong>{r.unevaluated}</strong></div>
      </section>
      <p className={s.muted}>Scores are the average of every recorded evaluation (quality, delivery, lead time, pricing, responsiveness, compliance; 1 to 5). Record evaluations from a vendor&apos;s Performance tab.</p>
      <section className="table-card">
        <div className={s.scroll}>
          <table>
            <thead><tr><th>#</th><th>Vendor</th><th>Code</th><th>Category</th><th>Status</th><th>Score</th><th>Band</th><th>Evaluations</th><th>Last evaluated</th></tr></thead>
            <tbody>
              {r.vendors.map((v, i) => (
                <tr key={v.id}>
                  <td>{offset + i + 1}</td>
                  <td><Link className={s.linkBtn} href={`/crm/vendors/${v.id}?tab=performance` as Route}>{v.name}</Link></td>
                  <td className={s.mono}>{v.vendorCode}</td>
                  <td>{v.category?.name ?? "-"}</td>
                  <td><span className="badge">{STATUS_LABEL[v.status] ?? v.status}</span></td>
                  <td><strong>{v.performanceScore?.toFixed(2)}</strong></td>
                  <td>{v.performanceBand}</td>
                  <td>{v.evaluationCount}</td>
                  <td>{fmtDate(v.lastEvaluatedAt)}</td>
                </tr>
              ))}
              {r.vendors.length === 0 ? <tr><td colSpan={9} className={s.empty}>No vendor evaluations found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <div className={s.pager}>
        <span>Page {r.page} of {r.pages}</span>
        <span className={s.pagerLinks}>
          {r.page > 1 ? <Link className="button secondary small" href={`/crm/vendors/performance?page=${r.page - 1}` as Route}>Previous</Link> : null}
          {r.page < r.pages ? <Link className="button secondary small" href={`/crm/vendors/performance?page=${r.page + 1}` as Route}>Next</Link> : null}
        </span>
      </div>
    </main>
  );
}
