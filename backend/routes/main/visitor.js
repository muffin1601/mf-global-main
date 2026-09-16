const express = require("express");
const router = express.Router();
const axios = require("axios");
const crypto = require("crypto");
const Visitor = require("../../models/Visitor");

const GEO_TIMEOUT_MS = 1500;
const MAX_DAILY_VISITOR_SAMPLES = 500;

const getClientIp = (req) => {
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (xForwardedFor) return xForwardedFor.split(",")[0].trim();
  return req.socket.remoteAddress;
};

// Visitor totals do not need a reversible IP address. Keep the existing field
// name for schema compatibility while storing only a non-reversible digest for
// new records. Historical records are intentionally left untouched.
const anonymizeIp = (ip) => crypto
  .createHash("sha256")
  .update(`${process.env.VISITOR_IP_SALT || "crm-visitor"}:${ip || "unknown"}`)
  .digest("hex");

const lookupGeo = async (ip) => {
  try {
    const geoRes = await axios.get(`http://ip-api.com/json/${encodeURIComponent(ip || "")}`, { timeout: GEO_TIMEOUT_MS });
    if (geoRes.data?.status === "success") {
      return { city: geoRes.data.city || "Unknown", region: geoRes.data.regionName || "Unknown" };
    }
  } catch { /* visitor counting must survive geo-IP failure/timeouts */ }
  return { city: "Unknown", region: "Unknown" };
};

router.get("/count", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const userIp = getClientIp(req);
    const anonymizedIp = anonymizeIp(userIp);
    const device = String(req.headers["user-agent"] || "Unknown").slice(0, 500);

    let visitor = await Visitor.findOne({ date: today });

    if (!visitor) {
      const { city, region } = await lookupGeo(userIp);

      const newVisitorData = {
        ip: anonymizedIp,
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

      if (!deviceAlreadyCounted && visitor.visitors.length < MAX_DAILY_VISITOR_SAMPLES) {
        const { city, region } = await lookupGeo(userIp);

        const newVisitorData = {
          ip: anonymizedIp,
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
    const [total] = await Visitor.aggregate([{ $group: { _id: null, total: { $sum: "$count" } } }]);

    res.json({
      totalVisitors: total?.total || 0,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch visitor count" });
  }
});

module.exports = router;
