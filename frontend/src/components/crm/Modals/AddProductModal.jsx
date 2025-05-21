import React, { useState } from 'react';
import { toast } from 'react-toastify';

const AddProductModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    p_name: '',
    p_image: '',
    p_description: '',
    p_type: '',
    p_color: '',
    p_price: {
      single_price: '',
      sales_5_50: '',
      sales_50_100: '',
      sales_100_above: ''
    }
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name in formData.p_price) {
      setFormData((prevData) => ({
        ...prevData,
        p_price: {
          ...prevData.p_price,
          [name]: value
        }
      }));
    } else {
      setFormData((prevData) => ({
        ...prevData,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/add-product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      throw new Error('Failed to add product');
    }

    const result = await response.json();
    toast.success('Product added successfully!');
    if (onSubmit) onSubmit(result);
    onClose();
  } catch (error) {
    console.error('Error adding product:', error);
    toast.error('❌ Failed to add product. Please try again.');
  }
};

  if (!isOpen) return null;

  return (
    <div className="form-modal-overlay">
      <div className="form-modal-content">
        <div className="form-modal-header">
          <h3 className="form-modal-title">Add New Product</h3>
          <button className="btn-close-form" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Product Name</label>
              <input
                type="text"
                name="p_name"
                value={formData.p_name}
                onChange={handleChange}
                className="form-modal-input"
                required
              />
            </div>

            <div className="form-group">
              <label>Image URL</label>
              <input
                type="text"
                name="p_image"
                value={formData.p_image}
                onChange={handleChange}
                className="form-modal-input"
              />
            </div>

            <div className="form-group">
              <label>Type</label>
              <input
                type="text"
                name="p_type"
                value={formData.p_type}
                onChange={handleChange}
                className="form-modal-input"
              />
            </div>

            <div className="form-group">
              <label>Color</label>
              <input
                type="text"
                name="p_color"
                value={formData.p_color}
                onChange={handleChange}
                className="form-modal-input"
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Description</label>
              <textarea
                name="p_description"
                value={formData.p_description}
                onChange={handleChange}
                className="form-modal-textarea"
              />
            </div>

            <div className="form-group">
              <label>Single Price</label>
              <input
                type="number"
                name="single_price"
                value={formData.p_price.single_price}
                onChange={handleChange}
                className="form-modal-input"
                required
              />
            </div>

            <div className="form-group">
              <label>Sales 5-50</label>
              <input
                type="number"
                name="sales_5_50"
                value={formData.p_price.sales_5_50}
                onChange={handleChange}
                className="form-modal-input"
              />
            </div>

            <div className="form-group">
              <label>Sales 50-100</label>
              <input
                type="number"
                name="sales_50_100"
                value={formData.p_price.sales_50_100}
                onChange={handleChange}
                className="form-modal-input"
              />
            </div>

            <div className="form-group">
              <label>Sales 100+</label>
              <input
                type="number"
                name="sales_100_above"
                value={formData.p_price.sales_100_above}
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
              Save Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProductModal;
