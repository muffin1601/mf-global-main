import React from "react";
import "./styles/ShipToModal.css";

const ShipToModal = ({ isOpen, onClose, addresses, onSelect }) => {
  if (!isOpen || !addresses) return null;

  return (
    <div className="ship-modal-overlay">
      <div className="ship-modal-content">
        <h3 className="ship-modal-title">
          Select Shipping Address
          <span className="ship-count">({addresses.length} options)</span>
        </h3>
        <p className="ship-modal-subtitle">
          Choose an address to set as the <strong>“Ship To”</strong> location.
        </p>

        <div className="ship-address-list">
          {addresses.map((addr, index) => (
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

        <button className="ship-close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default ShipToModal;
