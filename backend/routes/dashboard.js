const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User"); 
const router = express.Router();


const verifyToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(403).json({ message: "Access Denied: No token provided." });
  }

  jwt.verify(token, process.env.JWT_SECRET || "secret", (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Access Denied: Invalid token." });
    }
    req.user = decoded; 
    next();
  });
};


router.get("/dashboard", verifyToken, async (req, res) => {
  try {
    
    const user = await User.findById(req.user.id);

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
