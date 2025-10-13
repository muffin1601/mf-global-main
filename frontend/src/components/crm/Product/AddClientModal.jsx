import React, { useState, useEffect, useRef } from "react";
import { FiX } from "react-icons/fi";
import { toast } from "react-toastify";
import CustomToast from "../CustomToast";
import "./styles/AddClientModal.css";

const AddClientModal = ({ isOpen, onClose, onSelect }) => {
  const [allClients, setAllClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredClients, setFilteredClients] = useState([]);
  const searchInputRef = useRef(null);

  // 🔹 Fetch clients when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      fetch(`${import.meta.env.VITE_API_URL}/overview/all-clients`)
        .then((res) => (res.ok ? res.json() : Promise.reject("Failed to fetch clients")))
        .then((data) => setAllClients(data.data || []))
        .catch(() =>
          toast(
            <CustomToast
              type="error"
              title="Error"
              message="Could not load client list."
            />
          )
        );
    }
  }, [isOpen]);

  
  useEffect(() => {
    const filtered = allClients
      .filter(
        (c) =>
          c.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.phone?.includes(searchTerm)
      )
      .slice(0, 10);
    setFilteredClients(filtered);
  }, [searchTerm, allClients]);

  
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // 🔹 Select client handler
  const handleSelect = (client) => {
    onSelect(client);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content large">
        <div className="modal-header">
          <h3>Select Client</h3>
          <button className="close-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <div className="search-box">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search by company name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="client-list">
          {filteredClients.length > 0 ? (
            <table className="client-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Contact Person</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr key={client._id}>
                    <td>{client.company}</td>
                    <td>{client.contact || "—"}</td>
                    <td>{client.phone || "—"}</td>
                    <td>{client.email || "—"}</td>
                    <td className="address-cell">
                      {client.address ? client.address.slice(0, 40) + "..." : "—"}
                    </td>
                    <td>
                      <button
                        className="btn-select"
                        onClick={() => handleSelect(client)}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="no-results">No matching clients found.</p>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddClientModal;
