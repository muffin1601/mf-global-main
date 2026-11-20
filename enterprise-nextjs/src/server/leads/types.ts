// Client-safe DTOs (plain JSON: dates are ISO strings, decimals are numbers).
export type Address = { street: string; city: string; state: string; postalCode: string; country: string };
export type AdditionalContact = { name: string; contact: string; details: string };

export type LeadAssignee = { userId: string; name: string; canView: boolean; canUpdate: boolean };

export type LeadRow = {
  id: string; name: string | null; company: string | null; email: string | null; phone: string | null; contact: string | null;
  location: string | null; state: string | null; category: string | null; dataType: string | null; fileName: string | null;
  status: string; callStatus: string; followUpDate: string | null; createdAt: string; source: string;
  priority: string | null; tags: string[]; lastActivityAt: string | null; updatedAt: string;
  assignees: LeadAssignee[];
  /** Whether the signed-in actor may edit this lead (admin, or assignee with update permission). */
  canUpdate: boolean;
};

export type LeadHistoryEntry = {
  id: string; fromStatus: string | null; toStatus: string; fromCallStatus: string | null; toCallStatus: string | null;
  changedAt: string; changedByName: string | null;
};

export type LeadDetail = LeadRow & {
  countryCode: string | null; quantity: number | null; requirements: string | null; remarks: string | null; inquiryDate: string | null;
  address: string | null; callingDate: string | null; updatedAt: string;
  followUps: { one: string | null; two: string | null; three: string | null };
  billingAddress: Address | null; shippingAddress: Address | null; additionalContacts: AdditionalContact[];
  history: LeadHistoryEntry[];
  assignedAtByUser: Record<string, string>;
};

export type LeadListResult = { rows: LeadRow[]; total: number; page: number; pageSize: number; pages: number };
export type FilterMeta = { categories: string[]; locations: string[]; states: string[]; fileNames: string[]; dataTypes: string[]; tags: string[] };
export type DuplicateCheck = { exists: false } | { exists: true; field: "phone" | "contact"; lead: { id: string; name: string | null; company: string | null; phone: string | null } | null };
