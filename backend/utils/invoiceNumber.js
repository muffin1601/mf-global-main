const Counter = require("../models/Counter");
const Quotation = require("../models/Quote");

// Single counter document keyed by this role.
const INVOICE_KEY = "invoice";

// Scan existing quotations for the highest numeric invoice number, so a freshly
// created counter continues the historical sequence instead of restarting at 1.
async function computeMaxExistingInvoiceNumber() {
  const docs = await Quotation.find({}, { "invoiceDetails.number": 1 }).lean();
  let max = 0;
  for (const d of docs) {
    const n = parseInt(String(d?.invoiceDetails?.number ?? "").replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/**
 * Atomically reserve the next invoice number.
 *
 * Concurrency: Counter.findOneAndUpdate({$inc}) is a single-document atomic
 * operation, so concurrent callers can never receive the same value — no
 * duplicates even under heavy parallel load.
 *
 * Transactions: pass a `session` to enlist the increment in a Mongo
 * transaction (atomic with the quotation insert). Works fine without one too.
 *
 * Seeding: on first use the counter is initialised to the max existing invoice
 * number via $setOnInsert (race-safe: a losing concurrent upsert is a no-op).
 *
 * @returns {Promise<number>} the reserved sequence value
 */
async function nextInvoiceNumber(session) {
  const exists = await Counter.findOne({ role: INVOICE_KEY }).lean();
  if (!exists) {
    const seed = await computeMaxExistingInvoiceNumber();
    await Counter.updateOne(
      { role: INVOICE_KEY },
      { $setOnInsert: { seq: seed } },
      { upsert: true }
    );
  }

  const opts = { new: true };
  if (session) opts.session = session;
  const updated = await Counter.findOneAndUpdate(
    { role: INVOICE_KEY },
    { $inc: { seq: 1 } },
    opts
  );
  return updated.seq;
}

module.exports = { nextInvoiceNumber, computeMaxExistingInvoiceNumber, INVOICE_KEY };
