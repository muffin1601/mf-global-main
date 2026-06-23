const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Parser } = require("json2csv");

const ClientData = require("../models/ClientData");
const ImportHistory = require("../models/ImportHistory");
const User = require("../models/User");
const authenticate = require("../middleware/auth");
const {
  buildHeaderMap,
  canonicalizeRow,
  isBlankRow,
  validateRow,
} = require("../utils/leadCsv");

// --- Storage dirs -----------------------------------------------------------
const UPLOAD_DIR = path.join(__dirname, "../uploads");
const JOB_DIR = path.join(UPLOAD_DIR, "import-jobs");
fs.mkdirSync(JOB_DIR, { recursive: true });

// Tunables
const PREVIEW_CAP = 100; // rows returned to the UI for preview/skipped tables
const REPORT_ROW_CAP = 50000; // max per-row entries persisted for CSV download
const MAX_FILE_BYTES = 50 * 1024 * 1024;

const CSV_MIME = new Set(["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain", "application/octet-stream"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `import-${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const extOk = /\.csv$/i.test(file.originalname);
    const mimeOk = CSV_MIME.has(file.mimetype);
    cb(null, extOk && mimeOk);
  },
});

const SAFE_TOKEN = /^[a-zA-Z0-9-]+$/;
const jobPath = (token) => path.join(JOB_DIR, `${token}.json`);

const readJob = (token) => {
  if (!SAFE_TOKEN.test(token)) return null;
  const p = jobPath(token);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
};
const writeJob = (token, job) => fs.writeFileSync(jobPath(token), JSON.stringify(job));
const deleteJob = (token) => fs.existsSync(jobPath(token)) && fs.unlink(jobPath(token), () => {});

// ===========================================================================
// GET /lead-import/sample  — download a ready-to-fill sample CSV
// ===========================================================================
router.get("/lead-import/sample", authenticate, (req, res) => {
  const header = "Company Name,Contact Person,Mobile Number,Email,City,State,Category,Requirements,Remarks";
  const rows = [
    "Acme Industries,Rahul Sharma,9876543210,rahul@acme.com,Delhi,Delhi,Manufacturing,Need 500 units of valves,Follow up next week",
    "Bright Electronics,Priya Verma,9812345678,priya@bright.in,Mumbai,Maharashtra,Electronics,Bulk LED order,Interested in catalogue",
    "Sunrise Traders,Amit Patel,9123456780,,Ahmedabad,Gujarat,Trading,Requirement for packaging material,Call after 5pm",
  ];
  const csvText = [header, ...rows].join("\r\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=lead_import_sample.csv");
  res.send(csvText);
});

// ===========================================================================
// POST /lead-import/preview  — parse + validate + dedup (NO insert)
// Returns summary + capped preview/skipped tables + a job token used by commit.
// ===========================================================================
router.post("/lead-import/preview", authenticate, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No CSV file uploaded." });

  const filePath = req.file.path;
  const cleanup = () => fs.existsSync(filePath) && fs.unlink(filePath, () => {});

  try {
    // --- Phase 1: parse the whole file into canonical rows ---
    const canonicalRows = [];
    let headerMap = null;
    let missingRequired = null;
    let headerError = null;

    await new Promise((resolve, reject) => {
      const parser = csv();
      fs.createReadStream(filePath)
        .pipe(parser)
        .on("headers", (headers) => {
          const built = buildHeaderMap(headers);
          headerMap = built.map;
          missingRequired = built.missingRequired;
          if (built.missingRequired.length) {
            headerError = `Missing required column(s): ${built.missingRequired.join(", ")}. Download the sample CSV for the correct format.`;
            parser.destroy(); // stop reading; bad format
          }
        })
        .on("data", (row) => {
          if (headerError) return;
          const canonical = canonicalizeRow(row, headerMap);
          if (!isBlankRow(canonical)) canonicalRows.push(canonical);
        })
        .on("close", resolve)
        .on("end", resolve)
        .on("error", reject);
    });

    if (headerError) {
      cleanup();
      return res.status(400).json({ message: headerError });
    }
    if (!canonicalRows.length) {
      cleanup();
      return res.status(400).json({ message: "The file has no data rows. Add at least one lead and try again." });
    }

    // --- Phase 2: validate every row ---
    const candidates = []; // { rowNumber, lead }
    const reportRows = []; // ALL non-blank rows, in order
    let invalid = 0;

    canonicalRows.forEach((c, i) => {
      const rowNumber = i + 2; // +1 for header, +1 for 1-based row numbering
      const result = validateRow(c, req.file.originalname);
      if (!result.ok) {
        invalid++;
        reportRows.push({ rowNumber, company: c.company || "", status: "Skipped", reason: result.reason, leadId: null });
      } else {
        const idx = reportRows.push({ rowNumber, company: c.company || "", status: "Valid", reason: "", leadId: null }) - 1;
        candidates.push({ rowNumber, reportIdx: idx, lead: result.lead });
      }
    });

    // --- Phase 3: duplicate detection (in-file + database) ---
    const phones = candidates.map((c) => c.lead.phone).filter(Boolean);
    const emails = candidates.map((c) => c.lead.email).filter(Boolean);
    const existing = await ClientData.find({
      $or: [{ phone: { $in: phones } }, { email: { $in: emails } }],
    }).select("phone email").lean();
    const existingPhones = new Set(existing.map((e) => e.phone).filter(Boolean));
    const existingEmails = new Set(existing.map((e) => e.email).filter(Boolean));

    const seenPhones = new Set();
    const seenEmails = new Set();
    const validRows = []; // survivors -> { rowNumber, reportIdx, lead }
    let duplicates = 0;

    for (const cand of candidates) {
      const { phone, email } = cand.lead;
      const r = reportRows[cand.reportIdx];
      let dupReason = null;
      if (phone && seenPhones.has(phone)) dupReason = "Duplicate Mobile Number (in file)";
      else if (email && seenEmails.has(email)) dupReason = "Duplicate Email (in file)";
      else if (phone && existingPhones.has(phone)) dupReason = "Duplicate Mobile Number";
      else if (email && existingEmails.has(email)) dupReason = "Duplicate Email";

      if (dupReason) {
        duplicates++;
        r.status = "Duplicate";
        r.reason = dupReason;
      } else {
        if (phone) seenPhones.add(phone);
        if (email) seenEmails.add(email);
        validRows.push(cand);
      }
    }

    const summary = {
      total: canonicalRows.length,
      valid: validRows.length,
      invalid,
      duplicate: duplicates,
    };

    // --- Phase 4: persist a job for commit; return capped tables to UI ---
    const token = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    writeJob(token, {
      userId: String(req.user._id),
      fileName: req.file.originalname,
      validRows,
      reportRows,
      summary,
    });
    cleanup(); // original CSV no longer needed; job JSON holds parsed data

    const skippedPreview = reportRows
      .filter((r) => r.status !== "Valid")
      .slice(0, PREVIEW_CAP)
      .map((r) => ({ rowNumber: r.rowNumber, company: r.company, status: r.status, reason: r.reason }));

    const validPreview = reportRows
      .filter((r) => r.status === "Valid")
      .slice(0, PREVIEW_CAP)
      .map((r) => ({ rowNumber: r.rowNumber, company: r.company }));

    return res.json({
      token,
      fileName: req.file.originalname,
      summary,
      skippedPreview,
      validPreview,
      previewCap: PREVIEW_CAP,
    });
  } catch (err) {
    cleanup();
    console.error("Lead import preview error:", err);
    return res.status(500).json({ message: "Could not read the CSV file. Make sure it is a valid CSV and not open in Excel." });
  }
});

// ===========================================================================
// POST /lead-import/commit  — insert a slice of the validated rows (batched)
// body: { token, importId?, offset, limit, assignTo? }
// Re-validates duplicates against the DB at insert time (never trusts preview).
// ===========================================================================
router.post("/lead-import/commit", authenticate, async (req, res) => {
  const { token, importId, offset = 0, limit = 500, assignTo } = req.body || {};
  const job = readJob(token);
  if (!job) return res.status(404).json({ message: "Import session expired. Please upload the file again." });
  if (job.userId !== String(req.user._id)) {
    return res.status(403).json({ message: "You can only commit your own import." });
  }

  try {
    const isAdmin = req.user.role === "admin";

    // Resolve assignment (admins only).
    let assignment = null;
    let assignedToName = null;
    if (isAdmin && assignTo) {
      const u = await User.findById(assignTo, "_id name").lean();
      if (u) {
        assignment = [{ user: { _id: u._id, name: u.name }, permissions: { view: true, update: false, delete: false } }];
        assignedToName = u.name;
      }
    }

    // First batch: create the ImportHistory record.
    let history;
    if (importId) {
      history = await ImportHistory.findById(importId);
      if (!history) return res.status(404).json({ message: "Import record not found." });
    } else {
      history = await ImportHistory.create({
        userId: req.user.userId || String(req.user._id),
        userName: req.user.name,
        role: req.user.role,
        fileName: job.fileName,
        totalRows: job.summary.total,
        imported: 0,
        skipped: job.summary.invalid,
        duplicates: job.summary.duplicate,
        errors: 0,
        status: "in_progress",
        assignedToName,
      });
    }

    const off = Math.max(0, Number(offset) || 0);
    const lim = Math.min(1000, Math.max(1, Number(limit) || 500));
    const slice = job.validRows.slice(off, off + lim);

    let insertedThisBatch = 0;
    let dupThisBatch = 0;

    if (slice.length) {
      // Re-check DB duplicates for this slice (data may have changed since preview).
      const phones = slice.map((s) => s.lead.phone).filter(Boolean);
      const emails = slice.map((s) => s.lead.email).filter(Boolean);
      const existing = await ClientData.find({
        $or: [{ phone: { $in: phones } }, { email: { $in: emails } }],
      }).select("phone email").lean();
      const exPhones = new Set(existing.map((e) => e.phone).filter(Boolean));
      const exEmails = new Set(existing.map((e) => e.email).filter(Boolean));

      const toInsert = [];
      const insertMeta = []; // parallel to toInsert -> reportIdx
      for (const s of slice) {
        const { phone, email } = s.lead;
        if ((phone && exPhones.has(phone)) || (email && exEmails.has(email))) {
          dupThisBatch++;
          const r = job.reportRows[s.reportIdx];
          if (r) { r.status = "Duplicate"; r.reason = r.reason || "Duplicate Mobile Number"; }
          continue;
        }
        const doc = { ...s.lead };
        if (assignment) doc.assignedTo = assignment;
        toInsert.push(doc);
        insertMeta.push(s.reportIdx);
      }

      if (toInsert.length) {
        const inserted = await ClientData.insertMany(toInsert, { ordered: false });
        insertedThisBatch = inserted.length;
        inserted.forEach((doc, i) => {
          const r = job.reportRows[insertMeta[i]];
          if (r) { r.status = "Imported"; r.leadId = doc._id; }
        });
      }
    }

    const processed = off + slice.length;
    const done = processed >= job.validRows.length;

    // Persist counters incrementally.
    history.imported += insertedThisBatch;
    history.duplicates += dupThisBatch;

    if (done) {
      history.status = "completed";
      const report = job.reportRows.slice(0, REPORT_ROW_CAP);
      history.report = report;
      history.reportTruncated = job.reportRows.length > REPORT_ROW_CAP;
      await history.save();
      deleteJob(token);
    } else {
      await history.save();
      writeJob(token, job); // persist leadId/status updates for the report
    }

    return res.json({
      importId: history._id,
      processed,
      totalValid: job.validRows.length,
      insertedThisBatch,
      dupThisBatch,
      imported: history.imported,
      duplicates: history.duplicates,
      skipped: history.skipped,
      total: history.totalRows,
      done,
    });
  } catch (err) {
    console.error("Lead import commit error:", err);
    return res.status(500).json({ message: "Something went wrong while importing. Some rows may not have been saved; re-uploading is safe (duplicates are skipped)." });
  }
});

// ===========================================================================
// GET /lead-import/history  — admins see all; users see their own
// ===========================================================================
router.get("/lead-import/history", authenticate, async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    const query = isAdmin ? {} : { userId: req.user.userId || String(req.user._id) };
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const imports = await ImportHistory.find(query)
      .select("-report")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(imports);
  } catch (err) {
    console.error("Import history error:", err);
    res.status(500).json({ message: "Could not load import history." });
  }
});

// ===========================================================================
// GET /lead-import/report/:id  — download the per-row report CSV
// ===========================================================================
router.get("/lead-import/report/:id", authenticate, async (req, res) => {
  try {
    const history = await ImportHistory.findById(req.params.id).lean();
    if (!history) return res.status(404).json({ message: "Import record not found." });

    const isAdmin = req.user.role === "admin";
    const ownerId = req.user.userId || String(req.user._id);
    if (!isAdmin && history.userId !== ownerId) {
      return res.status(403).json({ message: "Access denied." });
    }

    const rows = (history.report || []).map((r) => ({
      "Row Number": r.rowNumber,
      Company: r.company,
      Status: r.status,
      Reason: r.reason || "",
      "Imported Lead ID": r.leadId ? String(r.leadId) : "",
    }));

    const parser = new Parser({ fields: ["Row Number", "Company", "Status", "Reason", "Imported Lead ID"] });
    const csvText = rows.length ? parser.parse(rows) : "Row Number,Company,Status,Reason,Imported Lead ID";

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=import_report_${history._id}.csv`);
    res.send(csvText);
  } catch (err) {
    console.error("Import report error:", err);
    res.status(500).json({ message: "Could not generate the report." });
  }
});

module.exports = router;
