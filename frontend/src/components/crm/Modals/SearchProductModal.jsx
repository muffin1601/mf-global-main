import React, { useState } from 'react';
import { toast } from 'react-toastify';


const SearchProductModal = ({ isOpen, onClose }) => {
  const [pCode, setPCode] = useState('');
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPrice, setShowPrice] = useState(false);

  const handleSearch = async () => {
    if (!pCode.trim()) {
      toast.error('Please enter a product code');
      return;
    }

    setLoading(true);
    setProduct(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/products/search?product_code=${pCode.trim()}`);
      if (!response.ok) throw new Error('Product not found');
      const data = await response.json();
      setProduct(data.product);
    } catch (err) {
      console.error('Search error:', err);
      toast.error('Product not found');
    } finally {
      setLoading(false);
    }
  };


  const fieldsToDisplay = [
  { key: 'product_code', label: 'Product Code' },
  { key: 'p_name', label: 'Product Name' },
  // { key: 'cat_id', label: 'Category ID' },
  // { key: 'p_image', label: 'Image URL' },
  { key: 'p_description', label: 'Description' },
  { key: 'p_type', label: 'Type' },
  { key: 'p_color', label: 'Color' },
  { key: 'HSN_code', label: 'HSN Code' },
  { key: 'GST_rate', label: 'GST Rate (%)' },
  { key: 'p_price.price_code', label: 'Price Code' },
  { key: 'p_price.single_price', label: 'Single Price' },
  { key: 'p_price.sales_5_50', label: 'Price (5-50 units)' },
  { key: 'p_price.sales_50_100', label: 'Price (50-100 units)' },
  { key: 'p_price.sales_100_above', label: 'Price (100+ units)' }
];


  if (!isOpen) return null;

  return (
    <div className="activitylog-modal-overlay">
      <div className="activitylog-modal-content">
        <div className="activitylog-title">Search Product by Code</div>

        <div className="activitylog-form-section">
          <div className="activitylog-form-group">
            <label className="activitylog-label">Product Code</label>
            <input
              type="text"
              className="activitylog-date-input"
              placeholder="e.g. P12345"
              value={pCode}
              onChange={(e) => setPCode(e.target.value)}
            />
          </div>
          <div className="activitylog-modal-buttons">
            <button className="activitylog-fetch-btn" onClick={handleSearch} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button className="activitylog-close-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="activitylog-results">
          {product ? (
            <>
              <table className="activitylog-activity-table">
                <thead>
                  <tr>
                    <th className="activitylog-th">Product Code</th>
                    <th className="activitylog-th">Name</th>
                    {/* <th className="activitylog-th">Category ID</th> */}
                    <th className="activitylog-th">Type</th>
                    <th className="activitylog-th">Color</th>
                    <th className="activitylog-th">HSN Code</th>
                    <th className="activitylog-th">GST Rate (%)</th>
                    {/* <th className="activitylog-th">Image</th> */}
                    <th className="activitylog-th">Description</th>
                    <th className="activitylog-th">Price Details</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="activitylog-td">{product.product_code}</td>
                    <td className="activitylog-td">{product.p_name}</td>
                    {/* <td className="activitylog-td">{product.cat_id}</td> */}
                    <td className="activitylog-td">{product.p_type}</td>
                    <td className="activitylog-td">{product.p_color}</td>
                    <td className="activitylog-td">{product.HSN_code}</td>
                    <td className="activitylog-td">{product.GST_rate}%</td>
                    {/* <td className="activitylog-td">
                      {product.p_image ? (
                        <img src={product.p_image} alt="Product" style={{ width: '50px', height: '50px' }} />
                      ) : 'N/A'}
                    </td> */}
                    <td className="activitylog-td">{product.p_description || '—'}</td>
                    <td className="activitylog-td">
                      <button onClick={() => setShowPrice(!showPrice)}>
                        {showPrice ? 'Hide' : 'Show'} Price
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>

              {showPrice && (
                <table className="activitylog-activity-table" style={{ marginTop: '1rem' }}>
                  <thead>
                    <tr>
                      <th className="activitylog-th">Price Code</th>
                      <th className="activitylog-th">Single Price</th>
                      <th className="activitylog-th">5-50 Sales</th>
                      <th className="activitylog-th">50-100 Sales</th>
                      <th className="activitylog-th">100+ Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="activitylog-td">{product.p_price?.price_code || '—'}</td>
                      <td className="activitylog-td">{product.p_price?.single_price}</td>
                      <td className="activitylog-td">{product.p_price?.sales_5_50}</td>
                      <td className="activitylog-td">{product.p_price?.sales_50_100}</td>
                      <td className="activitylog-td">{product.p_price?.sales_100_above}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <div className="activitylog-no-logs">No product found or searched yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchProductModal;

const css = `

.activitylog-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.44);
  display: flex;
  border-radius: 20px;
  justify-content: center;
  align-items: center;
  z-index: 99999;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* CONTAINER (glass card) */
.activitylog-modal-content {
  width: 700px;
  max-width: calc(100% - 2rem);
  max-height: 90%;
  overflow-y: auto;
  backdrop-filter: blur(14px) saturate(120%);
  -webkit-backdrop-filter: blur(14px) saturate(120%);
  background: rgba(255, 255, 255, 0.87);
  border-radius: 20px;
  padding: 1.6rem 1.6rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.34);
  background-size: cover;
  background-position: center;
  scroll-behavior: smooth;
  transition: transform 180ms ease, opacity 180ms ease;
}

