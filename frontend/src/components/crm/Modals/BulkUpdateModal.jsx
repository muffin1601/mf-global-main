import React, { useState } from 'react';
import './styles/BulkUpdateModal.css'; // Reuse modal styles
import { toast } from 'react-toastify';
import axios from 'axios';

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
    location: location ,
    category: category ,
    datatype: lead.datatype,
    callStatus: lead.callStatus,
    followUpDate: lead.followUpDate,
  }));

  try {
    const res = await axios.post(`${import.meta.env.VITE_API_URL}/save-all-updates`, {
      updates,
    });

    toast.success('Leads updated successfully!');
    onUpdateSuccess();  // Refresh leads
    onClose();          // Close modal
  } catch (err) {
    console.error('Bulk update failed:', err);
    toast.error('Failed to update leads.');
  }
};
  return (
    <div className="update-modal">
      <div className="update-modal-content">
        <h3>Bulk Update Leads</h3>
        <form onSubmit={handleSubmit}>
          <div className="update-form-group">
            <label>New Category</label>
            <input
            className='update-input'
              type="text"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="Enter category"
            />
          </div>
          <div className="update-form-group">
            <label>New Location</label>
            <input
              className='update-input'
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Enter location"
            />
          </div>
          <div className="update-modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel-update">Cancel</button>
            <button type="submit" className="btn-save-update">Update</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkUpdateModal;
