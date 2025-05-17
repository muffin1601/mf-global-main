import React, { useEffect, useState } from "react";
import axios from "axios";

import { logActivity } from "../../utils/logActivity";

const AssignedClients = () => {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedClientIds, setSelectedClientIds] = useState([]);

    const [callStatusUpdates, setCallStatusUpdates] = useState({});
    const [categories, setCategories] = useState([]);
    const [locations, setLocations] = useState([]);
    const [datatypes, setDatatypes] = useState([]);
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [clientNumber, setClientNumber] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 20;
    const indexOfLastClient = currentPage * rowsPerPage;
    const indexOfFirstClient = indexOfLastClient - rowsPerPage;
    const currentClients = clients.slice(indexOfFirstClient, indexOfLastClient);
    const totalPages = Math.ceil(clients.length / rowsPerPage);
    const [filters, setFilters] = useState({
        category: "",
        location: "",
        datatype: ""
      });

    const loggedInUser = JSON.parse(localStorage.getItem("user"));
    if (!loggedInUser?._id) {
        return <p>Error: User ID is required!</p>;
    }
    const userId = loggedInUser._id;
    const userName = loggedInUser.name;

    useEffect(() => {
        axios.get(`${import.meta.env.VITE_API_URL}/clients/meta`).then((res) => {
          setCategories(res.data.categories);
          setLocations(res.data.locations);
          setDatatypes(res.data.datatypes);
        });
      }, []);
      
      
      
      const fetchClients = async () => {
        try {
          const query = new URLSearchParams(filters).toString();
          const res = await axios.get(
            `${import.meta.env.VITE_API_URL}/clients/assigned/${userId}/filtered?${query}`
          );
          setClients(res.data);
          setClientNumber(res.data.length);
          setCurrentPage(1); // Reset to page 1 on new search
        } catch (error) {
          console.error("Error fetching filtered clients", error);
        }
      };
      

    const fetchAssignedClients = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/clients/assigned/${userId}`);
            setClients(res.data);
            setClientNumber(res.data.length);
            setCurrentPage(1); // Reset to page 1 on new fetch
        } catch (error) {
            console.error("Error fetching assigned clients", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAssignedClients();
    }, [userId]);

    const downloadCSVReport = async () => {
        if (!fromDate || !toDate) {
          alert("Please select both From and To dates.");
          return;
        }
      
        const formattedFromDate = new Date(fromDate).toISOString().split("T")[0];
        const formattedToDate = new Date(toDate).toISOString().split("T")[0];
      
        try {
          const res = await axios.get(
            `${import.meta.env.VITE_API_URL}/clients/report/${userId}/download-csv`,
            {
              params: { from: formattedFromDate, to: formattedToDate },
              responseType: "blob",
            }
          );
      
          const blob = new Blob([res.data], { type: "text/csv" });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute(
            "download",
            `UserReport_${userName}_${formattedFromDate}_to_${formattedToDate}.csv`
          );
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
      
          await logActivity("Downloaded Client Report", {
            fromDate: formattedFromDate,
            toDate: formattedToDate,
          });
        } catch (error) {
          console.error("Error downloading CSV report:", error);
          alert("Failed to download report. Please try again.");
        }
      };
      
      
      

    const handleInputChange = (clientId, field, value) => {
        setClients(prev =>
            prev.map(client =>
                client._id === clientId ? { ...client, [field]: value } : client
            )
        );
    };

    const handleSelectClient = (clientId) => {
        setSelectedClientIds(prev =>
            prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
        );
    };
    
      
      const handleSelectAll = () => {
        const allClientIds = clients.map(client => client._id);
        if (selectedClientIds.length === clients.length) {
            setSelectedClientIds([]);
        } else {
            setSelectedClientIds(allClientIds);
        }
    };
    
      
    const sendWhatsAppMessages = async () => {
        const selectedClients = clients.filter(client => selectedClientIds.includes(client._id));
        const phones = selectedClients.map(c => c.phone).filter(Boolean);
      
        if (phones.length === 0) {
          alert("No clients selected for WhatsApp.");
          return;
        }
      
        alert(`Sending WhatsApp messages to: ${phones.join(", ")}`);
        await logActivity("Sent WhatsApp Messages", { recipients: phones });
      };
      
      const sendEmails = async () => {
        const selectedClients = clients.filter(client => selectedClientIds.includes(client._id));
        const emails = selectedClients.map(c => c.email).filter(Boolean);
      
        if (emails.length === 0) {
          alert("No clients selected for Email.");
          return;
        }
      
        alert(`Sending Emails to: ${emails.join(", ")}`);
        await logActivity("Sent Emails", { recipients: emails });
      };
      
    function formatDate(dateString) {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toISOString().split("T")[0]; // "YYYY-MM-DD"
      }
      

      const saveAllUpdates = async () => {
        // Filter clients based on selectedClientIds
        const updates = clients
          .filter(client => selectedClientIds.includes(client._id)) // Select clients using _id
          .map(client => {
            const updatedFields = callStatusUpdates[client.phone] || {}; // Use phone for tracking updates
      
            return {
              id: client._id,
              name: client.name,
              email: client.email,
              phone: client.phone,
              contact: client.contact,
              remarks: client.remarks,
              requirements: client.requirements,
              location: client.location,
              datatype: client.datatype,
              category: client.category,
              callStatus: updatedFields.callStatus ?? client.callStatus,
              followUpDate: updatedFields.followUpDate ?? client.followUpDate,
              clientId: client.clientId,
              userId: client.userId,
              permission: client.permission
            };
          });
      
        if (updates.length === 0) {
          alert("No clients selected or no changes to save.");
          return;
        }
      
        try {
          const res = await axios.post(`${import.meta.env.VITE_API_URL}/save-all-updates`, { updates });
          console.log("Updates saved:", res.data);
      
          setCallStatusUpdates({});
          setSelectedClientIds([]); // Clear the selected clients list
          await logActivity("Saved Selected Client Updates", { updates });
      
          alert("Selected client updates saved successfully.");
          fetchAssignedClients(); // Refresh data
        } catch (error) {
          console.error("Error saving updates:", error.response || error.message);
          alert(`Error saving updates: ${error.response?.data?.message || error.message}`);
        }
      };
      
    
    if (loading) return <p>Loading...</p>;

    return (
        <>
           
            <div className="ac-container">
                <h2 className="ac-title">My Assigned Data</h2>
                <div className="search-inputs">
                    <select
                        className="category-select"
                        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    >
                        <option value="">All Categories</option>
                        {categories.map((cat) => (
                            <option value={cat} key={cat}>{cat}</option>
                        ))}
                    </select>
                    <select
                        className="datatype-select"
                        onChange={(e) => setFilters({ ...filters, datatype: e.target.value })}
                    >
                        <option value="">All Datatypes</option>
                        {datatypes.map((type) => (
                            <option value={type} key={type}>{type}</option>
                        ))}
                    </select>

                    <select
                        className="location-select"
                        onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                    >
                        <option value="">All Locations</option>
                        {locations.map((loc) => (
                            <option value={loc} key={loc}>{loc}</option>
                        ))}
                    </select>
                    <button className="client-btn" onClick={fetchClients}>Search</button>
                </div>
                <div className="ac-count">Total Clients: {clientNumber}</div>
                <div className="container-2">
                    <div className="ac-selection-count">
                        Selected: {selectedClientIds.length}
                    </div>
                    <div className="report-filter-container">
                    <label>
                        From:{" "}
                        <input
                            className="input-date"
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                        />
                    </label>
                    <label>
                        To:{" "}
                        <input
                        className="input-date"
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                        />
                    </label>
                    
                    <button className="download-btn"onClick={downloadCSVReport}>
                        Get Report
                    </button></div>
                </div>

                <table className="ac-table">
                    <thead>
                        <tr>
                            <th><input
                                type="checkbox"
                                checked={selectedClientIds.length === clients.length && clients.length > 0}
                                onChange={handleSelectAll}
                            /></th>                            
                            <th>Name</th>
                            <th>Company</th>
                            <th>Phone</th>
                            <th>Contact</th>
                            <th>Email</th>
                            <th>Location</th>
                            <th>Datatype</th>
                            <th>Requirements</th>
                            <th>Category</th>
                            <th>Call Status</th>
                            <th>Remarks</th>
                            <th>Follow-up Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentClients.map(client => (
                            <tr key={client._id}>
                                <td><input
                                    className="input-checkbox"
                                    type="checkbox"
                                    checked={selectedClientIds.includes(client._id)}
                                    onChange={() => handleSelectClient(client._id)}
                                /></td>
                                <td>{client.permission === "update" ? <input type="text" className="input" value={client.name || ""} onChange={(e) => handleInputChange(client._id, "name", e.target.value)} /> : client.name}</td>
                                <td>{client.company}</td>
                                <td>{client.permission === "update" ? <input type="text"className="input" value={client.phone || ""} onChange={(e) => handleInputChange(client._id, "phone", e.target.value)} /> : client.phone}</td>
                                <td>{client.permission === "update" ? <input type="text" className="input" value={client.contact || ""} onChange={(e) => handleInputChange(client._id, "contact", e.target.value)} /> : client.contact}</td>
                                <td>{client.permission === "update" ? <input type="email" className="input"value={client.email || ""} onChange={(e) => handleInputChange(client._id, "email", e.target.value)} /> : client.email}</td>
                                <td>{client.location}</td>
                                <td>{client.datatype}</td>
                                <td><input type="text" className="input" value={client.requirements || ""} onChange={(e) => handleInputChange(client._id, "requirements", e.target.value)} /></td>
                                <td><input type="text" className="input" value={client.category || ""} onChange={(e) => handleInputChange(client._id, "category", e.target.value)} /></td>
                                <td>
                                    <select value={client.callStatus} className="select-call" onChange={(e) => handleInputChange(client._id, "callStatus", e.target.value)}>
                                        <option value="">All</option>
                                        <option value="Not Called">Not Called</option>
                                        <option value="Ring">📞 Ring</option>
                                        <option value="Not Interested">❌ Not Interested</option>
                                        <option value="Available After One Month">⏳ Available After One Month</option>
                                        <option value="Converted">✅ Converted</option>
                                        <option value="Follow-up Required">📆 Follow-up Required</option>
                                        <option value="Wrong Number">🚫 Wrong Number</option>
                                    </select>
                                </td>
                                <td><input type="text"  className="input" value={client.remarks || ""} onChange={(e) => handleInputChange(client._id, "remarks", e.target.value)} /></td>
                                <td>
                                <input
                                    type="date"
                                    className="input"
                                    value={
                                        formatDate(
                                            callStatusUpdates[client.phone]?.followUpDate ??
                                            client.followUpDate
                                        )
                                    }
                                    onChange={(e) =>
                                        setCallStatusUpdates((prev) => ({
                                            ...prev,
                                            [client.phone]: {
                                                ...prev[client.phone],
                                                followUpDate: e.target.value,
                                            },
                                        }))
                                    }
                                /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {/* Pagination Controls */}
                {clients.length > rowsPerPage && (
                    <div className="pagination-controls">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((prev) => prev - 1)}
                            className="pagination-btn"
                        >
                            ⬅ Prev
                        </button>
                        <span className="pagination-info">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((prev) => prev + 1)}
                            className="pagination-btn"
                        >
                            Next ➡
                        </button>
                    </div>
                )}

                <div className="ac-btn-container">
                    <div className="ac-left-btn">
                        <button disabled={selectedClientIds.length === 0} className="btn-wa" onClick={sendWhatsAppMessages}>Send WhatsApp</button>
                        <button disabled={selectedClientIds.length === 0} className="btn-email" onClick={sendEmails}>Send Emails</button>
                    </div>
                    <button disabled={selectedClientIds.length === 0} className="btn-save" onClick={saveAllUpdates}>Save Changes</button>
                </div>
            </div>
        </>
    );
};

export default AssignedClients;
