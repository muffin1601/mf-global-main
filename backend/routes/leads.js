const express = require('express');
const router = express.Router();
const ClientData = require('../models/ClientData'); 
require('dotenv').config();
const fetchAndStoreLeads = require('../scripts/fetchTradeIndiaLeadsToCRM');
const fetchLeadsFromIndiaMart = require('../scripts/fetchLeadsFromIndiaMart');

router.post('/coachinpromo/capture-lead', async (req, res) => {
 
  const apiKey = req.headers['x-api-key'];


  if (apiKey !== process.env.COACHINGPROMO_API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  try {
 
    const {
      name,
      companyname,
      email,
      location,
      phone,
      message,
    } = req.body;

  
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

    
    res.status(201).json({ message: 'Lead captured successfully', data: newClient });
  } catch (err) {
    console.error('Error capturing lead:', err.message);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
});

router.post('/printkee/capture-lead', async (req, res) => {
 
  const apiKey = req.headers['x-api-key'];

  
  if (apiKey !== process.env.COACHINGPROMO_API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  try {
    
    const {
      name,
      company,
      productCode,
      email,
      phone,
      requirements,
    } = req.body;

    
    const newClient = await ClientData.create({
      name: name,
      company: company,
      email: email,
      phone: phone,
      requirements: requirements || productCode,
      inquiryDate: new Date(),
      callStatus: "Not Called",
      status: "New Lead",
      datatype: "WebPortals",
    });

    
    res.status(201).json({ message: 'Lead captured successfully', data: newClient });
  } catch (err) {
    console.error('Error capturing lead:', err.message);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
});


module.exports = router;
