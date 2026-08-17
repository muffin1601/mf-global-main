// Vendor CSV import and export.
//
// The import is a reviewed, four-step workflow rather than a blind bulk insert:
//   1. POST /import/upload    — upload the file; headers are detected and an
//                               initial column mapping is suggested.
//   2. POST /import/validate  — with the confirmed mapping, every row is checked
//                               and a preview + per-row error/duplicate report
//                               is returned. Nothing is written yet.
//   3. POST /import/commit    — the valid rows are inserted.
//   4. GET  /import/:id/report— download the full per-row report as CSV.
//
// No invalid record is ever silently skipped: every rejected row appears in the
// report with the reason it was rejected.

const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Parser } = require('json2csv');

const router = express.Router();

const Vendor = require('../../models/VendorData');
const VendorCategory = require('../../models/VendorCategory');
const VendorProduct = require('../../models/VendorProduct');
const VendorImportJob = require('../../models/VendorImportJob');
const authenticate = require('../../middleware/auth');
const { requireVendorPermission } = require('../../middleware/vendorPermissions');
const {
  suggestMapping, missingRequired, mapRow, validateRow, canonicalizeRow,
  MAPPABLE_FIELDS, EXPORT_FIELDS, TEMPLATE_HEADERS,
} = require('../../utils/vendorCsv');
const {
  normalizeCompanyName, normalizeCode, normalizeEmail, normalizePhone,
} = require('../../utils/vendorFields');
const { ok, fail, isValidId, handleError, logVendorAudit, performanceBand } = require('../../utils/vendorHelpers');
// Reuse the list endpoint's filter/sort builders so an export always matches
// exactly what the user has on screen.
const { buildListQuery, buildSort } = require('./vendors');

// Uploaded vendor lists are confidential too — keep them out of the
// publicly served uploads directory.
const IMPORT_DIR = path.join(__dirname, '../../private-uploads/vendor-imports');
const MAX_IMPORT_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_ROWS = 20000;      // refuse files larger than one interactive import
const PREVIEW_ROWS = 50;     // rows returned to the browser for review
const REPORT_ROW_CAP = 5000; // rows persisted in the downloadable report
const EXPORT_ROW_CAP = 50000;
const INSERT_BATCH = 500;

const CSV_MIME = new Set(['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(IMPORT_DIR, { recursive: true });
    cb(null, IMPORT_DIR);
  },
  filename: (req, file, cb) => cb(null, `vendorimport-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.csv`),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_IMPORT_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const extOk = /\.csv$/i.test(file.originalname || '');
    const mimeOk = CSV_MIME.has(file.mimetype);
    cb(null, extOk && mimeOk);
  },
});

const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return fail(res, 413, 'The file is too large. The maximum size is 15 MB.');
    return fail(res, 400, 'The file could not be uploaded. Please try again.');
  });
};

// Stream a CSV into memory-bounded rows. Rejects past MAX_ROWS rather than
// letting a runaway file exhaust the process.
const readCsv = (filePath, { limit = MAX_ROWS } = {}) => new Promise((resolve, reject) => {
  const rows = [];
  let headers = [];
  let overLimit = false;

  const parser = csv({ mapHeaders: ({ header }) => String(header || '').trim() });

  fs.createReadStream(filePath)
    .pipe(parser)
    .on('headers', (h) => { headers = h; })
    .on('data', (row) => {
      if (overLimit) return;
      // Skip the fully blank trailing rows Excel appends when saving as CSV.
      if (Object.values(row).every((v) => !String(v ?? '').trim())) return;
      if (rows.length >= limit) { overLimit = true; return; }
      rows.push(row);
    })
    .on('end', () => resolve({ headers, rows, overLimit }))
    .on('error', reject);
});

const cleanupJobFile = (storedName) => {
  if (storedName) fs.unlink(path.join(IMPORT_DIR, storedName), () => {});
};

// An import that is uploaded but never confirmed would otherwise leave its CSV
// — containing real vendor data — on disk indefinitely. There is no job queue
// in this application, so the sweep runs opportunistically on upload: cheap,
// self-contained, and guaranteed to run whenever the feature is used.
const STALE_IMPORT_MS = 24 * 60 * 60 * 1000;

