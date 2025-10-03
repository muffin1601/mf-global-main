const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData"); 
const User = require('../models/User');

router.post("/leads/assign", async (req, res) => {
  const { Leads, userIds, permissions } = req.body;

  try {
    const users = await User.find({ _id: { $in: userIds } }, "_id name");

    await Promise.all(
      Leads.map(async (leadId) => {
        const lead = await Client.findById(leadId);
        if (!lead) return;

        const updatedAssignments = new Map();

        (lead.assignedTo || []).forEach((a) => {
          if (a.user && a.user._id) {
            updatedAssignments.set(a.user._id.toString(), a);
          }
        });

        users.forEach((user) => {
          updatedAssignments.set(user._id.toString(), {
            user: { _id: user._id, name: user.name },
            permissions: { ...permissions }
          });
        });

        lead.assignedTo = Array.from(updatedAssignments.values());
        await lead.save();
      })
    );

    res.json({ message: "Leads assigned successfully" });
  } catch (error) {
    console.error("Lead assignment error:", error);
    res.status(500).json({ error: "Assignment failed" });
  }
});

router.post('/leads/remove-assignments', async (req, res) => {
  const { Leads, userIds } = req.body;

  try {
    await Promise.all(
      Leads.map(async (leadId) => {
        const lead = await Client.findById(leadId);
        if (!lead) return;

        lead.assignedTo = (lead.assignedTo || []).filter(
          (a) => !userIds.includes(a.user?._id?.toString())
        );

        await lead.save();
      })
    );

    res.json({ message: 'Assignments removed successfully' });
  } catch (error) {
    console.error('Remove assignments error:', error);
    res.status(500).json({ error: 'Failed to remove assignments' });
  }
});

function cleanValuesWithBlank(arr) {
  const uniqueValues = [...new Set(arr
    .filter(v => v != null && String(v).trim() !== "")
    .map(v => String(v).trim())
  )];

  const hasBlank = arr.some(v => v == null || String(v).trim() === "");

  return hasBlank ? ["", ...uniqueValues] : uniqueValues;
}

router.get("/clients/meta", async (req, res) => {
  try {
    const categories = cleanValuesWithBlank(await Client.distinct("category"));
    const locations = cleanValuesWithBlank(await Client.distinct("location"));
    const states = cleanValuesWithBlank(await Client.distinct("state"));
    const filenames = cleanValuesWithBlank(await Client.distinct("fileName"));
    const datatypes = cleanValuesWithBlank(await Client.distinct("datatype"));

    res.json({ categories, locations, states, filenames, datatypes });
  } catch (err) {
    console.error("Meta Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/clients/assigned/:username/meta", async (req, res) => {
  const { username } = req.params;

  try {
    const assignedClients = await Client.find({
      "assignedTo.user.name": username
    }).lean();

    const categories = cleanValuesWithBlank(assignedClients.map(c => c.category));
    const locations = cleanValuesWithBlank(assignedClients.map(c => c.location));
    const states = cleanValuesWithBlank(assignedClients.map(c => c.state));
    const filenames = cleanValuesWithBlank(assignedClients.map(c => c.fileName));
    const datatypes = cleanValuesWithBlank(assignedClients.map(c => c.datatype));

    res.json({ categories, locations, states, filenames, datatypes });
  } catch (err) {
    console.error("Assigned Meta Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/clients/unassigned/meta", async (req, res) => {
  try {
    const unassignedClients = await Client.find({
      $or: [
        { assignedTo: { $exists: false } },
        { assignedTo: { $size: 0 } },
        { "assignedTo.user._id": { $exists: false } }
      ]
    }).lean();

    const cleanValuesWithBlank = (arr) => {
      const values = [...new Set(arr.filter(v => v != null && v !== "").map(v => String(v).trim()))];
      const hasBlank = arr.some(v => v == null || v === "");
      return hasBlank ? ["", ...values] : values;
    };

    const categories = cleanValuesWithBlank(unassignedClients.map(c => c.category));
    const locations = cleanValuesWithBlank(unassignedClients.map(c => c.location));
    const states = cleanValuesWithBlank(unassignedClients.map(c => c.state));
    const filenames = cleanValuesWithBlank(unassignedClients.map(c => c.fileName));
    const datatypes = cleanValuesWithBlank(unassignedClients.map(c => c.datatype));

    res.json({ categories, locations, states, filenames, datatypes });
  } catch (err) {
    console.error("Unassigned Meta Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
