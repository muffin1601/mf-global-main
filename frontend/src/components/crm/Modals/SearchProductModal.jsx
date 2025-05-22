import React, { useState } from 'react';
import { toast } from 'react-toastify';
import './styles/ActivityLogModal.css'; // Reuse your CSS

const SearchProductModal = ({ isOpen, onClose }) => {
  const [pCode, setPCode] = useState('');
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!pCode.trim()) {
      toast.error('Please enter a product code');
      return;
    }

    setLoading(true);
    setProduct(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/products/search?p_code=${pCode.trim()}`);
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
    { key: 'p_code', label: 'Product Code' },
    { key: 'p_name', label: 'Product Name' },
    { key: 'category', label: 'Category' },
    { key: 'price.mrp', label: 'MRP' },
    { key: 'price.sp', label: 'Selling Price' },
    { key: 'stock', label: 'Stock Quantity' },
    // Add more as needed
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
            <table className="activitylog-activity-table">
              <thead>
                <tr>
                  <th className="activitylog-th">Field</th>
                  <th className="activitylog-th">Value</th>
                </tr>
              </thead>
              <tbody>
                {fieldsToDisplay.map(({ key, label }) => {
                  const value = key.includes('.')
                    ? key.split('.').reduce((obj, prop) => (obj ? obj[prop] : ''), product)
                    : product[key];

                  return (
                    <tr key={key}>
                      <td className="activitylog-td">{label}</td>
                      <td className="activitylog-td">
                        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="activitylog-no-logs">No product found or searched yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchProductModal;
