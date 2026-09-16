const mongoose = require("mongoose");
const Category = require("../models/Category");
const Counter = require("../models/Counter");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Prefixes are shared across categories that start with the same letters. This
// keeps the visible SKU unique even when category IDs are different.
const productCodePrefix = (categoryName) => {
  const letters = String(categoryName || "").match(/\p{L}/gu) || [];
  const prefix = letters.slice(0, 2).join("").toUpperCase();
  if (!prefix) throw new Error("A product category must contain at least one alphabetic character.");
  return prefix;
};

const highestExistingSequence = async (prefix) => {
  const Product = mongoose.model("Product");
  const expression = new RegExp(`^${escapeRegex(prefix)}-(\\d+)$`);
  const products = await Product.find({ p_code: expression }).select("p_code").lean();
  return products.reduce((highest, product) => {
    const match = product.p_code.match(expression);
    return Math.max(highest, match ? Number(match[1]) || 0 : 0);
  }, 0);
};

const getCategoryAndPrefix = async (categoryId) => {
  if (!mongoose.isValidObjectId(categoryId)) throw new Error("Please select a valid category.");
  const category = await Category.findById(categoryId).select("name").lean();
  if (!category) throw new Error("Please select a valid category.");
  return { prefix: productCodePrefix(category.name) };
};

const nextSequence = async (prefix) => {
  const role = `product-code:${prefix}`;
  const exists = await Counter.exists({ role });
  const initialSequence = exists ? 0 : await highestExistingSequence(prefix);
  // Bootstrap separately so MongoDB never receives $inc and $setOnInsert for
  // the same field in one update. A competing bootstrap merely observes the
  // newly-created row; allocation below is always atomic.
  if (!exists) {
    await Counter.updateOne({ role }, { $setOnInsert: { seq: initialSequence } }, { upsert: true });
  }
  const counter = await Counter.findOneAndUpdate(
    { role },
    { $inc: { seq: 1 } },
    { new: true }
  ).lean();
  return counter.seq;
};

const generateProductCode = async (categoryId) => {
  const { prefix } = await getCategoryAndPrefix(categoryId);
  const Product = mongoose.model("Product");
  for (;;) {
    const code = `${prefix}-${String(await nextSequence(prefix)).padStart(3, "0")}`;
    // This additionally handles legacy codes created before the counter exists.
    if (!await Product.exists({ p_code: code })) return code;
  }
};

const previewProductCode = async (categoryId) => {
  const { prefix } = await getCategoryAndPrefix(categoryId);
  const counter = await Counter.findOne({ role: `product-code:${prefix}` }).select("seq").lean();
  const sequence = counter ? counter.seq + 1 : (await highestExistingSequence(prefix)) + 1;
  return `${prefix}-${String(sequence).padStart(3, "0")}`;
};

module.exports = { generateProductCode, previewProductCode, productCodePrefix };