const purgeStaleImports = () => {
  fs.readdir(IMPORT_DIR, (readErr, files) => {
    if (readErr || !files) return;
    const cutoff = Date.now() - STALE_IMPORT_MS;
    for (const file of files) {
      const filePath = path.join(IMPORT_DIR, file);
      // eslint-disable-next-line no-loop-func
      fs.stat(filePath, (statErr, stats) => {
        if (statErr || !stats.isFile()) return;
        if (stats.mtimeMs < cutoff) fs.unlink(filePath, () => {});
      });
    }
  });
};

/* ========================= 1. UPLOAD & DETECT ========================= */
router.post('/import/upload', authenticate, requireVendorPermission('vendor.import'), handleUpload, async (req, res) => {
  try {
    if (!req.file) return fail(res, 400, 'Upload a .csv file to import vendors');

    // Sweep abandoned uploads from previous sessions before adding another.
    purgeStaleImports();

    const { headers, rows, overLimit } = await readCsv(req.file.path);

    if (!headers.length || !rows.length) {
      cleanupJobFile(req.file.filename);
      return fail(res, 400, 'The file has no data rows. Check the file and try again.');
    }
    if (overLimit) {
      cleanupJobFile(req.file.filename);
      return fail(res, 400, `This file has more than ${MAX_ROWS.toLocaleString()} rows. Split it into smaller files and import them one at a time.`);
    }

    const mapping = suggestMapping(headers);

    const job = await VendorImportJob.create({
      userId: req.user._id,
      userName: req.user.name || req.user.username || '',
      fileName: req.file.originalname,
      storedName: req.file.filename,
      headers,
      mapping,
      totalRows: rows.length,
      status: 'uploaded',
    });

    return ok(res, {
      jobId: job._id,
      fileName: job.fileName,
      headers,
      mapping,
      mappableFields: MAPPABLE_FIELDS,
      totalRows: rows.length,
      sampleRows: rows.slice(0, 5),
    }, 201);
  } catch (err) {
    if (req.file) cleanupJobFile(req.file.filename);
    return handleError(res, err, 'POST /import/upload');
  }
});

// Load a job the caller owns. Import jobs are per-user: one user cannot resume
// or commit another user's upload by guessing its id.
const loadJob = async (req, res, next) => {
  try {
    const jobId = req.params.jobId || req.body.jobId;
    if (!isValidId(jobId)) return fail(res, 400, 'Invalid import job id');

    const job = await VendorImportJob.findById(jobId);
    if (!job) return fail(res, 404, 'Import job not found. Upload the file again.');
    if (String(job.userId) !== String(req.user._id) && req.user.role !== 'admin') {
      return fail(res, 403, 'This import was started by another user');
    }
    req.job = job;
    return next();
  } catch (err) {
    return handleError(res, err, 'loadJob');
  }
};

