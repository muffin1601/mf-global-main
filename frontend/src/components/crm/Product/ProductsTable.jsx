import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import '../../../styles/crm/LeadTable.css';
import { AiOutlineDelete, AiOutlineEdit, AiOutlineEye, AiOutlineReload } from 'react-icons/ai';
import AddProductModal from '../Modals/AddProductModal';
import AddCategoryModal from '../Modals/AddCategoryModal';
import ConfirmModal from '../Modals/ConfirmModal';
import EditProductModal from '../Modals/EditProductModal';
import { toast } from 'react-toastify';
import CustomToast from '../CustomToast';
import { resolveProductImageUrl, PRODUCT_IMAGE_PLACEHOLDER } from '../../../utils/productImage';

const API = import.meta.env.VITE_API_URL;
const PAGE_SIZES = [10, 25, 50];
const SORT_OPTIONS = [
  ['updated_desc', 'Recently updated'], ['created_desc', 'Newest first'], ['created_asc', 'Oldest first'],
  ['name_asc', 'Name A-Z'], ['name_desc', 'Name Z-A'], ['price_asc', 'Price low to high'], ['price_desc', 'Price high to low'],
];

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return debounced;
}

const ProductsTable = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('updated_desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [viewProduct, setViewProduct] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const debouncedQuery = useDebouncedValue(query);
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } }, []);

  const fetchCategories = useCallback(async () => {
    const response = await axios.get(`${API}/categories`);
    setCategories(response.data || []);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await axios.get(`${API}/products`, { params: { page, limit: pageSize, query: debouncedQuery, category, sort } });
      setProducts(response.data.products || []);
      setTotal(Number(response.data.total) || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load products. Please try again.');
    } finally { setLoading(false); }
  }, [page, pageSize, debouncedQuery, category, sort]);

  useEffect(() => { fetchCategories().catch(() => setError('Unable to load product categories. Please try again.')); }, [fetchCategories]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { setPage(1); }, [debouncedQuery, category, sort, pageSize]);

  const categoryNames = useMemo(() => new Map(categories.map((item) => [item._id, item.name])), [categories]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingStart = total ? (page - 1) * pageSize + 1 : 0;
  const showingEnd = Math.min(page * pageSize, total);
  const clearFilters = () => { setQuery(''); setCategory(''); setSort('updated_desc'); };
  const refresh = () => { fetchProducts(); fetchCategories().catch(() => {}); };

  const handleDelete = async () => {
    if (!productToDelete || deleting) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/products/delete/${productToDelete._id}`);
      toast(<CustomToast type="success" title="Product deleted" message={`"${productToDelete.p_name}" was deleted.`} />);
      setProductToDelete(null);
      if (products.length === 1 && page > 1) setPage(page - 1); else fetchProducts();
    } catch (requestError) {
      toast(<CustomToast type="error" title="Delete failed" message={requestError.response?.data?.message || 'The product was not deleted. Please try again.'} />);
    } finally { setDeleting(false); }
  };
  const stop = (event, callback) => { event.stopPropagation(); callback(); };

  return <section className="lead-card product-management" aria-labelledby="products-title">
    <header className="lead-header product-header">
      <div><h5 id="products-title">Products</h5><p className="product-subtitle">Manage product details, pricing, and categories.</p></div>
      <div className="lead-btn-group"><button type="button" className="btn-filter-2" onClick={() => setShowCategories(true)}>Manage categories</button><button type="button" className="btn-add-2" onClick={() => setShowAdd(true)}>+ Add product</button></div>
    </header>
    <div className="product-toolbar" aria-label="Product list controls">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, code, category, or description" aria-label="Search products" />
      <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category"><option value="">All categories</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select>
      <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products">{SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      {(query || category || sort !== 'updated_desc') && <button type="button" className="product-clear-filter" onClick={clearFilters}>Reset</button>}
      <button type="button" className="product-refresh" onClick={refresh} disabled={loading} aria-label="Refresh products" title="Refresh products"><AiOutlineReload /></button>
    </div>
    <p className="product-count" aria-live="polite">{total} product{total === 1 ? '' : 's'}</p>
    {error && <div className="product-message product-error" role="alert">{error} <button type="button" onClick={refresh}>Try again</button></div>}
    <div className="lead-table-wrapper" aria-busy={loading}>
      <table className="lead-table product-table"><thead><tr><th>Product</th><th>Code</th><th>Category</th><th>Type / colour</th><th>Price</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="7" className="product-empty">Loading products...</td></tr> : products.length ? products.map((product) => <tr key={product._id} className="product-row" tabIndex="0" onClick={() => setViewProduct(product)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setViewProduct(product); } }}>
          <td data-label="Product"><span className="product-name"><img src={resolveProductImageUrl(product.p_image) || PRODUCT_IMAGE_PLACEHOLDER} alt="" onError={(event) => { event.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER; }} /><strong>{product.p_name}</strong></span></td>
          <td data-label="Code">{product.p_code || '-'}<br /><small>{product.s_code || ''}</small></td><td data-label="Category">{categoryNames.get(product.cat_id) || 'Uncategorised'}</td><td data-label="Type / colour">{[product.p_type, product.p_color].filter(Boolean).join(' / ') || '-'}</td><td data-label="Price">{product.p_price?.net_amount == null ? '-' : `Rs. ${Number(product.p_price.net_amount).toLocaleString('en-IN')}`}</td><td data-label="Updated">{product.updatedAt ? new Date(product.updatedAt).toLocaleDateString('en-IN') : '-'}</td>
          <td data-label="Actions"><div className="lead-actions"><button type="button" title="View product" aria-label={`View ${product.p_name}`} onClick={(event) => stop(event, () => setViewProduct(product))}><AiOutlineEye /></button><button type="button" title="Edit product" aria-label={`Edit ${product.p_name}`} onClick={(event) => stop(event, () => setEditProduct(product))}><AiOutlineEdit /></button>{user?.role === 'admin' && <button type="button" className="btn-delete" title="Delete product" aria-label={`Delete ${product.p_name}`} onClick={(event) => stop(event, () => setProductToDelete(product))}><AiOutlineDelete /></button>}</div></td>
        </tr>) : <tr><td colSpan="7" className="product-empty">{query || category ? <>No products match your search or filters. <button type="button" onClick={clearFilters}>Reset filters</button></> : <>No products yet. <button type="button" onClick={() => setShowAdd(true)}>Create your first product</button></>}</td></tr>}</tbody></table>
    </div>
    <footer className="lead-pagination-wrapper"><span className="lead-entries">Showing {showingStart}-{showingEnd} of {total}</span><div className="product-pagination"><label>Rows <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div></footer>
    {showAdd && <AddProductModal isOpen onClose={() => setShowAdd(false)} onSubmit={() => { setShowAdd(false); setPage(1); refresh(); }} />}
    {showCategories && <AddCategoryModal isOpen onClose={() => { setShowCategories(false); refresh(); }} onSubmit={refresh} />}
    {editProduct && <EditProductModal product={editProduct} onClose={() => setEditProduct(null)} onSave={(updated) => { setEditProduct(null); setViewProduct(null); setProducts((items) => items.map((item) => item._id === updated._id ? updated : item)); }} />}
    {productToDelete && <ConfirmModal title="Delete product?" message={`Delete "${productToDelete.p_name}"? This cannot be undone.`} confirmLabel="Delete product" loading={deleting} onCancel={() => !deleting && setProductToDelete(null)} onConfirm={handleDelete} />}
    {viewProduct && <ProductDetails product={viewProduct} category={categoryNames.get(viewProduct.cat_id)} onClose={() => setViewProduct(null)} onEdit={() => { setEditProduct(viewProduct); setViewProduct(null); }} onDelete={() => { setProductToDelete(viewProduct); setViewProduct(null); }} canDelete={user?.role === 'admin'} />}
  </section>;
};

const ProductDetails = ({ product, category, onClose, onEdit, onDelete, canDelete }) => <div className="glasso-confirm-overlay" role="presentation" onMouseDown={onClose}><section className="glasso-confirm-container product-details" role="dialog" aria-modal="true" aria-labelledby="product-details-title" onMouseDown={(event) => event.stopPropagation()}><header><h2 id="product-details-title">{product.p_name}</h2><button type="button" aria-label="Close product details" onClick={onClose}>x</button></header><img className="product-detail-image" src={resolveProductImageUrl(product.p_image) || PRODUCT_IMAGE_PLACEHOLDER} alt="" onError={(event) => { event.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER; }} /><dl><dt>Product code</dt><dd>{product.p_code || '-'}</dd><dt>Style code</dt><dd>{product.s_code || '-'}</dd><dt>Category</dt><dd>{category || 'Uncategorised'}</dd><dt>Type</dt><dd>{product.p_type || '-'}</dd><dt>Colour</dt><dd>{product.p_color || '-'}</dd><dt>Net price</dt><dd>{product.p_price?.net_amount == null ? '-' : `Rs. ${Number(product.p_price.net_amount).toLocaleString('en-IN')}`}</dd><dt>Last updated</dt><dd>{product.updatedAt ? new Date(product.updatedAt).toLocaleString('en-IN') : '-'}</dd>{product.p_description && <><dt>Description</dt><dd>{product.p_description}</dd></>}</dl><footer><button type="button" className="glasso-confirm-btn cancel" onClick={onClose}>Close</button><button type="button" className="glasso-confirm-btn edit" onClick={onEdit}>Edit</button>{canDelete && <button type="button" className="glasso-confirm-btn delete" onClick={onDelete}>Delete</button>}</footer></section></div>;

export default ProductsTable;
