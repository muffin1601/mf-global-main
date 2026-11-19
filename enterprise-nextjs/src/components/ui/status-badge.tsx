import type { ReactNode } from "react";

/**
 * Display-only status chips. The tone is derived from the STORED value; the text shown is the stored
 * value itself (or an explicit label), so no enum is renamed or translated. Unknown values fall back
 * to the neutral tone rather than throwing, because legacy data can contain values outside the enums.
 */
export type Tone = "success" | "warning" | "danger" | "info" | "primary" | "violet" | "neutral";

const LEAD_STATUS: Record<string, Tone> = {
  "New Lead": "info",
  "In Progress": "warning",
  "Followed Up": "violet",
  "Won Lead": "success",
  "Lost Lead": "danger",
};

const CALL_STATUS: Record<string, Tone> = {
  "Not Called": "neutral",
  Ring: "info",
  "Not Interested": "danger",
  "Available After One Month": "violet",
  "Follow-up Required": "warning",
  "Wrong Number": "danger",
  Converted: "success",
};

const GENERIC: Record<string, Tone> = {
  // vendors / products / users / imports (enum values and their labels)
  ACTIVE: "success", Active: "success", Enabled: "success", COMPLETED: "success", Completed: "success", Ready: "success", Valid: "success",
  PENDING: "warning", Pending: "warning", "In progress": "warning", PROCESSING: "warning", Duplicate: "warning", Duplicates: "warning",
  INACTIVE: "neutral", Inactive: "neutral", Disabled: "neutral", Archived: "neutral", ARCHIVED: "neutral",
  BLOCKED: "danger", Blacklisted: "danger", FAILED: "danger", Failed: "danger", Error: "danger", Invalid: "danger", Expired: "danger",
  ADMIN: "primary", USER: "neutral",
  High: "danger", Medium: "warning", Low: "neutral", Critical: "danger",
};

export type BadgeKind = "lead" | "call" | "generic";

export function toneFor(value: string, kind: BadgeKind = "generic"): Tone {
  const map = kind === "lead" ? LEAD_STATUS : kind === "call" ? CALL_STATUS : GENERIC;
  return map[value] ?? GENERIC[value] ?? "neutral";
}

export function StatusBadge({ value, kind = "generic", tone, children, dot = true, title }: {
  value: string; kind?: BadgeKind; tone?: Tone; children?: ReactNode; dot?: boolean; title?: string;
}) {
  const t = tone ?? toneFor(value, kind);
  return <span className={`badge tone-${t}${dot ? " badge-dot" : ""}`} title={title}>{children ?? value}</span>;
}
