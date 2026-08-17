// Vendor notes, calls, emails, meetings, follow-ups, tasks and reminders —
// the chronological timeline shown on the vendor profile.

const express = require('express');

const router = express.Router({ mergeParams: true });

const VendorActivity = require('../../models/VendorActivity');
const Vendor = require('../../models/VendorData');
const authenticate = require('../../middleware/auth');
const { requireVendorPermission } = require('../../middleware/vendorPermissions');
const { getPaging, setPageHeaders } = require('../../utils/paginate');
const { validateActivityPayload } = require('../../utils/vendorValidators');
const { ACTIVITY_TYPES } = require('../../utils/vendorFields');
const { ok, fail, isValidId, handleError, logVendorAudit, pick } = require('../../utils/vendorHelpers');

const loadVendor = async (req, res, next) => {
  try {
    if (!isValidId(req.params.vendorId)) return fail(res, 400, 'Invalid vendor id');
    const vendor = await Vendor.findById(req.params.vendorId).select('_id v_code name');
    if (!vendor) return fail(res, 404, 'Vendor not found');
    req.vendor = vendor;
    return next();
  } catch (err) {
    return handleError(res, err, 'loadVendor (activities)');
  }
};

router.get('/:vendorId/activities', authenticate, requireVendorPermission('vendor.view'), loadVendor, async (req, res) => {
  try {
    const { page, limit, skip } = getPaging(req);

    const filter = { vendor: req.vendor._id };
    if (req.query.type && ACTIVITY_TYPES.includes(req.query.type)) filter.activityType = req.query.type;
    if (req.query.open === 'true') filter.completedAt = null;

    const [activities, total] = await Promise.all([
      VendorActivity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      VendorActivity.countDocuments(filter),
    ]);

    const pages = setPageHeaders(res, total, page, limit);
    return ok(res, { activities, total, page, pages });
  } catch (err) {
    return handleError(res, err, 'GET vendor activities');
  }
});

router.post('/:vendorId/activities', authenticate, requireVendorPermission('vendor.edit'), loadVendor, async (req, res) => {
  try {
    const errors = validateActivityPayload(req.body);
    if (errors.length) return fail(res, 400, errors[0], { errors });

    const data = pick(req.body, ['activityType', 'subject', 'body', 'dueDate']);

    const activity = await VendorActivity.create({
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      vendor: req.vendor._id,
      createdBy: req.user._id,
      createdByName: req.user.name || req.user.username || '',
    });

    // Keeps the "Last Activity" column on the list page accurate without a
    // per-row lookup.
    await Vendor.updateOne({ _id: req.vendor._id }, { $set: { lastActivityAt: activity.createdAt } });

    await logVendorAudit(req, 'Vendor activity added', {
      vendorId: req.vendor._id, v_code: req.vendor.v_code, activityType: activity.activityType,
    });

    return ok(res, { activity }, 201);
  } catch (err) {
    return handleError(res, err, 'POST vendor activity');
  }
});

router.put('/:vendorId/activities/:activityId', authenticate, requireVendorPermission('vendor.edit'), loadVendor, async (req, res) => {
  try {
    if (!isValidId(req.params.activityId)) return fail(res, 400, 'Invalid activity id');

    const activity = await VendorActivity.findById(req.params.activityId);
    if (!activity || String(activity.vendor) !== String(req.vendor._id)) {
      return fail(res, 404, 'Activity not found for this vendor');
    }
    // Timeline entries are authored content: only the author or an
    // administrator may rewrite one.
    if (String(activity.createdBy) !== String(req.user._id) && req.user.role !== 'admin') {
      return fail(res, 403, 'You can only edit activities you created');
    }

    const errors = validateActivityPayload({ ...activity.toObject(), ...req.body });
    if (errors.length) return fail(res, 400, errors[0], { errors });

    const data = pick(req.body, ['activityType', 'subject', 'body', 'dueDate']);
    if ('dueDate' in data) data.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    // `completed` is a toggle rather than a free-form timestamp.
    if (req.body.completed === true) data.completedAt = activity.completedAt || new Date();
    if (req.body.completed === false) data.completedAt = null;

    Object.assign(activity, data);
    await activity.save();

    return ok(res, { activity });
  } catch (err) {
    return handleError(res, err, 'PUT vendor activity');
  }
});

router.delete('/:vendorId/activities/:activityId', authenticate, requireVendorPermission('vendor.edit'), loadVendor, async (req, res) => {
  try {
    if (!isValidId(req.params.activityId)) return fail(res, 400, 'Invalid activity id');

    const activity = await VendorActivity.findById(req.params.activityId);
    if (!activity || String(activity.vendor) !== String(req.vendor._id)) {
      return fail(res, 404, 'Activity not found for this vendor');
    }
    if (String(activity.createdBy) !== String(req.user._id) && req.user.role !== 'admin') {
      return fail(res, 403, 'You can only delete activities you created');
    }

    await activity.deleteOne();

    await logVendorAudit(req, 'Vendor activity deleted', {
      vendorId: req.vendor._id, v_code: req.vendor.v_code, activityType: activity.activityType,
    });

    return ok(res, { message: 'Activity deleted' });
  } catch (err) {
    return handleError(res, err, 'DELETE vendor activity');
  }
});

module.exports = router;
