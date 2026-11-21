import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Recoverable error panel, the counterpart of <EmptyState>. Shows a safe, human message and an
 * optional reference (e.g. Next.js `error.digest`) that support can match to server logs. Never pass
 * raw exception text or stack traces here; server errors must stay on the server.
 */
export function ErrorState({ title = "Something went wrong", description, reference, action, icon: Icon = AlertTriangle }: {
  title?: string; description?: ReactNode; reference?: string; action?: ReactNode; icon?: LucideIcon;
}) {
  return (
    <div className="empty-state error-state" role="alert">
      <span className="empty-state-icon" aria-hidden="true"><Icon size={18} /></span>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {reference ? <p>Reference: <code>{reference}</code></p> : null}
      {action}
    </div>
  );
}
