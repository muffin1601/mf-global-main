import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
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

    // Convert comma-separated product string to array
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
      toast.success('Vendor added successfully!');
      if (onSubmit) onSubmit(result);
      onClose();
    } catch (error) {
      console.error('Error adding vendor:', error);
      toast.error('Failed to add vendor. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="form-modal-overlay">
      <div className="form-modal-content">
        <div className="form-modal-header">
          <h3 className="form-modal-title">Add New Vendor</h3>
          <button className="btn-close-form" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Vendor Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-modal-input"
                required
              />
            </div>

            <div className="form-group">
              <label>Contact Name</label>
              <input
                type="text"
                name="contact_name"
                value={formData.contact_name}
                onChange={handleChange}
                className="form-modal-input"
              />
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="form-modal-input"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="form-modal-input"
              />
            </div>

            <div className="form-group">
              <label>Vendor Type</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="form-modal-input"
              >
                <option value="">Select Type</option>
                <option value="Trader">Trader</option>
                <option value="Manufacturer">Manufacturer</option>
                <option value="Importer">Importer</option>
              </select>
            </div>

            <div className="form-group">
                <label>Category</label>
                <select
                    name="cat_id"
                    value={formData.cat_id}
                    onChange={handleChange}
                    className="form-modal-input"
                >
                    <option value="">Select Category</option>
                    {categoryNames.map((cat) => (
                        <option key={cat._id || cat.id || cat} value={cat._id || cat.id || cat}>
                            {cat.name || cat.label || cat._id || cat.id || cat}
                        </option>
                    ))}
                </select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Products (comma-separated)</label>
              <input
                type="text"
                name="products"
                value={formData.products}
                onChange={handleChange}
                className="form-modal-input"
              />
            </div>

            <div className="form-group">
              <label>Address Line 1</label>
              <input
                type="text"
                name="addr1"
                value={formData.addr1}
                onChange={handleChange}
                className="form-modal-input"
              />
            </div>

            <div className="form-group">
              <label>Address Line 2</label>
              <input
                type="text"
                name="addr2"
                value={formData.addr2}
                onChange={handleChange}
                className="form-modal-input"
              />
            </div>

            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="form-modal-input"
              />
            </div>

            <div className="form-group">
              <label>State</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="form-modal-input"
              />
            </div>

            <div className="form-group">
              <label>PIN Code</label>
              <input
                type="text"
                name="pin_code"
                value={formData.pin_code}
                onChange={handleChange}
                className="form-modal-input"
              />
            </div>
          </div>

          <div className="form-actions form-action-buttons">
            <button type="button" className="close-form-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-form-btn">
              Save Vendor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddVendorModal;