/* Nice appear animation */
.activitylog-modal-content.show {
  transform: translateY(0);
  opacity: 1;
}

/* HEADER */
.activitylog-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.activitylog-title {
  font-size: 1.4rem;
  color: #313131;
  font-weight: 600;
  margin: 0;
  font-family: 'Outfit', sans-serif;
}

.activitylog-close-btn {
  font-size: 0.95rem;
  color: #fff;
  background: rgba(200, 0, 0, 0.72);
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.activitylog-close-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(200,0,0,0.14); }

/* FORM / BODY GRID */
.activitylog-form-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
}

/* INPUT GROUPS */
.activitylog-form-group {
  display: flex;
  flex-direction: column;
}

.activitylog-label {
  color: #292929;
  margin-bottom: 0.35rem;
  font-size: 0.92rem;
  font-weight: 500;
}


.activitylog-date-input,
.activitylog-modal-content select,
.activitylog-modal-content textarea {
  padding: 0.55rem 0.9rem;
  border-radius: 10px;
  border: none;
  outline: none;
  font-family: 'Outfit', sans-serif;
  background: rgba(255, 255, 255, 0.84);
  color: #000;
  height: 2.5rem;
  box-shadow: inset 0 1px 0 rgba(0,0,0,0.03);
}


.activitylog-modal-content select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1rem;
  padding-right: 2.25rem;
  height: 2.5rem;
}


.activitylog-modal-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  align-items: center;
  margin-top: 0.5rem;
  grid-column: 1 / -1; 
}


.activitylog-fetch-btn {
  padding: 0.55rem 1rem;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-family: 'Outfit', sans-serif;
  white-space: nowrap;
  background: rgba(23, 146, 23, 1);
  color: #fff;
  transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.12s ease;
}
.activitylog-fetch-btn:hover {
  background: rgba(18, 120, 18, 0.98);
  box-shadow: 0 6px 18px rgba(18,120,18,0.12);
  transform: translateY(-1px);
}


.activitylog-close-btn.secondary {
  background: rgba(223, 47, 47, 0.77);
   font-family: 'Outfit', sans-serif;
  color: #222;
}
.activitylog-close-btn.secondary:hover {
  background: rgba(133, 41, 41, 0.63);
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}

/* RESULTS */
.activitylog-results {
  margin-top: 1rem;
}

/* TABLE */
.activitylog-activity-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Outfit', sans-serif;
  background: transparent;
  table-layout: auto;
}

.activitylog-activity-table thead tr {
  background: rgba(0,0,0,0.03);
}

.activitylog-th {
  text-align: left;
  padding: 0.6rem 0.65rem;
  font-weight: 700;
  font-size: 0.92rem;
  color: #222;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}

.activitylog-td {
  padding: 0.6rem 0.65rem;
  font-size: 0. nine rem; /* fallback */
  font-size: 0.92rem;
  color: #2b2b2b;
  border-bottom: 1px dashed rgba(0,0,0,0.04);
  vertical-align: middle;
  word-break: break-word;
}


.activitylog-td button {
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  border: none;
   font-family: 'Outfit', sans-serif;
  background: rgba(0, 102, 204, 0.12);
  color: #004a99;
  cursor: pointer;
  font-weight: 600;
}
.activitylog-td button:hover {
  background: rgba(0, 102, 204, 0.18);
  transform: translateY(-1px);
}

/* Price details sub-table spacing */
.activitylog-activity-table + .activitylog-activity-table {
  margin-top: 1rem;
}

/* NO RESULTS */
.activitylog-no-logs {
  padding: 1.25rem;
  color: #4a4a4a;
  background: rgba(0,0,0,0.02);
  border-radius: 10px;
  text-align: center;
  font-size: 0.98rem;
}


.activitylog-modal-content {
  scrollbar-width: thin;
  scrollbar-color: rgba(100,100,100,0.5) rgba(200,200,200,0.18);
}
.activitylog-modal-content::-webkit-scrollbar {
  width: 12px;
}
.activitylog-modal-content::-webkit-scrollbar-track {
  background: rgba(200,200,200,0.14);
  border-radius: 10px;
}
.activitylog-modal-content::-webkit-scrollbar-thumb {
  background-color: rgba(100,100,100,0.5);
  border-radius: 10px;
  border: 3px solid rgba(200,200,200,0.18);
}
.activitylog-modal-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(80,80,80,0.72);
  transform: scaleX(1.05);
}

/* RESPONSIVE */
@media (max-width: 640px) {
  .activitylog-modal-content {
    padding: 1rem;
    width: calc(100% - 2rem);
    border-radius: 14px;
  }
  .activitylog-form-section {
    grid-template-columns: 1fr;
  }
  .activitylog-modal-buttons {
    justify-content: center;
  }
}

/* Small helpers */
.activitylog-muted {
  color: #666;
  font-size: 0. nine rem;
}
.activitylog-bold {
  font-weight: 600;
}
`;    

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);