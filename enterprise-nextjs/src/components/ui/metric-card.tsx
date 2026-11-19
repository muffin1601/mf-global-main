import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import type { Tone } from "./status-badge";

/** KPI tile. When `href` is set the whole card is a link to the matching filtered list. */
export function MetricCard({ label, value, icon: Icon, tone = "primary", href, hint }: {
  label: string; value: ReactNode; icon?: LucideIcon; tone?: Tone; href?: string; hint?: ReactNode;
}) {
  const body = (
    <>
      <div className="kpi-head">
        <span className="kpi-label">{label}</span>
        {Icon ? <span className={`kpi-icon tone-${tone}`} aria-hidden="true"><Icon size={15} strokeWidth={2} /></span> : null}
      </div>
      <strong className="kpi-value">{value}</strong>
      {hint ? <span className="kpi-foot">{hint}</span> : null}
      {href ? <ArrowUpRight className="kpi-arrow" size={14} aria-hidden="true" /> : null}
    </>
  );
  return href
    ? <Link className="kpi" href={href as Route} aria-label={`${label}: ${typeof value === "string" || typeof value === "number" ? value : ""}. Open list`}>{body}</Link>
    : <div className="kpi">{body}</div>;
}
