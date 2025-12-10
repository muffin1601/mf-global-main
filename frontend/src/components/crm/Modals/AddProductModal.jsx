import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import CustomToast from '../CustomToast';

const AddProductModal = ({ isOpen, onClose, onSubmit }) => {
  const [categoryNames, setCategoryNames] = useState([]);
  const [printkeeCats, setPrintkeeCats] = useState([]);

  const [subcategories, setSubcategories] = useState([]);

  const [selectedImage, setSelectedImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const [origin, setOrigin] = useState({
    source: "crm",
    categoryId: "",
    subcategoryId: ""
  });

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

  /* --------------------------------------------------
      LOAD CRM CATEGORIES & PRINTKEE STRUCTURE
  -------------------------------------------------- */
  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/products/meta`)
      .then(res => setCategoryNames(res.data.cat_names));

    axios.get(`${import.meta.env.VITE_API_URL}/origin/printkee-categories`)
      .then(res => setPrintkeeCats(res.data));
  }, []);

  /* --------------------------------------------------
      UPDATE SUBCATEGORY ON CATEGORY CHANGE
  -------------------------------------------------- */
  useEffect(() => {
    if (!origin.categoryId) {
      setSubcategories([]);
      return;
    }

    const category = printkeeCats.find(c => c._id === origin.categoryId);
    setSubcategories(category?.subcategories || []);

  }, [origin.categoryId, printkeeCats]);

  /* --------------------------------------------------
      HANDLE INPUT CHANGES
  -------------------------------------------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name in formData.p_price) {
      setFormData(prev => ({
        ...prev,
        p_price: { ...prev.p_price, [name]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  /* --------------------------------------------------
      IMAGE UPLOAD
  -------------------------------------------------- */
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedImage(file);
    setPreviewImage(URL.createObjectURL(file));
  };

  /* --------------------------------------------------
      SUBMIT PRODUCT
  -------------------------------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const fd = new FormData();

      Object.keys(formData).forEach(key => {
        if (key !== "p_price") fd.append(key, formData[key]);
      });

      fd.append("p_price", JSON.stringify(formData.p_price));
      fd.append("origin", JSON.stringify(origin));

      if (selectedImage) fd.append("p_image", selectedImage);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/add-product`, {
        method: "POST",
        body: fd
      });

      if (!res.ok) throw new Error("Failed to add product");

      const result = await res.json();

      toast(<CustomToast type="success" title="Product Added" />);
      onSubmit?.(result);
      onClose();

    } catch (err) {
      toast(<CustomToast type="error" title="Failed" message={err.message} />);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fe-modal-overlay" onClick={onClose}>
      <div className="fe-modal-container" onClick={(e) => e.stopPropagation()}>

        <div className="fe-modal-header">
          <h3 className="fe-modal-title">Add Product</h3>
          <button className="fe-modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>

          <div className="fe-modal-body">

            {/* Origin Selector */}
            <div className="fe-input-group" style={{ gridColumn: "span 2" }}>
              <label>Source Database</label>
              <select
                value={origin.source}
                onChange={(e) => setOrigin({ source: e.target.value })}
              >
                <option value="crm">CRM Only</option>
                <option value="printkee">Printkee</option>
                <option value="coachingpromo">CoachingPromo</option>
              </select>
            </div>

            {/* If Printkee → Show Category & Subcategory */}
            {origin.source === "printkee" && (
              <>
                <div className="fe-input-group">
                  <label>Select Printkee Category</label>
                  <select
                    value={origin.categoryId}
                    onChange={(e) =>
                      setOrigin(prev => ({
                        ...prev,
                        categoryId: e.target.value,
                        subcategoryId: ""
                      }))
                    }
                  >
                    <option value="">Select Category</option>
                    {printkeeCats.map(cat => (
                      <option key={cat._id} value={cat._id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="fe-input-group">
                  <label>Select Subcategory</label>
                  <select
                    value={origin.subcategoryId}
                    onChange={(e) =>
                      setOrigin(prev => ({
                        ...prev,
                        subcategoryId: e.target.value
                      }))
                    }
                  >
                    <option value="">Select Subcategory</option>
                    {subcategories.map(sub => (
                      <option key={sub._id} value={sub._id}>{sub.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Rest of your existing form (image, name, price, etc.) */}
            {/* --- DO NOT REMOVE ANYTHING --- */}

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
