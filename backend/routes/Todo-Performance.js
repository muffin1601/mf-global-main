const express = require("express");
const router = express.Router();

const salesData = [
  { name: "Sarita", deals: 15, leads: 100, rate: 15.0, change: "up" },
  { name: "Neha", deals: 20, leads: 120, rate: 16.7, change: "down" },
  { name: "Anju", deals: 20, leads: 35, rate: 57.0, change: "up" },
   { name: "Afroz", deals: 20, leads: 35, rate: 57.0, change: "up" },
];

router.get("/sales-performance", (req, res) => {
  res.json(salesData);
});

const tasksData = [
  { title: "Review Campaign", description: "Marketing review", status: "pending" },
  { title: "Update DB", description: "Client DB cleanup", status: "done" },
  { title: "Call Clients", description: "Follow up on leads", status: "not_started" },
];

router.get("/tasks", (req, res) => {
  res.json(tasksData);
});

module.exports = router;
