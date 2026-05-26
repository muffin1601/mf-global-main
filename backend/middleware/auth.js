const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticate = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Authentication is not configured" });
    }

    const authHeader = req.headers.authorization;


    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1]; 

    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
   
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!user.enabled) {
      return res.status(403).json({ message: "Account is disabled" });
    }
    
    req.user = user;

    next(); 
  } catch (error) {
    console.error("Auth Error:", error);
    return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
  }
};

module.exports = authenticate;
