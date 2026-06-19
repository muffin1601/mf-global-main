const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData");
const { ObjectId } = require('mongodb');
const { computeLcFields } = require("../utils/normalizeFields");
const ClientPermission = require("../models/ClientPermission"); 
const authenticate = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

router.post("/add-client", authenticate, async (req, res) => {
  try {
    const { contact, phone } = req.body;

    
    const removeIcons = (value) =>
      typeof value === "string" ? value.replace(/^[^\w\s]*\s*/, "").trim() : value;

    req.body.datatype = removeIcons(req.body.datatype);
    req.body.status = removeIcons(req.body.status);
    req.body.callStatus = removeIcons(req.body.callStatus);

    
    const existingClient = await Client.findOne({
      $or: [
        contact && { contact },
        phone && { phone }
      ].filter(Boolean)
    });

    if (existingClient) {
      return res.status(400).json({ error: "Client already exists" });
    }

    const client = new Client(req.body);
    await client.save();

    res.status(201).json({ message: "Client added successfully" });
  } catch (error) {
    console.error("Error saving client:", error);
    res.status(500).json({ error: "Failed to add client" });
  }
});


router.get('/check-duplicate-phone', authenticate, async (req, res) => {
  const { phone } = req.query;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    const existingUser = await Client.findOne({ phone });

    if (existingUser) {
      res.json({ exists: true, user: existingUser });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error('Error checking phone:', error);
    res.status(500).json({ error: 'Server error' });
  }
});



router.get("/check-duplicate-contact", authenticate, async (req, res) => {
  const { contact } = req.query;

  if (!contact) {
    return res.status(400).json({ message: "Contact number is required" });
  }

  try {
    const existingContactUser = await Client.findOne({ contact });

    if (existingContactUser) {
      return res.json({ exists: true, user: existingContactUser });
    }
    return res.json({ exists: false });
  } catch (error) {
    console.error("Error checking contact duplicacy:", error);
    return res.status(500).json({ message: "Error checking duplicacy", error: error.message });
  }
});



router.post("/clients/delete", authenticate, requireRole("admin"), async (req, res) => {
  const { ids } = req.body; 
  try {
    await Client.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: "Clients deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete clients", error });
  }
});

const removeIcons = (value) => {
  return typeof value === "string"
    ? value.replace(/^[^\w]*\s*/, "").trim()
    : value;
};


const buildFollowUpDateFields = (client, newFollowUpDate) => {
  if (!newFollowUpDate) return {};

  const dateObj = new Date(newFollowUpDate);
  const { followUpDateOne, followUpDateTwo, followUpDateThree } = client;

  if (!followUpDateOne) return { followUpDate: dateObj, followUpDateOne: dateObj };
  if (!followUpDateTwo) return { followUpDate: dateObj, followUpDateTwo: dateObj };
  if (!followUpDateThree) return { followUpDate: dateObj, followUpDateThree: dateObj };

  const oldest = Math.min(
    new Date(followUpDateOne).getTime(),
    new Date(followUpDateTwo).getTime(),
    new Date(followUpDateThree).getTime()
  );

  if (new Date(followUpDateOne).getTime() === oldest) {
    return { followUpDate: dateObj, followUpDateOne: dateObj };
  } else if (new Date(followUpDateTwo).getTime() === oldest) {
    return { followUpDate: dateObj, followUpDateTwo: dateObj };
  } else {
    return { followUpDate: dateObj, followUpDateThree: dateObj };
  }
};

const buildBillingAddress = (client, billingAddress, addressField) => {
  if (billingAddress && typeof billingAddress === "object") return billingAddress;
  
  if (client.billingAddress) return client.billingAddress;

  return {
    street: addressField || client.address || "",
    city: client.state || "",
    state: client.state || "",
    postalCode: "",
    country: "",
  };
};

