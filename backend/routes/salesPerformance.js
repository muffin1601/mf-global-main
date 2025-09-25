const express = require("express");
const router = express.Router();
const ClientData = require("../models/ClientData");

router.get("/sales-performance", async (req, res) => {
  try {
    // Aggregate per sales rep dynamically for all-time data
    const pipeline = [
      { $unwind: "$assignedTo" }, // In case multiple assignees
      {
        $group: {
          _id: "$assignedTo.user._id",
          name: { $first: "$assignedTo.user.name" },
          leads: { $sum: 1 },
          deals: {
            $sum: { $cond: [{ $eq: ["$status", "Won Lead"] }, 1, 0] },
          },
        },
      },
      {
        $addFields: {
          closedPercentage: {
            $cond: [{ $eq: ["$leads", 0] }, 0, { $multiply: [{ $divide: ["$deals", "$leads"] }, 100] }],
          },
          change: "neutral", // Optional: compute change vs previous period
        },
      },
      { $sort: { name: 1 } }, // Sort by rep name
    ];

    const salesData = await ClientData.aggregate(pipeline);

    res.json(salesData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
