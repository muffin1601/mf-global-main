// Vendor document management.
//
// Files live in backend/private-uploads/vendors — deliberately OUTSIDE the
// backend/uploads directory that server.js exposes via express.static. A
// compliance document must be unreachable without authentication, and a
// randomised filename is obscurity, not access control. The only way to read
// one is the authenticated download/preview route below. Filenames are still
// generated server-side so a malicious original name (../../etc/passwd,
// foo.pdf.exe) can never influence the path.

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const router = express.Router({ mergeParams: true });

const VendorDocument = require('../../models/VendorDocument');
const Vendor = require('../../models/VendorData');
const authenticate = require('../../middleware/auth');
const { requireVendorPermission } = require('../../middleware/vendorPermissions');
const { getPaging, setPageHeaders } = require('../../utils/paginate');
const { validateDocumentPayload } = require('../../utils/vendorValidators');
const { ok, fail, isValidId, handleError, logVendorAudit, pick } = require('../../utils/vendorHelpers');

const DOCS_DIR = path.join(__dirname, '../../private-uploads/vendors');
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// Allowlist by BOTH extension and mimetype — either alone is trivially spoofed.
const ALLOWED = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

// Types safe to render inline in a browser tab. Everything else is forced to
// download, so an uploaded HTML/SVG payload can never execute in our origin.
const INLINE_VIEWABLE = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
    cb(null, DOCS_DIR);
  },
  filename: (req, file, cb) => {
    // Random name + validated extension. The user's filename is stored in the
    // database for display only and never touches the filesystem.
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `vendordoc-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mimes = ALLOWED[ext];
    if (!mimes) return cb(new Error('UNSUPPORTED_TYPE'), false);
    if (!mimes.includes(file.mimetype)) return cb(new Error('UNSUPPORTED_TYPE'), false);
    return cb(null, true);
  },
});

// Translate multer's own errors into the module's response envelope, so an
// oversized or wrong-typed file produces a clear message rather than a 500.
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return fail(res, 413, 'File is too large. The maximum size is 10 MB.');
    }
    if (err.message === 'UNSUPPORTED_TYPE') {
      return fail(res, 415, `Unsupported file type. Allowed: ${Object.keys(ALLOWED).join(', ')}`);
    }
    return fail(res, 400, 'The file could not be uploaded. Please try again.');
  });
};

// Remove a just-uploaded file when the request is subsequently rejected, so a
// failed validation never leaves an orphan on disk.
const discard = (file) => {
  if (file?.path) fs.unlink(file.path, () => {});
};

const loadVendor = async (req, res, next) => {
  try {
    if (!isValidId(req.params.vendorId)) {
      discard(req.file);
      return fail(res, 400, 'Invalid vendor id');
    }
    const vendor = await Vendor.findById(req.params.vendorId).select('_id v_code name');
    if (!vendor) {
      discard(req.file);
      return fail(res, 404, 'Vendor not found');
    }
    req.vendor = vendor;
    return next();
  } catch (err) {
    discard(req.file);
    return handleError(res, err, 'loadVendor (documents)');
  }
};

/* -------------------------------- LIST -------------------------------- */
router.get('/:vendorId/documents', authenticate, requireVendorPermission('vendor.view'), loadVendor, async (req, res) => {
  try {
    const { page, limit, skip } = getPaging(req);
    const filter = { vendor: req.vendor._id, status: req.query.status === 'Archived' ? 'Archived' : 'Active' };

    const [documents, total] = await Promise.all([
      VendorDocument.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      VendorDocument.countDocuments(filter),
    ]);

    const now = Date.now();
    const rows = documents.map((doc) => {
      // Expiry is derived here rather than stored, so it is never stale.
      let expiryState = 'none';
      if (doc.expiryDate) {
        const days = Math.ceil((new Date(doc.expiryDate).getTime() - now) / 86400000);
        if (days < 0) expiryState = 'expired';
        else if (days <= 30) expiryState = 'expiring';
        else expiryState = 'valid';
        doc.daysToExpiry = days;
      }
      doc.expiryState = expiryState;
      // storedName is an internal detail — the client uses the download route.
      delete doc.storedName;
      doc.canPreview = INLINE_VIEWABLE.has(doc.mimeType);
      return doc;
    });

    const pages = setPageHeaders(res, total, page, limit);
    return ok(res, { documents: rows, total, page, pages });
  } catch (err) {
    return handleError(res, err, 'GET vendor documents');
  }
});

/* ------------------------------- UPLOAD ------------------------------- */
router.post(
  '/:vendorId/documents',
  authenticate,
  requireVendorPermission('vendor.documents'),
  handleUpload,
  loadVendor,
  async (req, res) => {
    try {
      if (!req.file) return fail(res, 400, 'Select a file to upload');

      const errors = validateDocumentPayload(req.body);
      if (errors.length) {
        discard(req.file);
        return fail(res, 400, errors[0], { errors });
      }

      const data = pick(req.body, ['name', 'documentType', 'description', 'issueDate', 'expiryDate']);

      const doc = await VendorDocument.create({
        ...data,
        issueDate: data.issueDate ? new Date(data.issueDate) : null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        vendor: req.vendor._id,
        storedName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        uploadedBy: req.user._id,
        uploadedByName: req.user.name || req.user.username || '',
      });

      await logVendorAudit(req, 'Vendor document uploaded', {
        vendorId: req.vendor._id, v_code: req.vendor.v_code,
        document: doc.name, documentType: doc.documentType,
      });

      const created = doc.toObject();
      delete created.storedName;
      return ok(res, { document: created }, 201);
    } catch (err) {
      discard(req.file);
      return handleError(res, err, 'POST vendor document');
    }
  }
);

/* ------------------------- REPLACE THE FILE ------------------------- */
router.put(
  '/:vendorId/documents/:docId/file',
  authenticate,
  requireVendorPermission('vendor.documents'),
  handleUpload,
  loadVendor,
  async (req, res) => {
    try {
      if (!isValidId(req.params.docId)) { discard(req.file); return fail(res, 400, 'Invalid document id'); }
      if (!req.file) return fail(res, 400, 'Select a replacement file');

      const doc = await VendorDocument.findById(req.params.docId);
      if (!doc || String(doc.vendor) !== String(req.vendor._id)) {
        discard(req.file);
        return fail(res, 404, 'Document not found for this vendor');
      }

      const oldStoredName = doc.storedName;
      doc.storedName = req.file.filename;
      doc.originalName = req.file.originalname;
      doc.mimeType = req.file.mimetype;
      doc.sizeBytes = req.file.size;
      doc.uploadedBy = req.user._id;
      doc.uploadedByName = req.user.name || req.user.username || '';
      await doc.save();

      // Only unlink the superseded file after the new one is safely recorded.
      if (oldStoredName) fs.unlink(path.join(DOCS_DIR, oldStoredName), () => {});

      await logVendorAudit(req, 'Vendor document replaced', {
        vendorId: req.vendor._id, v_code: req.vendor.v_code, document: doc.name,
      });

      const updated = doc.toObject();
      delete updated.storedName;
      return ok(res, { document: updated });
    } catch (err) {
      discard(req.file);
      return handleError(res, err, 'PUT vendor document file');
    }
  }
);

/* -------------------------- UPDATE METADATA -------------------------- */
router.put('/:vendorId/documents/:docId', authenticate, requireVendorPermission('vendor.documents'), loadVendor, async (req, res) => {
  try {
    if (!isValidId(req.params.docId)) return fail(res, 400, 'Invalid document id');

    const doc = await VendorDocument.findById(req.params.docId);
    if (!doc || String(doc.vendor) !== String(req.vendor._id)) {
      return fail(res, 404, 'Document not found for this vendor');
    }

    const errors = validateDocumentPayload({ ...doc.toObject(), ...req.body });
    if (errors.length) return fail(res, 400, errors[0], { errors });

    const data = pick(req.body, ['name', 'documentType', 'description', 'issueDate', 'expiryDate', 'status']);
    if ('issueDate' in data) data.issueDate = data.issueDate ? new Date(data.issueDate) : null;
    if ('expiryDate' in data) data.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
    if (data.status && !['Active', 'Archived'].includes(data.status)) delete data.status;

    Object.assign(doc, data);
    await doc.save();

    await logVendorAudit(req, 'Vendor document updated', {
      vendorId: req.vendor._id, v_code: req.vendor.v_code, document: doc.name,
    });

    const updated = doc.toObject();
    delete updated.storedName;
    return ok(res, { document: updated });
  } catch (err) {
    return handleError(res, err, 'PUT vendor document');
  }
});

/* --------------------------- DOWNLOAD / PREVIEW --------------------------- */
router.get('/:vendorId/documents/:docId/file', authenticate, requireVendorPermission('vendor.view'), loadVendor, async (req, res) => {
  try {
    if (!isValidId(req.params.docId)) return fail(res, 400, 'Invalid document id');

    const doc = await VendorDocument.findById(req.params.docId).select('+storedName').lean();
    if (!doc || String(doc.vendor) !== String(req.vendor._id)) {
      return fail(res, 404, 'Document not found for this vendor');
    }

    // Resolve and confirm the path stays inside DOCS_DIR — defence in depth
    // against any stored value that is not the random name we generated.
    const filePath = path.resolve(DOCS_DIR, doc.storedName);
    if (!filePath.startsWith(path.resolve(DOCS_DIR) + path.sep)) {
      return fail(res, 400, 'Invalid document reference');
    }
    if (!fs.existsSync(filePath)) {
      return fail(res, 404, 'The stored file is no longer available');
    }

    const inline = req.query.disposition === 'inline' && INLINE_VIEWABLE.has(doc.mimeType);
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    // Block sniffing and framing of user-supplied content.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; object-src 'none'");
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    // Quote-escape the filename so it cannot break out of the header value.
    const safeName = String(doc.originalName || 'document').replace(/["\r\n]/g, '');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`);

    return fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    return handleError(res, err, 'GET vendor document file');
  }
});

/* -------------------------------- DELETE -------------------------------- */
router.delete('/:vendorId/documents/:docId', authenticate, requireVendorPermission('vendor.documents'), loadVendor, async (req, res) => {
  try {
    if (!isValidId(req.params.docId)) return fail(res, 400, 'Invalid document id');

    const doc = await VendorDocument.findById(req.params.docId).select('+storedName');
    if (!doc || String(doc.vendor) !== String(req.vendor._id)) {
      return fail(res, 404, 'Document not found for this vendor');
    }

    const { name, storedName } = doc;
    await doc.deleteOne();
    if (storedName) fs.unlink(path.join(DOCS_DIR, storedName), () => {});

    await logVendorAudit(req, 'Vendor document deleted', {
      vendorId: req.vendor._id, v_code: req.vendor.v_code, document: name,
    });

    return ok(res, { message: 'Document deleted' });
  } catch (err) {
    return handleError(res, err, 'DELETE vendor document');
  }
});

module.exports = router;
module.exports.DOCS_DIR = DOCS_DIR;
