const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData"); 
const User = require('../models/User');
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

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

router.post("/leads/assign/single", async (req, res) => {
 
  const { Leads, userIds, permissions } = req.body;
  
  const leadId = Leads?.[0];
  const userId = userIds?.[0];


  if (!leadId || !userId) {
    return res.status(400).json({ error: "Lead ID or User ID is missing for single assignment." });
  }

  try {
    
    const objectUserId = new ObjectId(userId);
    const user = await User.findById(objectUserId, "_id name");

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    
    const objectLeadId = new ObjectId(leadId);
    const lead = await Client.findById(objectLeadId);
    
    if (!lead) {
        return res.status(404).json({ error: "Lead not found." });
    }

    const updatedAssignments = new Map();

    
    (lead.assignedTo || []).forEach((a) => {
      if (a.user && a.user._id) {
        updatedAssignments.set(a.user._id.toString(), a);
      }
    });

    
    const safePermissions = {
      view: !!permissions?.view,
      update: !!permissions?.update,
      delete: !!permissions?.delete
    };

    updatedAssignments.set(user._id.toString(), {
      
      user: { _id: user._id, name: user.name }, 
      permissions: safePermissions
    });

    
    lead.assignedTo = Array.from(updatedAssignments.values());
    await lead.save();

    res.json({ message: "Lead assigned successfully." });
  } catch (error) {
    console.error("Single lead assignment error:", error);
    
    if (error.name === 'CastError') {
         return res.status(400).json({ error: "Invalid ID format provided." });
    }
    res.status(500).json({ error: "Assignment failed due to a server error." });
  }
});


router.post('/leads/remove-assignments', async (req, res) => {
  const { Leads } = req.body; 

  try {
    await Promise.all(
      Leads.map(async (leadId) => {
        const lead = await Client.findById(leadId);
        if (!lead) return;

        
        lead.assignedTo = [];

        await lead.save();
      })
    );

    res.json({ message: 'Assignments removed successfully' });
  } catch (error) {
    console.error('Remove assignments error:', error);
    res.status(500).json({ error: 'Failed to remove assignments' });
  }
});


router.post("/leads/transfer-assignments", async (req, res) => {
  const { Leads, newUserName } = req.body; 
  if (!Leads || !Array.isArray(Leads) || Leads.length === 0) {
    return res.status(400).json({ error: "No leads provided" });
  }

  if (!newUserName) {
    return res.status(400).json({ error: "Target user name is required" });
  }

  try {
    
    const targetUser = await User.findOne({ name: newUserName }, "_id name");
    if (!targetUser) {
      return res.status(404).json({ error: "Target user not found" });
    }

    
    await Promise.all(
      Leads.map(async (leadId) => {
        const lead = await Client.findById(leadId);
        if (!lead) return;

        lead.assignedTo = [
          {
            user: { _id: targetUser._id, name: targetUser.name },
            permissions: { view: true, update: true, delete: false },
          },
        ];

        await lead.save();
      })
    );

    res.json({ message: "Assignments transferred successfully" });
  } catch (error) {
    console.error("Transfer assignments error:", error);
    res.status(500).json({ error: "Failed to transfer assignments" });
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
