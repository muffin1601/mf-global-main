import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../../../styles/crm/LeadTable.css';
import { AiOutlineEye, AiOutlineEdit, AiOutlineDelete } from 'react-icons/ai';
import AddProductModal from '../Modals/AddProductModal';
import AddCategoryModal from '../Modals/AddCategoryModal'; // Adjust the import path as needed
import ConfirmModal from '../Modals/ConfirmModal';
import EditProductModal from '../Modals/EditProductModal'; // Adjust the import path as needed
import { toast } from 'react-toastify';
// import other modals as needed

const ProductsTable = () => {
  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 10;
  const [showCatModal, setShowCatModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);

  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/products`);
      const productsData = response.data.products; // ✅ Fix here
      setProducts(productsData);
      setTotalProducts(productsData.length);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };


  const getPaginatedProducts = () => {
    const startIndex = (currentPage - 1) * productsPerPage;
    return products.slice(startIndex, startIndex + productsPerPage);
  };

  const totalPages = Math.ceil(totalProducts / productsPerPage);

  const handleAddProduct = () => {
    setShowFormModal(true);
  };
  const handleAddCategory = () => {
    setShowCatModal(true);
  }

  
const handleDeleteProduct = async () => {
  if (!productToDelete) return;

  try {
    const res = await axios.delete(`${import.meta.env.VITE_API_URL}/products/delete/${productToDelete._id}`);
    toast.success("Product deleted successfully");

    // await logActivity("Deleted Product", { productName: productToDelete.p_name });

    setProductToDelete(null); // close modal
    fetchProducts(); // refresh list
  } catch (error) {
    console.error("Error deleting product:", error);
    toast.error("Failed to delete product.");
  }
};


  return (
    <div className="lead-card">
      <div className="lead-header">
        <h5>All Products</h5>
        <div className="lead-btn-group">
          <button className="btn-add" onClick={handleAddProduct}>+ Product</button>
          <button className="btn-filter" onClick={handleAddCategory}>+ Category</button>
        </div>
      </div>

      <div className="lead-table-wrapper">
        <table className="lead-table">
          <thead>
            <tr>
              <th>S.NO</th>
              <th>Product Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Color</th>
              <th>Description</th>
              <th>Image</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {getPaginatedProducts().map((product, index) => (
              <tr key={product._id}>
                <td>{(currentPage - 1) * productsPerPage + index + 1}</td>
                <td>{product.product_code}</td>
                <td>{product.p_name}</td>
                <td>{product.p_type}</td>
                <td>{product.p_color}</td>
                <td>{product.p_description}</td>
                <td>
                  {product.p_image ? (
                    <img src={product.p_image} alt={product.p_name} style={{ width: '40px', height: '40px' }} />
                  ) : (
                    'N/A'
                  )}
                </td>
                <td>
                  <div className="lead-actions">
                    {/* <button className="btn-view" title="View" onClick={() => setSelectedProduct(product)}><AiOutlineEye /></button> */}
                    <button className="btn-edit" title="Edit" onClick={() => setEditProduct(product)}><AiOutlineEdit /></button>
                    {user?.role === 'admin' && (
                      <button className="btn-delete" title="Delete" onClick={() => setProductToDelete(product)}>
                        <AiOutlineDelete />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="lead-pagination-wrapper">
        <span className="lead-entries">
          Showing {getPaginatedProducts().length} of {totalProducts} Entries
        </span>
        <ul className="lead-pagination">
          <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>Prev</button>
          </li>
          {[...Array(Math.min(totalPages, 2))].map((_, i) => {
            const pageNumber = Math.min((Math.floor((currentPage - 1) / 2) * 2) + i + 1, totalPages);
            return (
              <li key={`page-${pageNumber}`} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                <button onClick={() => setCurrentPage(pageNumber)}>{pageNumber}</button>
              </li>
            );
          })}
          <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>Next</button>
          </li>
        </ul>
      </div>

      {showFormModal && (
        <AddProductModal isOpen={showFormModal} onClose={() => { setShowFormModal(false); fetchProducts(); }} />
      )}
      {showCatModal && (
        <AddCategoryModal isOpen={showCatModal} onClose={() => setShowCatModal(false)} />
      )}
      {editProduct && (
        <EditProductModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSave={fetchProducts}
          // userRole={user.role}
        />
      )}
      {productToDelete && (
        <ConfirmModal
          message={`Are you sure you want to delete ${productToDelete.p_name}?`}
          onCancel={() => setProductToDelete(null)}
          onConfirm={handleDeleteProduct}
        />
      )}
    </div>
  );
};

export default ProductsTable;
