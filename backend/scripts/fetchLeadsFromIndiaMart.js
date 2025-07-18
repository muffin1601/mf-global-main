const axios = require("axios");
const ClientData = require("../models/ClientData");
require("dotenv").config({ path: "../.env" });

function formatDate(date) {
  const day = date.getDate().toString().padStart(2, "0");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");

  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

function extractOrderValue(message) {
  if (!message) return null;
  const match = message.match(/Order Value\s*:\s*Rs\.? ?([\d,]+(?:\s*-\s*[\d,]+)?)/i);
  return match ? match[1] : null;
}

const fetchLeadsFromIndiaMart = async () => {
  try {
    const key = process.env.INDIAMART_API_KEY;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 1);

    const formattedStart = encodeURIComponent(formatDate(startDate));
    const formattedEnd = encodeURIComponent(formatDate(endDate));

    const url = `https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_crm_key=${key}&start_time=${formattedStart}&end_time=${formattedEnd}`;

    console.log("📡 Fetching IndiaMART leads...");
    const { data } = await axios.get(url);
    console.log(url);
    console.log(data);

    if (data.CODE !== 200 || !Array.isArray(data.RESPONSE)) {
      throw new Error("Invalid response from IndiaMART");
    }

    const leads = data.RESPONSE;

    for (const lead of leads) {
      const leadData = {
        name: lead.SENDER_NAME,
        company: lead.SENDER_COMPANY,
        email: lead.SENDER_EMAIL,
        phone: lead.SENDER_MOBILE,
        location: lead.SENDER_CITY || lead.SENDER_STATE,
        category: "IndiaMart",
        requirements: lead.QUERY_MESSAGE,
        datatype: "IndiaMart",
        inquiryDate: lead.QUERY_TIME,
        address: lead.SENDER_ADDRESS,
        quantity: null,
        remarks: lead.QUERY_MCAT_NAME,
        callStatus: "Not Called",
        assignedTo: null,
        status: "New Lead",
        followUpDate: null,
        followUpDateOne: null,
        followUpDateTwo: null,
        followUpDateThree: null,
        fileName: null,
      };

      await ClientData.findOneAndUpdate(
        { email: lead.SENDER_EMAIL, inquiryDate: lead.QUERY_TIME }, // deduplication logic
        leadData,
        { upsert: true, new: true }
      );
    }

    console.log(`✅ Saved ${leads.length} leads to DB`);
  } catch (error) {
    console.error("❌ Error fetching/saving IndiaMART leads:", error.message);
  }
};

module.exports = fetchLeadsFromIndiaMart;

