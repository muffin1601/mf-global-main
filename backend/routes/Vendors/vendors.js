const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const Vendor = require('../../models/VendorData');
const VendorCategory = require('../../models/VendorCategory');
const VendorProduct = require('../../models/VendorProduct');
const VendorDocument = require('../../models/VendorDocument');
const VendorEvaluation = require('../../models/VendorEvaluation');
const VendorActivity = require('../../models/VendorActivity');
const User = require('../../models/User');
const ActivityLog = require('../../models/UserActivity');

const authenticate = require('../../middleware/auth');
const { requireVendorPermission, permissionsForRole, roleHasPermission } = require('../../middleware/vendorPermissions');
const { getPaging, setPageHeaders } = require('../../utils/paginate');
const { validateVendorPayload } = require('../../utils/vendorValidators');
const { findPotentialDuplicates } = require('../../utils/vendorDuplicates');
const {
  VENDOR_STATUSES, VENDOR_PRIORITIES, VENDOR_TYPES, ADDRESS_TYPES,
  CONTACT_TYPES, DOCUMENT_TYPES, ACTIVITY_TYPES, PAYMENT_METHODS, CURRENCIES,
  maskTail,
} = require('../../utils/vendorFields');
const {
  ok, fail, isValidId, toObjectId, handleError, logVendorAudit, diffSummary,
  performanceBand, pick, escapeRegex,
} = require('../../utils/vendorHelpers');

/* Fields a client is allowed to set. Anything else in the body (v_code,
 * performance, createdBy, isArchived, _id, __v …) is dropped, so a crafted
 * request cannot overwrite server-managed state. */
const WRITABLE_FIELDS = [
  'name', 'legalName', 'type', 'category', 'status', 'priority', 'website',
  'gstin', 'pan', 'cin', 'taxRegistration', 'industry', 'description', 'tags',
  'owner', 'contacts', 'addresses', 'bank',
  // Legacy top-level fields kept in sync for the older product screens.
  'contact_name', 'phone', 'email', 'cat_id', 'products',
  'addr1', 'addr2', 'city', 'state', 'pin_code',
];

// Bank fields are only writable by roles holding vendor.edit_bank.
const BANK_FIELDS = [
  'bankName', 'accountHolderName', 'accountNumber', 'ifsc', 'branch', 'upi',
  'paymentTerms', 'creditPeriodDays', 'currency', 'preferredPaymentMethod',
];

// Audited scalar fields for the update diff. Bank and other sensitive blocks
// are deliberately excluded — the audit records only that banking changed.
const AUDITED_FIELDS = [
  'name', 'legalName', 'type', 'status', 'priority', 'website', 'gstin', 'pan',
  'cin', 'industry', 'category', 'owner', 'phone', 'email',
];

// Columns the list may be sorted by. An arbitrary client string is never used
// as a sort key (it would let callers probe unindexed / sensitive paths).
const SORTABLE = {
  name: 'name',
  v_code: 'v_code',
  status: 'status',
  priority: 'priority',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  lastActivityAt: 'lastActivityAt',
  performance: 'performance.overallScore',
};

// Projection for list responses: never includes the bank block, so account
// details cannot leak through the table endpoint at all.
const LIST_PROJECTION = 'v_code name legalName type category status priority industry tags logo owner email phone contacts addresses.city addresses.state performance.overallScore performance.evaluationCount isArchived lastActivityAt createdAt updatedAt';

/* -------------------------------------------------------------------------
 * Reference data — statuses, priorities, categories, owners and the calling
 * user's effective permissions. One request instead of five on page load.
 * ---------------------------------------------------------------------- */
