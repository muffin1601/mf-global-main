import { ADDRESS_TYPES, CURRENCIES, PAYMENT_METHODS, VENDOR_PRIORITIES, VENDOR_TYPES } from "@/server/vendors/fields";
import type { Field } from "./modal-form";

type Opt = { id: string; name: string };
const opts = (list: readonly string[], blank?: string) => [...(blank !== undefined ? ([["", blank]] as const) : []), ...list.map((v) => [v, v] as const)] as const;

export type VendorDefaults = {
  id?: string;
  name?: string; legalName?: string | null; vendorType?: string | null; categoryId?: string | null; ownerId?: string | null; status?: string; priority?: string;
  email?: string | null; phone?: string | null; website?: string | null; gstin?: string | null; pan?: string | null; cin?: string | null; taxRegistration?: string | null;
  industry?: string | null; tags?: string[]; description?: string; notes?: string; updatedAt?: string;
  bank?: { bankName?: string; accountHolderName?: string; accountNumberMasked?: string; ifsc?: string; branch?: string; upi?: string; currency?: string; paymentTerms?: string | null; creditPeriodDays?: number | string | null; preferredPaymentMethod?: string };
};

export function vendorFields(args: { mode: "create" | "edit"; categories: Opt[]; owners: Opt[]; canEditBank: boolean; canArchive: boolean; d?: VendorDefaults }): Field[] {
  const { mode, categories, owners, canEditBank, canArchive, d = {} } = args;
  const statusOptions = [["PENDING", "Pending"], ["ACTIVE", "Active"], ["INACTIVE", "Inactive"], ...(canArchive ? ([["BLOCKED", "Blacklisted"]] as const) : [])] as const;
  const fields: Field[] = [
    { kind: "section", label: "Identity" },
    { name: "name", label: "Vendor name", required: true, defaultValue: d.name },
    { name: "legalName", label: "Legal business name", defaultValue: d.legalName },
    { name: "vendorType", kind: "select", label: "Vendor type", options: opts(VENDOR_TYPES, "Select type"), defaultValue: d.vendorType ?? "" },
    { name: "categoryId", kind: "select", label: "Category", options: [["", "No category"], ...categories.map((c) => [c.id, c.name] as const)], defaultValue: d.categoryId ?? "" },
    ...(mode === "create" ? [{ name: "status", kind: "select" as const, label: "Status", options: statusOptions, defaultValue: "PENDING" }] : []),
    { name: "priority", kind: "select", label: "Priority", options: opts(VENDOR_PRIORITIES), defaultValue: d.priority ?? "Medium" },
    { name: "ownerId", kind: "select", label: "Owner", options: [["", "Unassigned"], ...owners.map((o) => [o.id, o.name] as const)], defaultValue: d.ownerId ?? "" },
    { name: "industry", label: "Industry", defaultValue: d.industry },
    { name: "tags", label: "Tags", placeholder: "comma separated", defaultValue: (d.tags ?? []).join(", ") },
    { name: "description", kind: "textarea", label: "Description", defaultValue: d.description },
    { kind: "section", label: "Contact and registrations" },
    { name: "email", kind: "email", label: "Email", defaultValue: d.email },
    { name: "phone", kind: "tel", label: "Phone", defaultValue: d.phone },
    { name: "website", label: "Website", defaultValue: d.website },
    { name: "gstin", label: "GSTIN", placeholder: "15 characters", defaultValue: d.gstin },
    { name: "pan", label: "PAN", placeholder: "10 characters", defaultValue: d.pan },
    { name: "cin", label: "CIN", defaultValue: d.cin },
    { name: "taxRegistration", label: "Other tax registration", defaultValue: d.taxRegistration },
  ];
  if (mode === "create") {
    fields.push(
      { kind: "section", label: "Primary contact (optional)" },
      { name: "contactName", label: "Contact name" },
      { name: "contactDesignation", label: "Designation" },
      { name: "contactEmail", kind: "email", label: "Contact email" },
      { name: "contactPhone", kind: "tel", label: "Contact phone" },
      { kind: "section", label: "Primary address (optional)" },
      { name: "addressType", kind: "select", label: "Address type", options: opts(ADDRESS_TYPES), defaultValue: "Registered Office" },
      { name: "line1", label: "Address line 1" },
      { name: "line2", label: "Address line 2" },
      { name: "city", label: "City" },
      { name: "state", label: "State" },
      { name: "postalCode", label: "PIN code" },
      { name: "country", label: "Country", defaultValue: "India" },
    );
  } else {
    fields.push({ name: "notes", kind: "textarea", label: "Internal notes", defaultValue: d.notes }, { name: "updatedAt", kind: "hidden", defaultValue: d.updatedAt });
  }
  if (canEditBank) {
    const b = d.bank ?? {};
    fields.push(
      { kind: "section", label: "Banking and payment (restricted)" },
      { name: "bank_bankName", label: "Bank name", defaultValue: b.bankName },
      { name: "bank_accountHolderName", label: "Account holder", defaultValue: b.accountHolderName },
      { name: "bank_accountNumber", label: "Account number", placeholder: b.accountNumberMasked ? `${b.accountNumberMasked} (leave blank to keep)` : "9-18 digits", autoComplete: "off" },
      { name: "bank_ifsc", label: "IFSC", defaultValue: b.ifsc },
      { name: "bank_branch", label: "Branch", defaultValue: b.branch },
      { name: "bank_upi", label: "UPI ID", defaultValue: b.upi },
      { name: "bank_currency", kind: "select", label: "Currency", options: opts(CURRENCIES), defaultValue: b.currency ?? "INR" },
      { name: "bank_paymentTerms", label: "Payment terms", defaultValue: b.paymentTerms },
      { name: "bank_creditPeriodDays", kind: "number", label: "Credit period (days)", min: 0, max: 3650, defaultValue: b.creditPeriodDays },
      { name: "bank_preferredPaymentMethod", kind: "select", label: "Preferred payment method", options: opts(PAYMENT_METHODS, "Not set"), defaultValue: b.preferredPaymentMethod ?? "" },
    );
  }
  return fields;
}
