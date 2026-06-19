const express = require("express");
const router = express.Router();
const ActivityLog = require("../models/UserActivity"); 
const authenticate = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const User = require("../models/User");
const bcrypt = require("bcrypt");

// Strip password (and other secrets) before any user doc leaves the server.
const sanitizeUser = (u) => {
  if (!u) return u;
  const obj = typeof u.toObject === "function" ? u.toObject() : { ...u };
  delete obj.password;
  return obj;
};

router.get("/activity/user", authenticate, requireRole("admin"), async (req, res) => {
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
    }).sort({ timestamp: -1 }).lean();

    res.json(logs);
  } catch (err) {
    console.error("Error fetching activity logs:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch('/admin/toggle-user/:id/toggle', authenticate, requireRole("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.enabled = !user.enabled;
    await user.save();
    res.json(sanitizeUser(user));
  } catch (err) {
    console.error("Error toggling user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


router.post('/admin/register-user', authenticate, requireRole("admin"), async (req, res) => {
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
    res.status(201).json({ message: "User created successfully", user: sanitizeUser(newUser) });
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
