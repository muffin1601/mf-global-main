import React, { useState } from "react";

import { toast } from "react-toastify";
import CustomToast from "../CustomToast"; 
import { logActivity } from "../../../utils/logActivity";
import axios from "axios";

const DownloadReportModal = ({ onClose, leads }) => {
  const [dateType, setDateType] = useState("followUpDate");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const user = JSON.parse(localStorage.getItem("user"));

  const handleDownload = () => {
    if (!fromDate || !toDate) {
      return toast(
        <CustomToast
          type="warning"
          title="Missing Dates"
          message="Please select both From and To dates."
        />
      );
    }

    downloadCSVReport(dateType, fromDate, toDate, leads);
  };

  const downloadCSVReport = async (dateType, fromDate, toDate, leads) => {
    if (!Array.isArray(leads) || leads.length === 0) {
      return toast(
        <CustomToast
          type="error"
          title="No Leads Found"
          message="There are no leads to include in this report."
        />
      );
    }

    const formattedFromDate = new Date(fromDate).toISOString().split("T")[0];
    const formattedToDate = new Date(toDate).toISOString().split("T")[0];

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
      link.setAttribute(
        "download",
        `LeadsReport_${formattedFromDate}_to_${formattedToDate}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast(
        <CustomToast
          type="success"
          title="Report Downloaded"
          message="The leads report has been downloaded successfully."
        />
      );

      await logActivity("Downloaded Client Report", {
        fromDate: formattedFromDate,
        toDate: formattedToDate,
        type: dateType,
        leadsCount: leads.length,
      });
    } catch (error) {
      console.error(
        "Error downloading CSV report:",
        error?.response?.data || error.message
      );
      toast(
        <CustomToast
          type="error"
          title="Download Failed"
          message={error?.response?.data?.message || "Failed to download report."}
        />
      );
    }
  };

  return (
    <div className="downloadreport-modal-overlay">
      <div className="downloadreport-modal-container">
        <div className="downloadreport-modal-header">
          <h3 className="downloadreport-modal-title">Download Report</h3>
          <button
            className="downloadreport-close-btn"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="downloadreport-form-group">
          <label className="downloadreport-label">Date Type</label>
          <select
            className="downloadreport-select"
            value={dateType}
            onChange={(e) => setDateType(e.target.value)}
            disabled={user.role === "user"}
          >
            <option value="followUpDate">Follow-up Date</option>
            <option value="createdAt">Created Date</option>
          </select>
        </div>

        <div className="downloadreport-form-group">
          <label className="downloadreport-label">From Date</label>
          <input
            type="date"
            className="downloadreport-input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className="downloadreport-form-group">
          <label className="downloadreport-label">To Date</label>
          <input
            type="date"
            className="downloadreport-input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <div className="downloadreport-footer-buttons">
          <button
            onClick={handleDownload}
            className="downloadreport-btn-save"
          >
            Download
          </button>
          <button
            className="downloadreport-btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadReportModal;

const css = `
.downloadreport-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  justify-content: center;
  border-radius: 20px;
  align-items: center;
  z-index: 1200;
}

.downloadreport-modal-container {
  background: rgba(255, 255, 255, 0.84);
  border-radius: 12px;
  width: 420px;
  max-width: 90%;
  font-family: 'Outfit', sans-serif;
  padding: 1.5rem;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.2);
  animation: fadeInScale 0.25s ease;
}

.downloadreport-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  font-family: 'Outfit', sans-serif;
}

.downloadreport-modal-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: #333;
}

.downloadreport-close-btn {
  border: none;
  background: transparent;
  font-size: 1.2rem;
  cursor: pointer;
  color: #777;
  transition: color 0.2s ease;
}

.downloadreport-close-btn:hover {
  color: #222;
}

.downloadreport-form-group {
  margin-bottom: 1rem;
  display: flex;
  font-family: 'Outfit', sans-serif;
  flex-direction: column;
}

.downloadreport-label {
  font-size: 0.95rem;
  margin-bottom: 0.4rem;
  color: #444;
}

.downloadreport-input,
.downloadreport-select {
  padding: 0.6rem 0.8rem;
  font-family: 'Outfit', sans-serif;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 0.95rem;
}

.downloadreport-footer-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.8rem;
  margin-top: 1rem;
}

.downloadreport-btn-save {
  background: #28a745;
  color: #fff;
  font-family: 'Outfit', sans-serif;
  border: none;
  padding: 0.65rem 1.2rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s ease;
}

.downloadreport-btn-save:hover {
  background: #218838;
}

.downloadreport-btn-cancel {
  background: #ddd;
  border: none;
  font-family: 'Outfit', sans-serif;
  padding: 0.65rem 1.2rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s ease;
}

.downloadreport-btn-cancel:hover {
  background: #bbb;
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
`;
const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);