router.post("/save-all-updates", authenticate, async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: "No updates to apply" });
    }

    const isAdmin = req.user.role === "admin";

    // --- Phase 1: fetch all target docs in bulk (was N findOne calls) ---
    const ids = [];
    const orConds = [];
    for (const u of updates) {
      if (u.id) {
        try { ids.push(new ObjectId(u.id)); } catch { /* skip bad id */ }
      } else if (u.phone || u.contact) {
        if (u.phone) orConds.push({ phone: u.phone });
        if (u.contact) orConds.push({ contact: u.contact });
      }
    }

    const fetchOps = [];
    if (ids.length) fetchOps.push(Client.find({ _id: { $in: ids } }));
    if (orConds.length) fetchOps.push(Client.find({ $or: orConds }));
    const fetched = (await Promise.all(fetchOps)).flat();

    const byId = new Map();
    const byPhone = new Map();
    const byContact = new Map();
    for (const c of fetched) {
      byId.set(String(c._id), c);
      if (c.phone && !byPhone.has(c.phone)) byPhone.set(c.phone, c);
      if (c.contact && !byContact.has(c.contact)) byContact.set(c.contact, c);
    }

    // --- Phase 2: build bulkWrite ops (was N findByIdAndUpdate calls) ---
    const ops = [];
    const matchedIds = [];

    for (const update of updates) {
      try {
        const {
          id,
          name,
          email,
          phone,
          contact,
          remarks,
          requirements,
          location,
          state,
          category,
          datatype,
          callStatus,
          followUpDate,
          assignedTo,
          additionalContacts,
          status,
          inquiryDate,
          address,
          billingAddress,
        } = update;

        if (!id && !phone && !contact) continue;

        const client = id
          ? byId.get(String(id))
          : (phone && byPhone.get(phone)) || (contact && byContact.get(contact));
        if (!client) continue;

        // Authorization: non-admins may only edit leads assigned to them.
        if (!isAdmin) {
          const isAssignee = Array.isArray(client.assignedTo) && client.assignedTo.some(
            (a) => a && a.user && String(a.user._id) === String(req.user._id)
          );
          if (!isAssignee) continue; // silently skip leads they don't own
        }


        const cleanDatatype = removeIcons(datatype);
        const cleanCallStatus = removeIcons(callStatus);
        const cleanStatus = removeIcons(status);

        // Only admins may (re)assign leads. Non-admins keep their existing
        // assignment untouched (cannot reassign leads to themselves/others).
        let assignedToTransformed;
        if (!isAdmin) {
          assignedToTransformed = Array.isArray(client.assignedTo) ? client.assignedTo : [];
        } else {
          // Original admin behavior preserved exactly.
          assignedToTransformed = [];
          if (Array.isArray(assignedTo) && assignedTo.length > 0) {
            assignedToTransformed = assignedTo
              .filter(a => a && a.user && a.user._id && a.user.name)
              .map(a => ({
                user: { _id: new ObjectId(a.user._id), name: a.user.name },
                permissions: {
                  view: !!a.permissions?.view,
                  update: !!a.permissions?.update,
                  delete: !!a.permissions?.delete,
                },
              }));
          }
        }

        const followUpFields = buildFollowUpDateFields(client, followUpDate);
        const billingAddressObj = buildBillingAddress(client, billingAddress, address);

        const updateFields = {
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
          ...(contact !== undefined && { contact }),
          ...(remarks !== undefined && { remarks }),
          ...(requirements !== undefined && { requirements }),
          ...(location !== undefined && { location }),
          ...(state !== undefined && { state }),
          ...(category !== undefined && { category }),
          ...(cleanDatatype !== undefined && { datatype: cleanDatatype }),
          ...(cleanCallStatus !== undefined && { callStatus: cleanCallStatus }),
          ...(cleanStatus !== undefined && { status: cleanStatus }),
          ...(inquiryDate !== undefined && inquiryDate !== "" && {
            inquiryDate: new Date(inquiryDate)
          }),
          ...(address !== undefined && { address }),
          assignedTo: assignedToTransformed,
          // Keep the denormalized assignment flag in sync (bulkWrite bypasses hooks).
          isAssigned: Array.isArray(assignedToTransformed) && assignedToTransformed.length > 0,
          additionalContacts: Array.isArray(additionalContacts)
            ? additionalContacts
            : client.additionalContacts,
          billingAddress: billingAddressObj,
          ...followUpFields,
        };

        // Keep the normalized lowercase shadow fields in sync. bulkWrite bypasses
        // Mongoose middleware, so compute them explicitly here.
        const lcFields = computeLcFields(updateFields);

        ops.push({
          updateOne: {
            filter: { _id: client._id },
            update: { $set: { ...updateFields, ...lcFields } },
          },
        });
        matchedIds.push(client._id);
      } catch (innerErr) {
        console.error("Failed to process individual update:", innerErr.message);
      }
    }

    // --- Phase 3: one bulkWrite instead of N findByIdAndUpdate round trips ---
    if (ops.length) {
      await Client.bulkWrite(ops, { ordered: false });
    }

    // Return the updated docs (one query) to preserve the response shape.
    const updatedDocs = matchedIds.length
      ? await Client.find({ _id: { $in: matchedIds } })
      : [];

    res.status(200).json({
      message: "Updates applied successfully",
      updatedClients: updatedDocs.length,
      updates: updatedDocs,
    });
  } catch (error) {
    console.error("Error in /save-all-updates:", error.message);
    res.status(500).json({ error: "Failed to save updates" });
  }
});


module.exports = router;
