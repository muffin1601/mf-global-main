const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData");
const ClientPermission = require("../models/ClientPermission"); // Correct model import

// GET /filter-clients
router.get("/filter-clients", async (req, res) => {
  try {
    const { search = "", callStatus = "" } = req.query;

    const searchQuery = {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { requirements: { $regex: search, $options: "i" } },
      ],
    };
    
    const filter = callStatus ? { ...searchQuery, callStatus } : searchQuery;
    const clients = await Client.find(filter);

    const uniqueClients = clients.filter((client, index, self) =>
      index === self.findIndex(c => c._id.toString() === client._id.toString())
    );
    res.json(uniqueClients);
    
  } catch (err) {
    console.error("Error in /filter-clients:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
