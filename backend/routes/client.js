const express = require("express");
const router = express.Router();
const Client = require("../models/ClientData");
const { ObjectId } = require('mongodb'); 
const ClientPermission = require("../models/ClientPermission"); 


router.post("/add-client", async (req, res) => {
  try {
    const { contact, phone } = req.body;

    
    const removeIcons = (value) =>
      typeof value === "string" ? value.replace(/^[^\w\s]*\s*/, "").trim() : value;

    req.body.datatype = removeIcons(req.body.datatype);
    req.body.status = removeIcons(req.body.status);
    req.body.callStatus = removeIcons(req.body.callStatus);

    
    const existingClient = await Client.findOne({
      $or: [
        contact && { contact },
        phone && { phone }
      ].filter(Boolean)
    });

    if (existingClient) {
      return res.status(400).json({ error: "Client already exists" });
    }

    const client = new Client(req.body);
    await client.save();

    res.status(201).json({ message: "Client added successfully" });
  } catch (error) {
    console.error("Error saving client:", error);
    res.status(500).json({ error: "Failed to add client" });
  }
});


router.get('/check-duplicate-phone', async (req, res) => {
  const { phone } = req.query;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    const existingUser = await Client.findOne({ phone });

    if (existingUser) {
      res.json({ exists: true, user: existingUser });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error('Error checking phone:', error);
    res.status(500).json({ error: 'Server error' });
  }
});



router.get("/check-duplicate-contact", async (req, res) => {
  const { contact } = req.query;

  if (!contact) {
    return res.status(400).json({ message: "Contact number is required" });
  }

  try {
    const existingContactUser = await Client.findOne({ contact });

    if (existingContactUser) {
      return res.json({ exists: true, user: existingContactUser });
    }
    return res.json({ exists: false });
  } catch (error) {
    console.error("Error checking contact duplicacy:", error);
    return res.status(500).json({ message: "Error checking duplicacy", error: error.message });
  }
});



router.post("/clients/delete", async (req, res) => {
  const { ids } = req.body; 
  try {
    await Client.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: "Clients deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete clients", error });
  }
});



const removeIcons = (value) => {
  return typeof value === "string"
    ? value.replace(/^[^\w]*\s*/, "").trim()
    : value;
};


const buildFollowUpDateFields = (client, newFollowUpDate) => {
  if (!newFollowUpDate) return {};

  const dateObj = new Date(newFollowUpDate);
  const { followUpDateOne, followUpDateTwo, followUpDateThree } = client;

  if (!followUpDateOne) return { followUpDate: dateObj, followUpDateOne: dateObj };
  if (!followUpDateTwo) return { followUpDate: dateObj, followUpDateTwo: dateObj };
  if (!followUpDateThree) return { followUpDate: dateObj, followUpDateThree: dateObj };

  const oldest = Math.min(
    new Date(followUpDateOne).getTime(),
    new Date(followUpDateTwo).getTime(),
    new Date(followUpDateThree).getTime()
  );

  if (new Date(followUpDateOne).getTime() === oldest) {
    return { followUpDate: dateObj, followUpDateOne: dateObj };
  } else if (new Date(followUpDateTwo).getTime() === oldest) {
    return { followUpDate: dateObj, followUpDateTwo: dateObj };
  } else {
    return { followUpDate: dateObj, followUpDateThree: dateObj };
  }
};

router.post("/save-all-updates", async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: "No updates to apply" });
    }

    const updatePromises = updates.map(async (update) => {
      try {
        const {
          id,
          name,
          email,
          phone,
          contact,
          remarks,
          requirements,
          location,
          state,
          category,
          datatype,
          callStatus,
          followUpDate,
          assignedTo,
          additionalContacts,
          status,
          inquiryDate,
          address,
        } = update;

        if (!id && !phone && !contact) return null;

        const query = id
          ? { _id: new ObjectId(id) }
          : { $or: [{ phone }, { contact }] };

        const client = await Client.findOne(query);
        if (!client) return null;

       
        const cleanDatatype = removeIcons(datatype);
        const cleanCallStatus = removeIcons(callStatus);
        const cleanStatus = removeIcons(status);

        
        let assignedToTransformed = [];

        if (Array.isArray(assignedTo) && assignedTo.length > 0) {
          assignedToTransformed = assignedTo
            .filter(
              (a) =>
                a &&
                a.user &&
                typeof a.user._id === "string" &&
                a.user._id.trim() !== "" &&
                typeof a.user.name === "string" &&
                a.user.name.trim() !== ""
            )
            .map((a) => {
              try {
                return {
                  user: {
                    _id: new ObjectId(a.user._id),
                    name: a.user.name,
                  },
                  permissions: {
                    view: !!a.permissions?.view,
                    update: !!a.permissions?.update,
                    delete: !!a.permissions?.delete,
                  },
                };
              } catch (err) {
                
                return null;
              }
            })
            .filter(Boolean); 
        } else {
          assignedToTransformed = []; 
        }

       
        const followUpFields = buildFollowUpDateFields(client, followUpDate);

       
        const updateFields = {
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
          ...(contact !== undefined && { contact }),
          ...(remarks !== undefined && { remarks }),
          ...(requirements !== undefined && { requirements }),
          ...(location !== undefined && { location }),
          ...(state !== undefined && { state }),
          ...(category !== undefined && { category }),
          ...(cleanDatatype && { datatype: cleanDatatype }),
          ...(cleanCallStatus && { callStatus: cleanCallStatus }),
          ...(cleanStatus && { status: cleanStatus }),
          ...(inquiryDate !== undefined && { inquiryDate }),
          ...(address !== undefined && { address }),
          assignedTo: assignedToTransformed,
          additionalContacts: Array.isArray(additionalContacts)
            ? additionalContacts
            : client.additionalContacts,
          ...followUpFields,
        };

        return Client.findByIdAndUpdate(client._id, { $set: updateFields }, {
          new: true,
          runValidators: true,
        });
      } catch (innerErr) {
        console.error("Failed to process individual update:", innerErr.message);
        return null;
      }
    });

    const results = await Promise.all(updatePromises);
    const updatedCount = results.filter(Boolean).length;

    res.status(200).json({
      message: "Updates applied successfully",
      updatedClients: updatedCount,
    });
  } catch (error) {
    console.error("Error in /save-all-updates:", error.message);
    res.status(500).json({ error: "Failed to save updates" });
  }
});

module.exports = router;
