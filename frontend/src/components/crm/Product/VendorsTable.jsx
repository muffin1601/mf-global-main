import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../../../styles/crm/LeadTable.css';
import { AiOutlineEye, AiOutlineEdit, AiOutlineDelete } from 'react-icons/ai';
import AddVendorModal from '../Modals/AddVendorModal'; // Make sure to create this modal

const VendorsTable = () => {
  const [vendors, setVendors] = useState([]);
  const [totalVendors, setTotalVendors] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const vendorsPerPage = 10;

  const [selectedVendor, setSelectedVendor] = useState(null);
  const [editVendor, setEditVendor] = useState(null);
  const [vendorToDelete, setVendorToDelete] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);

  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/vendors`);
      const vendorsData = response.data.vendors || response.data; // adjust as per API
      setVendors(vendorsData);
      setTotalVendors(vendorsData.length);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const getPaginatedVendors = () => {
    const startIndex = (currentPage - 1) * vendorsPerPage;
    return vendors.slice(startIndex, startIndex + vendorsPerPage);
  };

  const totalPages = Math.ceil(totalVendors / vendorsPerPage);

  const handleAddVendor = () => {
    setShowFormModal(true);
  };

  return (
    <div className="lead-card">
      <div className="lead-header">
        <h5>All Vendors</h5>
        <div className="lead-btn-group">
          <button className="btn-add" onClick={handleAddVendor}>+ Add</button>
        </div>
      </div>

      <div className="lead-table-wrapper">
        <table className="lead-table">
          <thead>
            <tr>
              <th>S.NO</th>
              <th>Vendor Code</th>
              <th>Name</th>
              <th>Contact Name</th>
              <th>Phone</th>
              <th>Type</th>
              <th>Email</th>
              <th>City</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {getPaginatedVendors().map((vendor, index) => (
              <tr key={vendor._id}>
                <td>{(currentPage - 1) * vendorsPerPage + index + 1}</td>
                <td>{vendor.v_code}</td>
                <td>{vendor.name}</td>
                <td>{vendor.contact_name}</td>
                <td>{vendor.phone}</td>
                <td>{vendor.type}</td>
                <td>{vendor.email}</td>
                <td>{vendor.city}</td>
                <td>
                  <div className="lead-actions">
                    <button className="btn-view" title="View" onClick={() => setSelectedVendor(vendor)}><AiOutlineEye /></button>
                    <button className="btn-edit" title="Edit" onClick={() => setEditVendor(vendor)}><AiOutlineEdit /></button>
                    {user?.role === 'admin' && (
                      <button className="btn-delete" title="Delete" onClick={() => setVendorToDelete(vendor)}>
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
          Showing {getPaginatedVendors().length} of {totalVendors} Entries
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
        <AddVendorModal isOpen={showFormModal} onClose={() => {setShowFormModal(false); fetchVendors();} }/>
      )}
    </div>
  );
};

export default VendorsTable;