/* ========================= 2. MAP & VALIDATE ========================= */
router.post('/import/validate', authenticate, requireVendorPermission('vendor.import'), loadJob, async (req, res) => {
  try {
    const job = req.job;
    if (job.status === 'completed') return fail(res, 409, 'This import has already been processed');

    const mapping = req.body.mapping && typeof req.body.mapping === 'object' ? req.body.mapping : job.mapping;

    // Only headers that exist in the file and fields we know about are honoured.
    const cleanMapping = {};
    for (const header of job.headers) {
      const field = mapping[header];
      cleanMapping[header] = MAPPABLE_FIELDS.includes(field) ? field : '';
    }

    const missing = missingRequired(cleanMapping);
    if (missing.length) {
      return fail(res, 400, 'Map a column to "Vendor Name" before continuing.', { missing });
    }

    const filePath = path.join(IMPORT_DIR, job.storedName);
    if (!fs.existsSync(filePath)) {
      return fail(res, 410, 'The uploaded file is no longer available. Please upload it again.');
    }

    const { rows } = await readCsv(filePath);
    const mapped = rows.map((row) => canonicalizeRow(mapRow(row, cleanMapping)));

    // One pass over the DB for all identity keys in the file, instead of a
    // query per row (which would be thousands of round trips).
    const keys = { nameNorm: [], gstinNorm: [], panNorm: [], emailNorm: [], phoneNorm: [] };
    for (const v of mapped) {
      if (v.name) keys.nameNorm.push(normalizeCompanyName(v.name));
      if (v.gstin) keys.gstinNorm.push(normalizeCode(v.gstin));
      if (v.pan) keys.panNorm.push(normalizeCode(v.pan));
      if (v.email) keys.emailNorm.push(normalizeEmail(v.email));
      if (v.phone) keys.phoneNorm.push(normalizePhone(v.phone));
    }

    const or = Object.entries(keys)
      .filter(([, values]) => values.length)
      .map(([field, values]) => ({ [field]: { $in: [...new Set(values)].filter(Boolean) } }));

    const existing = or.length
      ? await Vendor.find({ $or: or }).select('nameNorm gstinNorm panNorm emailNorm phoneNorm name').lean()
      : [];

    const existingSets = {
      nameNorm: new Set(existing.map((e) => e.nameNorm).filter(Boolean)),
      gstinNorm: new Set(existing.map((e) => e.gstinNorm).filter(Boolean)),
      panNorm: new Set(existing.map((e) => e.panNorm).filter(Boolean)),
      emailNorm: new Set(existing.map((e) => e.emailNorm).filter(Boolean)),
      phoneNorm: new Set(existing.map((e) => e.phoneNorm).filter(Boolean)),
    };

    // Duplicates within the file itself count too.
    const seen = { nameNorm: new Set(), gstinNorm: new Set(), panNorm: new Set() };

    const report = [];
    let importedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    mapped.forEach((vendor, index) => {
      const rowNumber = index + 2; // +1 for zero-index, +1 for the header row
      const errors = validateRow(vendor);

      if (errors.length) {
        errorCount += 1;
        report.push({ rowNumber, vendorName: vendor.name || '', status: 'Error', reason: errors.join('; ') });
        return;
      }

      const rowKeys = {
        nameNorm: normalizeCompanyName(vendor.name),
        gstinNorm: normalizeCode(vendor.gstin),
        panNorm: normalizeCode(vendor.pan),
        emailNorm: normalizeEmail(vendor.email),
        phoneNorm: normalizePhone(vendor.phone),
      };

      const reasons = [];
      if (rowKeys.gstinNorm && (existingSets.gstinNorm.has(rowKeys.gstinNorm) || seen.gstinNorm.has(rowKeys.gstinNorm))) reasons.push('GSTIN already exists');
      if (rowKeys.panNorm && (existingSets.panNorm.has(rowKeys.panNorm) || seen.panNorm.has(rowKeys.panNorm))) reasons.push('PAN already exists');
      if (rowKeys.nameNorm && (existingSets.nameNorm.has(rowKeys.nameNorm) || seen.nameNorm.has(rowKeys.nameNorm))) reasons.push('A vendor with this name already exists');
      if (rowKeys.emailNorm && existingSets.emailNorm.has(rowKeys.emailNorm)) reasons.push('Email already used by another vendor');
      if (rowKeys.phoneNorm && existingSets.phoneNorm.has(rowKeys.phoneNorm)) reasons.push('Phone already used by another vendor');

      if (reasons.length) {
        duplicateCount += 1;
        report.push({ rowNumber, vendorName: vendor.name, status: 'Duplicate', reason: reasons.join('; ') });
        return;
      }

      if (rowKeys.nameNorm) seen.nameNorm.add(rowKeys.nameNorm);
      if (rowKeys.gstinNorm) seen.gstinNorm.add(rowKeys.gstinNorm);
      if (rowKeys.panNorm) seen.panNorm.add(rowKeys.panNorm);

      importedCount += 1;
      report.push({ rowNumber, vendorName: vendor.name, status: 'Ready', reason: '' });
    });

    job.mapping = cleanMapping;
    job.totalRows = mapped.length;
    job.imported = 0;
    job.duplicates = duplicateCount;
    job.errorCount = errorCount;
    job.status = 'validated';
    job.report = report.slice(0, REPORT_ROW_CAP);
    job.reportTruncated = report.length > REPORT_ROW_CAP;
    await job.save();

    return ok(res, {
      jobId: job._id,
      mapping: cleanMapping,
      summary: {
        totalRows: mapped.length,
        readyToImport: importedCount,
        duplicates: duplicateCount,
        errors: errorCount,
      },
      // Only a slice is sent to the browser; the full report is downloadable.
      preview: report.slice(0, PREVIEW_ROWS),
      previewTruncated: report.length > PREVIEW_ROWS,
    });
  } catch (err) {
    return handleError(res, err, 'POST /import/validate');
  }
});

