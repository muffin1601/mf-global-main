const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData");
const { ObjectId } = require('mongodb'); // Using native mongodb ObjectId
const ClientPermission = require("../models/ClientPermission"); // Correct model import

// POST /add-client

router.post("/add-client", async (req, res) => {
  try {
    const { contact, phone } = req.body;

    // Remove icons from specific fields before checking or saving
    const removeIcons = (value) =>
      typeof value === "string" ? value.replace(/^[^\w\s]*\s*/, "").trim() : value;

    req.body.datatype = removeIcons(req.body.datatype);
    req.body.status = removeIcons(req.body.status);
    req.body.callStatus = removeIcons(req.body.callStatus);

    // Check for duplicate client using contact or phone
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


router.get('/check-duplicate-phone', async (req, res) => {
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

// Check if contact number exists in the database

router.get("/check-duplicate-contact", async (req, res) => {
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


// Example in Express.js
router.post("/clients/delete", async (req, res) => {
  const { ids } = req.body; // expects an array of client _id values
  try {
    await Client.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: "Clients deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete clients", error });
  }
});

<<<<<<< HEAD

// Utility: clean icons from strings
const removeIcons = (value) => {
  return typeof value === "string"
    ? value.replace(/^[^\w]*\s*/, "").trim()
    : value;
};

// Utility: determine which follow-up field to update
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
=======
// Helper function: builds follow-up date history logic
function buildFollowUpDateFields(client, newFollowUpDate) {
  if (!newFollowUpDate) return {};

  const dateObj = new Date(newFollowUpDate);
  const history = {};

  const { followUpDateOne, followUpDateTwo, followUpDateThree } = client;

  if (!followUpDateOne) {
    history.followUpDateOne = dateObj;
  } else if (!followUpDateTwo) {
    history.followUpDateTwo = dateObj;
  } else if (!followUpDateThree) {
    history.followUpDateThree = dateObj;
  } else {
    // All are filled — overwrite the oldest
    const oldest = Math.min(
      new Date(followUpDateOne).getTime(),
      new Date(followUpDateTwo).getTime(),
      new Date(followUpDateThree).getTime()
    );

    if (new Date(followUpDateOne).getTime() === oldest) {
      history.followUpDateOne = dateObj;
    } else if (new Date(followUpDateTwo).getTime() === oldest) {
      history.followUpDateTwo = dateObj;
    } else {
      history.followUpDateThree = dateObj;
    }
  }

  return {
    followUpDate: dateObj,
    ...history
  };
}
>>>>>>> e535ab6584991d2da1192b8eb158a59d2165b973

router.post("/save-all-updates", async (req, res) => {
  try {
    const { updates } = req.body;
<<<<<<< HEAD

=======
    // Clean icons from datatype, status, callStatus before saving
    const removeIcons = (options) =>
      Array.isArray(options)
      ? options.map(opt => typeof opt === "string" ? opt.replace(/^[^\w]*\s*/, "").trim() : opt)
      : typeof options === "string"
        ? options.replace(/^[^\w]*\s*/, "").trim()
        : options;

    updates.forEach(update => {
      if (update.datatype) update.datatype = removeIcons(update.datatype);
      if (update.status) update.status = removeIcons(update.status);
      if (update.callStatus) update.callStatus = removeIcons(update.callStatus);
    });
>>>>>>> e535ab6584991d2da1192b8eb158a59d2165b973
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: "No updates to apply" });
    }

<<<<<<< HEAD
    const updatePromises = updates.map(async (update) => {
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
          category,
          datatype,
          callStatus,
          followUpDate,
          assignedTo,
          additionalContacts,
          status,
          inquiryDate,
          address,
        } = update;

        if (!id && !phone && !contact) return null;

        const query = id
          ? { _id: new ObjectId(id) }
          : { $or: [{ phone }, { contact }] };

        const client = await Client.findOne(query);
        if (!client) return null;

        // Clean field values
        const cleanDatatype = removeIcons(datatype);
        const cleanCallStatus = removeIcons(callStatus);
        const cleanStatus = removeIcons(status);

        // AssignedTo transformation
        let assignedToTransformed = [];

        if (Array.isArray(assignedTo) && assignedTo.length > 0) {
          assignedToTransformed = assignedTo
            .filter(
              (a) =>
                a &&
                a.user &&
                typeof a.user._id === "string" &&
                a.user._id.trim() !== "" &&
                typeof a.user.name === "string" &&
                a.user.name.trim() !== ""
            )
            .map((a) => {
              try {
                return {
                  user: {
                    _id: new ObjectId(a.user._id),
                    name: a.user.name,
                  },
                  permissions: {
                    view: !!a.permissions?.view,
                    update: !!a.permissions?.update,
                    delete: !!a.permissions?.delete,
                  },
                };
              } catch (err) {
                // Skip invalid ObjectId
                return null;
              }
            })
            .filter(Boolean); // Remove any nulls from failed conversions
        } else {
          assignedToTransformed = []; // empty is allowed
        }

        // Determine which follow-up date to update
        const followUpFields = buildFollowUpDateFields(client, followUpDate);

        // Construct update object conditionally
        const updateFields = {
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
          ...(contact !== undefined && { contact }),
          ...(remarks !== undefined && { remarks }),
          ...(requirements !== undefined && { requirements }),
          ...(location !== undefined && { location }),
          ...(category !== undefined && { category }),
          ...(cleanDatatype && { datatype: cleanDatatype }),
          ...(cleanCallStatus && { callStatus: cleanCallStatus }),
          ...(cleanStatus && { status: cleanStatus }),
          ...(inquiryDate !== undefined && { inquiryDate }),
          ...(address !== undefined && { address }),
          assignedTo: assignedToTransformed,
          additionalContacts: Array.isArray(additionalContacts)
            ? additionalContacts
            : client.additionalContacts,
          ...followUpFields,
        };

        return Client.findByIdAndUpdate(client._id, { $set: updateFields }, {
          new: true,
          runValidators: true,
        });
      } catch (innerErr) {
        console.error("Failed to process individual update:", innerErr.message);
        return null;
      }
=======
    // Validate assignedTo fields for all updates before starting DB operations
    for (const update of updates) {
      if (Array.isArray(update.assignedTo)) {
        for (const a of update.assignedTo) {
          if (!a.user || !a.user._id || !a.user.name) {
            return res.status(400).json({ error: "assignedTo user._id and user.name are required" });
          }
        }
      }
    }

    const updatePromises = updates.map(async (update) => {
      const {
        id,
        name,
        email,
        phone,
        contact,
        remarks,
        requirements,
        location,
        category,
        datatype,
        callStatus,
        followUpDate,
        assignedTo,
        additionalContacts
      } = update;

      const query = id ? { _id: new ObjectId(id) } : (phone || contact) ? { $or: [{ phone }, { contact }] } : null;
      if (!query) return null;

      const client = await Client.findOne(query);
      if (!client) return null;

      const followUpFields = buildFollowUpDateFields(client, followUpDate);

      // Transform assignedTo
      let assignedToTransformed = client.assignedTo || [];
      if (Array.isArray(assignedTo)) {
        assignedToTransformed = assignedTo.map((a) => ({
          user: {
            _id: new ObjectId(a.user._id),
            name: a.user.name,
          },
          permissions: {
            view: !!a.permissions?.view,
            update: !!a.permissions?.update,
            delete: !!a.permissions?.delete,
          },
        }));
      }

      const updateFields = {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(contact !== undefined && { contact }),
        ...(remarks !== undefined && { remarks }),
        ...(requirements !== undefined && { requirements }),
        ...(location !== undefined && { location }),
        ...(category !== undefined && { category }),
        ...(datatype !== undefined && { datatype }),
        ...(callStatus !== undefined && { callStatus }),
        ...(followUpDate !== undefined && { followUpDate }),
        assignedTo: assignedToTransformed,
        additionalContacts: Array.isArray(additionalContacts) ? additionalContacts : client.additionalContacts,
        ...followUpFields
      };

      return Client.findByIdAndUpdate(client._id, { $set: updateFields }, { new: true, runValidators: true });
>>>>>>> e535ab6584991d2da1192b8eb158a59d2165b973
    });

    const results = await Promise.all(updatePromises);
    const updatedCount = results.filter(Boolean).length;

    res.status(200).json({
      message: "Updates applied successfully",
<<<<<<< HEAD
      updatedClients: updatedCount,
    });
  } catch (error) {
    console.error("Error in /save-all-updates:", error.message);
    res.status(500).json({ error: "Failed to save updates" });
  }
});

=======
      updatedClients: updatedCount
    });

  } catch (error) {
    console.error("Error in /save-all-updates:", error);
    res.status(500).json({ error: "Failed to save updates", details: error.message });
  }
});


>>>>>>> e535ab6584991d2da1192b8eb158a59d2165b973
module.exports = router;