router.get('/meta', authenticate, requireVendorPermission('vendor.view'), async (req, res) => {
  try {
    const [categories, owners] = await Promise.all([
      VendorCategory.find({ isActive: true }).select('_id name code').sort({ sortOrder: 1, name: 1 }).lean(),
      User.find({ enabled: true }).select('_id name username').sort({ name: 1 }).lean(),
    ]);

    return ok(res, {
      statuses: VENDOR_STATUSES,
      priorities: VENDOR_PRIORITIES,
      types: VENDOR_TYPES,
      addressTypes: ADDRESS_TYPES,
      contactTypes: CONTACT_TYPES,
      documentTypes: DOCUMENT_TYPES,
      activityTypes: ACTIVITY_TYPES,
      paymentMethods: PAYMENT_METHODS,
      currencies: CURRENCIES,
      categories,
      owners,
      permissions: permissionsForRole(req.user.role),
    });
  } catch (err) {
    return handleError(res, err, 'GET /meta');
  }
});

/* -------------------------------------------------------------------------
 * Dashboard summary. Every figure is derived from real documents; there are no
 * placeholder metrics. Metrics with no underlying data report null/0 and the
 * UI renders them as "No data" rather than inventing a number.
 * ---------------------------------------------------------------------- */
router.get('/summary', authenticate, requireVendorPermission('vendor.view'), async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const expiryHorizon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [statusCounts, archivedCount, recentCount, expiringDocs, ratingAgg, topRated, leadTimeAgg] = await Promise.all([
      Vendor.aggregate([
        { $match: { isArchived: { $ne: true } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Vendor.countDocuments({ isArchived: true }),
      Vendor.countDocuments({ isArchived: { $ne: true }, createdAt: { $gte: thirtyDaysAgo } }),
      VendorDocument.aggregate([
        {
          $match: {
            status: 'Active',
            expiryDate: { $ne: null, $lte: expiryHorizon },
          },
        },
        { $group: { _id: '$vendor' } },
        { $count: 'vendors' },
      ]),
      Vendor.aggregate([
        { $match: { isArchived: { $ne: true }, 'performance.overallScore': { $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$performance.overallScore' }, rated: { $sum: 1 } } },
      ]),
      Vendor.find({ isArchived: { $ne: true }, 'performance.overallScore': { $ne: null } })
        .select('v_code name performance.overallScore performance.evaluationCount')
        .sort({ 'performance.overallScore': -1 })
        .limit(5)
        .lean(),
      VendorProduct.aggregate([
        { $match: { isActive: true, leadTimeDays: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: '$leadTimeDays' }, records: { $sum: 1 } } },
      ]),
    ]);

    const byStatus = Object.fromEntries(VENDOR_STATUSES.map((s) => [s, 0]));
    let total = 0;
    for (const row of statusCounts) {
      if (row._id in byStatus) byStatus[row._id] = row.count;
      total += row.count;
    }

    // "Requiring review": pending vendors plus active vendors that have never
    // been evaluated — both are real, actionable states.
    const neverEvaluated = await Vendor.countDocuments({
      isArchived: { $ne: true },
      status: 'Active',
      'performance.overallScore': null,
    });

    return ok(res, {
      summary: {
        total,
        archived: archivedCount,
        byStatus,
        addedLast30Days: recentCount,
        vendorsWithExpiringDocuments: expiringDocs[0]?.vendors || 0,
        requiringReview: byStatus.Pending + neverEvaluated,
        // null when nothing has been rated yet — the card shows "No data".
        averageRating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 100) / 100 : null,
        ratedVendors: ratingAgg[0]?.rated || 0,
        averageLeadTimeDays: leadTimeAgg[0] ? Math.round(leadTimeAgg[0].avg) : null,
        topRated: topRated.map((v) => ({
          _id: v._id,
          v_code: v.v_code,
          name: v.name,
          score: v.performance?.overallScore ?? null,
          evaluations: v.performance?.evaluationCount ?? 0,
          band: performanceBand(v.performance?.overallScore ?? null),
        })),
      },
    });
  } catch (err) {
    return handleError(res, err, 'GET /summary');
  }
});

/* -------------------------------------------------------------------------
 * Build the Mongo filter for the list/export endpoints from query params.
 * All user input is escaped or coerced; nothing is interpolated raw.
 * ---------------------------------------------------------------------- */
const buildListQuery = (query = {}) => {
  const filter = {};

  // $ne:true rather than false — vendors created before this module existed
  // have no isArchived field at all, and {isArchived:false} does NOT match a
  // missing field. Using equality here would hide the entire existing
  // vendor list.
  filter.isArchived = String(query.archived || '') === 'true' ? true : { $ne: true };

  if (query.status) {
    const statuses = String(query.status).split(',').map((s) => s.trim()).filter((s) => VENDOR_STATUSES.includes(s));
    if (statuses.length) filter.status = { $in: statuses };
  }

  if (query.priority) {
    const priorities = String(query.priority).split(',').map((s) => s.trim()).filter((p) => VENDOR_PRIORITIES.includes(p));
    if (priorities.length) filter.priority = { $in: priorities };
  }

  if (query.type && VENDOR_TYPES.includes(query.type)) filter.type = query.type;

  if (query.category) {
    const ids = String(query.category).split(',').map(toObjectId).filter(Boolean);
    if (ids.length) filter.category = { $in: ids };
  }

  if (query.owner) {
    if (String(query.owner) === 'unassigned') filter.owner = null;
    else {
      const ids = String(query.owner).split(',').map(toObjectId).filter(Boolean);
      if (ids.length) filter.owner = { $in: ids };
    }
  }

  if (query.tag) {
    filter.tags = String(query.tag).trim();
  }

  // Created-date window.
  const from = query.createdFrom ? new Date(query.createdFrom) : null;
  const to = query.createdTo ? new Date(query.createdTo) : null;
  if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
    filter.createdAt = {};
    if (from && !Number.isNaN(from.getTime())) filter.createdAt.$gte = from;
    if (to && !Number.isNaN(to.getTime())) {
      // Inclusive end-of-day so "to = today" includes today's records.
      to.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = to;
    }
  }

  // Global search across the identity fields users actually search by.
  // Anchored prefix regexes on indexed normalized fields keep this usable at
  // scale; the term is escaped so regex metacharacters are literal.
  const term = String(query.search || '').trim();
  if (term) {
    const rx = new RegExp(escapeRegex(term), 'i');
    const digits = term.replace(/\D/g, '');
    const or = [
      { name: rx },
      { legalName: rx },
      { v_code: rx },
      { email: rx },
      { 'contacts.email': rx },
      { 'contacts.fullName': rx },
    ];
    // Identifier clauses only when the term actually contains alphanumerics —
    // otherwise the anchored prefix would collapse to /^/ and match everything.
    const code = term.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code) {
      or.push({ gstin: new RegExp(`^${escapeRegex(code)}`) });
      or.push({ pan: new RegExp(`^${escapeRegex(code)}`) });
    }
    if (digits.length >= 4) {
      or.push({ phone: new RegExp(escapeRegex(digits)) });
      or.push({ phoneNorm: new RegExp(escapeRegex(digits)) });
      or.push({ 'contacts.phone': new RegExp(escapeRegex(digits)) });
    }
    filter.$or = or;
  }

  return filter;
};

const buildSort = (query = {}) => {
  const key = SORTABLE[query.sortBy] || 'createdAt';
  const dir = String(query.sortDir || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  // _id tiebreaker keeps pagination stable when the sort key has ties.
  return { [key]: dir, _id: -1 };
};

/* -------------------------------------------------------------------------
 * LIST — server-side search, filter, sort and pagination. The browser never
 * receives more than one page of vendors.
 * ---------------------------------------------------------------------- */
router.get('/', authenticate, requireVendorPermission('vendor.view'), async (req, res) => {
  try {
    const { page, limit, skip } = getPaging(req);
    const filter = buildListQuery(req.query);

    const [vendors, total] = await Promise.all([
      Vendor.find(filter)
        .select(LIST_PROJECTION)
        .populate('category', 'name code')
        .populate('owner', 'name username')
        .sort(buildSort(req.query))
        .skip(skip)
        .limit(limit)
        .lean(),
      Vendor.countDocuments(filter),
    ]);

    // Reduce the embedded contacts array to just the primary contact — the only
    // one the table renders — instead of shipping every contact for every row.
    const rows = vendors.map((v) => {
      const primary = (v.contacts || []).find((c) => c.isPrimary) || (v.contacts || [])[0] || null;
      const city = (v.addresses || [])[0]?.city || v.city || '';
      const { contacts, addresses, ...rest } = v;
      return {
        ...rest,
        city,
        primaryContact: primary
          ? { fullName: primary.fullName, email: primary.email, phone: primary.phone, designation: primary.designation }
          : null,
        performanceBand: performanceBand(v.performance?.overallScore ?? null),
      };
    });

    // Product counts for the visible page only — a single grouped query rather
    // than one query per row (avoids the N+1 the naive version would cause).
    const ids = rows.map((r) => r._id);
    const counts = ids.length
      ? await VendorProduct.aggregate([
        { $match: { vendor: { $in: ids }, isActive: true } },
        { $group: { _id: '$vendor', count: { $sum: 1 } } },
      ])
      : [];
    const countByVendor = new Map(counts.map((c) => [String(c._id), c.count]));
    rows.forEach((r) => { r.productCount = countByVendor.get(String(r._id)) || 0; });

    const pages = setPageHeaders(res, total, page, limit);
    return ok(res, { vendors: rows, total, page, pages, limit });
  } catch (err) {
    return handleError(res, err, 'GET /vendors');
  }
});

/* -------------------------------------------------------------------------
 * Duplicate pre-check. The create endpoint runs the same check server-side —
 * this route exists so the form can warn the user before they submit.
 * ---------------------------------------------------------------------- */
router.post('/check-duplicates', authenticate, requireVendorPermission('vendor.view'), async (req, res) => {
  try {
    const candidate = pick(req.body, ['name', 'gstin', 'pan', 'email', 'phone']);
    const excludeId = isValidId(req.body.excludeId) ? req.body.excludeId : null;
    const { blocking, warnings } = await findPotentialDuplicates(candidate, excludeId);
    return ok(res, { blocking, warnings });
  } catch (err) {
    return handleError(res, err, 'POST /check-duplicates');
  }
});

/* -------------------------------------------------------------------------
 * BULK ACTIONS — status update and archive over a selection.
 * ---------------------------------------------------------------------- */
const MAX_BULK = 200;

router.patch('/bulk/status', authenticate, requireVendorPermission('vendor.edit'), async (req, res) => {
  try {
    const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).filter(isValidId).map(toObjectId);
    if (!ids.length) return fail(res, 400, 'Select at least one vendor');
    if (ids.length > MAX_BULK) return fail(res, 400, `Select at most ${MAX_BULK} vendors at a time`);

    const { status } = req.body;
    if (!VENDOR_STATUSES.includes(status)) {
      return fail(res, 400, `Status must be one of: ${VENDOR_STATUSES.join(', ')}`);
    }
    if (status === 'Blacklisted' && !roleHasPermission(req.user.role, 'vendor.archive')) {
      return fail(res, 403, 'Only an administrator can blacklist vendors');
    }

    const result = await Vendor.updateMany(
      { _id: { $in: ids } },
      { $set: { status, updatedBy: req.user._id } }
    );

    await logVendorAudit(req, 'Vendor status changed (bulk)', {
      count: result.modifiedCount, to: status, vendorIds: ids.map(String).slice(0, 50),
    });

    return ok(res, { updated: result.modifiedCount });
  } catch (err) {
    return handleError(res, err, 'PATCH /vendors/bulk/status');
  }
});

router.patch('/bulk/archive', authenticate, requireVendorPermission('vendor.archive'), async (req, res) => {
  try {
    const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).filter(isValidId).map(toObjectId);
    if (!ids.length) return fail(res, 400, 'Select at least one vendor');
    if (ids.length > MAX_BULK) return fail(res, 400, `Select at most ${MAX_BULK} vendors at a time`);

    const restore = req.body.restore === true;
    const result = await Vendor.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          isArchived: !restore,
          archivedAt: restore ? null : new Date(),
          archivedBy: restore ? null : req.user._id,
          updatedBy: req.user._id,
        },
      }
    );

    await logVendorAudit(req, restore ? 'Vendors restored (bulk)' : 'Vendors archived (bulk)', {
      count: result.modifiedCount, vendorIds: ids.map(String).slice(0, 50),
    });

    return ok(res, { updated: result.modifiedCount });
  } catch (err) {
    return handleError(res, err, 'PATCH /vendors/bulk/archive');
  }
});

