// DashboardCards.jsx
import React, { useEffect, useState } from "react";
import "../../styles/crm/ToDoPerformance.css";

const ToDoPerformance = () => {
    const [sales, setSales] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState("Today");
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL}/sales-performance`)
            .then(res => res.json())
            .then(setSales);

        fetch(`${import.meta.env.VITE_API_URL}/tasks`)
            .then(res => res.json())
            .then(setTasks);
    }, []);

    const statusIcon = status =>
        status === "done" ? "✅" : status === "pending" ? "⏳" : "🕐";

    const handleSelectPeriod = (period) => {
        setSelectedPeriod(period);
        setShowDropdown(false);
        // Optional: add logic to refetch or filter data
    };

    return (
        <div className="dashboard-container">
            {/* Sales Performance */}
            <div className="sales-card">
                <div className="sales-card-header" style={{ position: "relative" }}>
                    Sales Performance{" "}
                    <span
                        className="sales-dropdown"
                        onClick={() => setShowDropdown(!showDropdown)}
                        style={{ cursor: "pointer", marginLeft: "10px" }}
                    >
                        {selectedPeriod} ▼
                    </span>
                    {showDropdown && (
                        <div style={dropdownStyle}>
                            {["Today", "Monthly", "Yearly"].map(option => (
                                <div
                                    key={option}
                                    onClick={() => handleSelectPeriod(option)}
                                    style={dropdownItemStyle}
                                >
                                    {option}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <table className="sales-table">
                    <thead>
                        <tr>
                            <th className="sales-header-sno">S.No.</th>
                            <th className="sales-header-representative">Representative</th>
                            <th className="sales-header-deals">Deals Closed</th>
                            <th className="sales-header-leads">Leads</th>
                            <th className="sales-header-rate">Rate (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sales.map((rep, i) => (
                            <tr key={i} className="sales-row">
                                <td className="sales-data-sno">{i + 1}</td>
                                <td className="sales-data-representative">{rep.name}</td>
                                <td className="sales-data-deals">{rep.deals}</td>
                                <td className="sales-data-leads">{rep.leads}</td>
                                <td className="sales-data-rate">
                                    {rep.rate.toFixed(1)}%
                                    <span className={`sales-change-icon ${rep.change === "up" ? "sales-up" : rep.change === "down" ? "sales-down" : ""}`}>
                                        {rep.change === "up" ? " ▲" : rep.change === "down" ? " ▼" : ""}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Tasks List */}
            <div className="tasks-card">
                <div className="tasks-card-header">
                    Tasks List
                    <div className="tasks-buttons">
                    <button className="tasks-tab tasks-tab-active">Today</button>
                    <button className="tasks-tab">Upcoming</button>
                    </div>
                </div>
                <ul className="tasks-list">
                    {tasks.map((task, i) => (
                        <li key={i} className="task-item">
                            <span className="task-status-icon">{statusIcon(task.status)}</span>
                            <div className="task-details">
                                <div className="task-title">{task.title}</div>
                                <div className="task-description">{task.description}</div>
                            </div>
                            <div className="task-actions">
                                <button className="task-edit-button">✏️</button>
                                <button className="task-delete-button">🗑️</button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const dropdownStyle = {
    position: "absolute",
    top: "100%",
    right: "10px",
    backgroundColor: "white",
    border: "1px solid #ccc",
    boxShadow: "0px 2px 8px rgba(0,0,0,0.15)",
    zIndex: 10,
    width: "120px",
    borderRadius: "4px",
};

const dropdownItemStyle = {
    padding: "8px 12px",
    cursor: "pointer",
    borderBottom: "1px solid #eee",
    backgroundColor: "#fff",
    fontSize: "14px",
    transition: "background 0.2s",
};

export default ToDoPerformance;
