const mongoose = require('mongoose');

const PriceSchema = new mongoose.Schema(
  {
    priceCode: { type: String },
    singlePrice: Number,
    sales_0_50: Number,
    sales_50_100: Number,
    sales_100_above: Number,
    discountPrice: Number,
    discount: {
      type: { type: String, enum: ['flat', 'percentage'], default: null },
      value: Number,
      validUntil: Date
    },
    currency: { type: String, default: 'INR' },
    taxIncluded: { type: Boolean, default: false },
    effectiveFrom: Date,
    effectiveTo: Date
  },
  { timestamps: true }
);

module.exports = PriceSchema;
