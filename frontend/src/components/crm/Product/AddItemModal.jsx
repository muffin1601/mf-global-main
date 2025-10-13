import React, { useState } from "react";
import { FiX } from "react-icons/fi";
import "./styles/AddItemModal.css";

const AddItemModal = ({ onClose, onSave }) => {
  const [itemData, setItemData] = useState({
    name: "",
    hsn: "",
    qty: 1,
    price: "",
    discount: 0,
    tax: 0,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setItemData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = () => {
    if (!itemData.name || !itemData.price) {
      alert("Please enter item name and price");
      return;
    }
    onSave({
      ...itemData,
      qty: Number(itemData.qty),
      price: Number(itemData.price),
      discount: Number(itemData.discount),
      tax: Number(itemData.tax),
    });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content medium">
        <div className="modal-header">
          <h3>Create New Item</h3>
          <button className="close-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-row">
            <label>Item / Service Name</label>
            <input
              type="text"
              name="name"
              placeholder="Enter item name"
              value={itemData.name}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <label>HSN / SAC Code</label>
            <input
              type="text"
              name="hsn"
              placeholder="Optional"
              value={itemData.hsn}
              onChange={handleChange}
            />
          </div>

          <div className="form-grid">
            <div>
              <label>Qty</label>
              <input
                type="number"
                name="qty"
                min="1"
                value={itemData.qty}
                onChange={handleChange}
              />
            </div>

            <div>
              <label>Price/Item (₹)</label>
              <input
                type="number"
                name="price"
                min="0"
                value={itemData.price}
                onChange={handleChange}
              />
            </div>

            <div>
              <label>Discount (%)</label>
              <input
                type="number"
                name="discount"
                min="0"
                value={itemData.discount}
                onChange={handleChange}
              />
            </div>

            <div>
              <label>Tax (%)</label>
              <input
                type="number"
                name="tax"
                min="0"
                value={itemData.tax}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-save" onClick={handleSubmit}>
            Add Item
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddItemModal;
