const express = require("express");
const router = express.Router();
const ActivityLog = require("../models/UserActivity"); 
const authenticate = require("../middleware/auth");
const User = require("../models/User"); 
const bcrypt = require("bcrypt");


router.get("/activity/user", authenticate, async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    const logs = await ActivityLog.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { userId: { $regex: query, $options: "i" } }
      ]
    }).sort({ timestamp: -1 });

    res.json(logs);
  } catch (err) {
    console.error("Error fetching activity logs:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch('/admin/toggle-user/:id/toggle', async (req, res) => {
  const user = await User.findById(req.params.id);
  user.enabled = !user.enabled;
  await user.save();
  res.json(user);
});


router.post('/admin/register-user', async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;
    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      username,
      email,
      password: hashedPassword,
      role
    });

    await newUser.save();
    res.status(201).json({ message: "User created successfully", user: newUser });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({ error: `Duplicate ${field}: ${err.keyValue[field]}` });
    }
    console.error("Error creating user:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
