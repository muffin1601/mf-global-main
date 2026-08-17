// Vendor products / services and vendor-specific pricing.
//
// These sit on the VendorProduct join collection, which references the
// EXISTING Product master — adding a product to a vendor never creates a
// duplicate product record. The same product can be linked to any number of
// vendors, and a vendor to any number of products.

const express = require('express');

const router = express.Router({ mergeParams: true });

const VendorProduct = require('../../models/VendorProduct');
const Product = require('../../models/ProductData');
const Vendor = require('../../models/VendorData');
const authenticate = require('../../middleware/auth');
const { requireVendorPermission } = require('../../middleware/vendorPermissions');
const { getPaging, setPageHeaders } = require('../../utils/paginate');
const { validateVendorProductPayload } = require('../../utils/vendorValidators');
const { ok, fail, isValidId, toObjectId, handleError, logVendorAudit, pick } = require('../../utils/vendorHelpers');

const WRITABLE = [
  'product', 'vendorItemCode', 'purchasePrice', 'currency', 'priceTiers',
  'moq', 'leadTimeDays', 'taxRate', 'discountPercent',
  'effectiveFrom', 'effectiveTo', 'notes', 'isActive', 'isPreferred',
];

const loadVendor = async (req, res, next) => {
  try {
    if (!isValidId(req.params.vendorId)) return fail(res, 400, 'Invalid vendor id');
    const vendor = await Vendor.findById(req.params.vendorId).select('_id v_code name');
    if (!vendor) return fail(res, 404, 'Vendor not found');
    req.vendor = vendor;
    return next();
  } catch (err) {
    return handleError(res, err, 'loadVendor (products)');
  }
};

// Two supply records for the same vendor+product must not cover overlapping
// dates — otherwise "the price today" is ambiguous. An open-ended record
// (effectiveTo === null) runs to infinity for the purposes of this check.
const findOverlapping = async (vendorId, productId, from, to, excludeId = null) => {
  const start = from ? new Date(from) : new Date();
  const end = to ? new Date(to) : null;

  const query = { vendor: vendorId, product: productId };
  if (excludeId) query._id = { $ne: excludeId };

  const existing = await VendorProduct.find(query).select('effectiveFrom effectiveTo').lean();

  return existing.find((row) => {
    const rowStart = row.effectiveFrom ? new Date(row.effectiveFrom) : new Date(0);
    const rowEnd = row.effectiveTo ? new Date(row.effectiveTo) : null;
    const startsBeforeRowEnds = rowEnd === null || start < rowEnd;
    const endsAfterRowStarts = end === null || end > rowStart;
    return startsBeforeRowEnds && endsAfterRowStarts;
  }) || null;
};

