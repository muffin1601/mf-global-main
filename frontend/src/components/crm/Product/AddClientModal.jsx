import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { FiX } from "react-icons/fi";
import { toast } from "react-toastify";
import CustomToast from "../CustomToast";
import "./styles/AddClientModal.css"; 

const AddClientModal = ({ isOpen, onClose, onSelect }) => {
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef(null);

  
  useEffect(() => {
    if (!isOpen) return undefined;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/overview/quotation-clients`,
          {
            params: { q: searchTerm.trim(), limit: 10 },
            signal: controller.signal,
          }
        );
        setClients(response.data.data || []);
      } catch (error) {
        if (error.code !== "ERR_CANCELED") {
          setClients([]);
          toast(
            <CustomToast
              type="error"
              title="Error"
              message="Could not load client list."
            />
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, searchTerm ? 250 : 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, searchTerm]);


  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setSearchTerm("");
      searchInputRef.current.focus();
    }
  }, [isOpen]);


  const handleSelect = (client) => {
    onSelect(client);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="client-modal__overlay">
      <div className="client-modal__content">
        <div className="client-modal__header">
          <h3 className="client-modal__title">Select Client</h3>
          <button className="client-modal__close-btn" onClick={onClose} aria-label="Close client picker">
            <FiX size={20} />
          </button>
        </div>

        <div className="client-modal__search-box">
          <input
            ref={searchInputRef}
            type="text"
            className="client-modal__search-input"
            placeholder="Search by client name, company, phone or contact..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="client-modal__list-container">
          {loading ? (
            <p className="client-modal__no-results">Searching clients...</p>
          ) : clients.length > 0 ? (
            <table className="client-table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client._id}>
                    <td>{client.name || "—"}</td>
                    <td>{client.company || "—"}</td>
                    <td>{client.contact || "—"}</td>
                    <td>{client.phone || "—"}</td>
                    <td>
                      <button
                        className="client-table__action-btn"
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
            <p className="client-modal__no-results">No matching clients found.</p>
          )}
        </div>

        <div className="client-modal__footer">
          <button className="client-modal__cancel-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddClientModal;
