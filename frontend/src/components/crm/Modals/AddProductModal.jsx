import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import './styles/EditLeadModal.css'; // Reuse existing modal CSS
import { AiOutlineClose } from 'react-icons/ai';

const AddProductModal = ({ isOpen, onClose, onSubmit }) => {
  const [categoryNames, setCategoryNames] = useState([]);

  const [formData, setFormData] = useState({
    product_code: '',
    p_name: '',
    p_image: '',
    p_description: '',
    p_type: '',
    p_color: '',
    cat_id: '',
    HSN_code: '',
    GST_rate: '',
    p_price: {
      single_price: '',
      sales_5_50: '',
      sales_50_100: '',
      sales_100_above: ''
    }
  });

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/products/meta`)
      .then((res) => setCategoryNames(res.data.cat_names))
      .catch((err) => console.error("Failed to fetch categories:", err));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name in formData.p_price) {
      setFormData(prev => ({
        ...prev,
        p_price: {
          ...prev.p_price,
          [name]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/add-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to add product');

      const result = await response.json();
      toast.success('Product added successfully!');
      if (onSubmit) onSubmit(result);
      onClose();
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Failed to add product. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="lead-modal-overlay" onClick={onClose}>
      <div className="lead-modal edit" onClick={(e) => e.stopPropagation()}>
        <div className="lead-modal-header">
          <h3>Add New Product</h3>
          <button className="close-btn" onClick={onClose}><AiOutlineClose /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="lead-modal-body grid">
            {[
              { label: "Product Code", name: "product_code" },
              { label: "Product Name", name: "p_name", required: true },
              { label: "Image URL", name: "p_image" },
              { label: "Type", name: "p_type" },
              { label: "Color", name: "p_color" },
              { label: "HSN Code", name: "HSN_code" },
              { label: "GST Rate (%)", name: "GST_rate", type: "number" }
            ].map(({ label, name, type = "text", required }) => (
              <div className="input-group" key={name}>
                <label>{label}</label>
                <input
                  type={type}
                  name={name}
                  value={formData[name]}
                  onChange={handleChange}
                  required={required}
                />
              </div>
            ))}

            <div className="input-group">
              <label>Category</label>
              <select
                name="cat_id"
                value={formData.cat_id}
                onChange={handleChange}
              >
                <option value="">Select Category</option>
                {categoryNames.map((cat) => (
                  <option key={cat._id || cat.id || cat} value={cat._id || cat.id || cat}>
                    {cat.name || cat.label || cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group" style={{ gridColumn: 'span 2' }}>
              <label>Description</label>
              <textarea
                name="p_description"
                value={formData.p_description}
                onChange={handleChange}
              />
            </div>

            {[
              { label: "Single Price", name: "single_price", required: true },
              { label: "Sales 5-50", name: "sales_5_50" },
              { label: "Sales 50-100", name: "sales_50_100" },
              { label: "Sales 100+", name: "sales_100_above" }
            ].map(({ label, name, required }) => (
              <div className="input-group" key={name}>
                <label>{label}</label>
                <input
                  type="number"
                  name={name}
                  value={formData.p_price[name]}
                  onChange={handleChange}
                  required={required}
                />
              </div>
            ))}
          </div>

          <div className="lead-modal-footer-edit">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-save-edit">
              Save Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProductModal;
