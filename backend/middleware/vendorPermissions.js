// Granular vendor capabilities layered on top of the CRM's existing role model.
//
// The application authenticates with `authenticate` (JWT -> req.user) and
// authorizes with roles ("admin" | "user"). Rather than inventing a parallel
// permission store, this module maps each vendor capability onto the roles that
// hold it. The capability names are the ones the module is specified against
// (vendor.view, vendor.create, ...), so behaviour is described in one table
// instead of being scattered across route definitions — and moving to a
// per-user permission store later means changing only `roleHasPermission`.
//
// This runs on the SERVER for every sensitive route: the frontend hides
// controls the user lacks, but hiding is cosmetic and never the enforcement.

const VENDOR_PERMISSIONS = [
  'vendor.view',
  'vendor.create',
  'vendor.edit',
  'vendor.archive',
  'vendor.delete',
  'vendor.export',
  'vendor.import',
  'vendor.documents',
  'vendor.performance',
  'vendor.manage_categories',
  'vendor.view_bank',
  'vendor.edit_bank',
];

// role -> capabilities. "user" gets read + day-to-day collaboration; anything
// destructive, financial or configuration-level is admin-only.
const ROLE_PERMISSIONS = {
  admin: new Set(VENDOR_PERMISSIONS),
  user: new Set([
    'vendor.view',
    'vendor.create',
    'vendor.edit',
    'vendor.export',
    'vendor.documents',
  ]),
};

const roleHasPermission = (role, permission) =>
  Boolean(ROLE_PERMISSIONS[role] && ROLE_PERMISSIONS[role].has(permission));

const permissionsForRole = (role) => Array.from(ROLE_PERMISSIONS[role] || []);

// Express middleware. Must be mounted AFTER `authenticate`.
const requireVendorPermission = (...permissions) => (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  const ok = permissions.every((p) => roleHasPermission(req.user.role, p));
  if (!ok) {
    return res.status(403).json({
      message: 'You do not have permission to perform this action',
    });
  }
  return next();
};

module.exports = {
  VENDOR_PERMISSIONS,
  roleHasPermission,
  permissionsForRole,
  requireVendorPermission,
};
