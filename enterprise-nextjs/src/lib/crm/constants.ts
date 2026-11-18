// Single source of truth for CRM enumerations (values come from the MERN app).
export const LEAD_STATUSES = ["New Lead", "In Progress", "Followed Up", "Won Lead", "Lost Lead"] as const;
export const CALL_STATUSES = ["Not Called", "Ring", "Not Interested", "Available After One Month", "Follow-up Required", "Wrong Number", "Converted"] as const;
// "LinkedIn" is not offered by the MERN create form but exists in live data (24 leads), so it must stay valid.
export const DATA_TYPES = ["IndiaMart", "Offline", "TradeIndia", "Exhibition", "WebPortals", "LinkedIn", "Other"] as const;
export const WON_STATUS = "Won Lead" as const;
export const TRENDING_STATUS = "In Progress" as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type CallStatus = (typeof CALL_STATUSES)[number];
