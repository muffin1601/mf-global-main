import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LeadDetailBody } from "@/components/leads/lead-detail-body";
import { PageHeader } from "@/components/ui/page-header";
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
  const back = user.role === "ADMIN" ? "/crm/lead-management" : "/crm/my-leads";
  return (
    <main className="page">
      <PageHeader
        eyebrow="Lead"
        title={lead.name || "Unnamed lead"}
        description={[lead.company, lead.location, lead.state].filter(Boolean).join(" · ") || undefined}
        actions={<Link className="button secondary" href={back}><ArrowLeft size={15} aria-hidden="true" />Back to leads</Link>}
      />
      <section className="card" style={{ maxWidth: 1100 }}><LeadDetailBody lead={lead} /></section>
    </main>
  );
}