/* -------------------------------------------------------------------------
 * DETAIL
 * ---------------------------------------------------------------------- */
router.get('/:id', authenticate, requireVendorPermission('vendor.view'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return fail(res, 400, 'Invalid vendor id');

    const canSeeBank = roleHasPermission(req.user.role, 'vendor.view_bank');

    let query = Vendor.findById(req.params.id)
      .populate('category', 'name code')
      .populate('owner', 'name username')
      .populate('createdBy', 'name username')
      .populate('updatedBy', 'name username');

    // The raw account number is `select: false`; only opt in when the caller
    // may see it, and even then only the masked form is returned below.
    if (canSeeBank) query = query.select('+bank.accountNumber');

    const vendor = await query.lean();
    if (!vendor) return fail(res, 404, 'Vendor not found');

    if (vendor.bank) {
      // Always replace the raw number with a mask before it leaves the server.
      vendor.bank.accountNumberMasked = vendor.bank.accountNumberMasked
        || maskTail(vendor.bank.accountNumber);
      delete vendor.bank.accountNumber;
      if (!canSeeBank) {
        vendor.bank = {
          currency: vendor.bank.currency,
          paymentTerms: vendor.bank.paymentTerms,
          creditPeriodDays: vendor.bank.creditPeriodDays,
          restricted: true,
        };
      }
    }

    vendor.performanceBand = performanceBand(vendor.performance?.overallScore ?? null);

    const [productCount, documentCount, activityCount, evaluationCount] = await Promise.all([
      VendorProduct.countDocuments({ vendor: vendor._id, isActive: true }),
      VendorDocument.countDocuments({ vendor: vendor._id, status: 'Active' }),
      VendorActivity.countDocuments({ vendor: vendor._id }),
      VendorEvaluation.countDocuments({ vendor: vendor._id }),
    ]);

    return ok(res, {
      vendor,
      counts: { products: productCount, documents: documentCount, activities: activityCount, evaluations: evaluationCount },
      permissions: permissionsForRole(req.user.role),
    });
  } catch (err) {
    return handleError(res, err, 'GET /vendors/:id');
  }
});

