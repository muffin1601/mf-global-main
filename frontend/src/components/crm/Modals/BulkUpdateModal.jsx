import React, { useState } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import CustomToast from "../CustomToast"; 

const BulkUpdateModal = ({ onClose, filteredLeads, onUpdateSuccess }) => {
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const updates = filteredLeads.map((lead) => ({
      id: lead._id || lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      contact: lead.contact,
      remarks: lead.remarks,
      requirements: lead.requirements,
      location: location,
      category: category,
      datatype: lead.datatype,
      callStatus: lead.callStatus,
      followUpDate: lead.followUpDate,
    }));

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/save-all-updates`, { updates });

      toast(
        <CustomToast
          type="success"
          title="Update Successful"
          message={`Updated ${updates.length} lead(s) successfully.`}
        />
      );

      onUpdateSuccess();
      onClose();
    } catch (err) {
      console.error('Bulk update failed:', err);
      toast(
        <CustomToast
          type="error"
          title="Update Failed"
          message="Something went wrong while updating leads."
        />
      );
    }
  };

  return (
    <div className="bulkupdate-modal-overlay">
      <div className="bulkupdate-modal-container">
        <div className="bulkupdate-modal-header">
          <h3 className="bulkupdate-modal-title">Bulk Update Leads</h3>
          <button className="bulkupdate-close-btn" onClick={onClose}>✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="bulkupdate-form">
          <div className="bulkupdate-form-group">
            <label className="bulkupdate-label">New Category</label>
            <input
              className="bulkupdate-input"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Enter category"
            />
          </div>
          <div className="bulkupdate-form-group">
            <label className="bulkupdate-label">New Location</label>
            <input
              className="bulkupdate-input"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter location"
            />
          </div>

          <div className="bulkupdate-footer-buttons">
            <button 
              type="button" 
              onClick={onClose} 
              className="bulkupdate-btn-cancel">
              Cancel
            </button>
            <button 
              type="submit" 
              className="bulkupdate-btn-save">
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkUpdateModal;

const css = `/* Overlay */
.bulkupdate-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  border-radius: 20px;
  justify-content: center;
  align-items: center;
  z-index: 99999;
  font-family: 'Outfit', sans-serif;
}

/* Container */
.bulkupdate-modal-container {
  width: 500px;
  max-height: 90%;
  overflow-y: auto;
  backdrop-filter: blur(15px);
  background: rgba(255, 255, 255, 0.87);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  font-family: 'Outfit', sans-serif;
}

/* Header */
.bulkupdate-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bulkupdate-modal-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #313131;
}

.bulkupdate-close-btn {
  font-size: 1.2rem;
  color: #3b3b3b;
  background: none;
  border: none;
  cursor: pointer;
}

/* Form */
.bulkupdate-form {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.bulkupdate-form-group {
  display: flex;
  flex-direction: column;
}

.bulkupdate-label {
  margin-bottom: 0.25rem;
  font-weight: 500;
  color: #292929;
}

.bulkupdate-input {
  padding: 0.6rem 0.9rem;
  border-radius: 10px;
  font-family: 'Outfit', sans-serif;
  border: none;
  outline: none;
  font-family: 'Outfit', sans-serif;
  background: rgba(255, 255, 255, 0.84);
  color: #000;
  transition: box-shadow 0.2s ease, background 0.2s ease;
}

.bulkupdate-input:focus {
  box-shadow: 0 0 6px rgba(0,0,0,0.2);
  background: rgba(255, 255, 255, 0.95);
}

/* Footer buttons */
.bulkupdate-footer-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  font-family: 'Outfit', sans-serif;
  margin-top: 1.5rem;
}

.bulkupdate-btn-cancel,
.bulkupdate-btn-save {
  padding: 0.6rem 1.2rem;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-family: 'Outfit', sans-serif;
  font-weight: 500;
  transition: all 0.2s ease;
  color: #fff;
}

.bulkupdate-btn-cancel {
  background: rgba(255,0,0,0.6);
}

.bulkupdate-btn-cancel:hover {
  background: rgba(200,0,0,0.8);
  box-shadow: 0 2px 8px rgba(255,0,0,0.15);
}

.bulkupdate-btn-save {
  background: rgba(23,146,23,1);
}

.bulkupdate-btn-save:hover {
  background: rgba(18,120,18,0.95);
  box-shadow: 0 2px 8px rgba(23,146,23,0.15);
}

/* Custom Scrollbar */
.bulkupdate-modal-container::-webkit-scrollbar {
  width: 10px;
}

.bulkupdate-modal-container::-webkit-scrollbar-track {
  background: rgba(200,200,200,0.2);
  border-radius: 10px;
}

.bulkupdate-modal-container::-webkit-scrollbar-thumb {
  background-color: rgba(100,100,100,0.5);
  border-radius: 10px;
  border: 2px solid rgba(200,200,200,0.2);
}

.bulkupdate-modal-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(80,80,80,0.7);
}
`;
const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);