/* ============================ 3. COMMIT ============================ */
router.post('/import/commit', authenticate, requireVendorPermission('vendor.import'), loadJob, async (req, res) => {
  try {
    const job = req.job;
    if (job.status === 'completed') return fail(res, 409, 'This import has already been processed');
    if (job.status !== 'validated') return fail(res, 400, 'Validate the import before confirming it');

    const filePath = path.join(IMPORT_DIR, job.storedName);
    if (!fs.existsSync(filePath)) {
      return fail(res, 410, 'The uploaded file is no longer available. Please upload it again.');
    }

    // Rows the validation step marked "Ready", keyed by row number so the
    // decision the user reviewed is exactly the decision applied.
    const readyRows = new Set(job.report.filter((r) => r.status === 'Ready').map((r) => r.rowNumber));

    const { rows } = await readCsv(filePath);
    const categories = await VendorCategory.find().select('_id name').lean();
    const categoryByName = new Map(categories.map((c) => [String(c.name).trim().toLowerCase(), c._id]));

    const toInsert = [];
    rows.forEach((raw, index) => {
      const rowNumber = index + 2;
      if (!readyRows.has(rowNumber)) return;

      const vendor = canonicalizeRow(mapRow(raw, job.mapping));
      const { categoryName, ...rest } = vendor;

      toInsert.push({
        ...rest,
        // Only an existing category is linked — the import never creates
        // master data as a side effect.
        category: categoryName ? categoryByName.get(categoryName.trim().toLowerCase()) || null : null,
        status: rest.status || 'Pending',
        createdBy: req.user._id,
        updatedBy: req.user._id,
        rowNumber,
      });
    });

    let imported = 0;
    const failures = [];

    // Insert in batches through the model (not insertMany with raw docs) so the
    // pre-save hook still assigns v_code and the normalized shadow fields.
    for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
      const batch = toInsert.slice(i, i + INSERT_BATCH);
      // eslint-disable-next-line no-await-in-loop
      const results = await Promise.allSettled(batch.map(({ rowNumber, ...data }) => Vendor.create(data)));
      results.forEach((result, idx) => {
        const { rowNumber, name } = batch[idx];
        if (result.status === 'fulfilled') {
          imported += 1;
          const entry = job.report.find((r) => r.rowNumber === rowNumber);
          if (entry) { entry.status = 'Imported'; entry.vendorId = result.value._id; }
        } else {
          const reason = result.reason?.code === 11000
            ? 'A vendor with these details already exists'
            : 'Could not be saved (check the values in this row)';
          failures.push({ rowNumber, name, reason });
          const entry = job.report.find((r) => r.rowNumber === rowNumber);
          if (entry) { entry.status = 'Error'; entry.reason = reason; }
        }
      });
    }

    job.imported = imported;
    job.errorCount += failures.length;
    job.status = 'completed';
    job.markModified('report');
    await job.save();

    // The source file has served its purpose — remove it rather than leaving
    // vendor data sitting on disk.
    cleanupJobFile(job.storedName);
    job.storedName = '';
    await job.save();

    await logVendorAudit(req, 'Vendors imported', {
      jobId: String(job._id), fileName: job.fileName,
      totalRows: job.totalRows, imported, duplicates: job.duplicates, errors: job.errorCount,
    });

    return ok(res, {
      jobId: job._id,
      summary: {
        totalRows: job.totalRows,
        imported,
        duplicates: job.duplicates,
        errors: job.errorCount,
      },
      failures: failures.slice(0, 20),
    });
  } catch (err) {
    return handleError(res, err, 'POST /import/commit');
  }
});

