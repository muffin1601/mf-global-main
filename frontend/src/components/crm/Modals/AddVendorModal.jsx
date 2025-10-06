import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import CustomToast from '../CustomToast';
import axios from 'axios';

const AddVendorModal = ({ isOpen, onClose, onSubmit }) => {
    const [categoryNames, setCategoryNames] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    type: '',
    cat_id: '',
    products: '',
    addr1: '',
    addr2: '',
    city: '',
    state: '',
    pin_code: ''
  });
  
useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/products/meta`).then((res) => {
      setCategoryNames(res.data.cat_names);
    });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  const payload = {
    ...formData,
    products: formData.products.split(',').map((p) => p.trim())
  };

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/add-vendor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Failed to add vendor');
    }

    const result = await response.json();
    toast(
      <CustomToast
        type="success"
        title="Vendor Added"
        message={`Vendor "${formData.name}" added successfully!`}
      />
    );

    if (onSubmit) onSubmit(result);
    onClose();
  } catch (error) {
    console.error('Error adding vendor:', error);
    toast(
      <CustomToast
        type="error"
        title="Add Vendor Failed"
        message={error.message || 'Failed to add vendor. Please try again.'}
      />
    );
  }
};

  if (!isOpen) return null;

  return (
  <div className="fe-modal-overlay">
    <div className="fe-modal-container">
      
      {/* Header */}
      <div className="fe-modal-header">
        <h3 className="fe-modal-title">Add New Vendor</h3>
        <button className="fe-modal-close" onClick={onClose}>×</button>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} className="fe-modal-body">
        {[
          { label: "Vendor Name *", name: "name", type: "text", required: true },
          { label: "Contact Name", name: "contact_name", type: "text" },
          { label: "Phone", name: "phone", type: "text" },
          { label: "Email", name: "email", type: "email" },
          { label: "Products (comma-separated)", name: "products", type: "text", span: 2 },
          { label: "Address Line 1", name: "addr1", type: "text" },
          { label: "Address Line 2", name: "addr2", type: "text" },
          { label: "City", name: "city", type: "text" },
          { label: "State", name: "state", type: "text" },
          { label: "PIN Code", name: "pin_code", type: "text" }
        ].map(({ label, name, type, required, span }) => (
          <div
            key={name}
            className="fe-input-group"
            style={span ? { gridColumn: `span ${span}` } : {}}
          >
            <label>{label}</label>
            <input
              type={type}
              name={name}
              value={formData[name] || ""}
              onChange={handleChange}
              required={required}
            />
          </div>
        ))}

        {/* Vendor Type Dropdown */}
        <div className="fe-input-group">
          <label>Vendor Type</label>
          <select
            name="type"
            value={formData.type || ""}
            onChange={handleChange}
          >
            <option value="">Select Type</option>
            <option value="Trader">Trader</option>
            <option value="Manufacturer">Manufacturer</option>
            <option value="Importer">Importer</option>
          </select>
        </div>

        {/* Category Dropdown */}
        <div className="fe-input-group">
          <label>Category</label>
          <select
            name="cat_id"
            value={formData.cat_id || ""}
            onChange={handleChange}
          >
            <option value="">Select Category</option>
            {categoryNames.map((cat) => (
              <option key={cat._id || cat.id || cat} value={cat._id || cat.id || cat}>
                {cat.name || cat.label || cat._id || cat.id || cat}
              </option>
            ))}
          </select>
        </div>

        {/* Footer Buttons */}
        <div className="fe-footer-buttons fe-action-buttons">
          <button type="button" className="fe-btn-close" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="fe-btn-submit">
            Save Vendor
          </button>
        </div>
      </form>
    </div>
  </div>
);

};

export default AddVendorModal;
