/* Read-only product image integrity diagnostic. No database or file mutations. */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const Product = require("../models/ProductData");
const { PRODUCT_UPLOAD_DIR, PRODUCT_PUBLIC_PREFIX, resolveStoredImagePath } = require("../utils/productImages");

const main = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

  const products = await Product.find({ p_image: { $nin: [null, ""] } }).select("p_code p_name p_image").lean();
  const referenced = new Map();
  const broken = [];
  const malformed = [];
  const remote = [];

  for (const product of products) {
    const reference = String(product.p_image || "").trim();
    if (/^https?:\/\//i.test(reference)) {
      remote.push({ productId: product._id, productCode: product.p_code, reference, result: "NOT CHECKED (remote URL)" });
      continue;
    }
    if (!reference.startsWith(PRODUCT_PUBLIC_PREFIX)) {
      malformed.push({ productId: product._id, productCode: product.p_code, reference });
      continue;
    }
    const storedPath = resolveStoredImagePath(reference);
    if (!storedPath) {
      malformed.push({ productId: product._id, productCode: product.p_code, reference });
      continue;
    }
    const key = path.normalize(storedPath).toLowerCase();
    referenced.set(key, [...(referenced.get(key) || []), String(product._id)]);
    if (!fs.existsSync(storedPath)) broken.push({ productId: product._id, productCode: product.p_code, reference });
  }

  const files = fs.existsSync(PRODUCT_UPLOAD_DIR)
    ? fs.readdirSync(PRODUCT_UPLOAD_DIR, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => path.join(PRODUCT_UPLOAD_DIR, entry.name))
    : [];
  const orphaned = files.filter((file) => !referenced.has(path.normalize(file).toLowerCase())).map((file) => path.basename(file));
  const duplicateReferences = [...referenced.entries()].filter(([, ids]) => ids.length > 1).map(([file, productIds]) => ({ file: path.basename(file), productIds }));

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    mode: "READ_ONLY",
    uploadDirectory: PRODUCT_UPLOAD_DIR,
    totals: { productsWithImageReferences: products.length, localFiles: files.length, broken: broken.length, malformed: malformed.length, orphaned: orphaned.length, duplicateReferences: duplicateReferences.length, remoteNotChecked: remote.length },
    broken,
    malformed,
    orphaned,
    duplicateReferences,
    remote,
  }, null, 2));
};

main().catch((error) => {
  console.error(`Product image diagnostics failed: ${error.message}`);
  process.exitCode = 1;
}).finally(async () => mongoose.disconnect());
