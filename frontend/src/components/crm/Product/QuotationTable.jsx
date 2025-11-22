import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import axios from 'axios';
import '../../../styles/crm/LeadTable.css';
import { AiOutlineEdit, AiOutlineDelete, AiOutlineEye } from 'react-icons/ai';
import ConfirmModal from '../Modals/ConfirmModal';
import { toast } from 'react-toastify';
import CustomToast from '../CustomToast';

const QuotationTable = () => {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [totalQuotations, setTotalQuotations] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const quotationsPerPage = 5;

  const [quotationToDelete, setQuotationToDelete] = useState(null);
  const [viewQuotation, setViewQuotation] = useState(null);
  const user = JSON.parse(localStorage.getItem('user'));
  const userRole = user?.role || 'user';
  const userId = user?._id || '';

  useEffect(() => {
    if (userRole === "admin") {
      fetchQuotations();
    } else {
      fetchUserQuotations();
    }
  }, [userRole]);

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

  const fetchUserQuotations = async () => {
    try {
      const token = localStorage.getItem("token");

      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/quotations/data/user/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = response.data.quotations || [];
      setQuotations(data);
      setTotalQuotations(data.length);
    } catch (error) {
      console.error("Error fetching user quotations:", error);
    }
  };


  const getPaginatedQuotations = () => {
    const startIndex = (currentPage - 1) * quotationsPerPage;
    return quotations.slice(startIndex, startIndex + quotationsPerPage);
  };

  const totalPages = Math.ceil(totalQuotations / quotationsPerPage);

  const calculateGrandTotal = (quotation) => {
    const itemsTotal = quotation.items?.reduce((acc, item) => {
      return acc + (item.qty * item.price) - (item.discount || 0) + (item.tax || 0);
    }, 0) || 0;
    const summary = quotation.summary || {};
    const roundOff = summary.autoRoundOff ? summary.roundOffAmount * (summary.roundOffSign === '+' ? 1 : -1) : 0;
    return itemsTotal - (summary.discount || 0) + (summary.additionalCharges || 0) + roundOff;
  };

  const handleDeleteQuotation = async () => {
    if (!quotationToDelete) return;

    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/quotations/delete/${quotationToDelete._id}`);

      toast(
        <CustomToast
          type="success"
          title="Deleted"
          message={`Quotation "${quotationToDelete.invoiceDetails?.number}" deleted successfully`}
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
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="lead-card">
      <div className="lead-header">
        <h5>Quotation Report</h5>
        <div className="lead-btn-group">
          <button className="btn-add-2" onClick={() => navigate("/crm/quotations/create")}>Create Quotation</button>
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
              {userRole === 'admin' && <th>Created By</th>}
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {getPaginatedQuotations().map((quotation, index) => (
              <tr key={quotation._id}>
                <td>{(currentPage - 1) * quotationsPerPage + index + 1}</td>
                <td>{quotation.invoiceDetails?.number || '-'}</td>
                <td>{formatDate(quotation.invoiceDetails?.date)}</td>
                <td>{quotation.party?.name || '-'}</td>
                <td>{quotation.party?.company || '-'}</td>
                <td>{quotation.party?.phone || '-'}</td>
                <td>₹{calculateGrandTotal(quotation).toFixed(2)}</td>
                {userRole === 'admin' && <td>{quotation.user?.name || '-'}</td>}
                <td>
                  <div className="lead-actions">
                    {/* <button
                      className="btn-view"
                      title="View"
                      onClick={() => setViewQuotation(quotation)}
                    >
                      <AiOutlineEye />
                    </button> */}
                    <button
                      className="btn-edit"
                      title="Edit"
                      onClick={() => navigate(`/crm/quotations/edit/${quotation._id}`)}
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
          {[...Array(totalPages)].map((_, i) => {
            const pageNumber = i + 1;
            return (
              <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
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
          message={`Are you sure you want to delete quotation "${quotationToDelete.invoiceDetails?.number}"?`}
          onCancel={() => setQuotationToDelete(null)}
          onConfirm={handleDeleteQuotation}
        />
      )}

      {/* {viewQuotation && (
        <ConfirmModal
          message={
            <>
              <h4>Quotation Details</h4>
              <p><b>Quotation No:</b> {viewQuotation.invoiceDetails?.number}</p>
              <p><b>Customer:</b> {viewQuotation.party?.name}</p>
              <p><b>Company:</b> {viewQuotation.party?.company || '-'}</p>
              <p><b>Address:</b> {viewQuotation.party?.address || '-'}</p>
              <p><b>Total:</b> ₹{calculateGrandTotal(viewQuotation).toFixed(2)}</p>
              <p><b>Created By:</b> {viewQuotation.user?.name || '-'}</p>
            </>
          }
          onCancel={() => setViewQuotation(null)}
          hideConfirmButton
        />
      )} */}
    </div>
  );
};

export default QuotationTable;
