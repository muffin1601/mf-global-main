import React, { useState, useEffect } from "react";
import { FiX, FiSearch } from "react-icons/fi";
import axios from "axios";
import "./styles/AddItemModal.css";

const AddItemModal = ({ onClose, onSave }) => {
  const [itemData, setItemData] = useState({
    name: "",
    style_code: "",
    qty: 1,
    price: "",
    discount: 0,
    tax: 0,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // -------------------------------
  // Fetch products on load
  // -------------------------------
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/products`);
        setProducts(res.data.products || []);
      } catch (err) {
        console.error("Error fetching products:", err);
      }
      setLoading(false);
    };
    fetchProducts();
  }, []);

  // -------------------------------
  // Smart GST extraction
  // -------------------------------
  const extractGST = (p) => {
    if (p?.p_price?.GST_rate !== undefined) return Number(p.p_price.GST_rate);
    if (p?.GST_rate !== undefined) return Number(p.GST_rate);
    return 0;
  };

  // -------------------------------
  // Smart price auto selector
  // -------------------------------
  const extractPrice = (p) => {
    if (p?.p_price?.sales_5_50) return p.p_price.sales_5_50;
    if (p?.p_price?.sales_50_100) return p.p_price.sales_50_100;
    if (p?.p_price?.sales_100_above) return p.p_price.sales_100_above;
    if (p?.p_price?.basic_amount) return p.p_price.basic_amount;
    return 0;
  };

  // -------------------------------
  // Filter suggestions
  // -------------------------------
  useEffect(() => {
    if (!searchTerm) {
      setFilteredProducts([]);
      return;
    }

    const lower = searchTerm.toLowerCase();

    const matches = products.filter((p) =>
      (p.p_name || "").toLowerCase().includes(lower) ||
      (p.p_code || "").toLowerCase().includes(lower) ||
      (p.s_code || "").toLowerCase().includes(lower) ||
      (p.HSN_code || "").toLowerCase().includes(lower) ||
      (p.cat_id || "").toLowerCase().includes(lower)
    );

    setFilteredProducts(matches.slice(0, 8));
  }, [searchTerm, products]);

  // -------------------------------
  // Select product
  // -------------------------------
  const handleProductSelect = (product) => {
    const gstValue = extractGST(product);
    const priceValue = extractPrice(product);

    setItemData({
      name: product.p_name,
      style_code: product.s_code || "",
      qty: 1,
      price: priceValue,
      discount: 0,
      tax: gstValue,
    });

    setSearchTerm(product.p_name);
    setFilteredProducts([]);
  };

  // -------------------------------
  // Input handler
  // -------------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setItemData((prev) => ({ ...prev, [name]: value }));
  };

  // -------------------------------
  // Submit handler
  // -------------------------------
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
              placeholder="Search by name, style code, product code, HSN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="additem-modal__search-input"
              autoFocus
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
                  <div className="suggestion-details">
                    <span>Style: {prod.s_code || "—"}</span>
                    <span>Code: {prod.p_code || "—"}</span>
                    <span>HSN: {prod.HSN_code || "—"}</span>
                    <span>GST: {extractGST(prod)}%</span>
                    <span>₹{extractPrice(prod)}</span>
                  </div>
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
              value={itemData.name}
              onChange={handleChange}
              placeholder="Enter item name"
            />
          </div>

          <div className="additem-modal__form-row">
            <label>Style Code</label>
            <input
              type="text"
              name="style_code"
              value={itemData.style_code}
              onChange={handleChange}
              placeholder="e.g., ST-2024"
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
              <label>GST (%)</label>
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
