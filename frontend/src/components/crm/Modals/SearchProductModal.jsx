import React, { useState } from "react";
import { toast } from "react-toastify";
import CustomToast from "../CustomToast";

const PriceCard = ({ product, taxRate }) => (
  <div className="premium-price-card">
    <h4>Pricing Details</h4>

    <div className="pp-row">
      <span>Price Code</span>
      <strong>{product.p_price?.price_code || "—"}</strong>
    </div>

    <div className="pp-row">
      <span>Basic Amount</span>
      <strong>{product.p_price?.basic_amount || "—"}</strong>
    </div>

    <div className="pp-row">
      <span>GST%</span>
      <strong>{product.p_price?.GST_rate || "—"}</strong>
    </div>

    <div className="pp-row total">
      <span>Net (Incl. Tax)</span>
      <strong>
        {product.p_price?.net_amount
          ? (Number(product.p_price.net_amount) + 
             (Number(product.p_price.net_amount) * taxRate) / 100).toFixed(0)
          : "—"}
      </strong>
    </div>
  </div>
);

const SearchProductModal = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [taxRate, setTaxRate] = useState(0);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast(
        <CustomToast
          type="warning"
          title="Empty Search"
          message="Enter product name, code, or color."
        />
      );
      return;
    }

    try {
      setLoading(true);
      const url = `${import.meta.env.VITE_API_URL
        }/products/search?query=${encodeURIComponent(searchTerm)}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data.products?.length) {
        toast(
          <CustomToast
            type="error"
            title="No Results"
            message="No matching product found."
          />
        );
        return;
      }

      setProducts(data.products);

      toast(
        <CustomToast
          type="success"
          title="Search Successful"
          message={`Found ${data.products.length} product(s).`}
        />
      );
    } catch (err) {
      toast(
        <CustomToast
          type="error"
          title="Search Failed"
          message={err.message}
        />
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEnter = (e) => e.key === "Enter" && handleSearch();

  if (!isOpen) return null;

  return (
    <div className="new-modal-overlay">
      <div className="new-modal">

        <div className="new-modal-header">
          <h2>Search Products</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* SEARCH INPUTS */}
        <div className="new-search-bar">
          <input
            type="text"
            className="new-search-input-2"
            placeholder="Search by name, code, material, color..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleEnter}
          />

          <input
            type="number"
            className="new-tax-input"
            placeholder="Tax %"
            value={taxRate}
            onChange={(e) => setTaxRate(Number(e.target.value))}
          />

          <button className="new-search-btn" onClick={handleSearch}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {/* PRODUCT GRID */}
        <div className="product-grid">
          {products.map((p) => (
            <div key={p._id} className="product-card glass-card">

              <a
                href={`${import.meta.env.VITE_IMAGE_URL}${p.p_image}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={`${import.meta.env.VITE_IMAGE_URL}${p.p_image}`}
                  className="product-img"
                  alt={p.p_name}
                  style={{ cursor: "pointer" }}
                />
              </a>

              <h3>{p.p_name}</h3>

              <p className="p-meta">
                <strong>Code:</strong> {p.p_code} | {p.s_code}
              </p>

              <p className="p-line">
                <span>Material:</span> {p.p_type}
              </p>

              <p className="p-line">
                <span>Color:</span> {p.p_color}
              </p>

              <p className="p-desc">{p.p_description || "No description"}</p>

              <p className="p-dim">
                <span>Dimensions: </span> {p.dimension || "—"}
              </p>

              <button
                className="view-price-btn"
                onClick={() =>
                  setExpandedProduct(expandedProduct === p._id ? null : p._id)
                }
              >
                {expandedProduct === p._id ? "Hide Price" : "Show Price"}
              </button>

              {expandedProduct === p._id && (
                <PriceCard product={p} taxRate={taxRate} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchProductModal;



const css = `
/* -------- FULLSCREEN BLURRED OVERLAY -------- */
.new-modal-overlay {
  position: fixed;
  inset: 0;
  backdrop-filter: blur(14px);
  background: rgba(0, 0, 0, 0.28);
  display: flex;
  justify-content: center;
  align-items: center;
  
  z-index: 20000;
  padding: 20px;
}

/* -------- MODAL CONTAINER -------- */
.new-modal {
  width: 90%;
  height: 95%;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 22px;
  padding: 20px;
  backdrop-filter: blur(18px);
  border: 1px solid rgba(255,255,255,0.3);
  box-shadow: 0 10px 40px rgba(0,0,0,0.25);
  overflow-y: auto;
}

/* -------- HEADER -------- */
.new-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(255,255,255,0.3);
}

.new-modal-header h2 {
  font-family: "Outfit", sans-serif;
  font-size: 1.6rem;
  color: #fff;
}

.close-btn {
  background: rgba(255,255,255,0.2);
  border: 0;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 18px;
  cursor: pointer;
  color: #fff;
  transition: 0.2s ease;
}

.close-btn:hover {
  background: rgba(255,255,255,0.35);
}

/* -------- SEARCH BAR -------- */
.new-search-bar {
  margin-top: 18px;
  display: flex;
  gap: 12px;
}

.new-search-input-2,
.new-tax-input {
  flex: 1;
  padding: 12px 14px;
  font-family: "Outfit", sans-serif;
  border-radius: 12px;
  border: 1px solid rgba(117, 117, 117, 0.49);
  background: rgba(0, 0, 0, 0.14);
  color: #ffffffff;
  font-size: 16px;
  backdrop-filter: blur(10px);
}
  .new-search-input-2::placeholder{
  color : #fff;}

.new-search-btn {
  padding: 12px 18px;
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1, #4338ca);
  color: #fff;
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-family: "Outfit";
}

.new-search-btn:hover {
  opacity: 0.9;
}

/* -------- PRODUCT GRID -------- */
.product-grid {
  margin-top: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill,minmax(260px,1fr));
  gap: 20px;
}

/* -------- PRODUCT CARD -------- */
.product-card {
  padding: 18px;
  border-radius: 18px;
  text-align: center;
  color: #fff;
}

.glass-card {
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255,255,255,0.35);
  box-shadow: 0 6px 20px rgba(0,0,0,0.25);
  backdrop-filter: blur(16px);
}

.product-img {
  width: 120px;
  height: 120px;
  object-fit: contain;
  border-radius: 12px;
  margin-bottom: 10px;
}

/* -------- TEXT -------- */
.p-meta {
  opacity: 0.85;
}

.p-line {
  margin: 4px 0;
}

.p-desc, .p-dim {
  margin-top: 8px;
  background: rgba(255,255,255,0.2);
  padding: 8px;
  border-radius: 10px;
  font-size: 0.85rem;
}

/* -------- PRICE CARD -------- */
.premium-price-card {
  background: rgba(255,255,255,0.25);
  padding: 14px;
  border-radius: 14px;
  margin-top: 12px;
  border: 1px solid rgba(255,255,255,0.4);
  backdrop-filter: blur(12px);
}

.pp-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
}

.pp-row.total {
  border-top: 1px solid rgba(255,255,255,0.3);
  margin-top: 6px;
  padding-top: 10px;
  font-weight: bold;
}

/* -------- BUTTONS -------- */

.view-price-btn {
  width: 100%;
  padding: 10px;
  border-radius: 12px;
  margin-top: 12px;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  font-family: "Outfit";
  color: #fff;
  font-weight: 500;

  background: linear-gradient(135deg, #06b6d4, #3b82f6);
  box-shadow: 0 4px 12px rgba(59,130,246,0.35);
  transition: 0.25s ease-in-out;
}

.view-price-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59,130,246,0.5);
  background: linear-gradient(135deg, #3b82f6, #4338ca);
}

/* --- Search Button (more premium) --- */
.new-search-btn {
  padding: 12px 20px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-family: "Outfit";
  color: #fff;

  background: linear-gradient(135deg, #10b981, #059669);
  box-shadow: 0 4px 12px rgba(16,185,129,0.35);

  transition: 0.25s ease-in-out;
}

.new-search-btn:hover {
  transform: translateY(-2px);
  opacity: 0.95;
  box-shadow: 0 6px 16px rgba(16,185,129,0.5);
}

/* --- Close Button improved --- */
.close-btn {
  background: rgba(255,255,255,0.22);
  border: 1px solid rgba(255,255,255,0.4);
  padding: 8px 12px;
  border-radius: 10px;
  color: #fff;
  font-size: 18px;
  cursor: pointer;

  transition: 0.25s ease-in-out;
  backdrop-filter: blur(8px);
}

.close-btn:hover {
  background: rgba(255,255,255,0.35);
  transform: scale(1.07);
}

/* --- Optional: Add small category color accents to product cards --- */
.product-card:hover {
  border: 1px solid rgba(255,255,255,0.7);
  transform: translateY(-4px);
  box-shadow: 0 10px 25px rgba(0,0,0,0.35);
  transition: 0.25s;
}


`;

const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);
