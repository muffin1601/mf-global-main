const express = require("express");
const router = express.Router();
const ClientPermission = require("../models/ClientPermission"); // Corrected the import
const Client = require("../models/ClientData");
const { Parser } = require("json2csv");
const authenticate = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

router.get("/clients/assigned/:userId", authenticate, async (req, res) => {
  const { userId } = req.params;
  if (req.user.role !== "admin" && req.user._id.toString() !== userId) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const permissions = await ClientPermission.find({ userId })
      .populate({
        path: "clientId",
        model: "ClientData",
        options: { lean: true }
      }).lean();

    const clients = permissions
      .filter(p => p.clientId) // Skip if clientId wasn't found
      .map(p => ({
        ...p.clientId,
        permission: p.permission
      }));
      const uniqueClients = clients.filter((client, index, self) =>
        index === self.findIndex(c =>
          (c.phone && client.phone && c.phone === client.phone) ||
          (c.contact && client.contact && c.contact === client.contact)
        )
      );
  
      res.json(uniqueClients);
    
  } catch (err) {
    console.error("Error fetching client permissions:", err);
    res.status(500).json({ message: "Server Error" });
  }
});


router.get("/clients/assigned/:userId/filtered", authenticate, async (req, res) => {
  const { userId } = req.params;
  const { category, datatype, location } = req.query;
  if (req.user.role !== "admin" && req.user._id.toString() !== userId) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const permissions = await ClientPermission.find({ userId })
      .populate({
        path: "clientId",
        model: "ClientData",
        options: { lean: true },
      }).lean();

    const clients = permissions
      .filter(p => p.clientId) 
      .map(p => ({
        ...p.clientId,
        permission: p.permission,
      }))
      .filter(client => {
        
        if (category && client.category !== category) return false;
        if (datatype && client.datatype !== datatype) return false;
        if (location && client.location !== location) return false;
        return true;
      });

    const uniqueClients = clients.filter((client, index, self) =>
      index === self.findIndex(c => c._id.toString() === client._id.toString())
    );

    res.json(uniqueClients);
  } catch (err) {
    console.error("Error fetching filtered clients:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.put("/clients/:id", authenticate, async (req, res) => {
  const { name, remarks, callStatus, requirements, location, category } = req.body;

  try {
    const updatedClient = await Client.findByIdAndUpdate(
      req.params.id,
      { name, remarks, callStatus, requirements, location, category },
      { new: true }
    );

    if (!updatedClient) {
      return res.status(404).json({ message: "Client not found" });
    }

    res.json({ success: true, client: updatedClient });
  } catch (err) {
    console.error("Error updating client:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

const formatDate = d => (d ? new Date(d).toISOString().split("T")[0] : "");

// Dedupe records keeping the first occurrence. A record is a duplicate if its
// phone OR contact already appeared in an earlier record. Single-pass (O(n))
// replacement for the previous filter(findIndex) O(n^2) scan — identical result.
const dedupeByPhoneOrContact = (arr) => {
  const seenPhones = new Set();
  const seenContacts = new Set();
  const out = [];
  for (const item of arr) {
    // Matches the original filter(findIndex) semantics exactly: a record is kept
    // only if it has a phone or contact to match itself by AND no earlier record
    // shares that phone/contact. (A record with neither phone nor contact was
    // dropped by the original — findIndex returned -1 — so we drop it too.)
    const hasKey = Boolean(item.phone) || Boolean(item.contact);
    const dupPhone = item.phone && seenPhones.has(item.phone);
    const dupContact = item.contact && seenContacts.has(item.contact);
    if (hasKey && !dupPhone && !dupContact) out.push(item);
    if (item.phone) seenPhones.add(item.phone);
    if (item.contact) seenContacts.add(item.contact);
  }
  return out;
};


const formatBillingAddress = addr => {
  if (!addr) return "";
  return `${addr.street || ""}, ${addr.city || ""}, ${addr.state || ""}, ${addr.postalCode || ""}, ${addr.country || ""}`
    .replace(/(^, )|(, $)/g, "")
    .trim();
};

const formatAssignedTo = assignedTo => {
  if (!Array.isArray(assignedTo)) return "";
  return assignedTo
    .map(a => a?.user?.name)
    .filter(name => typeof name === "string" && name.trim().length > 0)
    .join(", ");
};

router.get("/clients/report/:userId/download-csv", authenticate, async (req, res) => {
  const { userId } = req.params;
  const { from, to } = req.query;
  if (req.user.role !== "admin" && req.user._id.toString() !== userId) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format." });
    }

    const permissions = await ClientPermission.find({ userId }).populate({
      path: "clientId",
      model: "ClientData",
      match: { followUpDate: { $gte: fromDate, $lte: toDate } },
      options: { lean: true },
    }).lean();

    const clients = permissions
      .filter(p => p.clientId)
      .map(p => {
        const c = p.clientId;
        return {
          name: c.name,
          company: c.company,
          phone: c.phone,
          contact: c.contact,
          email: c.email,
          category: c.category,
          datatype: c.datatype,
          location: c.location,
          state: c.state,
          address: c.address,
          status: c.status,
          remarks: c.remarks,
          followUpDate: formatDate(c.followUpDate),
          followUpDateOne: formatDate(c.followUpDateOne),
          followUpDateTwo: formatDate(c.followUpDateTwo),
          followUpDateThree: formatDate(c.followUpDateThree),
          callingdate: formatDate(c.callingdate),
          billingAddress: formatBillingAddress(c.billingAddress),
          assignedTo: formatAssignedTo(c.assignedTo),
        };
      });

    const uniqueClients = dedupeByPhoneOrContact(clients);

    const parser = new Parser();
    const csv = parser.parse(uniqueClients);

    res.setHeader("Content-Disposition", "attachment; filename=clients.csv");
    res.setHeader("Content-Type", "text/csv");
    res.send(csv);
  } catch (err) {
    console.error("Error downloading client CSV:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// --------- /leads/report/download ---------
router.post("/leads/report/download", authenticate, requireRole("admin"), async (req, res) => {
  const { from, to, type, leads } = req.body;

  if (!["followUpDate", "createdAt"].includes(type)) {
    return res.status(400).json({ message: "Invalid date field type." });
  }
  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ message: "Leads array is missing or empty." });
  }

  try {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format." });
    }

    const filteredLeads = leads.filter(lead => {
      const rawDate = lead[type];
      if (!rawDate) return false;
      const dateValue = new Date(rawDate);
      return !isNaN(dateValue.getTime()) && dateValue >= fromDate && dateValue <= toDate;
    });

    const formattedLeads = filteredLeads.map(c => ({
      name: c.name || "",
      company: c.company || "",
      phone: c.phone || "",
      contact: c.contact || "",
      email: c.email || "",
      category: c.category || "",
      datatype: c.datatype || "",
      location: c.location || "",
      state: c.state || "",
      address: c.address || "",
      status: c.status || "",
      remarks: c.remarks || "",
      followUpDate: formatDate(c.followUpDate),
      followUpDateOne: formatDate(c.followUpDateOne),
      followUpDateTwo: formatDate(c.followUpDateTwo),
      followUpDateThree: formatDate(c.followUpDateThree),
      createdAt: formatDate(c.createdAt),
      callingdate: formatDate(c.callingdate),
      billingAddress: formatBillingAddress(c.billingAddress),
      assignedTo: formatAssignedTo(c.assignedTo),
    }));

    const uniqueLeads = dedupeByPhoneOrContact(formattedLeads);

    if (uniqueLeads.length === 0) {
      return res.status(400).json({ message: "No leads found in the given date range." });
    }

    const parser = new Parser();
    const csv = parser.parse(uniqueLeads);

    res.setHeader("Content-Disposition", "attachment; filename=clients.csv");
    res.setHeader("Content-Type", "text/csv");
    res.send(csv);
  } catch (err) {
    console.error("Error generating client report:", err.stack || err);
    res.status(500).json({ message: "Server Error" });
  }
});

// --------- /leads/report/download-by-leads ---------
router.post("/leads/report/download-by-leads", authenticate, async (req, res) => {
  try {
    const { leads } = req.body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ message: "No leads provided." });
    }

    const formattedLeads = leads.map(c => ({
      name: c.name,
      company: c.company,
      phone: c.phone,
      contact: c.contact,
      email: c.email,
      category: c.category,
      datatype: c.datatype,
      location: c.location,
      state: c.state,
      address: c.address,
      status: c.status,
      remarks: c.remarks,
      followUpDate: formatDate(c.followUpDate),
      followUpDateOne: formatDate(c.followUpDateOne),
      followUpDateTwo: formatDate(c.followUpDateTwo),
      followUpDateThree: formatDate(c.followUpDateThree),
      createdAt: formatDate(c.createdAt),
      callingdate: formatDate(c.callingdate),
      billingAddress: formatBillingAddress(c.billingAddress),
      assignedTo: formatAssignedTo(c.assignedTo),
    }));

    const uniqueLeads = dedupeByPhoneOrContact(formattedLeads);

    const parser = new Parser();
    const csv = parser.parse(uniqueLeads);

    res.setHeader("Content-Disposition", "attachment; filename=Selected_Leads_Report.csv");
    res.setHeader("Content-Type", "text/csv");
    res.send(csv);
  } catch (err) {
    console.error("Error generating leads report:", err.stack || err);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
