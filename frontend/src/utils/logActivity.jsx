// src/utils/logActivity.js
import axios from "axios";

export const logActivity = async (action, details = {}) => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
  
      // ✅ Guard clause
      if (!user || !user.userId) {
        console.warn("User not found or missing userId in localStorage. Skipping activity log.");
        return;
      }
  
      const logPayload = {
        userId: user.userId,
        name: user.name,
        role: user.role,
        action,
        timestamp: new Date().toISOString(),
        details,
      };
  
      // ✅ Log payload before sending
      console.log("Sending activity log:", logPayload);
  
      await axios.post(`${import.meta.env.VITE_API_URL}/activity/log`, logPayload);
    } catch (error) {
      // ✅ Print full error response if available
      console.error("Activity logging failed:", error.response?.data || error.message);
    }
  };
  