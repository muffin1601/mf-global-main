import React, { useState, useEffect } from "react";
import axios from "axios";
import "./styles/ActivityLogModal.css";

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
