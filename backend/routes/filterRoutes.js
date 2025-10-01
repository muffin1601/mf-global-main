const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData");
const ClientPermission = require("../models/ClientPermission"); 

router.post("/clients/filter", async (req, res) => {
  try {
    const {
      category,
      location,
      state,
      datatype,
      callStatus,
      fileName,
      status,
      assigned,
      assignedTo,
    } = req.body;

    const query = [];

    if (category && Array.isArray(category) && category.length > 0) {
      query.push({ category: { $in: category } });
    }
    if (location && Array.isArray(location) && location.length > 0) {
      query.push({ location: { $in: location } });
    }
    if (state && Array.isArray(state) && state.length > 0) {
      query.push({ state: { $in: state } });
    }
    if (datatype && Array.isArray(datatype) && datatype.length > 0) {
      query.push({ datatype: { $in: datatype } });
    }
    if (callStatus && Array.isArray(callStatus) && callStatus.length > 0) {
      query.push({ callStatus: { $in: callStatus } });
    }
    if (fileName && Array.isArray(fileName) && fileName.length > 0) {
      query.push({ fileName: { $in: fileName } });
    }
    if (status && Array.isArray(status) && status.length > 0) {
      query.push({ status: { $in: status } });
    }

  
    if (assigned === "assigned") {
      query.push({ assignedTo: { $exists: true, $ne: [] } });
    } else if (assigned === "unassigned") {
      query.push({ $or: [{ assignedTo: { $exists: false } }, { assignedTo: [] }] });
    }

    
    if (assignedTo && Array.isArray(assignedTo) && assignedTo.length > 0) {
      query.push({
        "assignedTo.user.name": { $in: assignedTo }
      });
    }

    const finalQuery = query.length > 0 ? { $and: query } : {};

    const clients = await Client.find(finalQuery);

  
    const uniqueClients = clients.filter((client, index, self) =>
      index === self.findIndex(c => c._id.toString() === client._id.toString())
    );

    res.json(uniqueClients);
  } catch (err) {
    console.error("Filter Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.post("/clients/assigned/:userName/filter", async (req, res) => {
  const { userName } = req.params;
  const filters = req.body;
  try {
    
    const query = { "assignedTo.user.name": userName };

    if (filters.category?.length) query.category = { $in: filters.category };
    if (filters.datatype?.length) query.datatype = { $in: filters.datatype };
    if (filters.location?.length) query.location = { $in: filters.location };
    if (filters.state?.length) query.state = { $in: filters.state };
    if (filters.status?.length) query.status = { $in: filters.status };
    if (filters.callStatus?.length) query.callStatus = { $in: filters.callStatus };

    
    const assignedClients = await Client.find(query).lean();

    res.json(assignedClients);
  } catch (err) {
    console.error("Assigned Filter Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.post("/clients/unassigned/filter", async (req, res) => {
  const filters = req.body;

  try {
    const query = { $and: [{ $or: [{ assignedTo: { $exists: false } }, { assignedTo: { $size: 0 } }] }] };

    if (filters.category?.length) query.$and.push({ category: { $in: filters.category } });
    if (filters.datatype?.length) query.$and.push({ datatype: { $in: filters.datatype } });
    if (filters.location?.length) query.$and.push({ location: { $in: filters.location } });
    if (filters.state?.length) query.$and.push({ state: { $in: filters.state } });
    if (filters.status?.length) query.$and.push({ status: { $in: filters.status } });
    if (filters.callStatus?.length) query.$and.push({ callStatus: { $in: filters.callStatus } });

    const unassignedClients = await Client.find(query).lean();
    res.json(unassignedClients);
  } catch (err) {
    console.error("Unassigned Filter Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
