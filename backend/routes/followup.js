const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData");
const authenticate = require("../middleware/auth");
const ClientPermission = require("../models/ClientPermission"); 

router.get("/followup/reminder/:userId", authenticate, async (req, res) => {
  const { userId } = req.params;

  // Non-admins may only see their own follow-up reminders.
  if (req.user.role !== "admin" && String(req.user._id) !== String(userId)) {
    return res.status(403).json({ error: "Access denied" });
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  try {
    
    const permissions = await ClientPermission.find({ userId }).populate({
      path: "clientId",
      model: "ClientData",
      match: {
        followUpDate: { $gte: startOfDay, $lte: endOfDay } 
      },
      options: { lean: true }
    }).lean();

    
    const followUpClients = permissions
      .filter(p => p.clientId)
      .map(p => ({
        ...p.clientId,
        permission: p.permission
      }));

    
    const uniqueClients = followUpClients.filter((client, index, self) =>
      index === self.findIndex(c =>
        (c.phone && client.phone && c.phone === client.phone) ||
        (c.contact && client.contact && c.contact === client.contact)
      )
    );

    res.json(uniqueClients); 
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
    
    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Non-admins may only update the status of a lead assigned to them.
    if (req.user.role !== "admin") {
      const isAssignee = Array.isArray(client.assignedTo) && client.assignedTo.some(
        (a) => a && a.user && String(a.user._id) === String(req.user._id)
      );
      if (!isAssignee) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    client.status = status;
    await client.save();

    res.json({ message: "Status updated successfully", client });
  } catch (err) {
    console.error("Error updating client status:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