/* ===================== 4. DOWNLOADABLE ROW REPORT ===================== */
router.get('/import/:jobId/report', authenticate, requireVendorPermission('vendor.import'), loadJob, async (req, res) => {
  try {
    const rows = req.job.report.map((r) => ({
      'Row Number': r.rowNumber,
      'Vendor Name': r.vendorName,
      Status: r.status,
      Reason: r.reason,
      'Vendor ID': r.vendorId ? String(r.vendorId) : '',
    }));

    if (!rows.length) return fail(res, 404, 'There is no report for this import');

    const parser = new Parser({ fields: ['Row Number', 'Vendor Name', 'Status', 'Reason', 'Vendor ID'] });
    const csvOut = parser.parse(rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="vendor-import-report-${req.job._id}.csv"`);
    return res.send(csvOut);
  } catch (err) {
    return handleError(res, err, 'GET import report');
  }
});

/* ========================== IMPORT TEMPLATE ========================== */
router.get('/import/template', authenticate, requireVendorPermission('vendor.import'), (req, res) => {
  // A header-only CSV so users start from the exact columns the importer reads.
  const csvOut = `${TEMPLATE_HEADERS.join(',')}\n`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="vendor-import-template.csv"');
  return res.send(csvOut);
});

/* =============================== EXPORT =============================== */
// Exports exactly what the current filters select, so the file matches what the
// user is looking at. Capped, and streamed from a lean projection.
router.get('/export', authenticate, requireVendorPermission('vendor.export'), async (req, res) => {
  try {
    const filter = buildListQuery(req.query);

    const total = await Vendor.countDocuments(filter);
    if (!total) return fail(res, 404, 'There are no vendors matching the current filters');

    const vendors = await Vendor.find(filter)
      .select('v_code name legalName type status priority industry website gstin pan cin tags email phone contacts addresses category owner performance isArchived createdAt city state pin_code addr1 addr2')
      .populate('category', 'name')
      .populate('owner', 'name username')
      .sort(buildSort(req.query))
      .limit(EXPORT_ROW_CAP)
      .lean();

    // Product counts for the exported set in one grouped query.
    const ids = vendors.map((v) => v._id);
    const counts = await VendorProduct.aggregate([
      { $match: { vendor: { $in: ids }, isActive: true } },
      { $group: { _id: '$vendor', count: { $sum: 1 } } },
    ]);
    const countByVendor = new Map(counts.map((c) => [String(c._id), c.count]));

    const rows = vendors.map((v) => {
      const primary = (v.contacts || []).find((c) => c.isPrimary) || (v.contacts || [])[0] || null;
      const address = (v.addresses || []).find((a) => a.isDefault) || (v.addresses || [])[0] || null;
      return {
        v_code: v.v_code || '',
        name: v.name || '',
        legalName: v.legalName || '',
        type: v.type || '',
        categoryName: v.category?.name || '',
        status: v.status || '',
        priority: v.priority || '',
        primaryContactName: primary?.fullName || v.contact_name || '',
        primaryContactDesignation: primary?.designation || '',
        phone: primary?.phone || v.phone || '',
        email: primary?.email || v.email || '',
        website: v.website || '',
        gstin: v.gstin || '',
        pan: v.pan || '',
        cin: v.cin || '',
        industry: v.industry || '',
        addressLine: address ? [address.line1, address.line2].filter(Boolean).join(', ') : [v.addr1, v.addr2].filter(Boolean).join(', '),
        city: address?.city || v.city || '',
        state: address?.state || v.state || '',
        pincode: address?.pincode || v.pin_code || '',
        country: address?.country || '',
        tagList: (v.tags || []).join('; '),
        ownerName: v.owner?.name || v.owner?.username || '',
        productCount: countByVendor.get(String(v._id)) || 0,
        // Blank rather than 0 when a vendor has never been evaluated.
        performanceScore: v.performance?.overallScore ?? '',
        performanceBand: performanceBand(v.performance?.overallScore ?? null),
        archived: v.isArchived ? 'Yes' : 'No',
        createdDate: v.createdAt ? new Date(v.createdAt).toISOString().slice(0, 10) : '',
      };
    });

    const parser = new Parser({ fields: EXPORT_FIELDS });
    const csvOut = parser.parse(rows);

    await logVendorAudit(req, 'Vendors exported', { rows: rows.length, truncated: total > EXPORT_ROW_CAP });

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="vendors-${stamp}.csv"`);
    if (total > EXPORT_ROW_CAP) res.setHeader('X-Export-Truncated', 'true');
    return res.send(csvOut);
  } catch (err) {
    return handleError(res, err, 'GET /export');
  }
});

module.exports = router;
