import React, { useState, useEffect } from "react";
import { FiX, FiSearch } from "react-icons/fi";
import axios from "axios";
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

  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/products`);
        const fetchedProducts = res.data.products || [];
        setProducts(fetchedProducts);
      } catch (err) {
        console.error("Error fetching products:", err);
      }
      setLoading(false);
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredProducts([]);
      return;
    }
    const lower = searchTerm.toLowerCase();
    const matches = products.filter(
      (p) =>
        p.p_name?.toLowerCase().includes(lower) ||
        p.p_code?.toLowerCase().includes(lower) ||
        p.HSN_code?.toLowerCase().includes(lower)
    );
    setFilteredProducts(matches.slice(0, 6));
  }, [searchTerm, products]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setItemData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProductSelect = (product) => {
    setItemData({
      name: product.p_name || "",
      hsn: product.HSN_code || "",
      qty: 1,
      price: product.p_price?.sales_5_50 || product.p_price?.basic_amount || 0,
      discount: 0,
      tax: product.GST_rate || 0,
    });
    setSearchTerm(product.p_name);
    setFilteredProducts([]);
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
    <div className="additem-modal__overlay">
      <div className="additem-modal__content">
        <div className="additem-modal__header">
          <h3 className="additem-modal__title">Create New Item</h3>
          <button className="additem-modal__close-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        {/* SEARCH BAR */}
        <div className="additem-modal__search-box">
          <div className="additem-modal__search-input-wrapper">
            <FiSearch className="additem-modal__search-icon" />
            <input
              type="text"
              placeholder="Search existing products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="additem-modal__search-input"
            />
          </div>
          {loading && <span className="additem-modal__loading">Loading...</span>}
          {filteredProducts.length > 0 && (
            <ul className="additem-modal__suggestions">
              {filteredProducts.map((prod) => (
                <li
                  key={prod._id}
                  onClick={() => handleProductSelect(prod)}
                  className="additem-modal__suggestion-item"
                >
                  <strong>{prod.p_name}</strong>
                  <span>
                    (HSN: {prod.HSN_code || "—"} | ₹
                    {prod.p_price?.sales_5_50 ||
                      prod.p_price?.basic_amount ||
                      "—"}
                    )
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* FORM */}
        <div className="additem-modal__body">
          <div className="additem-modal__form-row">
            <label>Item / Service Name</label>
            <input
              type="text"
              name="name"
              placeholder="Enter item name"
              value={itemData.name}
              onChange={handleChange}
            />
          </div>

          <div className="additem-modal__form-row">
            <label>HSN / SAC Code</label>
            <input
              type="text"
              name="hsn"
              placeholder="Optional"
              value={itemData.hsn}
              onChange={handleChange}
            />
          </div>

          <div className="additem-modal__form-grid">
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

        {/* FOOTER */}
        <div className="additem-modal__footer">
          <button className="additem-modal__cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="additem-modal__save-btn" onClick={handleSubmit}>
            Add Item
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddItemModal;
