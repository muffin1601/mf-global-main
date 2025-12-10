const mongoose = require('mongoose');
const ProductSchema = require('./productSchema');
const AuditSchema = require('./Audit');

const SubcategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String },
    image: String,
    hoverImage: String,
    tag: String,
    products: [ProductSchema],
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    metaTitle: String,
    metaDescription: String,
    audit: AuditSchema
  },
  { timestamps: true }
);

module.exports = SubcategorySchema;
