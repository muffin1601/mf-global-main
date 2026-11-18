import type { UserRole } from "@/generated/prisma/enums";

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
