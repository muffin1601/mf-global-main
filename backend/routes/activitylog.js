const express = require("express");
const router = express.Router();
const ActivityLog = require("../models/UserActivity");


router.post("/activity/log", async (req, res) => {
  try {
    const { userId, name, role, action, timestamp, details } = req.body;

    if (!userId || !action || !timestamp) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const logEntry = new ActivityLog({
      userId,
      name,
      role,
      action,
      timestamp: new Date(timestamp),
      details,
    });

    await logEntry.save();

    res.status(200).json({ success: true, message: "Activity logged successfully" });
  } catch (error) {
    console.error("Error logging activity:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = router;