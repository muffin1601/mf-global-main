const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData");

// Utility: clean and trim filter values
const cleanFilter = (arr) =>
  arr
    .filter((v) => v != null) // remove null/undefined
    .map((v) => String(v).trim());

// Utility: build field query supporting blank-only and case-insensitive matching
const buildFieldQuery = (field, arr) => {
  if (!arr || !arr.length) return null;

  const values = arr.map((v) => (v == null ? "" : String(v).trim()));
  const hasBlank = values.includes("");
  const nonBlankValues = values.filter((v) => v !== "");

  const orClauses = [];

  if (nonBlankValues.length) {
    orClauses.push({ [field]: { $in: nonBlankValues.map((v) => new RegExp(`^${v}$`, "i")) } });
  }
  if (hasBlank) {
    orClauses.push({ [field]: { $in: [null, ""] } });
  }

  if (!orClauses.length) return null;
  return orClauses.length === 1 ? orClauses[0] : { $or: orClauses };
};

// =================== General Filter ===================
router.post("/clients/filter", async (req, res) => {
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

    if (assigned === "assigned") query.push({ assignedTo: { $exists: true, $ne: [] } });
    if (assigned === "unassigned")
      query.push({ $or: [{ assignedTo: { $exists: false } }, { assignedTo: { $size: 0 } }] });

    if (assignedTo?.length)
      query.push({ "assignedTo.user.name": { $in: cleanFilter(assignedTo) } });

    const finalQuery = query.length ? { $and: query } : {};
    const clients = await Client.find(finalQuery).lean();
    res.json(clients);
  } catch (err) {
    console.error("General Filter Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// =================== Assigned Filter ===================
router.post("/clients/assigned/:userName/filter", async (req, res) => {
  const { userName } = req.params;
  const filters = req.body;

  try {
    const query = { $and: [{ "assignedTo.user.name": userName }] };

    const fields = ["category", "datatype", "location", "state", "status", "callStatus", "fileName"];
    fields.forEach((field) => {
      if (filters[field]?.length) {
        const q = buildFieldQuery(field, filters[field]);
        if (q) query.$and.push(q);
      }
    });

    const assignedClients = await Client.find(query).lean();
    res.json(assignedClients);
  } catch (err) {
    console.error("Assigned Filter Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.post("/clients/unassigned/filter", async (req, res) => {
  const filters = req.body;
  console.log("Received unassigned filter request with body:", filters);

  try {
    const query = {
      $and: [
        {
          $or: [
            { assignedTo: { $exists: false } },           // no assignedTo field
            { assignedTo: { $size: 0 } },                 // empty array
            { "assignedTo.user._id": { $exists: false } } // array exists but no valid user
          ]
        }
      ]
    };

    const fields = ["category", "datatype", "location", "state", "status", "callStatus", "fileName"];
    fields.forEach((field) => {
      if (filters[field]?.length) {
        const q = buildFieldQuery(field, filters[field]);
        if (q) query.$and.push(q);
      }
    });

    const unassignedClients = await Client.find(query).lean();
    res.json(unassignedClients);
  } catch (err) {
    console.error("Unassigned Filter Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});


module.exports = router;
