import React, { useState, useEffect } from 'react';
import CustomToast from '../CustomToast';
import axios from 'axios';
import { toast } from 'react-toastify';

const EditVendorModal = ({ vendor, onClose, onSave }) => {
  const [editedVendor, setEditedVendor] = useState({});
  const [categoryNames, setCategoryNames] = useState([]);

  useEffect(() => {
    if (vendor) {
      setEditedVendor({ ...vendor });
    }
  }, [vendor]);

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/products/meta`)
      .then((res) => {
        setCategoryNames(res.data.cat_names || []);
      })
      .catch((err) => console.error("Error fetching categories:", err));
  }, []);

  const handleChange = (field, value) => {
    setEditedVendor((prev) => ({ ...prev, [field]: value }));
  };

  const saveVendor = async () => {
  try {
    const res = await axios.post(
      `${import.meta.env.VITE_API_URL}/vendors/update`,
      editedVendor
    );

    toast(
      <CustomToast
        type="success"
        title="Updated"
        message={`Vendor "${editedVendor.name}" updated successfully!`}
      />
    );

    onSave(res.data);
    onClose();
  } catch (error) {
    console.error("Error updating vendor:", error);
    toast(
      <CustomToast
        type="error"
        title="Update Failed"
        message={error.response?.data?.message || error.message}
      />
    );
  }
};

  if (!vendor) return null;

  const fieldLabels = {
    v_code: "Vendor Code",
    name: "Vendor Name",
    contact_name: "Contact Person",
    phone: "Phone Number",
    products: "Products (comma-separated)",
    addr1: "Address Line 1",
    addr2: "Address Line 2",
    city: "City",
    state: "State",
    pin_code: "Pin Code",
    email: "Email"
  };

  return (
  <div className="glasso-modal-overlay" onClick={onClose}>
    <div className="glasso-modal-container" onClick={(e) => e.stopPropagation()}>
      
      {/* Header */}
      <div className="glasso-modal-header">
        <h3 className="glasso-modal-title">Edit Vendor</h3>
        <button className="glasso-close-btn" onClick={onClose}>×</button>
      </div>

      {/* Body */}
      <div className="glasso-modal-body">
        {/* Text Inputs */}
        {Object.entries(fieldLabels).map(([field, label]) => (
          <div className="glasso-input-group" key={field}>
            <label>{label}</label>
            {field === 'products' ? (
              <input
                type="text"
                value={(editedVendor.products || []).join(', ')}
                onChange={e => handleChange('products', e.target.value.split(',').map(p => p.trim()))}
              />
            ) : (
              <input
                type={field === "email" ? "email" : "text"}
                value={editedVendor[field] || ""}
                onChange={(e) => handleChange(field, e.target.value)}
                disabled={field === "v_code"}
              />
            )}
          </div>
        ))}

        {/* Vendor Type Dropdown */}
        <div className="glasso-input-group">
          <label>Vendor Type</label>
          <select
            name="type"
            value={editedVendor.type || ""}
            onChange={(e) => handleChange("type", e.target.value)}
          >
            <option value="">Select Type</option>
            <option value="Trader">Trader</option>
            <option value="Manufacturer">Manufacturer</option>
            <option value="Importer">Importer</option>
          </select>
        </div>

        {/* Category Dropdown */}
        <div className="glasso-input-group">
          <label>Category</label>
          <select
            name="cat_id"
            value={editedVendor.cat_id || ""}
            onChange={(e) => handleChange("cat_id", e.target.value)}
          >
            <option value="">Select Category</option>
            {categoryNames.map((cat) => (
              <option key={cat._id || cat.id || cat} value={cat._id || cat.id || cat}>
                {cat.name || cat.label || cat._id || cat.id || cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="glasso-footer-buttons glasso-action-buttons">
        <button className="glasso-btn-cancel" onClick={onClose}>Cancel</button>
        <button className="glasso-btn-save" onClick={saveVendor}>Save</button>
      </div>
    </div>
  </div>
);

};

export default EditVendorModal;
