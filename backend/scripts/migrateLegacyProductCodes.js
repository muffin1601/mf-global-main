/*
 * Recode legacy product SKUs from their current product category.
 *
 * Default mode is read-only. Use `node scripts/migrateLegacyProductCodes.js
 * --apply` only during a maintenance window: Product.p_code is intentionally
 * changed, while product IDs and every other collection remain untouched.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Category = require("../models/Category");
const Product = require("../models/ProductData");
const Counter = require("../models/Counter");
const { productCodePrefix } = require("../services/productCode");

const apply = process.argv.includes("--apply");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const codeFor = (prefix, sequence) => `${prefix}-${String(sequence).padStart(3, "0")}`;

const buildPlan = async (session) => {
  const queryOptions = session ? { session } : undefined;
  const [categories, products] = await Promise.all([
    Category.find().select("_id name").lean(queryOptions),
    Product.find().select("_id cat_id p_code p_name createdAt").sort({ createdAt: 1, _id: 1 }).lean(queryOptions),
  ]);
  const categoryById = new Map(categories.map((category) => [String(category._id), category]));
  const reserved = new Set(products.map((product) => product.p_code).filter(Boolean));
  const nextByPrefix = new Map();
  const updates = [];
  const skipped = [];

  for (const product of products) {
    const category = categoryById.get(String(product.cat_id));
    if (!category) {
      skipped.push({ id: String(product._id), name: product.p_name || "", reason: "missing category" });
      continue;
    }
    const prefix = productCodePrefix(category.name);
    const validCode = new RegExp(`^${escapeRegex(prefix)}-\\d+$`).test(product.p_code || "");
    if (validCode) continue; // Do not change already-migrated category codes.

    let sequence = nextByPrefix.get(prefix);
    if (!sequence) {
      const expression = new RegExp(`^${escapeRegex(prefix)}-(\\d+)$`);
      sequence = products.reduce((highest, item) => {
        const match = String(item.p_code || "").match(expression);
        return Math.max(highest, match ? Number(match[1]) || 0 : 0);
      }, 0) + 1;
    }
    let code = codeFor(prefix, sequence);
    while (reserved.has(code)) code = codeFor(prefix, ++sequence);
    reserved.add(code);
    nextByPrefix.set(prefix, sequence + 1);
    updates.push({ id: product._id, from: product.p_code || null, to: code, prefix, sequence });
  }
  return { products: products.length, updates, skipped };
};

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const initialPlan = await buildPlan();
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", products: initialPlan.products, updates: initialPlan.updates.length, skipped: initialPlan.skipped, preview: initialPlan.updates.slice(0, 10) }, null, 2));
    if (!apply || !initialPlan.updates.length) return;
    if (initialPlan.skipped.length) throw new Error("Migration stopped: products with missing categories cannot be safely recoded.");

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const plan = await buildPlan(session);
        if (plan.skipped.length) throw new Error("Migration stopped: products with missing categories cannot be safely recoded.");
        await Product.collection.bulkWrite(plan.updates.map((item) => ({
          updateOne: { filter: { _id: item.id }, update: { $set: { p_code: item.to } } },
        })), { session });
        const maxima = new Map();
        for (const item of plan.updates) maxima.set(item.prefix, Math.max(maxima.get(item.prefix) || 0, item.sequence));
        for (const [prefix, sequence] of maxima) {
          await Counter.updateOne({ role: `product-code:${prefix}` }, { $max: { seq: sequence } }, { upsert: true, session });
        }
        console.log(`Applied ${plan.updates.length} product-code updates.`);
      });
    } finally {
      await session.endSession();
    }
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("Product-code migration failed:", error.message);
  process.exitCode = 1;
});