/* ------------------------- LIST for one vendor ------------------------- */
router.get('/:vendorId/products', authenticate, requireVendorPermission('vendor.view'), loadVendor, async (req, res) => {
  try {
    const { page, limit, skip } = getPaging(req);

    const filter = { vendor: req.vendor._id };
    if (req.query.active === 'true') filter.isActive = true;
    if (req.query.active === 'false') filter.isActive = false;

    const [items, total] = await Promise.all([
      VendorProduct.find(filter)
        // A single populate of the product master — not one query per row.
        .populate('product', 'p_code p_name s_code cat_id HSN_code p_image GST_rate')
        .sort({ isPreferred: -1, effectiveFrom: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VendorProduct.countDocuments(filter),
    ]);

    const pages = setPageHeaders(res, total, page, limit);
    return ok(res, { items, total, page, pages });
  } catch (err) {
    return handleError(res, err, 'GET vendor products');
  }
});

/* --------------- Reverse lookup: vendors supplying a product --------------- */
router.get('/by-product/:productId', authenticate, requireVendorPermission('vendor.view'), async (req, res) => {
  try {
    if (!isValidId(req.params.productId)) return fail(res, 400, 'Invalid product id');

    const items = await VendorProduct.find({ product: req.params.productId, isActive: true })
      .populate('vendor', 'v_code name status performance.overallScore')
      .sort({ purchasePrice: 1 })
      .limit(100)
      .lean();

    return ok(res, { items, total: items.length });
  } catch (err) {
    return handleError(res, err, 'GET vendors by product');
  }
});

/* ------------------------------- CREATE ------------------------------- */
router.post('/:vendorId/products', authenticate, requireVendorPermission('vendor.edit'), loadVendor, async (req, res) => {
  try {
    const errors = validateVendorProductPayload(req.body);
    if (errors.length) return fail(res, 400, errors[0], { errors });

    const productId = toObjectId(req.body.product);
    if (!productId) return fail(res, 400, 'Select a valid product');

    // Object-level check: the referenced product must genuinely exist. A client
    // cannot fabricate a link to an arbitrary id.
    const product = await Product.findById(productId).select('p_code p_name').lean();
    if (!product) return fail(res, 404, 'The selected product no longer exists');

    const data = pick(req.body, WRITABLE);
    data.vendor = req.vendor._id;
    data.product = productId;

    const clash = await findOverlapping(req.vendor._id, productId, data.effectiveFrom, data.effectiveTo);
    if (clash) {
      return fail(res, 409, `A price record for ${product.p_name} already covers these dates. Close the existing record first or choose a later effective-from date.`);
    }

    const item = await VendorProduct.create({ ...data, createdBy: req.user._id, updatedBy: req.user._id });

    await logVendorAudit(req, 'Vendor product added', {
      vendorId: req.vendor._id, v_code: req.vendor.v_code,
      product: product.p_name, productCode: product.p_code,
    });

    return ok(res, { item: await item.populate('product', 'p_code p_name s_code') }, 201);
  } catch (err) {
    return handleError(res, err, 'POST vendor product');
  }
});

/* ------------------------------- UPDATE ------------------------------- */
router.put('/:vendorId/products/:itemId', authenticate, requireVendorPermission('vendor.edit'), loadVendor, async (req, res) => {
  try {
    if (!isValidId(req.params.itemId)) return fail(res, 400, 'Invalid record id');

    const item = await VendorProduct.findById(req.params.itemId);
    // Object-level authorization: the record must belong to the vendor in the
    // URL, so a valid id from another vendor cannot be edited through this path.
    if (!item || String(item.vendor) !== String(req.vendor._id)) {
      return fail(res, 404, 'Pricing record not found for this vendor');
    }

    const errors = validateVendorProductPayload({ ...item.toObject(), ...req.body }, { partial: true });
    if (errors.length) return fail(res, 400, errors[0], { errors });

    const data = pick(req.body, WRITABLE);
    delete data.product; // re-pointing a record at a different product is not an edit

    const from = data.effectiveFrom ?? item.effectiveFrom;
    const to = 'effectiveTo' in data ? data.effectiveTo : item.effectiveTo;
    const clash = await findOverlapping(req.vendor._id, item.product, from, to, item._id);
    if (clash) {
      return fail(res, 409, 'Another price record for this product already covers these dates.');
    }

    const previousPrice = item.purchasePrice;
    Object.assign(item, data, { updatedBy: req.user._id });
    await item.save();

    await logVendorAudit(req, 'Vendor pricing updated', {
      vendorId: req.vendor._id, v_code: req.vendor.v_code, recordId: String(item._id),
      priceChanged: previousPrice !== item.purchasePrice
        ? { from: previousPrice, to: item.purchasePrice }
        : undefined,
    });

    return ok(res, { item: await item.populate('product', 'p_code p_name s_code') });
  } catch (err) {
    return handleError(res, err, 'PUT vendor product');
  }
});

/* ------------------------------- DELETE ------------------------------- */
router.delete('/:vendorId/products/:itemId', authenticate, requireVendorPermission('vendor.edit'), loadVendor, async (req, res) => {
  try {
    if (!isValidId(req.params.itemId)) return fail(res, 400, 'Invalid record id');

    const item = await VendorProduct.findById(req.params.itemId).populate('product', 'p_name');
    if (!item || String(item.vendor) !== String(req.vendor._id)) {
      return fail(res, 404, 'Pricing record not found for this vendor');
    }

    const productName = item.product?.p_name || '';
    // Only the join record is removed — the shared Product master is untouched.
    await item.deleteOne();

    await logVendorAudit(req, 'Vendor product removed', {
      vendorId: req.vendor._id, v_code: req.vendor.v_code, product: productName,
    });

    return ok(res, { message: 'Product removed from this vendor' });
  } catch (err) {
    return handleError(res, err, 'DELETE vendor product');
  }
});

module.exports = router;
