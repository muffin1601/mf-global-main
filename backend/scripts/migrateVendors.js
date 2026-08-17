#!/usr/bin/env node
/**
 * Backfill existing vendors for the Vendor Management module.
 *
 * Vendors created before this module have none of the fields it relies on:
 *   - isArchived  : absent, so archive/active filtering cannot classify them
 *   - status      : absent, so status filters and dashboard counts skip them
 *   - nameNorm /  : absent, so DUPLICATE DETECTION CANNOT SEE THEM — a second
 *     gstinNorm     copy of an existing supplier would be created silently
 *     panNorm
 *     emailNorm
 *     phoneNorm
 *
 * This script fills those in. It is:
 *   - NON-DESTRUCTIVE : only ever $set fields that are missing or derived.
 *                       No existing value is overwritten except the normalized
 *                       shadow fields, which are derived data by definition.
 *   - IDEMPOTENT      : safe to run repeatedly; a second run reports 0 changes.
 *   - DRY-RUN BY DEFAULT: prints what it would do and writes nothing.
 *
 * Usage
 *   node scripts/migrateVendors.js              # dry run (default, safe)
 *   node scripts/migrateVendors.js --apply      # actually write
 *   node scripts/migrateVendors.js --apply --status=Active
 *
 * --status sets the status given to vendors that have none. It defaults to
 * "Pending" so nothing is silently presented as an approved supplier; pass
 * --status=Active if your existing list is already all live suppliers.
 *
 * Always take a database backup before running with --apply.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const {
  VENDOR_STATUSES,
  normalizeCompanyName,
  normalizeCode,
  normalizeEmail,
  normalizePhone,
} = require('../utils/vendorFields');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const statusArg = (args.find((a) => a.startsWith('--status=')) || '').split('=')[1];
const DEFAULT_STATUS = statusArg || 'Pending';
const BATCH = 500;

if (!VENDOR_STATUSES.includes(DEFAULT_STATUS)) {
  console.error(`❌ --status must be one of: ${VENDOR_STATUSES.join(', ')}`);
  process.exit(1);
}

const main = async () => {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI is not set. Run this from the backend directory with your .env in place.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  // Work through the raw collection: we are repairing documents that may not
  // satisfy the current schema (e.g. no name), so Mongoose validation must not
  // reject them mid-migration.
  const col = mongoose.connection.collection('vendors');

  const total = await col.countDocuments({});
  console.log(`\n${APPLY ? '🚚 APPLYING' : '🔍 DRY RUN (nothing will be written)'}`);
  console.log(`   Database : ${mongoose.connection.name}`);
  console.log(`   Vendors  : ${total}`);
  console.log(`   Default status for vendors without one: ${DEFAULT_STATUS}\n`);

  const stats = {
    scanned: 0,
    isArchivedSet: 0,
    statusSet: 0,
    prioritySet: 0,
    normalizedSet: 0,
    unchanged: 0,
    missingName: 0,
  };

  const cursor = col.find({}, {
    projection: {
      name: 1, gstin: 1, pan: 1, email: 1, phone: 1,
      isArchived: 1, status: 1, priority: 1,
      nameNorm: 1, gstinNorm: 1, panNorm: 1, emailNorm: 1, phoneNorm: 1,
    },
  });

  let ops = [];
  const flush = async () => {
    if (!ops.length) return;
    if (APPLY) await col.bulkWrite(ops, { ordered: false });
    ops = [];
  };

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    stats.scanned += 1;

    const set = {};

    // --- Lifecycle defaults (only when genuinely absent) ---
    if (doc.isArchived === undefined || doc.isArchived === null) {
      set.isArchived = false;
      stats.isArchivedSet += 1;
    }
    if (!doc.status) {
      set.status = DEFAULT_STATUS;
      stats.statusSet += 1;
    }
    if (!doc.priority) {
      set.priority = 'Medium';
      stats.prioritySet += 1;
    }

    // --- Normalized shadow fields (derived; recompute if wrong or missing) ---
    const derived = {
      nameNorm: normalizeCompanyName(doc.name),
      gstinNorm: normalizeCode(doc.gstin),
      panNorm: normalizeCode(doc.pan),
      emailNorm: normalizeEmail(doc.email),
      phoneNorm: normalizePhone(doc.phone),
    };
    let normalizedChanged = false;
    for (const [key, value] of Object.entries(derived)) {
      if ((doc[key] || '') !== value) {
        set[key] = value;
        normalizedChanged = true;
      }
    }
    if (normalizedChanged) stats.normalizedSet += 1;

    if (!doc.name || !String(doc.name).trim()) stats.missingName += 1;

    if (Object.keys(set).length === 0) {
      stats.unchanged += 1;
      continue;
    }

    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
    if (ops.length >= BATCH) await flush();
  }
  await flush();

  console.log('   Scanned                    :', stats.scanned);
  console.log('   isArchived backfilled      :', stats.isArchivedSet);
  console.log('   status backfilled          :', stats.statusSet);
  console.log('   priority backfilled        :', stats.prioritySet);
  console.log('   search/duplicate keys built:', stats.normalizedSet);
  console.log('   already up to date         :', stats.unchanged);

  if (stats.missingName) {
    console.log(`\n⚠️  ${stats.missingName} vendor(s) have no name. They will list and can be`);
    console.log('   opened, but the module requires a name before they can be saved again.');
    console.log('   Give them a name in the UI when you next edit them.');
  }

  if (!APPLY) {
    console.log('\n🔍 Dry run complete — nothing was written.');
    console.log('   Re-run with --apply once you have a database backup.\n');
  } else {
    console.log('\n✅ Migration complete.\n');
  }

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error('\n❌ Migration failed:', err.message);
  console.error('   No partial state to undo: every write is an idempotent $set,');
  console.error('   so re-running the script is safe.\n');
  try { await mongoose.disconnect(); } catch { /* already closed */ }
  process.exit(1);
});
