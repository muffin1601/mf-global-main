const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData");
const authenticate = require("../middleware/auth");
const ClientPermission = require("../models/ClientPermission"); // Correct model import

router.get("/followup/reminder/:userId", authenticate, async (req, res) => {
  const { userId } = req.params;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  try {
    // Get the clients assigned to the user and filter by followUpDate for today
    const permissions = await ClientPermission.find({ userId }).populate({
      path: "clientId",
      model: "ClientData",
      match: {
        followUpDate: { $gte: startOfDay, $lte: endOfDay } // Filter clients for today
      },
      options: { lean: true }
    });

    // Flatten and filter valid clients
    const followUpClients = permissions
      .filter(p => p.clientId) // Only keep if the client matched the date
      .map(p => ({
        ...p.clientId,
        permission: p.permission
      }));

    // Deduplicate clients by phone or contact
    const uniqueClients = followUpClients.filter((client, index, self) =>
      index === self.findIndex(c =>
        (c.phone && client.phone && c.phone === client.phone) ||
        (c.contact && client.contact && c.contact === client.contact)
      )
    );

    res.json(uniqueClients); // Send the list of clients for today
  } catch (err) {
    console.error("Error fetching follow-up clients:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


router.put("/followup/update-status/:clientId", authenticate, async (req, res) => {
  const { clientId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  try {
    // Find the client by clientId
    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Update the status field with the provided status
    client.status = status;
    await client.save();

    res.json({ message: "Status updated successfully", client });
  } catch (err) {
    console.error("Error updating client status:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
