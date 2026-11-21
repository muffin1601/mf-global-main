// Single source of truth for CRM enumerations (values come from the MERN app).
export const LEAD_STATUSES = ["New Lead", "In Progress", "Followed Up", "Won Lead", "Lost Lead"] as const;
export const CALL_STATUSES = ["Not Called", "Ring", "Not Interested", "Available After One Month", "Follow-up Required", "Wrong Number", "Converted"] as const;
// "LinkedIn" is not offered by the MERN create form but exists in live data (24 leads), so it must stay valid.
export const DATA_TYPES = ["IndiaMart", "Offline", "TradeIndia", "Exhibition", "WebPortals", "LinkedIn", "Other"] as const;
export const WON_STATUS = "Won Lead" as const;
export const TRENDING_STATUS = "In Progress" as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type CallStatus = (typeof CALL_STATUSES)[number];

// Enterprise CRM 2.0 (Phase 2). New, optional lead attributes; existing leads keep NULL / no tags.
export const LEAD_PRIORITIES = ["Low", "Medium", "High"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];
export const MAX_LEAD_TAGS = 20;
export const MAX_TAG_LENGTH = 40;
/** Tags are trimmed, single-spaced, case-insensitively de-duplicated (first spelling wins). */
export function normalizeTags(input: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const tag = raw.replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LENGTH);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
  }
  return out.slice(0, MAX_LEAD_TAGS);
}
