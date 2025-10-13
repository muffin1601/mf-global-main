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


function formatPhone(phone) {
  if (!phone) return "";
  let cleaned = phone.toString().replace(/\D/g, ""); 
  if (cleaned.startsWith("91") && cleaned.length > 10) {
    cleaned = cleaned.slice(2);
  }
  return cleaned.slice(-10); 
}


const fetchAndStoreLeads = async () => {
  let dbConnection;
  try {
    dbConnection = await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    const todayIST = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
    const fromDate = todayIST;
    const toDate = todayIST;
    
    const limit = 50;
    let page = 1;
    let total = 0;

    while (true) {
      const url = `https://www.tradeindia.com/utils/my_inquiry.html?userid=${TRADEINDIA_USERID}&profile_id=${TRADEINDIA_PROFILE_ID}&key=${TRADEINDIA_KEY}&from_date=${fromDate}&to_date=${toDate}&limit=${limit}&page_no=${page}`;

      console.log(`📡 Requesting TradeIndia leads (Page ${page})`);

      const res = await axios.get(url);
      const leads = Array.isArray(res.data) ? res.data : [];

      if (leads.length === 0) {
        console.log('✅ All leads fetched for the day.');
        break;
      }

      for (const lead of leads) {
        const leadPhone = formatPhone(lead.sender_mobile);
        const inquiryISODate = moment(lead.generated_date, "YYYY-MM-DD HH:mm:ss").toISOString();

        const mappedLead = {
          name: lead.sender_name || '',
          company: lead.sender_co || '',
          email: lead.sender_email || '',
          phone: leadPhone,
          contact: lead.sender_name || '',
          location: lead.sender_city || '',
          state: lead.sender_state || '',
          category: lead.product_name || 'General Inquiry',
          
          requirements: lead.message ? lead.message.replace(/[^\w\s]/gi, '').split(' ').slice(0, 100).join(' ') : '',
          remarks: lead.subject || lead.product_name || '',
          
          datatype: 'TradeIndia',
          status: 'New Lead',
          inquiryDate: inquiryISODate,

          billingAddress: {
            street: lead.sender_address || '',
            city: lead.sender_city || '',
            state: lead.sender_state || '',
            country: lead.sender_country || '',
          },
        };

        await ClientData.updateOne(
          { 
            phone: mappedLead.phone, 
            inquiryDate: mappedLead.inquiryDate
          },
          { $set: mappedLead },
          { upsert: true }
        );
      }

      total += leads.length;
      console.log(`✅ Page ${page} processed (${leads.length} leads saved/updated)`);
      page++;
    }

    console.log(`🎯 Total TradeIndia leads imported: ${total}`);
  } catch (err) {
    console.error('❌ Script failed:', err);
  } finally {
    if (dbConnection) {
      await mongoose.disconnect();
      console.log('🔗 MongoDB disconnected');
    }
  }
};

module.exports = fetchAndStoreLeads;