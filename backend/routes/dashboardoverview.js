const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData");
const authenticate = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { getPaging, setPageHeaders } = require("../utils/paginate");
const countsCache = require("../utils/countsCache");

// Lean projection: every field the lead tables + edit modal actually read.
// Excludes only Mongoose internals (__v). Keeps UI behavior identical.
const LEAD_FIELDS = "-__v";

router.use(authenticate);

router.get("/counts", async (req, res) => {
  try {
    // Global totals are admin-only. Regular users receive counts from the same
    // ownership scope used by their lists, preventing both leakage and drift.
    const scope = req.user.role === "admin"
      ? {}
      : { "assignedTo.user._id": req.user._id };

    if (req.user.role !== "admin") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const withScope = (extra = {}) => ({ ...scope, ...extra });
      const [totalClients, newClients, convertedClients, trendingClients] = await Promise.all([
        Client.countDocuments(scope),
        Client.countDocuments(withScope({ createdAt: { $gte: today } })),
        Client.countDocuments(withScope({ status: "Won Lead" })),
        Client.countDocuments(withScope({ status: "In Progress" })),
      ]);
      return res.json({
        totalClients,
        newClients,
        assignedClients: totalClients,
        unassignedClients: 0,
        convertedClients,
        trendingClients,
      });
    }

    const cached = countsCache.get();
    if (cached) {
      res.set("X-Cache", "HIT");
      return res.json(cached);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalClients,
      newClients,
      assignedClients,
      unassignedClients,
      convertedClients,
      trendingClients
    ] = await Promise.all([
      Client.countDocuments(),
      Client.countDocuments({ createdAt: { $gte: today } }),
      Client.countDocuments({ isAssigned: true }),
      Client.countDocuments({ isAssigned: false }),
      Client.countDocuments({ status: "Won Lead" }),
      Client.countDocuments({ status: "In Progress"})
    ]);

    const payload = {
      totalClients,
      newClients,
      assignedClients,
      unassignedClients,
      convertedClients,
      trendingClients
    };
    countsCache.set(payload);
    res.set("X-Cache", "MISS");
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


router.get("/user-stats/:username", async (req, res) => {
  const username = req.params.username;

  // Non-admins may only read their own stats.
  if (req.user.role !== "admin" && req.user.name !== username) {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // One index-served aggregation replaces 5 separate countDocuments round
    // trips. The $match uses the {assignedTo.user.name} index so only this
    // user's leads are scanned, then the 5 buckets are summed in a single pass.
    const ownershipFilter = req.user.role === "admin"
      ? { "assignedTo.user.name": username }
      : { "assignedTo.user._id": req.user._id };
    const [agg] = await Client.aggregate([
      { $match: ownershipFilter },
      {
        $group: {
          _id: null,
          myLeads: { $sum: 1 },
          myConversions: { $sum: { $cond: [{ $eq: ["$status", "Won Lead"] }, 1, 0] } },
          todaysFollowUps: {
            $sum: { $cond: [{ $and: [{ $gte: ["$followUpDate", today] }, { $lt: ["$followUpDate", tomorrow] }] }, 1, 0] },
          },
          upcomingFollowUps: { $sum: { $cond: [{ $gte: ["$followUpDate", tomorrow] }, 1, 0] } },
          myTrendingLeads: { $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] } },
        },
      },
    ]);

    const myLeadsCount = agg?.myLeads || 0;
    const myConversionsCount = agg?.myConversions || 0;
    const todaysFollowUpsCount = agg?.todaysFollowUps || 0;
    const upcomingFollowUpsCount = agg?.upcomingFollowUps || 0;
    const myTrendingLeadsCount = agg?.myTrendingLeads || 0;

    const conversionRate = myLeadsCount > 0
      ? ((myConversionsCount / myLeadsCount) * 100).toFixed(2)
      : "0.00";


    res.json({
      myLeads: myLeadsCount,
      myConversions: `${conversionRate}%`,
      todaysFollowUps: todaysFollowUpsCount,
      upcomingFollowUps: upcomingFollowUpsCount,
      myTrendingLeads: myTrendingLeadsCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Shared helper: paginated + projected + Mongo-sorted lead list.
// `shape` controls backward-compatible body: "envelope" -> { data, total, ... }
// (original all-clients shape); "array" -> bare array of the current page
// (original shape for the other lists). Pagination metadata is always in headers.
const sendLeadPage = async (req, res, filter, shape) => {
  const { page, limit, skip } = getPaging(req);
  const [data, total] = await Promise.all([
    Client.find(filter)
      .select(LEAD_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Object.keys(filter).length
      ? Client.countDocuments(filter)
      : Client.estimatedDocumentCount(),
  ]);
  const pages = setPageHeaders(res, total, page, limit);
  if (shape === "envelope") {
    return res.status(200).json({ data, total, page, pages });
  }
  return res.status(200).json(data);
};

// Index-backed (was a $or/$elemMatch array scan).
const UNASSIGNED_FILTER = { isAssigned: false };

// Client picker used by quotation create/edit. Admins may select any client;
// regular users may select only clients assigned to them. Search happens on
// the server so records beyond the first dashboard page remain discoverable.
router.get("/quotation-clients", async (req, res) => {
  try {
    const { page, limit, skip } = getPaging(req);
    const search = String(req.query.q || "").trim().slice(0, 100);
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ownership = req.user.role === "admin"
      ? {}
      : { "assignedTo.user._id": req.user._id };
    const searchFilter = search
      ? {
          $or: ["name", "company", "phone", "contact"].map((field) => ({
            [field]: { $regex: escapedSearch, $options: "i" },
          })),
        }
      : {};
    const filter = Object.keys(ownership).length && Object.keys(searchFilter).length
      ? { $and: [ownership, searchFilter] }
      : { ...ownership, ...searchFilter };

    const [data, total] = await Promise.all([
      Client.find(filter)
        .select("name company phone contact billingAddress shippingAddress state")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Client.countDocuments(filter),
    ]);
    const pages = setPageHeaders(res, total, page, limit);
    res.json({ data, total, page, pages });
  } catch (error) {
    console.error("Error searching quotation clients:", error);
    res.status(500).json({ error: "Failed to search clients" });
  }
});

router.get("/all-clients", requireRole("admin"), async (req, res) => {
  try {
    await sendLeadPage(req, res, {}, "envelope");
  } catch (error) {
    console.error("Error fetching all clients:", error);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

router.get("/converted-clients", requireRole("admin"), async (req, res) => {
  try {
    await sendLeadPage(req, res, { status: "Won Lead" }, "array");
  } catch (error) {
    console.error("Error fetching converted clients:", error);
    res.status(500).json({ error: "Failed to fetch converted clients" });
  }
});

router.get("/trending-leads", requireRole("admin"), async (req, res) => {
  try {
    await sendLeadPage(req, res, { status: "In Progress" }, "array");
  } catch (error) {
    console.error("Error fetching trending leads:", error);
    res.status(500).json({ error: "Failed to fetch trending leads" });
  }
});

router.get("/assigned-clients", requireRole("admin"), async (req, res) => {
  try {
    await sendLeadPage(req, res, { isAssigned: true }, "array");
  } catch (error) {
    console.error("Error fetching assigned clients:", error);
    res.status(500).json({ error: "Failed to fetch assigned clients" });
  }
});

router.get("/unassigned-clients", requireRole("admin"), async (req, res) => {
  try {
    await sendLeadPage(req, res, UNASSIGNED_FILTER, "array");
  } catch (error) {
    console.error("Error fetching unassigned clients:", error);
    res.status(500).json({ error: "Failed to fetch unassigned clients" });
  }
});


router.get("/new-clients", requireRole("admin"), async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Sort now done in Mongo (createdAt:-1); JS sort removed.
    await sendLeadPage(req, res, { createdAt: { $gte: twentyFourHoursAgo } }, "array");
  } catch (error) {
    console.error("Error fetching new clients:", error);
    res.status(500).json({ error: "Failed to fetch new clients" });
  }
});

router.get('/user-dashboard-stats/:username', async (req, res) => {
  const username = decodeURIComponent(req.params.username);

  if (req.user.role !== "admin" && req.user.name !== username) {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Single aggregation: one indexed $match, then all bucketing + sorting done
    // inside MongoDB via $facet. No post-query JS filtering.
    const ownershipFilter = req.user.role === "admin"
      ? { "assignedTo.user.name": username }
      : { "assignedTo.user._id": req.user._id };
    const [result] = await Client.aggregate([
      { $match: ownershipFilter },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          myLeads: [],
          myConversions: [{ $match: { status: "Won Lead" } }],
          myTrendingLeads: [{ $match: { status: "In Progress" } }],
          todaysFollowUps: [{ $match: { followUpDate: { $gte: today, $lt: tomorrow } } }],
          upcomingFollowUps: [{ $match: { followUpDate: { $gt: tomorrow } } }],
        },
      },
    ]);

    res.json({
      myLeads: result?.myLeads || [],
      myConversions: result?.myConversions || [],
      todaysFollowUps: result?.todaysFollowUps || [],
      upcomingFollowUps: result?.upcomingFollowUps || [],
      myTrendingLeads: result?.myTrendingLeads || [],
    });
  } catch (error) {
    console.error('Error fetching user dashboard stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
