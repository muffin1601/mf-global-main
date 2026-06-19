/**
 * One-time migration: backfill the normalized lowercase shadow fields
 * (category_lc, location_lc, state_lc, datatype_lc, callStatus_lc,
 *  status_lc, fileName_lc) for all existing ClientData documents.
 *
 * Required because the new index-backed filter queries `<field>_lc`, which is
 * empty on documents written before this change.
 *
 * Run once:  node scripts/backfillNormalizedFields.js
 * Idempotent: re-running just recomputes the same values.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Client = require("../models/ClientData");
const { NORMALIZED_FIELDS, lcKey, toLc } = require("../utils/normalizeFields");

const BATCH = 1000;

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI not set");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected");

  const cursor = Client.find({}, NORMALIZED_FIELDS.join(" ")).lean().cursor();
  let ops = [];
  let processed = 0;
  let written = 0;

  const flush = async () => {
    if (!ops.length) return;
    const res = await Client.collection.bulkWrite(ops, { ordered: false });
    written += res.modifiedCount || 0;
    ops = [];
  };

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const set = {};
    for (const field of NORMALIZED_FIELDS) set[lcKey(field)] = toLc(doc[field]);
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
    processed++;
    if (ops.length >= BATCH) await flush();
    if (processed % 5000 === 0) console.log(`  …${processed} processed`);
  }
  await flush();

  console.log(`✅ Backfilled ${processed} documents (${written} modified)`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});
