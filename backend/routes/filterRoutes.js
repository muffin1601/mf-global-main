const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData");
const authenticate = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

const { lcKey, toLc } = require("../utils/normalizeFields");
const { getPaging } = require("../utils/paginate");

// Exclude Mongoose internals + the normalized shadow fields the frontend never
// reads. Keeps every field the lead tables / edit modal / CSV download use.
const LEAD_PROJECTION =
  "-__v -category_lc -location_lc -state_lc -datatype_lc -callStatus_lc -status_lc -fileName_lc";

// Run a filtered lead query with pagination, projection, indexed sort and lean.
const runPaginatedLeadQuery = async (req, res, finalQuery) => {
  const { page, limit, skip } = getPaging(req);
  const [data, total] = await Promise.all([
    Client.find(finalQuery)
      .select(LEAD_PROJECTION)
      .sort({ createdAt: -1 }) // indexed (createdAt:-1)
      .skip(skip)
      .limit(limit)
      .lean(),
    Object.keys(finalQuery).length
      ? Client.countDocuments(finalQuery)
      : Client.estimatedDocumentCount(),
  ]);
  res.json({
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  });
};

const cleanFilter = (arr) =>
  arr
    .filter((v) => v != null)
    .map((v) => String(v).trim());


// Index-backed case-insensitive equality: query the normalized `<field>_lc`
// shadow column with an exact lowercase $in instead of a case-insensitive
// RegExp (which forces a collection/index scan).
const buildFieldQuery = (field, arr) => {
  if (!arr || !arr.length) return null;

  const lcField = lcKey(field);
  const values = arr.map((v) => (v == null ? "" : String(v).trim()));
  const hasBlank = values.includes("");
  const nonBlankValues = values.filter((v) => v !== "");

  const orClauses = [];

  if (nonBlankValues.length) {
    orClauses.push({ [lcField]: { $in: nonBlankValues.map((v) => toLc(v)) } });
  }
  if (hasBlank) {
    // Missing/blank docs may have null, "", or no _lc value at all.
    orClauses.push({ [lcField]: { $in: [null, ""] } });
  }

  if (!orClauses.length) return null;
  return orClauses.length === 1 ? orClauses[0] : { $or: orClauses };
};

router.post("/clients/filter", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const {
      category,
      location,
      state,
      datatype,
      callStatus,
      fileName,
      status,
      assigned,
      assignedTo,
    } = req.body;

    const query = [];

    if (category?.length) query.push(buildFieldQuery("category", category));
    if (location?.length) query.push(buildFieldQuery("location", location));
    if (state?.length) query.push(buildFieldQuery("state", state));
    if (datatype?.length) query.push(buildFieldQuery("datatype", datatype));
    if (callStatus?.length) query.push(buildFieldQuery("callStatus", callStatus));
    if (fileName?.length) query.push(buildFieldQuery("fileName", fileName));
    if (status?.length) query.push(buildFieldQuery("status", status));

    if (assigned === "assigned") query.push({ isAssigned: true });
    if (assigned === "unassigned") query.push({ isAssigned: false });

    if (assignedTo?.length)
      query.push({ "assignedTo.user.name": { $in: cleanFilter(assignedTo) } });

    const finalQuery = query.length ? { $and: query } : {};
    await runPaginatedLeadQuery(req, res, finalQuery);
  } catch (err) {
    console.error("General Filter Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.post("/clients/assigned/:userName/filter", authenticate, async (req, res) => {
  const { userName } = req.params;
  const filters = req.body;

  if (req.user.role !== "admin" && req.user.name !== userName) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const query = { $and: [{ "assignedTo.user.name": userName }] };

    const fields = ["category", "datatype", "location", "state", "status", "callStatus", "fileName"];
    fields.forEach((field) => {
      if (filters[field]?.length) {
        const q = buildFieldQuery(field, filters[field]);
        if (q) query.$and.push(q);
      }
    });

    await runPaginatedLeadQuery(req, res, query);
  } catch (err) {
    console.error("Assigned Filter Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.post("/clients/unassigned/filter", authenticate, requireRole("admin"), async (req, res) => {
  const filters = req.body;

  try {
    // Index-backed (was a $or/$size/$exists array scan).
    const query = { $and: [{ isAssigned: false }] };

    const fields = ["category", "datatype", "location", "state", "status", "callStatus", "fileName"];
    fields.forEach((field) => {
      if (filters[field]?.length) {
        const q = buildFieldQuery(field, filters[field]);
        if (q) query.$and.push(q);
      }
    });

    await runPaginatedLeadQuery(req, res, query);
  } catch (err) {
    console.error("Unassigned Filter Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});


module.exports = router;
