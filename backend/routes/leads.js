const express = require('express');
const router = express.Router();
const ClientData = require('../models/ClientData'); // Your Mongoose model
require('dotenv').config();
const fetchAndStoreLeads = require('../scripts/fetchTradeIndiaLeadsToCRM');
const fetchLeadsFromIndiaMart = require('../scripts/fetchLeadsFromIndiaMart');

router.post('/coachinpromo/capture-lead', async (req, res) => {
 
  const apiKey = req.headers['x-api-key'];

  // Check if the API key matches the one stored in the CRM's .env file
  if (apiKey !== process.env.COACHINGPROMO_API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  try {
    // Extract lead data from the request body
    const {
      name,
      companyname,
      email,
      location,
      phone,
      message,
    } = req.body;

    // Create a new lead (client) record
    const newClient = await ClientData.create({
      name: name,
      company: companyname,
      email: email,
      phone: phone,
      location: location,
      requirements: message,
      inquiryDate: new Date(),
      callStatus: "Not Called",
      datatype: "WebPortals",
    });

    // Respond with success message and client data
    res.status(201).json({ message: 'Lead captured successfully', data: newClient });
  } catch (err) {
    console.error('Error capturing lead:', err.message);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
});

router.post('/printkee/capture-lead', async (req, res) => {
 
  const apiKey = req.headers['x-api-key'];

  // Check if the API key matches the one stored in the CRM's .env file
  if (apiKey !== process.env.COACHINGPROMO_API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  try {
    // Extract lead data from the request body
    const {
      name,
      company,
      email,
      phone,
      requirements,
    } = req.body;

    // Create a new lead (client) record
    const newClient = await ClientData.create({
      name: name,
      company: company,
      email: email,
      phone: phone,
      requirements: requirements,
      inquiryDate: new Date(),
      callStatus: "Not Called",
      status:"New Lead",
      datatype: "WebPortals",
    });

    // Respond with success message and client data
    res.status(201).json({ message: 'Lead captured successfully', data: newClient });
  } catch (err) {
    console.error('Error capturing lead:', err.message);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
});

// Route to fetch and store leads
// router.get('/tradeIndia/fetch-leads', async (req, res) => {
//   try {
//     // Call the function to fetch and store leads
//     await fetchAndStoreLeads();
//     res.status(200).json({ message: 'Leads fetched and stored successfully' });
//   } catch (error) {
//     console.error("❌ Error fetching and storing leads:", error.message);
//     res.status(500).json({ message: 'Error fetching and storing leads', error: error.message });
//   }
// });

// router.get('/fetch-indiamart-leads', async (req, res) => {
//   try {
//     // Call the function to fetch and store leads
//     await fetchLeadsFromIndiaMart();
//     res.status(200).json({ message: 'IndiaMART leads fetched and stored successfully' });
//   } catch (error) {
//     console.error("❌ Error fetching and storing IndiaMART leads:", error.message);
//     res.status(500).json({ message: 'Error fetching and storing leads', error: error.message });
//   }
// });

module.exports = router;
