const mongoose = require('mongoose');
const SubcategorySchema = require('./subcategorySchema');
const AuditSchema = require('./Audit');

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String },
    slug: { type: String },
    image: String,
    hoverImage: String,
    tag: String,
    subcategories: [SubcategorySchema],
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    metaTitle: String,
    metaDescription: String,
    audit: AuditSchema
  },
  { timestamps: true }
);

module.exports = CategorySchema;

