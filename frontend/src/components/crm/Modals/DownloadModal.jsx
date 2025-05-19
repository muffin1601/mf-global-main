import React, { useState } from 'react';
import './styles/DownloadModal.css';
import { toast } from 'react-toastify';
import { logActivity } from '../../../utils/logActivity';
import axios from 'axios';

const DownloadReportModal = ({ onClose, leads }) => {
  const [dateType, setDateType] = useState('followUpDate');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

   const user = JSON.parse(localStorage.getItem('user'));
   
  const handleDownload = () => {
    if (!fromDate || !toDate) {
      toast.warning("Please select both From and To dates.");
      return;
    }

    downloadCSVReport(dateType, fromDate, toDate, leads);
  };

  const downloadCSVReport = async (dateType, fromDate, toDate, leads) => {
    if (!Array.isArray(leads) || leads.length === 0) {
      toast.error("No leads available to include in the report.");
      return;
    }

    const formattedFromDate = new Date(fromDate).toISOString().split("T")[0];
    const formattedToDate = new Date(toDate).toISOString().split("T")[0];

    console.log("Sending download report with:", {
      fromDate: formattedFromDate,
      toDate: formattedToDate,
      dateType,
      leadsCount: leads.length,
    });

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/leads/report/download`,
        {
          from: formattedFromDate,
          to: formattedToDate,
          type: dateType,
          leads,
        },
        {
          responseType: "blob",
        }
      );

      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `LeadsReport_${formattedFromDate}_to_${formattedToDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Report downloaded successfully!");

      await logActivity("Downloaded Client Report", {
        fromDate: formattedFromDate,
        toDate: formattedToDate,
        type: dateType,
        leadsCount: leads.length,
      });
    } catch (error) {
      console.error("Error downloading CSV report:", error?.response?.data || error.message);
      toast.error(error?.response?.data?.message || "Failed to download report.");
    }
  };

  return (
    <div className="download-modal-overlay">
      <div className="download-modal">
        <h2>Download Report</h2>

        <div className="download-form-group">
          <label>Date Type:</label>
          <select className='downlaod-select' value={dateType} onChange={(e) => setDateType(e.target.value)} disabled = {user.role == 'user'}>
            <option value="followUpDate">Follow-up Date</option>
            <option value="createdAt">Created Date</option>
          </select>
        </div>

        <div className="download-form-group">
          <label>From Date:</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>

        <div className="download-form-group">
          <label>To Date:</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>

        <div className="download-modal-buttons">
          <button onClick={handleDownload}>Download</button>
          <button className="cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default DownloadReportModal;
