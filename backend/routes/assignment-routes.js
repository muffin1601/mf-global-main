const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData"); 
const User = require('../models/User');

router.post('/leads/assign', async (req, res) => {
  const { Leads, userIds, permissions } = req.body;

  try {
    const users = await User.find({ _id: { $in: userIds } }, '_id name');

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
            user: {
              _id: user._id,
              name: user.name || null,
            },
            permissions,
          });
        });

        lead.assignedTo = Array.from(updatedAssignments.values());
        await lead.save();
      })
    );

    res.json({ message: 'Leads assigned successfully' });
  } catch (error) {
    console.error('Lead assignment error:', error);
    res.status(500).json({ error: 'Assignment failed' });
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


router.get("/clients/meta", async (req, res) => {
  try {
    const categories = await Client.distinct("category");
    const locations = await Client.distinct("location");
    const states = await Client.distinct("state");
    // const datatypes = await Client.distinct("datatype");
    const filenames = await Client.distinct("fileName");

    res.json({ categories, locations,states, filenames });
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

  
    const categories = [...new Set(assignedClients.map(c => c.category).filter(Boolean))];
    const locations = [...new Set(assignedClients.map(c => c.location).filter(Boolean))];
    const states = [...new Set(assignedClients.map(c => c.state).filter(Boolean))];
    const filenames = [...new Set(assignedClients.map(c => c.fileName).filter(Boolean))];
    const datatypes = [...new Set(assignedClients.map(c => c.datatype).filter(Boolean))];

    res.json({ categories, locations, states,filenames, datatypes });
  } catch (err) {
    console.error("Assigned Meta Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
