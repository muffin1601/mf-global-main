/**
 * One-time migration: recompute and persist `totals` for every historical
 * quotation, using the server-side single source of truth
 * (utils/quotationCalc.calculateQuotationTotals).
 *
 * Also seeds the atomic invoice counter to the highest existing invoice number,
 * so server-assigned numbers continue the sequence without colliding with
 * historical records.
 *
 * Run once:  node scripts/backfillQuotationTotals.js
 * Safe to rerun: recomputes the same totals; the counter is only seeded if it
 * doesn't already exist (never lowered).
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Quotation = require("../models/Quote");
const Counter = require("../models/Counter");
const { calculateQuotationTotals } = require("../utils/quotationCalc");
const { computeMaxExistingInvoiceNumber, INVOICE_KEY } = require("../utils/invoiceNumber");

const BATCH = 500;

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI not set");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected");

  // --- 1. Recompute totals for all quotations ---
  const cursor = Quotation.find({}, { items: 1, summary: 1 }).lean().cursor();
  let ops = [];
  let processed = 0;
  let modified = 0;

  const flush = async () => {
    if (!ops.length) return;
    const res = await Quotation.collection.bulkWrite(ops, { ordered: false });
    modified += res.modifiedCount || 0;
    ops = [];
  };

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const totals = calculateQuotationTotals(doc.items || [], doc.summary || {});
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { totals } } } });
    processed++;
    if (ops.length >= BATCH) await flush();
    if (processed % 2000 === 0) console.log(`  …${processed} processed`);
  }
  await flush();
  console.log(`✅ Recomputed totals for ${processed} quotations (${modified} modified)`);

  // --- 2. Seed the invoice counter (only if missing) ---
  const existing = await Counter.findOne({ role: INVOICE_KEY });
  if (!existing) {
    const max = await computeMaxExistingInvoiceNumber();
    await Counter.updateOne(
      { role: INVOICE_KEY },
      { $setOnInsert: { seq: max } },
      { upsert: true }
    );
    console.log(`✅ Invoice counter seeded to ${max} (next number will be ${max + 1})`);
  } else {
    console.log(`ℹ️  Invoice counter already exists (seq=${existing.seq}) — left unchanged`);
  }

  await mongoose.disconnect();
  console.log("✅ Done");
  process.exit(0);
})().catch((err) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});
