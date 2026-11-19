import Link from "next/link";
import { ChevronLeft, ChevronRight, FileDown, FileText, Pencil, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listQuotations } from "@/server/quotations/service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteQuotationButton } from "./delete-button";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  const admin = user.role === "ADMIN";
  const { page: rawPage } = await searchParams;
  const result = await listQuotations({ id: user.id, role: user.role, name: user.name }, { page: Number(rawPage) || 1, pageSize: PAGE_SIZE });
  const date = (v: string) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }); };
  const href = (p: number) => `/crm/quotations?page=${p}` as never;
  const cols = admin ? 7 : 6;

  return (
    <main className="page">
      <PageHeader
        title="Quotations"
        description={admin ? "Every quotation issued by the team." : "Quotations you have created."}
        actions={<Link className="button" href="/crm/quotations/create"><Plus size={15} aria-hidden="true" />New quotation</Link>}
      />
      <section className="table-card">
        <div className="table-scroll">
          <table style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th>Quotation</th><th>Date</th><th>Customer</th><th>Phone</th><th className="num">Grand total</th>
                {admin && <th>Created by</th>}<th style={{ width: 1 }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((q) => (
                <tr key={q.id}>
                  <td><Link className="cell-primary link" style={{ color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: ".8125rem" }} href={`/crm/quotations/${q.id}/edit` as never}>{q.number}</Link></td>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>{date(q.date)}</td>
                  <td><span className="cell-primary">{q.customer || "—"}</span>{q.company ? <span className="sub">{q.company}</span> : null}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{q.phone || "—"}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{inr.format(q.grandTotal)}</td>
                  {admin && <td>{q.createdBy}</td>}
                  <td>
                    <div className="row-actions">
                      <Link className="icon-btn" href={`/crm/quotations/${q.id}/edit` as never} aria-label={`Edit quotation ${q.number}`} title="Edit"><Pencil size={15} /></Link>
                      <a className="icon-btn" href={`/api/quotations/${q.id}/pdf`} aria-label={`Download PDF of ${q.number}`} title="Download PDF"><FileDown size={15} /></a>
                      {admin && <DeleteQuotationButton id={q.id} number={q.number} />}
                    </div>
                  </td>
                </tr>
              ))}
              {result.data.length === 0 && (
                <tr><td colSpan={cols} style={{ padding: 0 }}>
                  <EmptyState icon={FileText} title="No quotations yet" description="Create a quotation from a lead and download it as a PDF."
                    action={<Link className="button small" href="/crm/quotations/create"><Plus size={14} aria-hidden="true" />New quotation</Link>} />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <nav className="table-foot" aria-label="Pagination">
          <span>{result.total.toLocaleString("en-IN")} quotation{result.total === 1 ? "" : "s"} · page {result.page} of {Math.max(1, result.pages)}</span>
          <div className="pager">
            {result.page > 1 ? <Link className="icon-btn bordered" href={href(result.page - 1)} aria-label="Previous page"><ChevronLeft size={15} /></Link> : null}
            {result.page < result.pages ? <Link className="icon-btn bordered" href={href(result.page + 1)} aria-label="Next page"><ChevronRight size={15} /></Link> : null}
          </div>
        </nav>
      </section>
    </main>
  );
}
