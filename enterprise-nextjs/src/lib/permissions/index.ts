import type { UserRole } from "@/generated/prisma/enums";

/* =============================================================================
   Vendor permissions (unchanged; used by src/server/vendors/* and vendor pages)
   ========================================================================== */
export const vendorPermissions = [
  "vendor.view", "vendor.create", "vendor.edit", "vendor.archive", "vendor.delete",
  "vendor.export", "vendor.import", "vendor.documents", "vendor.performance",
  "vendor.manage_categories", "vendor.view_bank", "vendor.edit_bank"
] as const;
export type VendorPermission = typeof vendorPermissions[number];

const rolePermissions: Record<UserRole, ReadonlySet<VendorPermission>> = {
  ADMIN: new Set(vendorPermissions),
  USER: new Set(["vendor.view", "vendor.create", "vendor.edit", "vendor.export", "vendor.documents"])
};

export function hasVendorPermission(role: UserRole, permission: VendorPermission) {
  return rolePermissions[role].has(permission);
}

export function assertVendorPermission(role: UserRole, permission: VendorPermission) {
  if (!hasVendorPermission(role, permission)) throw new Error("FORBIDDEN");
}

/* =============================================================================
   CRM capability catalog (Enterprise CRM 2.0, Phase 1 foundation)

   Every capability below names a rule that the services ALREADY enforce today.
   The grants reproduce current behaviour exactly for the two existing roles,
   and tests/permissions.catalog.test.ts pins them. Nothing here widens access.

   Two layers, both enforced on the server:
   1. Capability: may this role perform this kind of action at all?  -> can()
   2. Record scope: which records? Leads use leadScope() (assignment.canView),
      edits need assignment.canUpdate, and quotations are owner-only for USER.
      Scope stays in the services. A capability never bypasses it.

   Configurable roles (Sales Manager, Finance, Auditor...) are a Phase 6
   decision that needs business approval and a schema change. See
   docs/enterprise/IMPLEMENTATION_PLAN.md, "Decisions requiring approval".
   ========================================================================== */
export const CRM_PERMISSIONS = {
  "dashboard.view_org": "See organisation-wide dashboard KPIs and the employee leaderboard",
  "leads.view_all": "See every lead, including unassigned leads",
  "leads.view_own": "See leads assigned to you (assignment with view access)",
  "leads.create": "Create leads manually",
  "leads.edit": "Edit leads within scope (USER: needs update access on the assignment)",
  "leads.assign": "Assign, transfer and unassign leads",
  "leads.bulk_update": "Bulk-update lead category/location",
  "leads.delete": "Delete leads, including delete-all-matching",
  "leads.import": "Import leads from CSV/Excel (USER: own import history only)",
  "leads.import_assign": "Assign leads to employees during import",
  "leads.export": "Export leads within scope",
  "quotations.view_all": "See every user's quotations",
  "quotations.create": "Create quotations",
  "quotations.edit": "Edit quotations within scope (USER: own only)",
  "quotations.delete": "Delete quotations",
  "products.view": "View and search the product catalogue",
  "products.manage": "Create, edit and archive products and categories",
  "reports.view": "View lead reports within scope",
  "reports.view_all": "Report across all employees and unassigned leads",
  "reports.export": "Export reports within scope",
  "users.manage": "Create users, enable/disable accounts, reset passwords",
  "audit.view": "View the activity (audit) log",
  "settings.manage": "Change CRM-wide configuration",
} as const;
export type CrmPermission = keyof typeof CRM_PERMISSIONS;
export const crmPermissionList = Object.keys(CRM_PERMISSIONS) as CrmPermission[];

const USER_GRANTS: readonly CrmPermission[] = [
  "leads.view_own", "leads.create", "leads.edit", "leads.import", "leads.export",
  "quotations.create", "quotations.edit",
  "products.view",
  "reports.view", "reports.export",
];

const crmGrants: Record<UserRole, ReadonlySet<CrmPermission>> = {
  ADMIN: new Set(crmPermissionList),
  USER: new Set(USER_GRANTS),
};

/** Capability check by role. Record scope must still be applied by the service. */
export function can(role: UserRole, permission: CrmPermission): boolean {
  return crmGrants[role]?.has(permission) ?? false;
}

/** The full grant list for a role (for the settings/permission-matrix UI). */
export const permissionsFor = (role: UserRole): CrmPermission[] => crmPermissionList.filter((p) => can(role, p));
