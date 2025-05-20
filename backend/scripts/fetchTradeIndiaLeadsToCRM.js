const axios = require('axios');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const ClientData = require('../models/ClientData');
require('dotenv').config({ path: "../.env" });

const {
  TRADEINDIA_USERID,
  TRADEINDIA_PROFILE_ID,
  TRADEINDIA_KEY,
  MONGO_URI,
} = process.env;

const fetchAndStoreLeads = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    const toDate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
    const fromDate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");

    const limit = 50;
    let page = 1;
    let total = 0;

    while (true) {
      const url = `https://www.tradeindia.com/utils/my_inquiry.html?userid=${TRADEINDIA_USERID}&profile_id=${TRADEINDIA_PROFILE_ID}&key=${TRADEINDIA_KEY}&from_date=${fromDate}&to_date=${toDate}&limit=${limit}&page_no=${page}`;

      console.log(`📡 Requesting TradeIndia leads (Page ${page})`);
      console.log(`🔗 URL: ${url}`);

      const res = await axios.get(url);
      const leads = Array.isArray(res.data) ? res.data : [];

      if (leads.length === 0) {
        console.log('✅ All leads fetched.');
        break;
      }

      for (const lead of leads) {
        const mappedLead = {
          name: lead.sender_name || '',
          company: lead.sender_co || '',
          email: lead.sender_email || '',
          phone: lead.sender_mobile || '',
          contact: lead.sender_name || '',
          location: lead.sender_city || '',
          category: lead.subject || lead.product_name || '',
          requirements: lead.message ? lead.message.replace(/[^\w\s]/gi, '').split(' ').slice(0, 100).join(' ') : '',
          remarks: '',
          datatype: 'TradeIndia',
          status: 'New Lead',
          inquiryDate: lead.generated_date || '',
          address: `${lead.sender_city || ''}, ${lead.sender_state || ''}, ${lead.sender_country || ''}`.trim(),
        };

        await ClientData.updateOne(
          { phone: mappedLead.phone, inquiryDate: mappedLead.inquiryDate },
          { $set: mappedLead },
          { upsert: true }
        );
      }

      total += leads.length;
      console.log(`✅ Page ${page} saved (${leads.length} leads)`);
      page++;
    }

    console.log(`🎯 Total leads imported: ${total}`);
  } catch (err) {
    console.error('❌ Script failed:', err);
  } 
};

module.exports = fetchAndStoreLeads;