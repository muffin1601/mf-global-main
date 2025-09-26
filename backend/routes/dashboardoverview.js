const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData");
const ClientPermission = require("../models/ClientPermission");

router.get("/all-clients", async (req, res) => {
  try {
    const clients = await Client.find().lean();
    const uniqueClientsMap = new Map();
    const skippedClients = [];

    clients.forEach(client => {
      const phoneKey = client.phone || client.contact;
      if (phoneKey) {
        if (!uniqueClientsMap.has(phoneKey)) {
          uniqueClientsMap.set(phoneKey, client);
        } else {
          skippedClients.push(client); 
        }
      } else {
        skippedClients.push(client);
      }
    });

    const uniqueClients = Array.from(uniqueClientsMap.values());
    uniqueClients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    
    console.log(
      "Skipped clients due to duplicate phone/contact:",
      skippedClients.map(c => ({ name: c.name, phone: c.phone || c.contact }))
    );

    res.status(200).json(uniqueClients);

  } catch (error) {
    console.error("Error fetching unique clients:", error);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});



router.get("/get-details-clients", async (req, res) => {
  try {
    const totalClients = await Client.countDocuments();
    const convertedClients = await Client.find({ status: "Won Lead" })
      .sort({ createdAt: -1 });
    const trendingLeads = await Client.find({ status: "In Progress" })
      .sort({ createdAt: -1 });
    const assignedClients = await Client.find({
      assignedTo: {
        $elemMatch: {
          "user._id": { $exists: true, $ne: null }
        }
      }
    }).sort({ createdAt: -1 });
    const unassignedClients = await Client.find({
      $or: [
        { assignedTo: { $exists: false } },
        { assignedTo: { $size: 0 } },
        {
          assignedTo: {
            $not: {
              $elemMatch: {
                "user._id": { $exists: true, $ne: null }
              }
            }
          }
        }
      ]
    }).sort({ createdAt: -1 });

    const convertedCount = convertedClients.length;
    const assignedCount = assignedClients.length;
    const unassignedCount = unassignedClients.length;

    const conversionRate = totalClients > 0
      ? ((convertedCount / totalClients) * 100).toFixed(2)
      : "0.00";

    res.status(200).json({
      uniqueConvertedClients: convertedClients,
      uniqueAssignedClients: assignedClients,
      uniqueUnassignedClients: unassignedClients,
      convertedCount,
      assignedCount,
      unassignedCount,
      totalClients,
      convertedClients,
      trendingLeads,
      conversionRate: `${conversionRate}%`
    });
  } catch (error) {
    console.error("Error fetching client details:", error);
    res.status(500).json({ error: "Failed to fetch client details" });
  }
});

router.get("/new-clients", async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newClients = await Client.find({ createdAt: { $gte: twentyFourHoursAgo } });
    newClients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.status(200).json(newClients);
  } catch (error) {
    console.error("Error fetching new clients:", error);
    res.status(500).json({ error: "Failed to fetch new clients" });
  }
});

router.get('/user-dashboard-stats/:username', async (req, res) => {
  const username = decodeURIComponent(req.params.username);

  try {
    const myLeads = await Client.find({ "assignedTo.user.name": username })
      .sort({ createdAt: -1 });

    const myConversions = myLeads
      .filter(client => client.status === "Won Lead")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const myTrendingLeads = myLeads
      .filter(client => client.status === "In Progress")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysFollowUps = myLeads
      .filter(client =>
        client.followUpDate &&
        new Date(client.followUpDate) >= today &&
        new Date(client.followUpDate) < tomorrow
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const upcomingFollowUps = myLeads
      .filter(client =>
        client.followUpDate &&
        new Date(client.followUpDate) > tomorrow
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      myLeads,
      myConversions,
      todaysFollowUps,
      upcomingFollowUps,
      myTrendingLeads
    });

  } catch (error) {
    console.error('Error fetching user dashboard stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
