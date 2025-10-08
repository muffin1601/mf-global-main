import React, { useState } from 'react';
import { toast } from 'react-toastify';
import CustomToast from '../CustomToast';
import QuotationModal from './QuotationModal';

const calculatePriceWithTax = (basePrice, taxRate) => {
  if (!basePrice) return '—';
  const numericBasePrice = Number(basePrice);
  if (isNaN(numericBasePrice)) return '—';
  return (numericBasePrice * (1 + taxRate / 100)).toFixed(2);
};

const PriceDetails = ({ product, taxRate }) => (
  <table className="price-details-table">
    <thead>
      <tr>
        <th>Price Code</th>
        <th>Single Price (Tax Inc.)</th>
        <th>5–50 Sales (Tax Inc.)</th>
        <th>50–100 Sales (Tax Inc.)</th>
        <th>100+ Sales (Tax Inc.)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>{product.p_price?.price_code || '—'}</td>
        <td>{calculatePriceWithTax(product.p_price?.single_price, taxRate)}</td>
        <td>{calculatePriceWithTax(product.p_price?.sales_5_50, taxRate)}</td>
        <td>{calculatePriceWithTax(product.p_price?.sales_50_100, taxRate)}</td>
        <td>{calculatePriceWithTax(product.p_price?.sales_100_above, taxRate)}</td>
      </tr>
    </tbody>
  </table>
);

const SearchProductModal = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPrice, setShowPrice] = useState(null);
  const [taxRate, setTaxRate] = useState(0);

  // Phase 3 state
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isQuotationOpen, setIsQuotationOpen] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast(
        <CustomToast
          type="warning"
          title="Missing Search Term"
          message="Please enter a product name, code, type, or color to search."
        />
      );
      return;
    }

    try {
      setLoading(true);
      setProducts([]);

      const url = `${import.meta.env.VITE_API_URL}/products/search?query=${encodeURIComponent(searchTerm)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || !data.products || data.products.length === 0) {
        toast(
          <CustomToast
            type="error"
            title="No Products Found"
            message="No products matched your search term."
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
          message={err.message || 'Failed to search products. Please try again.'}
        />
      );
    } finally {
      setLoading(false);
    }
  };

  const addToQuotation = (product) => {
    if (selectedProducts.find((p) => p._id === product._id)) {
      toast(
        <CustomToast
          type="warning"
          title="Already Added"
          message={`${product.p_name} is already added to the quotation.`}
        />
      );
      return;
    }
    setSelectedProducts([...selectedProducts, product]);
    toast(
      <CustomToast
        type="success"
        title="Added to Quotation"
        message={`${product.p_name} added successfully.`}
      />
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="search-product-modal-overlay">
        <div className="search-product-modal-content">
          <div className="modal-title">Product Search & Pricing</div>

          <div className="form-group-row">
            <div className="form-group search-group">
              <label htmlFor="search-input" className="tax-label">Search</label>
              <input
                id="search-input"
                type="text"
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by code, name, type, color, or HSN..."
              />
            </div>

            <div className="form-group tax-group">
              <label htmlFor="tax-rate-input" className="tax-label">Apply Tax (%)</label>
              <input
                id="tax-rate-input"
                type="number"
                className="search-input tax-input"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                placeholder="e.g., 18"
                min="0"
              />
            </div>
          </div>

          <div className="modal-buttons">
            <button
              className="search-btn"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button className="close-btn-2" onClick={onClose}>
              Close
            </button>
          </div>

          <div className="search-results">
            {products.length > 0 ? (
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Color</th>
                    <th>HSN</th>
                    <th>GST Rate</th>
                    <th>Description</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <React.Fragment key={p._id}>
                      <tr>
                        <td>{p.product_code}</td>
                        <td>{p.p_name}</td>
                        <td>{p.p_type}</td>
                        <td>{p.p_color}</td>
                        <td>{p.HSN_code}</td>
                        <td>{p.GST_rate}%</td>
                        <td>{p.p_description || '—'}</td>
                        <td>
                          <button
                            className="price-btn"
                            onClick={() =>
                              setShowPrice(showPrice === p._id ? null : p._id)
                            }
                          >
                            {showPrice === p._id ? 'Hide' : 'Show'} Price
                          </button>
                          <button className="add-btn" onClick={() => addToQuotation(p)}>+ Add</button>
                        </td>
                      </tr>
                      {showPrice === p._id && (
                        <tr>
                          <td colSpan="8" className="price-details-cell">
                            <PriceDetails product={p} taxRate={taxRate} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="no-results-message">
                No product found or searched yet.
              </div>
            )}
          </div>

          <button className='quote-show' onClick={() => setIsQuotationOpen(true)}>View Quotation List</button>
        </div>
      </div>

      <QuotationModal
        isOpen={isQuotationOpen}
        onClose={() => setIsQuotationOpen(false)}
        selectedProducts={selectedProducts}
      />
    </>
  );
};

export default SearchProductModal;

const css = `
.search-product-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.44);
  display: flex;
  justify-content: center;
   border-radius:20px;
  align-items: center;
  z-index: 99999;
}

