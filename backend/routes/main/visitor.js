const express = require("express");
const router = express.Router();
const axios = require("axios");
const Visitor = require("../../models/Visitor");

const getClientIp = (req) => {
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (xForwardedFor) return xForwardedFor.split(",")[0].trim();
  return req.socket.remoteAddress;
};

router.get("/count", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const userIp = getClientIp(req);
    const device = req.headers["user-agent"] || "Unknown";

    let visitor = await Visitor.findOne({ date: today });

    if (!visitor) {
      let city = "Unknown";
      let region = "Unknown";

      try {
        const geoRes = await axios.get(`http://ip-api.com/json/${userIp}`);
        if (geoRes.data.status === "success") {
          city = geoRes.data.city || "Unknown";
          region = geoRes.data.regionName || "Unknown";
        }
      } catch {}

      const newVisitorData = {
        ip: userIp,
        city,
        region,
        device,
        timestamp: new Date(),
      };

      visitor = await Visitor.create({
        date: today,
        count: 1,
        visitors: [newVisitorData],
      });
    } else {
      const deviceAlreadyCounted = visitor.visitors.some((v) => v.device === device);

      if (!deviceAlreadyCounted) {
        let city = "Unknown";
        let region = "Unknown";

        try {
          const geoRes = await axios.get(`http://ip-api.com/json/${userIp}`);
          if (geoRes.data.status === "success") {
            city = geoRes.data.city || "Unknown";
            region = geoRes.data.regionName || "Unknown";
          }
        } catch {}

        const newVisitorData = {
          ip: userIp,
          city,
          region,
          device,
          timestamp: new Date(),
        };

        visitor.count++;
        visitor.visitors.push(newVisitorData);
        await visitor.save();
      }
    }

    // Return total visitors across all days
    const allVisitors = await Visitor.find({});
    const totalCount = allVisitors.reduce((acc, v) => acc + v.count, 0);

    res.json({
      totalVisitors: totalCount,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch visitor count" });
  }
});

module.exports = router;
