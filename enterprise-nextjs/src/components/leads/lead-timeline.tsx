import type { LucideIcon } from "lucide-react";
import { ArrowRightLeft, CalendarCheck, FileText, Mail, MessageSquare, Phone, Sparkles, StickyNote, UserCheck, Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ActivityRowActions } from "@/components/activities/activity-row-actions";
import type { TimelineEntry } from "@/server/leads/timeline";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const ACTIVITY_ICON: Record<string, LucideIcon> = { CALL: Phone, EMAIL: Mail, MEETING: Users, FOLLOW_UP: CalendarCheck, TASK: FileText, NOTE: StickyNote, OTHER: MessageSquare };

function iconFor(e: TimelineEntry): LucideIcon {
  if (e.kind === "created") return Sparkles;
  if (e.kind === "status") return ArrowRightLeft;
  if (e.kind === "ownership") return UserCheck;
  return ACTIVITY_ICON[e.activity?.type ?? ""] ?? MessageSquare;
}

/**
 * Server-rendered lead timeline (newest first). Activity entries carry row actions; the server
 * re-checks every action, the `can*` flags only decide which buttons are shown.
 */
export function LeadTimeline({ entries, leadId, viewerId, isAdmin }: { entries: TimelineEntry[]; leadId: string; viewerId: string; isAdmin: boolean }) {
  if (!entries.length) return <EmptyState title="No history yet" description="Calls, notes, status changes and assignments will appear here." />;
  return (
    <ol className="timeline">
      {entries.map((e) => {
        const Icon = iconFor(e);
        const a = e.activity;
        return (
          <li key={e.id} className={`timeline-item kind-${e.kind}`}>
            <span className="timeline-icon" aria-hidden="true"><Icon size={14} /></span>
            <div className="timeline-body">
              <div className="timeline-head">
                <strong>{e.title}</strong>
                {a && a.type !== "NOTE" && a.status === "OPEN" ? (
                  <StatusBadge value="open" tone={a.dueAt && a.dueAt < new Date().toISOString() ? "danger" : "info"}>
                    {a.dueAt ? `Due ${fmt(a.dueAt)}` : "Open"}
                  </StatusBadge>
                ) : null}
                {a ? (
                  <span style={{ marginLeft: "auto" }}>
                    <ActivityRowActions id={a.id} status={a.status} type={a.type} subject={e.title} leadId={leadId}
                      canChange={isAdmin || a.createdById === viewerId || a.assigneeId === viewerId} canDelete={isAdmin || a.createdById === viewerId} />
                  </span>
                ) : null}
              </div>
              {e.detail ? <p className="timeline-detail">{e.detail}</p> : null}
              <p className="timeline-meta"><time dateTime={e.at}>{fmt(e.at)}</time>{e.actor ? ` · ${e.actor}` : ""}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
