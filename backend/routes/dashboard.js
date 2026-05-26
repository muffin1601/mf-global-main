const express = require("express");
const User = require("../models/User"); 
const authenticate = require("../middleware/auth");
const router = express.Router();

router.get("/dashboard", authenticate, async (req, res) => {
  try {
    
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // You can return any other data you need for the dashboard, like a custom message
    res.json({
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        location: user.location,
      },
      message: "Welcome to the Data Entry dashboard!",
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({ message: "Server error." });
  }
});

module.exports = router;
