import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import CustomToast from '../CustomToast';
import './ProductModal.css';

const AddProductModal = ({ isOpen, onClose, onSubmit }) => {
  const [categoryNames, setCategoryNames] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    s_code: '',
    p_name: '',
    p_type: '',
    p_color: '',
    HSN_code: '',
    dimension: '',
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

    if (basic_amount !== '' && GST_rate !== '' && Number.isFinite(Number(basic_amount)) && Number.isFinite(Number(GST_rate))) {
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

    // nested p_price fields
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

    if (saving) return;
    setSaving(true);
    try {
      const fd = new FormData();

      fd.append("s_code", formData.s_code);
      fd.append("p_name", formData.p_name);
      fd.append("p_type", formData.p_type);
      fd.append("p_color", formData.p_color);
      fd.append("HSN_code", formData.HSN_code);
      fd.append("dimension", formData.dimension);        // ⭐ NEW FIELD SENT ⭐
      fd.append("cat_id", formData.cat_id);
      fd.append("p_description", formData.p_description);
      fd.append("p_price", JSON.stringify(formData.p_price));

      if (selectedImage) {
        fd.append("p_image", selectedImage);
      }

      const response = await axios.post(`${import.meta.env.VITE_API_URL}/add-product`, fd);
      const result = response.data;

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
          message={error.response?.data?.error || error.message || 'The product could not be saved.'}
        />
      );
    } finally { setSaving(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fe-modal-overlay" onClick={onClose}>
      <div className="fe-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="fe-modal-header">
          <h3 className="fe-modal-title">Add New Product</h3>
          <button type="button" className="fe-modal-close" aria-label="Close add product" onClick={onClose} disabled={saving}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="fe-modal-body">

            {/* Image Upload */}
            <div className="fe-input-group" style={{ gridColumn: "span 2" }}>
              <label htmlFor="product-image">Product Image</label>

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
                <input id="product-image" type="file" accept="image/*" onChange={handleImageUpload} disabled={saving} />
              )}
            </div>

            {/* Main Inputs */}
            {[ 
              { label: 'Style Code', name: 's_code', required: true },
              { label: 'Product Name', name: 'p_name', required: true },
              { label: 'Material Type', name: 'p_type' },
              { label: 'Color', name: 'p_color' },
              { label: 'HSN Code', name: 'HSN_code' },
              { label: 'Dimensions', name: 'dimension' },   // ⭐ NEW FIELD ⭐
            ].map(({ label, name, required }) => (
              <div className="fe-input-group" key={name}>
                <label htmlFor={`add-product-${name}`}>{label}{required ? ' *' : ''}</label>
                <input
                  id={`add-product-${name}`}
                  type="text"
                  name={name}
                  value={formData[name]}
                  onChange={handleChange}
                  required={required}
                />
              </div>
            ))}

            <div className="fe-input-group">
              <label htmlFor="add-product-category">Category *</label>
              <select
                id="add-product-category"
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
              <label htmlFor="add-product-description">Description</label>
              <textarea
                id="add-product-description"
                name="p_description"
                value={formData.p_description}
                onChange={handleChange}
              />
            </div>

            {/* Pricing */}
            <div className="fe-input-group">
              <label htmlFor="add-product-purchase-price">Purchase Amount</label>
              <input
                id="add-product-purchase-price"
                type="number"
                min="0"
                step="0.01"
                name="purchase_price"
                value={formData.p_price.purchase_price}
                onChange={handleChange}
              />
            </div>

            <div className="fe-input-group">
              <label htmlFor="add-product-basic-amount">Basic Amount *</label>
              <input
                id="add-product-basic-amount"
                type="number"
                min="0"
                step="0.01"
                name="basic_amount"
                value={formData.p_price.basic_amount}
                onChange={handleChange}
                required
              />
            </div>

            <div className="fe-input-group">
              <label htmlFor="add-product-gst">GST Rate (%) *</label>
              <select
                id="add-product-gst"
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
              <label htmlFor="add-product-net-amount">Net Amount</label>
              <input
                id="add-product-net-amount"
                type="number"
                name="net_amount"
                value={Math.round(formData.p_price.net_amount || 0)}
                readOnly
              />
            </div>
          </div>

          <div className="fe-footer-buttons fe-action-buttons">
            <button type="button" className="fe-btn-close" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="fe-btn-submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save Product'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default AddProductModal;
