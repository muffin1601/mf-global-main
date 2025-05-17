const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData");
const { ObjectId } = require('mongodb'); // Using native mongodb ObjectId
const ClientPermission = require("../models/ClientPermission"); // Correct model import

// POST /add-client

router.post("/add-client", async (req, res) => {
  try {
    const { contact, phone } = req.body;

    // Only check for duplicacy if contact or phone is not null or empty
    const existingClient = await Client.findOne({
      $or: [
        contact && { contact }, // Only check if contact is provided
        phone && { phone }        // Only check if phone is provided
      ].filter(Boolean) // Filter out any falsy values (null, undefined, or empty strings)
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

router.post("/save-all-updates", async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: "No updates to apply" });
    }

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
    });

    const results = await Promise.all(updatePromises);
    const updatedCount = results.filter(Boolean).length;

    res.status(200).json({
      message: "Updates applied successfully",
      updatedClients: updatedCount
    });

  } catch (error) {
    console.error("Error in /save-all-updates:", error);
    res.status(500).json({ error: "Failed to save updates", details: error.message });
  }
});


module.exports = router;
