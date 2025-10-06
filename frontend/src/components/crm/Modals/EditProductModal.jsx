import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import CustomToast from '../CustomToast';

const EditProductModal = ({ product, onClose, onSave }) => {
  const [editedProduct, setEditedProduct] = useState({});
  const [price, setPrice] = useState({
    price_code: '',
    single_price: '',
    sales_5_50: '',
    sales_50_100: '',
    sales_100_above: ''
  });
  const [categoryNames, setCategoryNames] = useState([]);

  useEffect(() => {
    if (product) {
      setEditedProduct({ ...product });
      setPrice({
        price_code: product.p_price?.price_code || '',
        single_price: product.p_price?.single_price || '',
        sales_5_50: product.p_price?.sales_5_50 || '',
        sales_50_100: product.p_price?.sales_50_100 || '',
        sales_100_above: product.p_price?.sales_100_above || ''
      });
    }
  }, [product]);

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/products/meta`)
      .then((res) => setCategoryNames(res.data.cat_names))
      .catch((err) => console.error("Error fetching categories:", err));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name in price) {
      setPrice(prev => ({ ...prev, [name]: value }));
    } else {
      setEditedProduct(prev => ({ ...prev, [name]: value }));
    }
  };
const saveProduct = async () => {
  try {
    const payload = { ...editedProduct, p_price: price };
    const res = await axios.post(
      `${import.meta.env.VITE_API_URL}/products/update`,
      payload
    );

    toast(
      <CustomToast
        type="success"
        title="Updated"
        message={`Product "${editedProduct.p_name}" updated successfully!`}
      />
    );

    onSave(res.data);
    onClose();
  } catch (error) {
    console.error("Error updating product:", error);
    toast(
      <CustomToast
        type="error"
        title="Update Failed"
        message={error.response?.data?.message || error.message}
      />
    );
  }
};

  if (!product) return null;

  return (
  <div className="glasso-modal-overlay" onClick={onClose}>
    <div className="glasso-modal-container" onClick={(e) => e.stopPropagation()}>
      <div className="glasso-modal-header">
        <h3 className="glasso-modal-title">Edit Product</h3>
        <button className="glasso-close-btn" onClick={onClose}>×</button>
      </div>

      <div className="glasso-modal-body">
        {[ 
          { label: "Product Code", name: "product_code" },
          { label: "Product Name", name: "p_name" },
          { label: "Image URL", name: "p_image" },
          { label: "Type", name: "p_type" },
          { label: "Color", name: "p_color" },
          { label: "HSN Code", name: "HSN_code" },
          { label: "GST Rate (%)", name: "GST_rate" }
        ].map(({ label, name }) => (
          <div className="glasso-input-group" key={name}>
            <label>{label}</label>
            <input
              type="text"
              name={name}
              value={editedProduct[name] || ""}
              onChange={handleChange}
            />
          </div>
        ))}

        <div className="glasso-input-group">
          <label>Category</label>
          <select
            name="cat_id"
            value={editedProduct.cat_id || ""}
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

        <div className="glasso-input-group" style={{ gridColumn: 'span 2' }}>
          <label>Description</label>
          <textarea
            name="p_description"
            value={editedProduct.p_description || ""}
            onChange={handleChange}
          />
        </div>

        {[
          { label: "Price Code", name: "price_code", disabled: true },
          { label: "Single Price", name: "single_price" },
          { label: "Sales 5-50", name: "sales_5_50" },
          { label: "Sales 50-100", name: "sales_50_100" },
          { label: "Sales 100+", name: "sales_100_above" }
        ].map(({ label, name, disabled }) => (
          <div className="glasso-input-group" key={name}>
            <label>{label}</label>
            <input
              type="number"
              name={name}
              value={price[name] || ""}
              onChange={handleChange}
              disabled={disabled}
            />
          </div>
        ))}
      </div>

      <div className="glasso-footer-buttons glasso-action-buttons">
        <button className="glasso-btn-cancel" onClick={onClose}>Cancel</button>
        <button className="glasso-btn-save" onClick={saveProduct}>Save</button>
      </div>
    </div>
  </div>
);

};

export default EditProductModal;