/* -------------------------------------------------------------------------
 * CREATE
 * ---------------------------------------------------------------------- */
router.post('/', authenticate, requireVendorPermission('vendor.create'), async (req, res) => {
  try {
    const errors = validateVendorPayload(req.body);
    if (errors.length) return fail(res, 400, errors[0], { errors });

    const data = pick(req.body, WRITABLE_FIELDS);

    if (data.bank && !roleHasPermission(req.user.role, 'vendor.edit_bank')) {
      delete data.bank;
    } else if (data.bank) {
      data.bank = pick(data.bank, BANK_FIELDS);
    }

    data.category = toObjectId(data.category);
    data.owner = toObjectId(data.owner);
    if (Array.isArray(data.products)) data.products = data.products.map((p) => String(p).trim()).filter(Boolean);
    if (Array.isArray(data.tags)) data.tags = [...new Set(data.tags.map((t) => String(t).trim()).filter(Boolean))];

    const { blocking, warnings } = await findPotentialDuplicates(data, null);

    // GSTIN/PAN collisions are always rejected — they cannot legitimately repeat.
    if (blocking.length) {
      return fail(res, 409, blocking[0].reason, { duplicates: blocking, blocking: true });
    }
    // Softer signals are returned for review; the client re-submits with
    // confirmDuplicate to proceed. Legitimate businesses are never hard-blocked.
    if (warnings.length && req.body.confirmDuplicate !== true) {
      return fail(res, 409, 'This vendor looks like a possible duplicate. Review the matches and confirm to continue.', {
        duplicates: warnings,
        blocking: false,
        requiresConfirmation: true,
      });
    }

    data.createdBy = req.user._id;
    data.updatedBy = req.user._id;

    const vendor = await Vendor.create(data);

    await logVendorAudit(req, 'Vendor created', {
      vendorId: vendor._id, v_code: vendor.v_code, name: vendor.name, status: vendor.status,
    });

    const created = vendor.toJSON();
    delete created.bank?.accountNumber;
    return ok(res, { vendor: created }, 201);
  } catch (err) {
    return handleError(res, err, 'POST /vendors');
  }
});

