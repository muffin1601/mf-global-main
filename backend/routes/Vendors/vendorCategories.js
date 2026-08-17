// Vendor category master data — configurable, not hard-coded.

const express = require('express');

const router = express.Router();

const VendorCategory = require('../../models/VendorCategory');
const Vendor = require('../../models/VendorData');
const authenticate = require('../../middleware/auth');
const { requireVendorPermission } = require('../../middleware/vendorPermissions');
const { validateCategoryPayload } = require('../../utils/vendorValidators');
const { normalizeText } = require('../../utils/vendorFields');
const { ok, fail, isValidId, toObjectId, handleError, logVendorAudit, pick } = require('../../utils/vendorHelpers');

const WRITABLE = ['name', 'description', 'isActive', 'sortOrder'];

/* --------------------------------- LIST --------------------------------- */
// Returns each category with the number of vendors using it, so the settings
// screen can show usage and warn before a category is retired. One grouped
// aggregation, not one count per category.
router.get('/', authenticate, requireVendorPermission('vendor.view'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.active === 'true') filter.isActive = true;
    if (req.query.active === 'false') filter.isActive = false;

    const [categories, usage] = await Promise.all([
      VendorCategory.find(filter).sort({ sortOrder: 1, name: 1 }).lean(),
      Vendor.aggregate([
        { $match: { category: { $ne: null } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

    const usageById = new Map(usage.map((u) => [String(u._id), u.count]));
    const rows = categories.map((c) => ({ ...c, vendorCount: usageById.get(String(c._id)) || 0 }));

    return ok(res, { categories: rows, total: rows.length });
  } catch (err) {
    return handleError(res, err, 'GET vendor categories');
  }
});

/* -------------------------------- CREATE -------------------------------- */
router.post('/', authenticate, requireVendorPermission('vendor.manage_categories'), async (req, res) => {
  try {
    const errors = validateCategoryPayload(req.body);
    if (errors.length) return fail(res, 400, errors[0], { errors });

    // Case-insensitive duplicate check before hitting the unique index, so the
    // user gets a sentence rather than a driver error.
    const existing = await VendorCategory.findOne({ nameNorm: normalizeText(req.body.name) }).lean();
    if (existing) return fail(res, 409, `A category named "${existing.name}" already exists`);

    const category = await VendorCategory.create({
      ...pick(req.body, WRITABLE),
      createdBy: req.user._id,
    });

    await logVendorAudit(req, 'Vendor category created', { categoryId: String(category._id), name: category.name });

    return ok(res, { category }, 201);
  } catch (err) {
    return handleError(res, err, 'POST vendor category');
  }
});

/* -------------------------------- UPDATE -------------------------------- */
router.put('/:id', authenticate, requireVendorPermission('vendor.manage_categories'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return fail(res, 400, 'Invalid category id');

    const errors = validateCategoryPayload(req.body, { partial: true });
    if (errors.length) return fail(res, 400, errors[0], { errors });

    const category = await VendorCategory.findById(req.params.id);
    if (!category) return fail(res, 404, 'Category not found');

    if (req.body.name) {
      const clash = await VendorCategory.findOne({
        nameNorm: normalizeText(req.body.name),
        _id: { $ne: category._id },
      }).lean();
      if (clash) return fail(res, 409, `A category named "${clash.name}" already exists`);
    }

    const before = { name: category.name, isActive: category.isActive };
    Object.assign(category, pick(req.body, WRITABLE));
    await category.save();

    await logVendorAudit(req, 'Vendor category updated', {
      categoryId: String(category._id), from: before, to: { name: category.name, isActive: category.isActive },
    });

    return ok(res, { category });
  } catch (err) {
    return handleError(res, err, 'PUT vendor category');
  }
});

/* -------------------------------- DELETE --------------------------------
 * A category in use is never silently removed. The caller must either
 * deactivate it (PUT isActive:false — it stays on existing vendors but is no
 * longer offered for new ones) or supply `reassignTo` so the affected vendors
 * are moved to another category in the same operation.
 * ---------------------------------------------------------------------- */
router.delete('/:id', authenticate, requireVendorPermission('vendor.manage_categories'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return fail(res, 400, 'Invalid category id');

    const category = await VendorCategory.findById(req.params.id);
    if (!category) return fail(res, 404, 'Category not found');

    const inUse = await Vendor.countDocuments({ category: category._id });

    if (inUse > 0) {
      const reassignTo = toObjectId(req.body?.reassignTo);
      if (!reassignTo) {
        return fail(res, 409,
          `${inUse} vendor${inUse === 1 ? ' is' : 's are'} using this category. Choose a category to move them to, or deactivate this one instead.`,
          { vendorCount: inUse, requiresReassignment: true });
      }
      if (String(reassignTo) === String(category._id)) {
        return fail(res, 400, 'Choose a different category to move the vendors to');
      }
      const target = await VendorCategory.findById(reassignTo).select('name').lean();
      if (!target) return fail(res, 404, 'The category to move vendors to no longer exists');

      await Vendor.updateMany({ category: category._id }, { $set: { category: reassignTo } });

      await logVendorAudit(req, 'Vendor category reassigned', {
        categoryId: String(category._id), from: category.name, to: target.name, vendorsMoved: inUse,
      });
    }

    await category.deleteOne();

    await logVendorAudit(req, 'Vendor category deleted', {
      categoryId: String(category._id), name: category.name, vendorsReassigned: inUse,
    });

    return ok(res, { message: 'Category deleted', vendorsReassigned: inUse });
  } catch (err) {
    return handleError(res, err, 'DELETE vendor category');
  }
});

module.exports = router;
