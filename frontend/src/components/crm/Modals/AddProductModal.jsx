import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import CustomToast from '../CustomToast';

const AddProductModal = ({ isOpen, onClose, onSubmit }) => {
  const [categoryNames, setCategoryNames] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const [formData, setFormData] = useState({
    s_code: '',
    p_name: '',
    p_type: '',
    p_color: '',
    HSN_code: '',
    cat_id: '',
    p_description: '',
    p_price: {
      purchase_price: '',
      basic_amount: '',
      GST_rate: '',
      net_amount: '',
    },
  });

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/products/meta`)
      .then((res) => setCategoryNames(res.data.cat_names))
      .catch((err) => console.error('Failed to fetch categories:', err));
  }, []);

  useEffect(() => {
    const { basic_amount, GST_rate } = formData.p_price;

    if (basic_amount && GST_rate) {
      const basic = parseFloat(basic_amount);
      const gst = parseFloat(GST_rate);
      const net = basic + (basic * gst) / 100;

      setFormData((prev) => ({
        ...prev,
        p_price: {
          ...prev.p_price,
          net_amount: net.toFixed(2),
        },
      }));
    }
  }, [formData.p_price.basic_amount, formData.p_price.GST_rate]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name in formData.p_price) {
      setFormData((prev) => ({
        ...prev,
        p_price: {
          ...prev.p_price,
          [name]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedImage(file);
    setPreviewImage(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setSelectedImage(null);
    setPreviewImage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const fd = new FormData();

      fd.append("s_code", formData.s_code);
      fd.append("p_name", formData.p_name);
      fd.append("p_type", formData.p_type);
      fd.append("p_color", formData.p_color);
      fd.append("HSN_code", formData.HSN_code);
      fd.append("cat_id", formData.cat_id);
      fd.append("p_description", formData.p_description);
      fd.append("p_price", JSON.stringify(formData.p_price));

      if (selectedImage) {
        fd.append("p_image", selectedImage);
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/add-product`, {
        method: "POST",
        body: fd,
      });

      if (!response.ok) throw new Error("Failed to add product");

      const result = await response.json();

      toast(
        <CustomToast
          type="success"
          title="Product Added"
          message={`Product "${formData.p_name}" added successfully!`}
        />
      );

      if (onSubmit) onSubmit(result);
      onClose();

    } catch (error) {
      toast(
        <CustomToast
          type="error"
          title="Add Product Failed"
          message={error.message}
        />
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fe-modal-overlay" onClick={onClose}>
      <div className="fe-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="fe-modal-header">
          <h3 className="fe-modal-title">Add New Product</h3>
          <button className="fe-modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="fe-modal-body">

            {/* Image Upload */}
            <div className="fe-input-group" style={{ gridColumn: "span 2" }}>
              <label>Product Image</label>

              {previewImage ? (
                <div style={{ textAlign: "left" }}>
                  <img
                    src={previewImage}
                    alt="Preview"
                    style={{
                    width: "auto",
                    height: "auto",
                    maxWidth: "160px",
                    maxHeight: "160px",
                    borderRadius: "10px",
                    objectFit: "contain",
                  }}
                  />
                  <button
                    type="button"
                    style={{
                      display: "block",
                      marginTop: "8px",
                      background: "#d32f2f",
                      color: "#fff",
                      padding: "0.4rem 0.8rem",
                      borderRadius: "8px",
                      fontFamily:"'Outfit', sans-serif",
                      border: "none",
                      cursor: "pointer"
                    }}
                    onClick={removeImage}
                  >
                    Remove Image
                  </button>
                </div>
              ) : (
                <input type="file" accept="image/*" onChange={handleImageUpload} />
              )}
            </div>

            {/* Main Inputs */}
            {[
              { label: 'Style Code', name: 's_code', required: true },
              { label: 'Product Name', name: 'p_name', required: true },
              { label: 'Material Type', name: 'p_type' },
              { label: 'Color', name: 'p_color' },
              { label: 'HSN Code', name: 'HSN_code' },
            ].map(({ label, name, required }) => (
              <div className="fe-input-group" key={name}>
                <label>{label}</label>
                <input
                  type="text"
                  name={name}
                  value={formData[name]}
                  onChange={handleChange}
                  required={required}
                />
              </div>
            ))}

            <div className="fe-input-group">
              <label>Category</label>
              <select
                name="cat_id"
                value={formData.cat_id}
                onChange={handleChange}
                required
              >
                <option value="">Select Category</option>
                {categoryNames.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="fe-input-group" style={{ gridColumn: "span 2" }}>
              <label>Description</label>
              <textarea
                name="p_description"
                value={formData.p_description}
                onChange={handleChange}
              />
            </div>

            {/* Pricing */}
            <div className="fe-input-group">
              <label>Purchase Amount</label>
              <input
                type="number"
                name="purchase_price"
                value={formData.p_price.purchase_price}
                onChange={handleChange}
              />
            </div>

            <div className="fe-input-group">
              <label>Basic Amount</label>
              <input
                type="number"
                name="basic_amount"
                value={formData.p_price.basic_amount}
                onChange={handleChange}
                required
              />
            </div>

            <div className="fe-input-group">
              <label>GST Rate (%)</label>
              <select
                name="GST_rate"
                value={formData.p_price.GST_rate}
                onChange={handleChange}
                required
              >
                <option value="">Select GST</option>
                <option value="5">5%</option>
                <option value="18">18%</option>
              </select>
            </div>

            <div className="fe-input-group">
              <label>Net Amount</label>
              <input
                type="number"
                name="net_amount"
                value={Math.round(formData.p_price.net_amount || 0)}
                readOnly
                // style={{ backgroundColor: '#f5f5f5' }}
              />
            </div>
          </div>

          <div className="fe-footer-buttons fe-action-buttons">
            <button type="button" className="fe-btn-close" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="fe-btn-submit">
              Save Product
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default AddProductModal;
