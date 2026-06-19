const express = require('express');
const router = express.Router();
const Quotation = require('../models/Quote');
const authMiddleware= require("../middleware/auth.js");
const requireRole = require("../middleware/requireRole");
const User = require('../models/User');
const mongoose = require('mongoose');
const { getPaging, setPageHeaders } = require('../utils/paginate');
const { calculateQuotationTotals, validateQuotationPayload } = require('../utils/quotationCalc');
const { nextInvoiceNumber } = require('../utils/invoiceNumber');

router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { party, items, terms, notes, bankDetails, invoiceDetails, summary } = req.body;

    // Server-side validation — no invalid quotation can be saved.
    const { isValid, errors } = validateQuotationPayload(party, items);
    if (!isValid) return res.status(400).json({ message: errors[0], errors });

    // Money is ALWAYS computed server-side. Client-sent totals are ignored.
    const totals = calculateQuotationTotals(items, summary || {});

    // Invoice number is assigned atomically server-side (concurrent-safe, no
    // duplicates). The client-sent number is ignored; the prefix is kept.
    const seq = await nextInvoiceNumber();
    const serverInvoiceDetails = {
      ...(invoiceDetails || {}),
      number: String(seq),
    };

    const newQuotation = new Quotation({
      user: req.user._id,
      party,
      items,
      terms,
      notes,
      bankDetails,
      invoiceDetails: serverInvoiceDetails,
      summary,
      totals,
    });

    const savedQuotation = await newQuotation.save();
    res.status(201).json(savedQuotation);
  } catch (error) {
    console.error("Error creating quotation:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT update — the proper edit workflow (was missing; edit used to POST /create
// and silently CREATE A DUPLICATE). Ownership-checked; totals recomputed.
router.put("/update/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid quotation id" });
    }

    const existing = await Quotation.findById(id);
    if (!existing) return res.status(404).json({ message: "Quotation not found" });

    // Only the owner or an admin may edit.
    if (req.user.role !== "admin" && String(existing.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { party, items, terms, notes, bankDetails, invoiceDetails, summary } = req.body;

    const { isValid, errors } = validateQuotationPayload(party, items);
    if (!isValid) return res.status(400).json({ message: errors[0], errors });

    const totals = calculateQuotationTotals(items, summary || {});

    // Preserve owner + invoice number; update everything else in place.
    existing.party = party;
    existing.items = items;
    existing.terms = terms;
    existing.notes = notes;
    existing.bankDetails = bankDetails;
    if (invoiceDetails) {
      // The invoice number + prefix are immutable once issued (server-authoritative).
      existing.invoiceDetails = {
        ...invoiceDetails,
        number: existing.invoiceDetails?.number,
        prefix: existing.invoiceDetails?.prefix ?? invoiceDetails.prefix,
      };
    }
    existing.summary = summary;
    existing.totals = totals;

    const saved = await existing.save();
    res.status(200).json(saved);
  } catch (error) {
    console.error("Error updating quotation:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/data/count", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
   
    const { page, limit, skip } = getPaging(req);
    const [quotations, count] = await Promise.all([
      Quotation.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'name username'),
      Quotation.estimatedDocumentCount(),
    ]);

    const pages = setPageHeaders(res, count, page, limit);

    res.status(200).json({
      success: true,
      count,
      quotations,
      total: count,
      page,
      pages,
    });
  } catch (error) {
    console.error("Error fetching quotations:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching quotations",
      error: error.message,
    });
  }
});

router.get("/data/user/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    // Non-admins may only list their own quotations.
    if (req.user.role !== "admin" && String(req.user._id) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { page, limit, skip } = getPaging(req);
    const filter = { user: userId };
    const [quotations, count] = await Promise.all([
      Quotation.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'name username'),
      Quotation.countDocuments(filter),
    ]);

    const pages = setPageHeaders(res, count, page, limit);

    res.status(200).json({
      success: true,
      count,
      quotations,
      total: count,
      page,
      pages,
    });
  } catch (error) {
    console.error("Error fetching quotations by user:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user quotations",
      error: error.message,
    });
  }
});

router.delete("/delete/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const deleted = await Quotation.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Quotation not found" });
    }
    res.status(200).json({ success: true, message: "Quotation deleted successfully" });
  } catch (error) {
    console.error("Error deleting quotation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/fetch/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const quotation = await Quotation.findById(id).lean();
    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    // Non-admins may only fetch their own quotation.
    if (req.user.role !== "admin" && String(quotation.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.status(200).json(quotation);
  } catch (error) {
    console.error("Error fetching quotation:", error);
    res.status(500).json({ message: "Failed to fetch quotation" });
  }
});


module.exports = router;
