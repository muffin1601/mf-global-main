import React, { useState, useEffect } from "react";
import axios from "axios";


const ActivityLogModal = ({ users, onClose }) => {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const formatDetails = (details) => {
    if (!details) return "No details available";

    if (Array.isArray(details)) {
      return details
        .map(
          (item, index) =>
            `--- Item ${index + 1} ---\n` +
            Object.entries(item)
              .map(([k, v]) => `${k}: ${v}`)
              .join("\n")
        )
        .join("\n\n");
    }

    if (typeof details === "object") {
      return Object.entries(details)
        .map(([k, v]) => {
          if (Array.isArray(v)) {
            return (
              `${k}:\n` +
              v
                .map(
                  (obj, i) =>
                    `  - ${Object.entries(obj)
                      .map(([key, val]) => `${key}: ${val}`)
                      .join(", ")}`
                )
                .join("\n")
            );
          } else {
            return `${k}: ${v}`;
          }
        })
        .join("\n");
    }

    return String(details);
  };

  const fetchUserActivity = async () => {
    if (!selectedUserId) return alert("Please select a user.");
    if (!fromDate || !toDate) return alert("Please select both From and To dates.");

    const token = localStorage.getItem("token");
    if (!token) {
      alert("You must be logged in to view this page.");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/activity/user`,
        {
          params: {
            query: selectedUserId,
            from: fromDate,
            to: toDate,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setActivities(res.data);
    } catch (error) {
      console.error("Error fetching user activity:", error);
      alert("Failed to fetch activity logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="activitylog-modal-overlay">
    <div className="activitylog-modal-content activitylog-large-modal">
      <h3 className="activitylog-title">Track User Activity</h3>

      {/* Form Section */}
      <div className="activitylog-form-section">

        {/* User Selector */}
        <div className="activitylog-form-group">
          <label className="activitylog-label" htmlFor="userSelect">User:</label>
          <select
            id="userSelect"
            className="activitylog-select"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            required
          >
            <option value="">Select User</option>
            {users.map((u) => (
              <option key={u._id} value={u.userId}>
                {u.name || u.username || u.email}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div className="activitylog-form-group activitylog-date-range">
          <div className="activitylog-date-field">
            <label className="activitylog-label" htmlFor="fromDate">From:</label>
            <input
              id="fromDate"
              className="activitylog-date-input"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              required
            />
          </div>
          <div className="activitylog-date-field">
            <label className="activitylog-label" htmlFor="toDate">To:</label>
            <input
              id="toDate"
              className="activitylog-date-input"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="activitylog-modal-buttons">
          <button
            className="activitylog-fetch-btn"
            onClick={fetchUserActivity}
            disabled={loading}
          >
            {loading ? "Loading..." : "Fetch Activity"}
          </button>
          <button className="activitylog-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Results Section */}
      {activities.length > 0 && (
        <div className="activitylog-results">
          <table className="activitylog-activity-table">
            <thead>
              <tr>
                <th className="activitylog-th">Action</th>
                <th className="activitylog-th">Date/Time</th>
                <th className="activitylog-th">Details</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((log, i) => (
                <React.Fragment key={i}>
                  <tr>
                    <td className="activitylog-td">{log.action}</td>
                    <td className="activitylog-td">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="activitylog-td">
                      <button
                        className="activitylog-details-btn"
                        onClick={() =>
                          setExpandedIndex(i === expandedIndex ? null : i)
                        }
                      >
                        {expandedIndex === i ? "Hide Details" : "View Details"}
                      </button>
                    </td>
                  </tr>
                  {expandedIndex === i && (
                    <tr className="activitylog-details-row">
                      <td className="activitylog-details-td" colSpan="3">
                        <pre className="activitylog-log-details">
                          {formatDetails(log.details)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && activities.length === 0 && (
        <p className="activitylog-no-logs">No activity logs found.</p>
      )}
    </div>
  </div>
);
};
export default ActivityLogModal;

const css = `
.activitylog-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.44);
  display: flex;
  border-radius:20px;
  justify-content: center;
  align-items: center;
  z-index: 99999;
}

.activitylog-modal-content {
  width: 900px;
  max-width: calc(100% - 2rem);
  max-height: 90%;
  overflow-y: auto;
  backdrop-filter: blur(14px) saturate(120%);
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 1.6rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.34);
  font-family: 'Outfit', sans-serif;
}

.activitylog-title {
  font-size: 1.6rem;
  color: #313131;
  font-weight: 600;
  margin-bottom: 20px;
  text-align: center;
}

.activitylog-form-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.activitylog-form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.activitylog-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: #555;
}

.activitylog-select,
.activitylog-date-input {
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.15);
  font-size: 1rem;
  background: #fff;
  font-family: 'Outfit', sans-serif;
  transition: all 0.18s ease;
}

.activitylog-select:focus,
.activitylog-date-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0,123,255,0.2);
}

.activitylog-date-range {
  display: flex;
  gap: 1rem;
}

.activitylog-date-field {
  flex: 1;
  display: flex;
  font-family: 'Outfit', sans-serif;
  flex-direction: column;
}

.activitylog-modal-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1rem;
  margin-bottom: 1.5rem;
}

.activitylog-fetch-btn {
  padding: 0.55rem 1rem;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-family: 'Outfit', sans-serif;
  background: #007bff;
  color: #fff;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.activitylog-fetch-btn:hover:not(:disabled) {
  background: #0056b3;
}

.activitylog-fetch-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.activitylog-close-btn {
  font-size: 0.95rem;
  color: #fff;
  background: #dc3545;
  border: none;
  font-family: 'Outfit', sans-serif;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.activitylog-close-btn:hover {
  background: #c82333;
}

.activitylog-results {
  margin-top: 1rem;
}

.activitylog-activity-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Outfit', sans-serif;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 10px;
  overflow: hidden;
}

.activitylog-activity-table th,
.activitylog-activity-table td {
  padding: 0.7rem;
  font-size: 0.9rem;
  text-align: left;
  border-bottom: 1px solid rgba(0,0,0,0.08);
}

.activitylog-activity-table th {
  font-weight: 600;
  color: #333;
  background: #f8f9fa;
}

.activitylog-activity-table tbody tr:hover {
  background: #f1f1f1;
}

.activitylog-details-btn {
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  border: none;
  background: #ffc107;
  color: #333;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.activitylog-details-btn:hover {
  background: #e0a800;
}

.activitylog-details-row {
  background: #fafafa;
}

.activitylog-details-td {
  padding: 0.6rem 0.7rem;
  font-family: monospace;
}

.activitylog-log-details {
  white-space: pre-wrap;
  word-break: break-word;
}

.activitylog-no-logs {
  padding: 1.5rem;
  color: #555;
  text-align: center;
  background: #f8f9fa;
  border-radius: 10px;
  margin-top: 1rem;
  border: 1px dashed #ccc;
}

/* Responsive */
@media (max-width: 900px) {
  .activitylog-modal-content {
    width: 95%;
  }
}

@media (max-width: 640px) {
  .activitylog-modal-content {
    padding: 1rem;
    width: calc(100% - 2rem);
  }
  .activitylog-date-range {
    flex-direction: column;
  }
  .activitylog-modal-buttons {
    flex-direction: column;
    align-items: stretch;
  }
  .activitylog-fetch-btn,
  .activitylog-close-btn {
    width: 100%;
  }
  .activitylog-activity-table th,
  .activitylog-activity-table td {
    padding: 0.5rem;
    font-size: 0.8rem;
  }
}

`;

const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);
