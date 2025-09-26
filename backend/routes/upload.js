const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const ClientData = require("../models/ClientData");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === "text/csv" || file.originalname.endsWith(".csv"));
  },
});

const PHONE_REGEX = /^[6-9][0-9]{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


const cleanInput = (input) => {
  return input
    .replace(/[^\x20-\x7E]/g, "")  
    .trim();  
};

router.post("/upload-csv", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No CSV file uploaded." });
  }

  const filePath = req.file.path;
  const results = [];
  const skippedData = [];
  let skipped = 0;
  let aborted = false;

  const addSkipped = ({ phone = null, contact = null, company = null, location = null, category = null, datatype = null, reason }) => {
    skipped++;
    skippedData.push({ phone, contact, company, location, category, datatype, reason });
  };

  const parser = csv();

  fs.createReadStream(filePath)
    .pipe(parser)
    .on("headers", (headers) => {
      const normalized = headers.map(h => h.trim().toLowerCase());
      if (!normalized.includes("company") || (!normalized.includes("phone") && !normalized.includes("contact"))) {
        aborted = true;
        parser.emit("error", new Error("Missing required headers"));
      }
    })
    .on("data", (row) => {
      if (aborted) return;

      const normalizedRow = {};
      for (const key in row) {
        normalizedRow[key.trim().toLowerCase()] = cleanInput(row[key]);
      }

      if (normalizedRow["contact"]) {
        normalizedRow["contact"] = normalizedRow["contact"].replace(/\s+/g, "");
      }
      const phone = normalizedRow["phone"] ? normalizedRow["phone"].replace(/\s+/g, "") : null;
      const contact = normalizedRow["contact"] || null;
      const company = normalizedRow["company"] || null;
      const location = normalizedRow["location"] || null;
      let category = normalizedRow["category"] || null;
      if (category) {
        category = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
      }
      const datatype = normalizedRow["datatype"] || null;

      if (!phone && !contact) {
        return addSkipped({ phone, contact, company, location, category, datatype, reason: "Missing phone and contact" });
      }

      if (phone && !PHONE_REGEX.test(phone)) {
        return addSkipped({ phone, contact, company, location, category, datatype, reason: "Invalid phone format" });
      }

      if (category && category.length > 15) {
        return addSkipped({ phone, contact, company, location, category, datatype, reason: "Category exceeds 15 characters" });
      }

      if (location && location.length > 15) {
        return addSkipped({ phone, contact, company, location, category, datatype, reason: "Location exceeds 15 characters" });
      }

      const validDatatypes = [
        "IndiaMart",
        "Offline",
        "TradeIndia",
        "JustDial",
        "WebPortals",
        "Other",
      ];

      if (!validDatatypes.includes(normalizedRow["datatype"])) {
        return addSkipped({
          phone,
          contact,
          company,
          location,
          category,
          datatype,
          reason: "Invalid datatype",
        });
      }

      results.push({
        name: normalizedRow["name"] || "",
        company,
        email: normalizedRow["email"] || null,
        phone,
        contact,
        location,
        category,
        quantity: Number(normalizedRow["quantity"]) || 0,
        remarks: normalizedRow["remarks"] || "",
        datatype: (normalizedRow["datatype"] || "").trim(),
        callStatus: normalizedRow["call status"] || "Not Called",
        followUpDate: normalizedRow["follow up date"] ? new Date(normalizedRow["follow up date"]) : null,
        assignedTo: null,
        status: "New Lead",
        followUpDateOne: null,
        followUpDateTwo: null,
        followUpDateThree: null,
        inquiryDate: new Date(),
        address: normalizedRow["address"] || "",
        fileName: req.file.originalname,
      });
    })
    .on("end", async () => {
      if (aborted) {
        fs.unlink(filePath, () => {});
        return res.status(400).json({ message: "CSV parse error: Missing required headers" });
      }

      try {
        const phones = results.map(r => r.phone).filter(Boolean);
        const contacts = results.map(r => r.contact).filter(Boolean);

        const existing = await ClientData.find({
          $or: [
            { phone: { $in: phones } },
            { contact: { $in: contacts } },
          ],
        });

        const seenPhones = new Set();
        const seenContacts = new Set();

        const finalData = results.filter((r) => {
          const isDupPhone = r.phone && (seenPhones.has(r.phone) || existing.some(e => e.phone === r.phone));
          const isDupContact = r.contact && (seenContacts.has(r.contact) || existing.some(e => e.contact === r.contact));

          if (isDupPhone || isDupContact) {
            const reason = [
              isDupPhone ? "Duplicate Phone" : null,
              isDupContact ? "Duplicate Contact" : null
            ].filter(Boolean).join(" & ");

            addSkipped({ ...r, reason });
            return false;
          }

          if (r.phone) seenPhones.add(r.phone);
          if (r.contact) seenContacts.add(r.contact);

          return true;
        });

        if (finalData.length) {
          await ClientData.insertMany(finalData);
        }

        fs.unlink(filePath, () => {});
        res.json({
          message: "Upload complete",
          inserted: finalData.length,
          skipped,
          skippedData,
        });
      } catch (err) {
        fs.unlink(filePath, () => {});
        console.error("DB Insert Error:", err);
        res.status(500).json({
          message: "Database error",
          error: err.message || err.toString(),
        });
      }
    })
    .on("error", (err) => {
      fs.unlink(filePath, () => {});
      console.error("CSV Parse Error:", err);
      res.status(400).json({
        message: "CSV parse error",
        error: err.message || err.toString(),
      });
    });
});

module.exports = router;
