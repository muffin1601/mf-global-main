import React, { useState } from "react";
import "./styles/ShipToModal.css";

const ShipToModal = ({ isOpen, onClose, addresses = [], onSelect, onAdd }) => {
  const [showForm, setShowForm] = useState(false);
  const [newAddress, setNewAddress] = useState({ name: "", address: "", state: "" });
  const [addressList, setAddressList] = useState(addresses);

  if (!isOpen) return null;

  const handleAddAddress = (e) => {
    e.preventDefault();

    if (!newAddress.name || !newAddress.address || !newAddress.state) {
      alert("Please fill all fields before adding.");
      return;
    }

    const updatedList = [...addressList, newAddress];
    setAddressList(updatedList);

    // Optional callback to parent (if saving in backend)
    if (onAdd) onAdd(newAddress);

    // Reset form
    setNewAddress({ name: "", address: "", state: "" });
    setShowForm(false);
  };

  return (
    <div className="ship-modal-overlay">
      <div className="ship-modal-content">
        <h3 className="ship-modal-title">
          Select Shipping Address
          <span className="ship-count">({addressList.length} options)</span>
        </h3>
        <p className="ship-modal-subtitle">
          Choose an address to set as the <strong>“Ship To”</strong> location.
        </p>

        {/* Address List */}
        <div className="ship-address-list">
          {addressList.map((addr, index) => (
            <div
              key={index}
              className="ship-address-card"
              onClick={() => onSelect(addr)}
            >
              <div className="ship-card-header">
                <h4>{addr.name}</h4>
                <span className="select-tag">Click to select</span>
              </div>
              <p>{addr.address}</p>
              <p>
                <strong>State:</strong> {addr.state}
              </p>
            </div>
          ))}
        </div>

        {/* Add New Address Section */}
        {showForm ? (
          <form className="ship-add-form" onSubmit={handleAddAddress}>
            <h4>Add New Address</h4>
            <input
              type="text"
              placeholder="Name / Location Label"
              value={newAddress.name}
              onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
            />
            <textarea
              placeholder="Full Address"
              value={newAddress.address}
              onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
            />
            <input
              type="text"
              placeholder="State"
              value={newAddress.state}
              onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
            />
            <div className="ship-add-actions">
              <button type="submit" className="ship2-add-btn">
                Add
              </button>
              <button
                type="button"
                className="ship2-cancel-btn"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            className="ship-add-btn"
            onClick={() => setShowForm(true)}
          >
            + Add New Address
          </button>
        )}

        <button className="ship-close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default ShipToModal;
