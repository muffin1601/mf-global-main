import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadDetailBody } from "@/components/leads/lead-detail-body";
import { requireUser } from "@/lib/auth/session";
import { HttpError } from "@/server/errors";
import { getLeadDetail } from "@/server/leads/queries";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let lead;
  try {
    lead = await getLeadDetail({ id: user.id, role: user.role, name: user.name, userId: user.userId, email: user.email }, id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Pipeline</div>
          <h1>{lead.name || "Lead"}</h1>
        </div>
        <Link className="button secondary" href="/crm/lead-management">Back to leads</Link>
      </div>
      <section className="card"><LeadDetailBody lead={lead} /></section>
    </main>
  );
}
