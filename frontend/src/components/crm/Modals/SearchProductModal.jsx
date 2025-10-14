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
        <th>Basic Amount</th>
        <th>GST%</th>
        <th>Net Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>{product.p_price?.price_code || '—'}</td>
        <td>{calculatePriceWithTax(product.p_price?.basic_amount, taxRate)}</td>
        <td>{product.p_price?.GST_rate || '-'}</td>
        <td>{calculatePriceWithTax(product.p_price?.net_amount, taxRate)}</td>
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

  
  // const [selectedProducts, setSelectedProducts] = useState([]);
  // const [isQuotationOpen, setIsQuotationOpen] = useState(false);

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

  // const addToQuotation = (product) => {
  //   if (selectedProducts.find((p) => p._id === product._id)) {
  //     toast(
  //       <CustomToast
  //         type="warning"
  //         title="Already Added"
  //         message={`${product.p_name} is already added to the quotation.`}
  //       />
  //     );
  //     return;
  //   }
  //   setSelectedProducts([...selectedProducts, product]);
  //   toast(
  //     <CustomToast
  //       type="success"
  //       title="Added to Quotation"
  //       message={`${product.p_name} added successfully.`}
  //     />
  //   );
  // };

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
                    
                    <th>Description</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <React.Fragment key={p._id}>
                      <tr>
                        <td>{p.p_code}</td>
                        <td>{p.p_name}</td>
                        <td>{p.p_type}</td>
                        <td>{p.p_color}</td>
                        <td>{p.HSN_code}</td>
                       
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
                          {/* <button className="add-btn" onClick={() => addToQuotation(p)}>+ Add</button> */}
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

          {/* <button className='quote-show' onClick={() => setIsQuotationOpen(true)}>View Quotation List</button> */}
        </div>
      </div>
{/* 
      <QuotationModal
        isOpen={isQuotationOpen}
        onClose={() => setIsQuotationOpen(false)}
        selectedProducts={selectedProducts}
      /> */}
    </>
  );
};

export default SearchProductModal;

const css = `
.search-product-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(40, 50, 60, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99999;
  padding: 1rem;
}

.search-product-modal-content {
  width: 90%;
  max-width: 900px;
  max-height: 90%;
  overflow-y: auto;
  backdrop-filter: blur(8px);
  background: #ffffff;
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  border: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.modal-title {
  font-size: 1.5rem;
  color: #334e68;
  font-weight: 500;
  text-align: center;
  font-family: 'Outfit', sans-serif;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #f0f0f0;
}

.form-group-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.form-group.search-group {
  flex: 1 1 60%;
  min-width: 200px;
}

.form-group.tax-group {
  flex: 1 1 35%;
  min-width: 120px;
}

.tax-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 400;
  color: #64748b;
  margin-bottom: 0.4rem;
  font-family: 'Outfit', sans-serif;
}

.search-input {
  font-size: 0.95rem;
  border-radius: 8px;
  width: 100%;
  font-family: 'Outfit', sans-serif;
  padding: 0.7rem 1rem;
  border: 1px solid #dcdcdc;
  background: #fcfcfc;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  background: #ffffff;
}

.modal-buttons {
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.search-btn {
  padding: 0.65rem 1.3rem;
  border-radius: 8px;
  border: none;
  font-family: 'Outfit', sans-serif;
  cursor: pointer;
  background: #3b82f6;
  color: #fff;
  font-weight: 500;
  font-size: 0.95rem;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.search-btn:hover:not(:disabled) {
  background: #2563eb;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
}

.search-btn:disabled {
  background: #e0e7ff;
  color: #93c5fd;
  cursor: not-allowed;
}

.close-btn-2 {
  font-size: 0.9rem;
  color: #64748b;
  background: transparent;
  border: 1px solid #d1d5db;
  font-family: 'Outfit', sans-serif;
  padding: 0.55rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn-2:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
  color: #334e68;
}

.products-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Outfit', sans-serif;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 1.5rem;
  table-layout: auto;
  word-break: break-word;
}

.products-table th,
.products-table td {
  padding: 0.7rem 0.9rem;
  font-size: 0.9rem;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.products-table th {
  font-weight: 500;
  color: #4b5563;
  background: #f9fafb;
}

.products-table tbody tr:hover {
  background: #f5f7f9;
}

.products-table button {
  padding: 0.35rem 0.7rem;
  border-radius: 6px;
  border: none;
  color: #ffffff;
  cursor: pointer;
  font-weight: 400;
  font-size: 0.85rem;
}

.price-btn {
  background: #4f46e5;
}

.price-btn:hover {
  background: #4338ca;
}

.add-btn {
  margin-left: 8px;
  background: #ef4444;
}

.add-btn:hover {
  background: #dc2626;
}

.price-details-cell {
  padding: 0 !important;
  background: #fcfcfc;
  border-bottom: none !important;
}

.price-details-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Outfit', sans-serif;
}

.price-details-table th {
  background: #eef2ff;
  color: #4338ca;
  font-weight: 500;
  text-align: left;
  padding: 0.7rem 0.9rem;
  font-size: 0.85rem;
}

.price-details-table td {
  text-align: left;
  background: #fcfcfc;
  padding: 0.6rem 0.9rem;
  border-bottom: none;
  font-size: 0.85rem;
  color: #4b5563;
}

.no-results-message {
  padding: 1.5rem;
  color: #64748b;
  text-align: center;
  background: #f9fafb;
  border-radius: 8px;
  margin-top: 1.5rem;
  border: 1px solid #e5e7eb;
}

.search-product-modal-content::-webkit-scrollbar {
  width: 8px;
}

.search-product-modal-content::-webkit-scrollbar-track {
  background: #f7f7f7;
  border-radius: 8px;
}

.search-product-modal-content::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 8px;
  border: 2px solid #f7f7f7;
}

.search-product-modal-content::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.search-product-modal-content {
  scrollbar-width: thin;
  scrollbar-color: #d1d5db #f7f7f7;
}

@media (max-width: 1024px) {
  .search-product-modal-content {
    max-width: 95%;
    padding: 1.5rem;
  }

  .form-group-row {
    flex-direction: column;
    gap: 1rem;
  }

  .form-group.tax-group {
    width: 100%;
  }

  .products-table th,
  .products-table td {
    font-size: 0.85rem;
    padding: 0.5rem 0.7rem;
  }

  .products-table button {
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
  }

  .modal-buttons {
    flex-direction: column;
    gap: 0.5rem;
  }

  .search-btn,
  .close-btn-2 {
    width: 100%;
  }

  .price-details-table th,
  .price-details-table td {
    font-size: 0.75rem;
  }
}

@media (max-width: 640px) {
  .search-product-modal-content {
    width: 95%;
    padding: 1rem;
  }

  .products-table th,
  .products-table td {
    font-size: 0.75rem;
  }

  .products-table button {
    padding: 0.25rem 0.5rem;
    font-size: 0.7rem;
    margin-top: 5px;
  }

  .modal-buttons {
    flex-direction: column;
  }

  .form-group-row {
    gap: 0.8rem;
  }

  .price-details-table th,
  .price-details-table td {
    font-size: 0.7rem;
  }
}
`;

const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);
