const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const authenticate = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

const publicUserFields = "-password";

router.get("/users", authenticate, async (req, res) => {
  try {
    const users = await User.find({ enabled: true, role:'user' }).select(publicUserFields);
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/users/all", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const users = await User.find({}).select(publicUserFields);
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Authentication is not configured" });
    }

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.enabled) {
      return res.status(403).json({ message: "Account is disabled. Please contact support." });
    }
  
    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    const safeUser = user.toObject();
    delete safeUser.password;

    res.json({ token, user: safeUser });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
// backend route (Express)
router.put('/admin/change-password/:userId', authenticate, requireRole("admin"), async (req, res) => {
  const { userId } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: 'New password is required.' });
  }
  try {
    const user = await User.findOne({ $or: [{ userId }, { _id: userId }] });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!user.enabled) {
      return res.status(403).json({ message: 'Account is disabled. Please contact support.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;

    await user.save();

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
