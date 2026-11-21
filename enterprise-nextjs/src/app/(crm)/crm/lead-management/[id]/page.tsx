import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { LeadDetailBody } from "@/components/leads/lead-detail-body";
import { LeadTimeline } from "@/components/leads/lead-timeline";
import { LogActivityButton } from "@/components/activities/activity-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge, type Tone } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import type { Actor } from "@/server/actor";
import { assignableUsers } from "@/server/activities/service";
import { HttpError } from "@/server/errors";
import { getLeadDetail } from "@/server/leads/queries";
import { getLeadTimeline } from "@/server/leads/timeline";

export const dynamic = "force-dynamic";

const PRIORITY_TONE: Record<string, Tone> = { High: "danger", Medium: "warning", Low: "neutral" };
const DAY_MS = 86_400_000;
const leadAgeDays = (createdAt: string, now: number = Date.now()) => Math.max(0, Math.floor((now - Date.parse(createdAt)) / DAY_MS));

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const actor: Actor = { id: user.id, role: user.role, name: user.name, userId: user.userId, email: user.email };
  let lead, timeline;
  try {
    [lead, timeline] = await Promise.all([getLeadDetail(actor, id), getLeadTimeline(actor, id)]);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const users = lead.canUpdate ? await assignableUsers(actor) : [];
  const back = user.role === "ADMIN" ? "/crm/lead-management" : "/crm/my-leads";
  // Lead aging: whole days since creation (derived, never stored).
  const ageDays = leadAgeDays(lead.createdAt);
  const label = lead.name || lead.company || "lead";
  return (
    <main className="page">
      <PageHeader
        eyebrow="Lead"
        title={lead.name || "Unnamed lead"}
        description={[lead.company, lead.location, lead.state].filter(Boolean).join(" · ") || undefined}
        meta={<>
          {lead.priority ? <StatusBadge value={lead.priority} tone={PRIORITY_TONE[lead.priority]}>{lead.priority} priority</StatusBadge> : null}
          {lead.tags.map((t) => <StatusBadge key={t} value={t} tone="neutral" dot={false}>#{t}</StatusBadge>)}
          <span className="muted" style={{ fontSize: ".8125rem" }}>
            {ageDays === 0 ? "Created today" : `${ageDays} day${ageDays === 1 ? "" : "s"} old`}
            {lead.lastActivityAt ? ` · last activity ${new Date(lead.lastActivityAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" })}` : " · no activity logged"}
          </span>
        </>}
        actions={<>
          {lead.canUpdate ? <LogActivityButton leadId={lead.id} leadLabel={label} users={users} currentUserId={user.id} /> : null}
          <Link className="button secondary" href={back}><ArrowLeft size={15} aria-hidden="true" />Back to leads</Link>
        </>}
      />
      <div className="grid-dashboard-2">
        <section className="card"><LeadDetailBody lead={lead} /></section>
        <section className="card" aria-labelledby="timeline-title">
          <div className="section-title-row">
            <h2 id="timeline-title" style={{ display: "flex", alignItems: "center", gap: 6 }}><History size={15} aria-hidden="true" />Activity &amp; history</h2>
          </div>
          <LeadTimeline entries={timeline} leadId={lead.id} viewerId={user.id} isAdmin={user.role === "ADMIN"} />
        </section>
      </div>
    </main>
  );
}
