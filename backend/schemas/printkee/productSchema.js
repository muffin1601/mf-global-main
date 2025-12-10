const mongoose = require('mongoose');
const PriceSchema = require('./Price');
const AuditSchema = require('./Audit');

const ProductSchema = new mongoose.Schema(
  {
    productCode: String,
    SKU: String,
    name: { type: String, required: true },
    slug: String,
    description: String,
    HSNCode: String,
    type: String,
    quantity: { type: Number, default: 0 },
    GSTRate: Number,
    brand: String,
    fabricType: String,
    size: [String],
    colour: [String],
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    minOrderQty: Number,
    maxOrderQty: Number,
    availabilityDate: Date,
    price: PriceSchema,
    image: String,
    subImages: [String],
    tags: [String],
    keywords: [String],
    isFeatured: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    ratings: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 }
    },
    metaTitle: String,
    metaDescription: String,
    audit: AuditSchema
  },
  { timestamps: true }
);

module.exports = ProductSchema;