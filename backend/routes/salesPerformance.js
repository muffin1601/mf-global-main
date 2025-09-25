const express = require("express");
const router = express.Router();
const ClientData = require("../models/ClientData");

router.get("/sales-performance", async (req, res) => {
  try {
    
    const pipeline = [
      { $unwind: "$assignedTo" }, 
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
          change: "neutral", 
        },
      },
      { $sort: { name: 1 } }, 
    ];

    const salesData = await ClientData.aggregate(pipeline);

    res.json(salesData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
