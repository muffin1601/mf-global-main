/**
 * One-time migration: backfill the denormalized `isAssigned` flag for all
 * existing ClientData documents.
 *
 *   isAssigned = (assignedTo is a non-empty array)
 *
 * Required because assigned/unassigned queries now use `{ isAssigned: ... }`,
 * which is empty on documents written before this change.
 *
 * Run once:  node scripts/backfillIsAssigned.js
 * Idempotent: re-running recomputes the same values.
 *
 * Uses two index-friendly updateMany passes (no per-doc loop):
 *   1. assignedTo non-empty  -> isAssigned = true
 *   2. everything else       -> isAssigned = false
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Client = require("../models/ClientData");

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI not set");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected");

  // Use the raw collection so the pre-update hook isn't needed and we control
  // the exact filter. "assignedTo.0 exists" = at least one element.
  const assignedRes = await Client.collection.updateMany(
    { "assignedTo.0": { $exists: true } },
    { $set: { isAssigned: true } }
  );
  console.log(`✅ assigned   -> isAssigned:true  (${assignedRes.modifiedCount} modified)`);

  const unassignedRes = await Client.collection.updateMany(
    { "assignedTo.0": { $exists: false } },
    { $set: { isAssigned: false } }
  );
  console.log(`✅ unassigned -> isAssigned:false (${unassignedRes.modifiedCount} modified)`);

  await mongoose.disconnect();
  console.log("✅ Done");
  process.exit(0);
})().catch((err) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});
