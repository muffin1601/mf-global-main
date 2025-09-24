const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData"); 
const User = require('../models/User');

router.post("/clients/filter", async (req, res) => {
  try {
    const {
      category,
      location,
      datatype,
      callStatus,
      fileName,
      status,
      assigned,
      assignedTo,
    } = req.body;

    const query = [];

    if (category && Array.isArray(category) && category.length > 0) {
      query.push({ category: { $in: category } });
    }
    if (location && Array.isArray(location) && location.length > 0) {
      query.push({ location: { $in: location } });
    }
    if (datatype && Array.isArray(datatype) && datatype.length > 0) {
      query.push({ datatype: { $in: datatype } });
    }
    if (callStatus && Array.isArray(callStatus) && callStatus.length > 0) {
      query.push({ callStatus: { $in: callStatus } });
    }
    if (fileName && Array.isArray(fileName) && fileName.length > 0) {
      query.push({ fileName: { $in: fileName } });
    }
    if (status && Array.isArray(status) && status.length > 0) {
      query.push({ status: { $in: status } });
    }

  
    if (assigned === "assigned") {
      query.push({ assignedTo: { $exists: true, $ne: [] } });
    } else if (assigned === "unassigned") {
      query.push({ $or: [{ assignedTo: { $exists: false } }, { assignedTo: [] }] });
    }

    
    if (assignedTo && Array.isArray(assignedTo) && assignedTo.length > 0) {
      query.push({
        "assignedTo.user.name": { $in: assignedTo }
      });
    }

    const finalQuery = query.length > 0 ? { $and: query } : {};

    const clients = await Client.find(finalQuery);

  
    const uniqueClients = clients.filter((client, index, self) =>
      index === self.findIndex(c => c._id.toString() === client._id.toString())
    );

    res.json(uniqueClients);
  } catch (err) {
    console.error("Filter Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



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

// GET /api/clients/meta
router.get("/clients/meta", async (req, res) => {
  try {
    const categories = await Client.distinct("category");
    const locations = await Client.distinct("location");
    // const datatypes = await Client.distinct("datatype");
    const filenames = await Client.distinct("fileName");

    res.json({ categories, locations, filenames });
  } catch (err) {
    console.error("Meta Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


module.exports = router;
