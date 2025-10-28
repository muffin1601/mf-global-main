import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import CustomToast from '../CustomToast';

const EditProductModal = ({ product, onClose, onSave }) => {
  const [editedProduct, setEditedProduct] = useState({
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
      net_amount: ''
    }
  });

  const [categoryNames, setCategoryNames] = useState([]);


  useEffect(() => {
    if (product) {
      setEditedProduct({
        s_code: product.s_code || '',
        p_name: product.p_name || '',
        p_type: product.p_type || '',
        p_color: product.p_color || '',
        HSN_code: product.HSN_code || '',
        cat_id: product.cat_id || '',
        p_description: product.p_description || '',
        p_price: {
          purchase_price: product.p_price?.purchase_price || '',
          basic_amount: product.p_price?.basic_amount || '',
          GST_rate: product.p_price?.GST_rate || '',
          net_amount: product.p_price?.net_amount || ''
        }
      });
    }
  }, [product]);

 
  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/products/meta`)
      .then((res) => setCategoryNames(res.data.cat_names))
      .catch((err) => console.error('Error fetching categories:', err));
  }, []);

 
  useEffect(() => {
    const { basic_amount, GST_rate } = editedProduct.p_price;
    if (basic_amount && GST_rate) {
      const basic = parseFloat(basic_amount);
      const gst = parseFloat(GST_rate);
      const net = basic + (basic * gst) / 100;
      setEditedProduct((prev) => ({
        ...prev,
        p_price: { ...prev.p_price, net_amount: net.toFixed(2) },
      }));
    }
  }, [editedProduct.p_price.basic_amount, editedProduct.p_price.GST_rate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name in editedProduct.p_price) {
      setEditedProduct((prev) => ({
        ...prev,
        p_price: { ...prev.p_price, [name]: value },
      }));
    } else {
      setEditedProduct((prev) => ({ ...prev, [name]: value }));
    }
  };

  const saveProduct = async () => {
    try {
      const payload = {
        _id: product._id,
        ...editedProduct,
        p_price: {
          price_code: product.p_price?.price_code,
          purchase_price: Number(editedProduct.p_price.purchase_price),
          basic_amount: Number(editedProduct.p_price.basic_amount),
          GST_rate: Number(editedProduct.p_price.GST_rate),
          net_amount: Number(editedProduct.p_price.net_amount),
        },
      };

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
      console.error('Error updating product:', error);
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
            { label: 'Style Code', name: 's_code' },
            { label: 'Product Name', name: 'p_name' },
            { label: 'Material Type', name: 'p_type' },
            { label: 'Color', name: 'p_color' },
            { label: 'HSN Code', name: 'HSN_code' },
          ].map(({ label, name }) => (
            <div className="glasso-input-group" key={name}>
              <label>{label}</label>
              <input
                type="text"
                name={name}
                value={editedProduct[name] || ''}
                onChange={handleChange}
              />
            </div>
          ))}

          
          <div className="glasso-input-group">
            <label>Category</label>
            <select
              name="cat_id"
              value={editedProduct.cat_id || ''}
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

       
          <div className="glasso-input-group" style={{ gridColumn: 'span 2' }}>
            <label>Description</label>
            <textarea
              name="p_description"
              value={editedProduct.p_description || ''}
              onChange={handleChange}
            />
          </div>

       
          <div className="glasso-input-group">
            <label>Purchase Amount</label>
            <input
              type="number"
              name="purchase_price"
              value={editedProduct.p_price.purchase_price || ''}
              onChange={handleChange}
            />
          </div>

          <div className="glasso-input-group">
            <label>Basic Amount</label>
            <input
              type="number"
              name="basic_amount"
              value={editedProduct.p_price.basic_amount || ''}
              onChange={handleChange}
            />
          </div>

          
          <div className="glasso-input-group">
            <label>GST Rate (%)</label>
            <select
              name="GST_rate"
              value={editedProduct.p_price.GST_rate || ''}
              onChange={handleChange}
            >
              <option value="">Select GST</option>
              <option value="5">5%</option>
              <option value="18">18%</option>
            </select>
          </div>


          <div className="glasso-input-group">
            <label>Net Amount</label>
            <input
              type="number"
              name="net_amount"
              value={
                editedProduct.p_price?.net_amount
                  ? Math.round(editedProduct.p_price.net_amount)
                  : ''
              }
              readOnly
              style={{ backgroundColor: '#f5f5f5' }}
            />
          </div>
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
