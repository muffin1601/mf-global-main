import React, { useEffect, useState } from "react";
import axios from "axios";

import { logActivity } from "../../utils/logActivity"; // Adjust the import path as necessary

const AssignWork = () => {
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [filters, setFilters] = useState({ category: "", location: "", callStatus: "", assigned: "all" });
  const [permissions, setPermissions] = useState({ view: false, update: false });
  const [selectedClients, setSelectedClients] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [Datatypes, setDatatypes] = useState([]);
  // const [bulkPermission, setBulkPermission] = useState("view");
  const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 20;
  
    const indexOfLastClient = currentPage * rowsPerPage;
    const indexOfFirstClient = indexOfLastClient - rowsPerPage;
    const currentClients = clients.slice(indexOfFirstClient, indexOfLastClient);
    const totalPages = Math.ceil(clients.length / rowsPerPage);

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/clients/meta`).then((res) => {
      setCategories(res.data.categories);
      setLocations(res.data.locations);
      setDatatypes(res.data.datatypes);
    });
  }, []);

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/users`).then((res) => setUsers(res.data));
  }, []);

  const fetchClients = () => {
    axios.post(`${import.meta.env.VITE_API_URL}/clients/filter`, filters).then((res) => {
      setClients(res.data);
    });
  };

  const handleAssign = () => {
    const permissionType = permissions.update ? "update" : permissions.view ? "view" : "none";
    axios.post(`${import.meta.env.VITE_API_URL}/clients/assign`, {
      userId: selectedUser,
      clientIds: selectedClients,
      permissions: permissionType
    }).then(() => {
      alert("Clients Assigned!");
      fetchClients();
    });
  };

  const handleUnassign = async () => {
  if (!selectedUser) return alert("Select a user first.");
  if (selectedClients.length === 0) return alert("Select clients to unassign.");

  try {
    await axios.post(`${import.meta.env.VITE_API_URL}/clients/unassign`, {
      userId: selectedUser,
      clientIds: selectedClients,
    });
    alert("Clients unassigned.");
    fetchClients();
    setSelectedClients([]);
  } catch (err) {
    console.error("Error unassigning clients", err);
    alert("Failed to unassign clients.");
  }
};

const handleTogglePermission = async () => {
  if (!selectedUser) return alert("Select a user first.");
  if (selectedClients.length === 0) return alert("Select clients first.");

  const permissionType = permissions.update ? "view" : "update"; // toggle logic

  try {
    await axios.put(`${import.meta.env.VITE_API_URL}/clients/toggle-permission`, {
      clientIds: selectedClients,
      userId: selectedUser,
    });
    alert(`Permission changed to ${permissionType}`);
    fetchClients();
    setPermissions({ view: false, update: false });
    setSelectedClients([]);
  } catch (err) {
    console.error("Error updating permissions", err);
    alert("Failed to update permissions.");
  }
};


  const toggleClientSelection = (id) => {
    setSelectedClients((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (selectAll) {
      setSelectedClients(clients.map((c) => c._id));
    } else {
      setSelectedClients([]);
    }
  }, [selectAll]);

  return (
    <div className="task-assign-container">
      <Navbar />
      <GoBackButton />
      <h2 className="task-assign-title">Assign User Permissions</h2>
      <div className="task-assign-filters">
        <select className="task-assign-select" onChange={(e) => setSelectedUser(e.target.value)}>
          <option>Select User</option>
          {users.map((u) => (
            <option value={u._id} key={u._id}>{u.name}</option>
          ))}
        </select>

        <label className="task-assign-checkbox-label">
          <input type="checkbox" onChange={(e) => setPermissions({ ...permissions, view: e.target.checked })}/> View
        </label>
        <label className="task-assign-checkbox-label">
          <input type="checkbox" onChange={(e) => setPermissions({ ...permissions, update: e.target.checked })}/> Update
        </label>

        <select className="task-assign-select" onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option value={cat} key={cat}>{cat}</option>
          ))}
        </select>
        <select className="task-assign-select" onChange={(e) => setFilters({ ...filters, datatype: e.target.value })}>
          <option value="">All Datatypes</option>
          {Datatypes.map((type) => (
            <option value={type} key={type}>{type}</option>
          ))}
        </select>

        <select className="task-assign-select" onChange={(e) => setFilters({ ...filters, location: e.target.value })}>
          <option value="">All Locations</option>
          {locations.map((loc) => (
            <option value={loc} key={loc}>{loc}</option>
          ))}
        </select>

        <select className="task-assign-select" onChange={(e) => setFilters({ ...filters, callStatus: e.target.value })}>
          <option value="">All Status</option>
          <option value="Not Called">Not Called</option>
          <option value="Ring">📞 Ring</option>
          <option value="Not Interested">❌ Not Interested</option>
          <option value="Available After One Month">⏳ Available After One Month</option>
          <option value="Converted">✅ Converted</option>
          <option value="Follow-up Required">📆 Follow-up Required</option>
          <option value="Wrong Number">🚫 Wrong Number</option>
        </select>

        <select className="task-assign-select" onChange={(e) => setFilters({ ...filters, assigned: e.target.value })}>
          <option value="all">All</option>
          <option value="assigned">Assigned</option>
          <option value="unassigned">Unassigned</option>
        </select>

        <button className="task-assign-button" onClick={fetchClients}>Fetch Clients</button>
      </div>

      <table className="task-assign-table">
        <thead>
          <tr>
            <th><input type="checkbox" checked={selectAll} onChange={(e) => setSelectAll(e.target.checked)} /></th>
            <th>Name</th>
            <th>Company</th>
            <th>Location</th>
            <th>Category</th>
            <th>Datatype</th>
            <th>Requirements</th>
            <th>Remarks</th>
            
            <th>Call Status</th>
            <th>Assigned To</th>
          </tr>
        </thead>
        <tbody>
          {currentClients.map((client) => (
            <tr key={client._id}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedClients.includes(client._id)}
                  onChange={() => toggleClientSelection(client._id)}
                />
              </td>
              <td>{client.name}</td>
              <td>{client.company}</td>
              <td>{client.location}</td>
              <td>{client.category}</td>
              <td>{client.datatype}</td>
              <td>{client.requirements || "N/A"}</td>
              <td>{client.remarks || "N/A"}</td>
              <td>{client.callStatus}</td>
              <td>{client.assignedTo?.name || "Unassigned"}</td>
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

      <button className="task-assign-assign-button" onClick={handleAssign}>Assign</button>
      <div className="task-assign-actions">
        <button className="task-assign-unassign-button" onClick={handleUnassign}>Unassign</button>
        <button className="task-assign-toggle-permission-button" onClick={handleTogglePermission}>
          Toggle Permission
        </button>
      </div>

    </div>
  );
};

export default AssignWork;
