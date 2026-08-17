const mongoose = require('mongoose');
const { CURRENCIES } = require('../utils/vendorFields');

/* Quantity-based price break, e.g. 1–49 @ 120, 50–199 @ 110.
 * maxQty === null means "and above". */
const priceTierSchema = new mongoose.Schema({
  minQty: { type: Number, required: true, min: 0 },
  maxQty: { type: Number, default: null, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  discountPercent: { type: Number, min: 0, max: 100, default: 0 },
}, { _id: false });

/* Vendor <-> Product supply relationship.
 *
 * This is the join collection: a vendor supplies many products and a product is
 * supplied by many vendors. It references the EXISTING Product collection — no
 * duplicate product master data is created here. Vendor-specific commercial
 * terms (their item code, price, MOQ, lead time) live on the join record where
 * they belong, together with the quantity price breaks.
 *
 * Multiple records may exist for the same (vendor, product) pair over time —
 * that is how price history works — but their [effectiveFrom, effectiveTo]
 * windows must not overlap. The route enforces this before writing.
 */
const vendorProductSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },

  vendorItemCode: { type: String, trim: true, maxlength: 100, default: '' },
  purchasePrice: { type: Number, required: true, min: 0 },
  currency: { type: String, enum: CURRENCIES, default: 'INR' },
  priceTiers: { type: [priceTierSchema], default: [] },

  moq: { type: Number, min: 0, default: 1 },
  leadTimeDays: { type: Number, min: 0, max: 3650, default: 0 },
  taxRate: { type: Number, min: 0, max: 100, default: 0 },
  discountPercent: { type: Number, min: 0, max: 100, default: 0 },

  effectiveFrom: { type: Date, default: () => new Date() },
  effectiveTo: { type: Date, default: null }, // null = open-ended
  notes: { type: String, trim: true, maxlength: 2000, default: '' },
  isActive: { type: Boolean, default: true },
  isPreferred: { type: Boolean, default: false },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// "Which products does this vendor supply" — the vendor-profile tab query.
vendorProductSchema.index({ vendor: 1, isActive: 1, effectiveFrom: -1 });
// "Which vendors supply this product" — the reverse lookup / sourcing view.
vendorProductSchema.index({ product: 1, isActive: 1 });
// Overlap detection reads by the exact pair.
vendorProductSchema.index({ vendor: 1, product: 1, effectiveFrom: 1 });

module.exports = mongoose.model('VendorProduct', vendorProductSchema);
