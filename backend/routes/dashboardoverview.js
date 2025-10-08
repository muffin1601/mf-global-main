const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData");

router.get("/counts", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalClients,
      newClients,
      assignedClients,
      unassignedClients,
      convertedClients,
      trendingClients
    ] = await Promise.all([
      Client.countDocuments(),
      Client.countDocuments({ createdAt: { $gte: today } }),
      Client.countDocuments({ "assignedTo.0": { $exists: true } }),
      Client.countDocuments({ $or: [{ assignedTo: { $exists: false } }, { assignedTo: { $size: 0 } }, { assignedTo: { $not: { $elemMatch: { "user._id": { $exists: true, $ne: null } } } } }] }),
      Client.countDocuments({ status: "Won Lead" }),
      Client.countDocuments({ status: "In Progress"})
    ]);

    res.json({
      totalClients,
      newClients,
      assignedClients,
      unassignedClients,
      convertedClients,
      trendingClients
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


router.get("/user-stats/:username", async (req, res) => {
  const username = req.params.username;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const [
      myLeadsCount,
      myConversionsCount,
      todaysFollowUpsCount,
      upcomingFollowUpsCount,
      myTrendingLeadsCount
    ] = await Promise.all([
      Client.countDocuments({ "assignedTo.user.name": username }),
      Client.countDocuments({ "assignedTo.user.name": username, status: "Won Lead" }),
      Client.countDocuments({ "assignedTo.user.name": username, followUpDate: { $gte: today, $lt: tomorrow } }),
      Client.countDocuments({ "assignedTo.user.name": username, followUpDate: { $gte: tomorrow } }),
      Client.countDocuments({ "assignedTo.user.name": username, trending: true })
    ]);

    const conversionRate = myLeadsCount > 0
      ? ((myConversionsCount / myLeadsCount) * 100).toFixed(2)
      : "0.00";


    res.json({
      myLeads: myLeadsCount,
      myConversions: `${conversionRate}%`,
      todaysFollowUps: todaysFollowUpsCount,
      upcomingFollowUps: upcomingFollowUpsCount,
      myTrendingLeads: myTrendingLeadsCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/all-clients", async (req, res) => {
  try {
    const clients = await Client.find().lean();
    res.status(200).json({
      data: clients,
      total: clients.length, 
    });
  } catch (error) {
    console.error("Error fetching all clients:", error);
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
        $elemMatch: { "user._id": { $exists: true, $ne: null } }
      }
    }).sort({ createdAt: -1 });

    const unassignedClients = await Client.find({
      $or: [
        { assignedTo: { $exists: false } },
        { assignedTo: { $size: 0 } },
        { assignedTo: { $not: { $elemMatch: { "user._id": { $exists: true, $ne: null } } } } }
      ]
    }).sort({ createdAt: -1 });

    res.status(200).json({
      uniqueAssignedClients: assignedClients,
      uniqueUnassignedClients: unassignedClients,
      totalClients,
      convertedClients,
      trendingLeads,
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
      .filter(client => client.followUpDate && new Date(client.followUpDate) >= today && new Date(client.followUpDate) < tomorrow)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const upcomingFollowUps = myLeads
      .filter(client => client.followUpDate && new Date(client.followUpDate) > tomorrow)
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
