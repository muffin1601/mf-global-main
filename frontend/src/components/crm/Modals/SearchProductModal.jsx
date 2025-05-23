import React, { useState } from 'react';
import { toast } from 'react-toastify';
import './styles/ActivityLogModal.css'; // Reuse your CSS

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

  // ✅ Define the fields outside JSX
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