/* -------------------------------------------------------------------------
 * UPDATE
 * ---------------------------------------------------------------------- */
router.put('/:id', authenticate, requireVendorPermission('vendor.edit'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return fail(res, 400, 'Invalid vendor id');

    const vendor = await Vendor.findById(req.params.id).select('+bank.accountNumber');
    if (!vendor) return fail(res, 404, 'Vendor not found');

    // currentType lets a legacy vendor keep a type the vocabulary no longer lists.
    const errors = validateVendorPayload(req.body, { partial: true, currentType: vendor.type });
    if (errors.length) return fail(res, 400, errors[0], { errors });

    // Optimistic concurrency. The token is `updatedAt`, not `__v`: Mongoose
    // only bumps __v when an array is modified, so a scalar edit would leave it
    // unchanged and two concurrent edits would silently overwrite each other.
    if (req.body.updatedAt) {
      const sent = new Date(req.body.updatedAt).getTime();
      const current = new Date(vendor.updatedAt).getTime();
      // Millisecond-exact: Mongo stores updatedAt at ms precision and JSON
      // round-trips it losslessly as an ISO string.
      if (!Number.isNaN(sent) && sent !== current) {
        return fail(res, 409, 'This vendor was changed by someone else. Reload and try again.');
      }
    }

    const data = pick(req.body, WRITABLE_FIELDS);

    const canEditBank = roleHasPermission(req.user.role, 'vendor.edit_bank');
    let bankChanged = false;
    if ('bank' in data) {
      if (!canEditBank) {
        delete data.bank;
      } else {
        const bank = pick(data.bank || {}, BANK_FIELDS);
        // An empty/masked account number means "leave it as it is" — the UI
        // never round-trips the real value, so a blank must not wipe it.
        if (!bank.accountNumber || /\*/.test(bank.accountNumber)) delete bank.accountNumber;
        Object.assign(vendor.bank, bank);
        bankChanged = true;
        delete data.bank;
      }
    }

    if ('category' in data) data.category = toObjectId(data.category);
    if ('owner' in data) data.owner = toObjectId(data.owner);
    if (Array.isArray(data.products)) data.products = data.products.map((p) => String(p).trim()).filter(Boolean);
    if (Array.isArray(data.tags)) data.tags = [...new Set(data.tags.map((t) => String(t).trim()).filter(Boolean))];

    // Status transitions go through PATCH /:id/status so they are audited as
    // status changes rather than buried inside a generic edit.
    delete data.status;

    // Re-check identity duplicates when an identifying field changed.
    if (data.name || data.gstin || data.pan || data.email || data.phone) {
      const candidate = {
        name: data.name ?? vendor.name,
        gstin: data.gstin ?? vendor.gstin,
        pan: data.pan ?? vendor.pan,
        email: data.email ?? vendor.email,
        phone: data.phone ?? vendor.phone,
      };
      const { blocking, warnings } = await findPotentialDuplicates(candidate, vendor._id);
      if (blocking.length) {
        return fail(res, 409, blocking[0].reason, { duplicates: blocking, blocking: true });
      }
      if (warnings.length && req.body.confirmDuplicate !== true) {
        return fail(res, 409, 'These details match another vendor. Review the matches and confirm to continue.', {
          duplicates: warnings, blocking: false, requiresConfirmation: true,
        });
      }
    }

    const before = vendor.toObject();
    Object.assign(vendor, data);
    vendor.updatedBy = req.user._id;
    await vendor.save();

    const changes = diffSummary(before, vendor.toObject(), AUDITED_FIELDS);
    if (bankChanged) changes.bank = { from: '[redacted]', to: '[redacted]' };

    if (Object.keys(changes).length) {
      await logVendorAudit(req, 'Vendor updated', {
        vendorId: vendor._id, v_code: vendor.v_code, name: vendor.name, changes,
      });
    }

    const updated = vendor.toJSON();
    delete updated.bank?.accountNumber;
    return ok(res, { vendor: updated });
  } catch (err) {
    return handleError(res, err, 'PUT /vendors/:id');
  }
});

