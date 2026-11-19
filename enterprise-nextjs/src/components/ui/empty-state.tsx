import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ title, description, icon: Icon = Inbox, action }: {
  title: string; description?: ReactNode; icon?: LucideIcon; action?: ReactNode;
}) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state-icon" aria-hidden="true"><Icon size={18} /></span>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

/** Empty row for a table: spans every column and renders an EmptyState. */
export function EmptyRow({ colSpan, ...props }: { colSpan: number } & Parameters<typeof EmptyState>[0]) {
  return <tr><td colSpan={colSpan} style={{ padding: 0 }}><EmptyState {...props} /></td></tr>;
}
