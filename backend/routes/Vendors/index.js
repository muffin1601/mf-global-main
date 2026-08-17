// Vendor Management module router.
//
// Mounted at /api/vendor-management. The legacy /api/vendors endpoints in
// routes/Products/vendor.js are left in place and untouched so the existing
// product screens keep working while they migrate to this module.
//
// Ordering matters: the collection-level routers (categories, import/export,
// performance leaderboard) are mounted before the per-vendor sub-resource
// routers, which are in turn mounted before the vendors router's own
// "/:id" handlers — so a literal path segment is never captured as an id.

const express = require('express');

const router = express.Router();

const vendors = require('./vendors');
const vendorContacts = require('./vendorContacts');
const vendorProducts = require('./vendorProducts');
const vendorDocuments = require('./vendorDocuments');
const vendorPerformance = require('./vendorPerformance');
const vendorActivities = require('./vendorActivities');
const vendorCategories = require('./vendorCategories');
const vendorImportExport = require('./vendorImportExport');

// Master data.
router.use('/categories', vendorCategories);

// Import / export are module-level operations, not per-vendor ones.
router.use('/', vendorImportExport);

// Performance: the cross-vendor leaderboard plus per-vendor evaluations.
router.use('/vendors', vendorPerformance);

// Per-vendor sub-resources (/vendors/:vendorId/...).
router.use('/vendors', vendorContacts);
router.use('/vendors', vendorProducts);
router.use('/vendors', vendorDocuments);
router.use('/vendors', vendorActivities);

// Core vendor CRUD, list, status, archive and audit.
router.use('/vendors', vendors);

module.exports = router;