/* -------------------------------------------------------------------------
 * STATUS CHANGE
 * ---------------------------------------------------------------------- */
router.patch('/:id/status', authenticate, requireVendorPermission('vendor.edit'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return fail(res, 400, 'Invalid vendor id');

    const { status, reason } = req.body;
    if (!VENDOR_STATUSES.includes(status)) {
      return fail(res, 400, `Status must be one of: ${VENDOR_STATUSES.join(', ')}`);
    }
    // Blacklisting is a commercial sanction — restrict it to administrators.
    if (status === 'Blacklisted' && !roleHasPermission(req.user.role, 'vendor.archive')) {
      return fail(res, 403, 'Only an administrator can blacklist a vendor');
    }

    const vendor = await Vendor.findById(req.params.id).select('v_code name status');
    if (!vendor) return fail(res, 404, 'Vendor not found');

    const previous = vendor.status;
    if (previous === status) return ok(res, { vendor, unchanged: true });

    vendor.status = status;
    vendor.updatedBy = req.user._id;
    await vendor.save();

    await logVendorAudit(req, 'Vendor status changed', {
      vendorId: vendor._id, v_code: vendor.v_code, name: vendor.name,
      from: previous, to: status, reason: reason ? String(reason).slice(0, 500) : undefined,
    });

    return ok(res, { vendor });
  } catch (err) {
    return handleError(res, err, 'PATCH /vendors/:id/status');
  }
});

