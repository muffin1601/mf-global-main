// Vendor performance evaluations.
//
// A vendor's headline score is always the mean of real, recorded evaluations.
// A vendor with none reports `overallScore: null` and the band "No data" — the
// module never manufactures a rating for an unevaluated supplier.

const express = require('express');

const router = express.Router({ mergeParams: true });

const VendorEvaluation = require('../../models/VendorEvaluation');
const Vendor = require('../../models/VendorData');
const authenticate = require('../../middleware/auth');
const { requireVendorPermission } = require('../../middleware/vendorPermissions');
const { getPaging, setPageHeaders } = require('../../utils/paginate');
const { validateEvaluationPayload, EVAL_CRITERIA } = require('../../utils/vendorValidators');
const {
  ok, fail, isValidId, handleError, logVendorAudit, pick,
  recomputeVendorPerformance, performanceBand,
} = require('../../utils/vendorHelpers');

const loadVendor = async (req, res, next) => {
  try {
    if (!isValidId(req.params.vendorId)) return fail(res, 400, 'Invalid vendor id');
    const vendor = await Vendor.findById(req.params.vendorId).select('_id v_code name performance');
    if (!vendor) return fail(res, 404, 'Vendor not found');
    req.vendor = vendor;
    return next();
  } catch (err) {
    return handleError(res, err, 'loadVendor (performance)');
  }
};

/* ------------------- Leaderboard across all vendors ------------------- */
// Backs the "Vendor Performance" page. Only vendors that have actually been
// evaluated are ranked; unevaluated ones are reported separately so the page
// can say how much of the supplier base still needs reviewing.
router.get('/leaderboard', authenticate, requireVendorPermission('vendor.performance'), async (req, res) => {
  try {
    const { page, limit, skip } = getPaging(req);

    const filter = { isArchived: { $ne: true }, 'performance.overallScore': { $ne: null } };
    const [rows, total, unevaluated] = await Promise.all([
      Vendor.find(filter)
        .select('v_code name status category performance')
        .populate('category', 'name')
        .sort({ 'performance.overallScore': -1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Vendor.countDocuments(filter),
      Vendor.countDocuments({ isArchived: { $ne: true }, 'performance.overallScore': null }),
    ]);

    const vendors = rows.map((v) => ({
      ...v,
      performanceBand: performanceBand(v.performance?.overallScore ?? null),
    }));

    const pages = setPageHeaders(res, total, page, limit);
    return ok(res, { vendors, total, page, pages, unevaluated, criteria: EVAL_CRITERIA });
  } catch (err) {
    return handleError(res, err, 'GET performance leaderboard');
  }
});

/* --------------------- Evaluations for one vendor --------------------- */
router.get('/:vendorId/evaluations', authenticate, requireVendorPermission('vendor.view'), loadVendor, async (req, res) => {
  try {
    const { page, limit, skip } = getPaging(req);

    const [evaluations, total] = await Promise.all([
      VendorEvaluation.find({ vendor: req.vendor._id })
        .sort({ evaluationDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VendorEvaluation.countDocuments({ vendor: req.vendor._id }),
    ]);

    const pages = setPageHeaders(res, total, page, limit);
    return ok(res, {
      evaluations,
      total,
      page,
      pages,
      performance: req.vendor.performance,
      performanceBand: performanceBand(req.vendor.performance?.overallScore ?? null),
      criteria: EVAL_CRITERIA,
    });
  } catch (err) {
    return handleError(res, err, 'GET vendor evaluations');
  }
});

/* ------------------------- Record an evaluation ------------------------- */
router.post('/:vendorId/evaluations', authenticate, requireVendorPermission('vendor.performance'), loadVendor, async (req, res) => {
  try {
    const errors = validateEvaluationPayload(req.body);
    if (errors.length) return fail(res, 400, errors[0], { errors });

    const scores = pick(req.body, EVAL_CRITERIA);
    for (const key of EVAL_CRITERIA) scores[key] = Number(scores[key]);

    const evaluation = await VendorEvaluation.create({
      ...scores,
      ...pick(req.body, ['comments', 'periodLabel']),
      vendor: req.vendor._id,
      evaluationDate: req.body.evaluationDate ? new Date(req.body.evaluationDate) : new Date(),
      evaluatedBy: req.user._id,
      evaluatedByName: req.user.name || req.user.username || '',
    });

    // Refresh the denormalized rollup so lists and dashboards stay consistent.
    const performance = await recomputeVendorPerformance(req.vendor._id);

    await logVendorAudit(req, 'Vendor evaluation recorded', {
      vendorId: req.vendor._id, v_code: req.vendor.v_code,
      overallScore: evaluation.overallScore,
    });

    return ok(res, {
      evaluation,
      performance,
      performanceBand: performanceBand(performance?.overallScore ?? null),
    }, 201);
  } catch (err) {
    return handleError(res, err, 'POST vendor evaluation');
  }
});

/* ------------------------- Delete an evaluation ------------------------- */
router.delete('/:vendorId/evaluations/:evalId', authenticate, requireVendorPermission('vendor.performance'), loadVendor, async (req, res) => {
  try {
    if (!isValidId(req.params.evalId)) return fail(res, 400, 'Invalid evaluation id');

    const evaluation = await VendorEvaluation.findById(req.params.evalId);
    if (!evaluation || String(evaluation.vendor) !== String(req.vendor._id)) {
      return fail(res, 404, 'Evaluation not found for this vendor');
    }

    await evaluation.deleteOne();
    const performance = await recomputeVendorPerformance(req.vendor._id);

    await logVendorAudit(req, 'Vendor evaluation deleted', {
      vendorId: req.vendor._id, v_code: req.vendor.v_code, evaluationId: String(req.params.evalId),
    });

    return ok(res, { performance, performanceBand: performanceBand(performance?.overallScore ?? null) });
  } catch (err) {
    return handleError(res, err, 'DELETE vendor evaluation');
  }
});

module.exports = router;
