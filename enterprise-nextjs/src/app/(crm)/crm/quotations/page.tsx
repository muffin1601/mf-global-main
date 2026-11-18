import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listQuotations } from "@/server/quotations/service";
import { DeleteQuotationButton } from "./delete-button";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  const admin = user.role === "ADMIN";
  const { page: rawPage } = await searchParams;
  const result = await listQuotations({ id: user.id, role: user.role, name: user.name }, { page: Number(rawPage) || 1, pageSize: PAGE_SIZE });
  const date = (v: string) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }); };
  const href = (p: number) => `/crm/quotations?page=${p}` as never;

  return (
    <main className="page">
      <div className="page-head">
        <div><div className="eyebrow">Sales documents</div><h1>Quotations</h1></div>
        <Link className="button" href="/crm/quotations/create">Create quotation</Link>
      </div>
      <section className="table-card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Quotation No</th><th>Date</th><th>Customer</th><th>Company</th><th>Phone</th><th>Grand Total</th>
              {admin && <th>Created By</th>}<th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((q) => (
              <tr key={q.id}>
                <td>{q.number}</td><td>{date(q.date)}</td><td>{q.customer}</td><td>{q.company}</td><td>{q.phone}</td>
                <td>{inr.format(q.grandTotal)}</td>
                {admin && <td>{q.createdBy}</td>}
                <td style={{ whiteSpace: "nowrap", display: "flex", gap: ".5rem" }}>
                  <Link className="button secondary" href={`/crm/quotations/${q.id}/edit` as never}>Edit</Link>
                  <a className="button secondary" href={`/api/quotations/${q.id}/pdf`}>Download PDF</a>
                  {admin && <DeleteQuotationButton id={q.id} number={q.number} />}
                </td>
              </tr>
            ))}
            {result.data.length === 0 && <tr><td colSpan={admin ? 8 : 7}>No quotations found.</td></tr>}
          </tbody>
        </table>
      </section>
      <nav style={{ display: "flex", gap: ".75rem", alignItems: "center", marginTop: "1rem" }} aria-label="Pagination">
        {result.page > 1 ? <Link className="button secondary" href={href(result.page - 1)}>Previous</Link> : null}
        <span>Page {result.page} of {result.pages} ({result.total} quotations)</span>
        {result.page < result.pages ? <Link className="button secondary" href={href(result.page + 1)}>Next</Link> : null}
      </nav>
    </main>
  );
}