/* -------------------------------------------------------------------------
 * ARCHIVE / RESTORE — the default, reversible "delete".
 * ---------------------------------------------------------------------- */
router.patch('/:id/archive', authenticate, requireVendorPermission('vendor.archive'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return fail(res, 400, 'Invalid vendor id');

    const vendor = await Vendor.findById(req.params.id).select('v_code name isArchived');
    if (!vendor) return fail(res, 404, 'Vendor not found');
    if (vendor.isArchived) return ok(res, { vendor, unchanged: true });

    vendor.isArchived = true;
    vendor.archivedAt = new Date();
    vendor.archivedBy = req.user._id;
    vendor.updatedBy = req.user._id;
    await vendor.save();

    await logVendorAudit(req, 'Vendor archived', {
      vendorId: vendor._id, v_code: vendor.v_code, name: vendor.name,
      reason: req.body?.reason ? String(req.body.reason).slice(0, 500) : undefined,
    });

    return ok(res, { vendor });
  } catch (err) {
    return handleError(res, err, 'PATCH /vendors/:id/archive');
  }
});

router.patch('/:id/restore', authenticate, requireVendorPermission('vendor.archive'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return fail(res, 400, 'Invalid vendor id');

    const vendor = await Vendor.findById(req.params.id).select('v_code name isArchived');
    if (!vendor) return fail(res, 404, 'Vendor not found');
    if (!vendor.isArchived) return ok(res, { vendor, unchanged: true });

    vendor.isArchived = false;
    vendor.archivedAt = null;
    vendor.archivedBy = null;
    vendor.updatedBy = req.user._id;
    await vendor.save();

    await logVendorAudit(req, 'Vendor restored', {
      vendorId: vendor._id, v_code: vendor.v_code, name: vendor.name,
    });

    return ok(res, { vendor });
  } catch (err) {
    return handleError(res, err, 'PATCH /vendors/:id/restore');
  }
});

