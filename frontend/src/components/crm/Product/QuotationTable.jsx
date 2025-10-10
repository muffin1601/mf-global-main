import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../../../styles/crm/LeadTable.css';
import { AiOutlineEdit, AiOutlineDelete, AiOutlineEye } from 'react-icons/ai';
import ConfirmModal from '../Modals/ConfirmModal';
import { toast } from 'react-toastify';
import CustomToast from '../CustomToast';

const QuotationTable = () => {
  const [quotations, setQuotations] = useState([]);
  const [totalQuotations, setTotalQuotations] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const quotationsPerPage = 5;

  const [quotationToDelete, setQuotationToDelete] = useState(null);
  const [viewQuotation, setViewQuotation] = useState(null);
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/quotations/data/count`);
      const data = response.data.quotations || [];
      setQuotations(data);
      setTotalQuotations(data.length);
    } catch (error) {
      console.error('Error fetching quotations:', error);
    }
  };

  const getPaginatedQuotations = () => {
    const startIndex = (currentPage - 1) * quotationsPerPage;
    return quotations.slice(startIndex, startIndex + quotationsPerPage);
  };

  const totalPages = Math.ceil(totalQuotations / quotationsPerPage);

  const handleDeleteQuotation = async () => {
    if (!quotationToDelete) return;

    try {
      const res = await axios.delete(
        `${import.meta.env.VITE_API_URL}/quotations/${quotationToDelete._id}`
      );

      toast(
        <CustomToast
          type="success"
          title="Deleted"
          message={`Quotation "${quotationToDelete.quotationNumber}" deleted successfully`}
        />
      );

      setQuotationToDelete(null);
      fetchQuotations();
    } catch (error) {
      console.error('Error deleting quotation:', error);
      toast(
        <CustomToast
          type="error"
          title="Delete Failed"
          message="Failed to delete quotation."
        />
      );
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="lead-card">
      <div className="lead-header">
        <h5>Quotation Report</h5>
        <div className="lead-btn-group">
          <button className="btn-add-2" onClick={handleAddVendor}>Create Quotation</button>
        </div>
      </div>

      <div className="lead-table-wrapper">
        <table className="lead-table">
          <thead>
            <tr>
              <th>S.NO</th>
              <th>Quotation No</th>
              <th>Date</th>
              <th>Customer Name</th>
              <th>Company</th>
              <th>Phone</th>
              <th>Grand Total</th>
              <th>Remarks</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {getPaginatedQuotations().map((quotation, index) => (
              <tr key={quotation._id}>
                <td>{(currentPage - 1) * quotationsPerPage + index + 1}</td>
                <td>{quotation.quotationNumber}</td>
                <td>{formatDate(quotation.quotationDate)}</td>
                <td>{quotation.customer?.name}</td>
                <td>{quotation.customer?.company || '-'}</td>
                <td>{quotation.customer?.phone || '-'}</td>
                <td>₹{quotation.grandTotal?.toFixed(2)}</td>
                <td>{quotation.customer?.remarks || '-'}</td>
                <td>
                  <div className="lead-actions">
                    <button
                      className="btn-view"
                      title="View"
                      onClick={() => setViewQuotation(quotation)}
                    >
                      <AiOutlineEye />
                    </button>
                    <button
                      className="btn-edit"
                      title="Edit"
                      onClick={() => alert('Edit feature coming soon')}
                    >
                      <AiOutlineEdit />
                    </button>
                    {user?.role === 'admin' && (
                      <button
                        className="btn-delete"
                        title="Delete"
                        onClick={() => setQuotationToDelete(quotation)}
                      >
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
          Showing {getPaginatedQuotations().length} of {totalQuotations} Entries
        </span>
        <ul className="lead-pagination">
          <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>Prev</button>
          </li>
          {[...Array(Math.min(totalPages, 2))].map((_, i) => {
            const pageNumber = Math.min((Math.floor((currentPage - 1) / 2) * 2) + i + 1, totalPages);
            return (
              <li
                key={`page-${pageNumber}`}
                className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}
              >
                <button onClick={() => setCurrentPage(pageNumber)}>{pageNumber}</button>
              </li>
            );
          })}
          <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>Next</button>
          </li>
        </ul>
      </div>

      {quotationToDelete && (
        <ConfirmModal
          message={`Are you sure you want to delete quotation "${quotationToDelete.quotationNumber}"?`}
          onCancel={() => setQuotationToDelete(null)}
          onConfirm={handleDeleteQuotation}
        />
      )}

      
      {viewQuotation && (
        <ConfirmModal
          message={
            <>
              <h4>Quotation Details</h4>
              <p><b>Quotation No:</b> {viewQuotation.quotationNumber}</p>
              <p><b>Customer:</b> {viewQuotation.customer?.name}</p>
              <p><b>Company:</b> {viewQuotation.customer?.company || '-'}</p>
              <p><b>Address:</b> {viewQuotation.customer?.address}</p>
              <p><b>Total:</b> ₹{viewQuotation.grandTotal?.toFixed(2)}</p>
            </>
          }
          onCancel={() => setViewQuotation(null)}
          hideConfirmButton
        />
      )}
    </div>
  );
};

export default QuotationTable;
