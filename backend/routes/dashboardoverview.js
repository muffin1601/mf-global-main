const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData");
const ClientPermission = require("../models/ClientPermission"); // Correct model import

// POST /add-client

router.get("/all-clients", async (req, res) => {
  try {
    const clients = await Client.find().lean(); // get all clients
    const uniqueClientsMap = new Map();

    clients.forEach(client => {
      const phoneKey = client.phone || client.contact; // use whichever field exists
      if (phoneKey && !uniqueClientsMap.has(phoneKey)) {
        uniqueClientsMap.set(phoneKey, client);
      }
    });
    
    const uniqueClients = Array.from(uniqueClientsMap.values());
    res.status(200).json(uniqueClients);
  } catch (error) {
    console.error("Error fetching unique clients:", error);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

router.get("/get-details-clients", async (req, res) => {
  try {
    const totalClients = await Client.countDocuments();

    // Clients with callStatus = "Converted"
    const convertedClients = await Client.find({ callStatus: "Converted" });

    // Clients where assignedTo contains at least one user with a valid _id
    const assignedClients = await Client.find({
      assignedTo: {
        $elemMatch: {
          "user._id": { $exists: true, $ne: null }
        }
      }
    });

    // Clients with no assignedTo OR empty OR none of the entries have a valid user._id
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
    });

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

        res.status(200).json(newClients);
    } catch (error) {
        console.error("Error fetching new clients:", error);
        res.status(500).json({ error: "Failed to fetch new clients" });
    }
});

// GET /api/user-dashboard-stats/:username
router.get('/user-dashboard-stats/:username', async (req, res) => {
  const username = decodeURIComponent(req.params.username);

  try {
    // All leads assigned to the user
    const myLeads = await Client.find({ "assignedTo.user.name": username });

    // My Conversions
    const myConversions = myLeads.filter(client => client.callStatus === "Converted");

    // Today's Follow-ups
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysFollowUps = myLeads.filter(client =>
      client.followUpDate &&
      new Date(client.followUpDate) >= today &&
      new Date(client.followUpDate) < tomorrow
    );

    // Upcoming Follow-ups (after today)
    const upcomingFollowUps = myLeads.filter(client =>
      client.followUpDate &&
      new Date(client.followUpDate) > tomorrow
    );

    res.json({
      myLeads,
      myConversions,
      todaysFollowUps,
      upcomingFollowUps
    });

  } catch (error) {
    console.error('Error fetching user dashboard stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