/* -------------------------------------------------------------------------
 * PERMANENT DELETE — administrators only, and only for an already-archived
 * vendor. Requires the vendor's code as a typed confirmation, and removes the
 * vendor's own related records (never anything shared, such as Products).
 * The audit trail is deliberately left intact.
 * ---------------------------------------------------------------------- */
router.delete('/:id', authenticate, requireVendorPermission('vendor.delete'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return fail(res, 400, 'Invalid vendor id');

    const vendor = await Vendor.findById(req.params.id).select('v_code name isArchived');
    if (!vendor) return fail(res, 404, 'Vendor not found');

    if (!vendor.isArchived) {
      return fail(res, 400, 'Archive the vendor before deleting it permanently');
    }
    if (String(req.body?.confirmCode || '').trim().toUpperCase() !== String(vendor.v_code).toUpperCase()) {
      return fail(res, 400, `Type the vendor code ${vendor.v_code} to confirm permanent deletion`);
    }

    const docs = await VendorDocument.find({ vendor: vendor._id }).select('storedName').lean();

    await Promise.all([
      VendorProduct.deleteMany({ vendor: vendor._id }),
      VendorDocument.deleteMany({ vendor: vendor._id }),
      VendorEvaluation.deleteMany({ vendor: vendor._id }),
      VendorActivity.deleteMany({ vendor: vendor._id }),
    ]);

    // Remove the orphaned files too, so deleting a vendor does not leave their
    // compliance documents readable on disk.
    for (const doc of docs) {
      if (!doc.storedName) continue;
      fs.unlink(path.join(__dirname, '../../private-uploads/vendors', doc.storedName), () => {});
    }

    await vendor.deleteOne();

    await logVendorAudit(req, 'Vendor permanently deleted', {
      vendorId: vendor._id, v_code: vendor.v_code, name: vendor.name,
      relatedRecordsRemoved: { documents: docs.length },
    });

    return ok(res, { message: 'Vendor permanently deleted' });
  } catch (err) {
    return handleError(res, err, 'DELETE /vendors/:id');
  }
});

/* -------------------------------------------------------------------------
 * AUDIT HISTORY for one vendor, read from the shared ActivityLog collection.
 * ---------------------------------------------------------------------- */
router.get('/:id/audit', authenticate, requireVendorPermission('vendor.view'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return fail(res, 400, 'Invalid vendor id');

    const { page, limit, skip } = getPaging(req);

    const filter = { 'details.module': 'vendor', 'details.vendorId': String(req.params.id) };
    const [entries, total] = await Promise.all([
      ActivityLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      ActivityLog.countDocuments(filter),
    ]);

    const pages = setPageHeaders(res, total, page, limit);
    return ok(res, { entries, total, page, pages });
  } catch (err) {
    return handleError(res, err, 'GET /vendors/:id/audit');
  }
});

module.exports = router;
module.exports.buildListQuery = buildListQuery;
module.exports.buildSort = buildSort;
module.exports.WRITABLE_FIELDS = WRITABLE_FIELDS;