.search-product-modal-content {
  width: 90%; 
  max-width: calc(100% - 2rem);
  max-height: 90%;
  overflow-y: auto;
  backdrop-filter: blur(14px) saturate(120%);
  background: rgba(255, 255, 255, 0.95); 
  border-radius: 20px;
  padding: 1.6rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.34);
}

.modal-title {
  font-size: 1.6rem;
  color: #313131;
  font-weight: 600;
  margin-bottom: 20px;
  text-align: center;
  font-family: 'Outfit', sans-serif;
}

.form-group-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-group.search-group {
  flex-grow: 1;
}

.form-group.tax-group {
  flex-shrink: 0;
  width: 200px;
}

.tax-label {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: #555;
  margin-bottom: 0.25rem;
  font-family: 'Outfit', sans-serif;
}

.search-input {
  font-size: 1rem;
  border-radius: 12px;
  width: 100%;
  font-family: 'Outfit', sans-serif;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: #fff;
  transition: all 0.18s ease;
}

.search-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.2);
}

.modal-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  align-items: center;
  margin-top: 1rem;
  margin-bottom: 1.5rem;
}

.search-btn {
  padding: 0.55rem 1rem;
  border-radius: 10px;
  border: none;
  font-family: 'Outfit', sans-serif;
  cursor: pointer;
  background: #007bff;
  color: #fff;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.search-btn:hover:not(:disabled) {
  background: #0056b3;
}

.search-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.close-btn-2 {
  font-size: 0.95rem;
  color: #fff;
  background: #dc3545;
  border: none;
  font-family: 'Outfit', sans-serif;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.close-btn-2:hover {
  background: #c82333;
}

.quote-show{
font-size: 0.95rem;
  color: #fff;
  background: #42940bff;
  border: none;
  font-family: 'Outfit', sans-serif;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  cursor: pointer;
  margin-top:20px;
  transition: background-color 0.2s ease;
}
  .quote-show:hover{
  background: #34720bff;
  }

.products-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Outfit', sans-serif;
  border: 1px solid rgba(0,0,0,0.1); 
  border-radius: 10px;
  overflow: hidden; 
}

.products-table th, .products-table td {
  padding: 0.7rem;
  font-size: 0.9rem;
  text-align: left;
  border-bottom: 1px solid rgba(0,0,0,0.08);
}

.products-table th {
  font-weight: 600;
  color: #333;
  background: #f8f9fa;
  white-space: nowrap; 
}

.products-table tbody tr:hover {
  background: #f1f1f1;
}

.products-table button {
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  border: none;
  
  color: #ffffffff;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s ease;
  font-family: 'Outfit', sans-serif;
}
.price-btn {
 
  background: #0246acff;
  color: #ffffff;
}

.price-btn:hover {
  
  background: #002f83ff;
}

.add-btn {
 
  margin-left: 10px;
  background: #ff3907ff;
  color: #ffffff; 
}

.add-btn:hover {
  
  background: #c83000ff;
}

.modal-content-area {
  background: #f0f4f8; 
  border: 1px solid #cbd5e1;
}


.modal-title {
  color: #334155;
}
.no-results-message {
  padding: 1.5rem;
  color: #555;
  text-align: center;
  background: #f8f9fa;
  border-radius: 10px;
  margin-top: 1rem;
  border: 1px dashed #ccc;
}

.price-details-cell {
  padding: 0 !important;
  background: #fafafa;
}

.price-details-table {
  width: 100%;
  border-collapse: collapse;
}

.price-details-table th {
  background: #e9ecef;
  color: #444;
  font-weight: 500;
  text-align: left;
  padding:  0.7rem;
  
}

.price-details-table td {
  text-align: center;
  background: #fafafa;
  padding: 0.6rem 0.7rem;
  text-align: left;
  border-bottom: none;
  font-family: monospace; 
}

/* Scrollbar for search-product-modal-content */
.search-product-modal-content::-webkit-scrollbar {
  width: 10px;
}

.search-product-modal-content::-webkit-scrollbar-track {
  background: #f1f1f1; 
  border-radius: 10px;
}

.search-product-modal-content::-webkit-scrollbar-thumb {
  background: #cbd5e1; 
  border-radius: 10px;
  border: 2px solid #f1f1f1; 
}

.search-product-modal-content::-webkit-scrollbar-thumb:hover {
  background: #94a3b8; 
}

/* Scrollbar for products-table (if table scrolls horizontally) */
.products-table::-webkit-scrollbar {
  height: 8px; /* Horizontal scrollbar height */
}

.products-table::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.products-table::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 6px;
}

.products-table::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Firefox scrollbar */
.search-product-modal-content {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 #f1f1f1;
}

.products-table {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 #f1f1f1;
}


@media (max-width: 900px) {
  .search-product-modal-content {
    width: 95%;
  }
}
@media (max-width: 640px) {
  .search-product-modal-content {
    padding: 1rem;
    width: calc(100% - 2rem);
  }
  .form-group-row {
    flex-direction: column;
  }
  .form-group.tax-group {
    width: 100%;
  }
  .products-table th, .products-table td {
    padding: 0.5rem;
    font-size: 0.8rem;
  }
  .modal-buttons {
    flex-direction: column;
    align-items: stretch;
  }
  .search-btn, .close-btn {
    width: 100%;
  }
  .price-details-table th, .price-details-table td {
    font-size: 0.75rem;
  }
}
`;

const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);
