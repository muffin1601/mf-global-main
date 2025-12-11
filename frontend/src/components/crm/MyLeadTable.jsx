import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/crm/LeadTable.css';
import { AiOutlineEye, AiOutlineEdit, AiOutlineDelete } from 'react-icons/ai';
import LeadModal from './Modals/LeadModal';
import EditLeadModal from './Modals/EditLeadModal';
import ConfirmModal from './Modals/ConfirmModal';
import { logActivity } from '../../utils/logActivity';
import { toast } from 'react-toastify';
import UserFilterModal from './Modals/UserFilterModal';
import DownloadReportModal from './Modals/DownloadModal';
import SearchProductModal from './Modals/SearchProductModal';
import CustomToast from './CustomToast';
import FormModal from './Modals/FormModal';

const MyLeadTable = () => {
  const [leads, setLeads] = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 5;

  const [selectedLead, setSelectedLead] = useState(null);
  const [editLead, setEditLead] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [isFormModalOpen, setFormModalOpen] = useState(false);
  const [LeadsforDownload, setLeadsforDownload] = useState(null);
  const [leadforDelete, setLeadforDelete] = useState(null);

  const [filters, setFilters] = useState({
    category: [],
    datatype: [],
    location: [],
    fileName: [],
    status: [],
    callStatus: [],
    assignedTo: [],
  });

  const user = JSON.parse(localStorage.getItem('user'));
  const userName = user.name;

  // Fetch all leads initially
  useEffect(() => {
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLeads = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/overview/user-dashboard-stats/${user.name}`
      );
      const data = response.data.myLeads;

      if (Array.isArray(data)) {
        setLeads(data);
        setTotalLeads(data.length);
      } else {
        setLeads([]);
        setTotalLeads(0);
        toast(
          <CustomToast
            type="error"
            title="Data Error"
            message="Invalid data format received from the server."
          />
        );
      }
    } catch (error) {
      console.error(error);
      toast(
        <CustomToast
          type="error"
          title="Fetch Failed"
          message="Error fetching leads. Please try again."
        />
      );
    }
  };

  const totalPages = Math.ceil(totalLeads / leadsPerPage);

  const getPaginatedLeads = () => {
    const startIndex = (currentPage - 1) * leadsPerPage;
    return leads.slice(startIndex, startIndex + leadsPerPage);
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Won Lead':
        return 'status-won';
      case 'New Lead':
        return 'status-new';
      case 'Lost Lead':
        return 'status-lost';
      case 'In Progress':
        return 'status-in-progress';
      case 'Followed Up':
        return 'status-contacted';
      default:
        return 'status-other';
    }
  };

  const filterAssignedLeads = async (userName, incomingFilters = filters) => {
    const removeIcons = (options) => {
      if (Array.isArray(options)) {
        return options.map((option) =>
          typeof option === 'string'
            ? option.replace(/^[^\w]*\s*/, '').trim()
            : option
        );
      }
      return options;
    };

    const cleanedFilters = {
      ...incomingFilters,
      datatype: removeIcons(incomingFilters.datatype),
      status: removeIcons(incomingFilters.status),
      callStatus: removeIcons(incomingFilters.callStatus),
    };

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/clients/assigned/${userName}/filter`,
        cleanedFilters
      );

      setLeads(res.data);
      setTotalLeads(res.data.length);
      setCurrentPage(1); // UX: go back to first page after filtering

      toast(
        <CustomToast
          type="success"
          title="Filtered"
          message="Assigned leads filtered successfully"
        />
      );
    } catch (err) {
      console.error('Assigned Filter Error:', err);
      toast(
        <CustomToast
          type="error"
          title="Filter Failed"
          message="Failed to filter assigned leads."
        />
      );
    }
  };

  // Check if any filter is active
  const hasActiveFilters = (filtersObj) =>
    Object.values(filtersObj).some(
      (v) => (Array.isArray(v) && v.length > 0) || (!Array.isArray(v) && v)
    );

  // Decide how to refresh list after edit: with filters or full list
  const refreshLeads = () => {
    if (hasActiveFilters(filters)) {
      filterAssignedLeads(userName, filters);
    } else {
      fetchLeads();
    }
  };

  const handleAddLead = () => {
    setFormModalOpen(true);
  };

  const downloadCSVReport = async (leadsToDownload) => {
    if (!Array.isArray(leadsToDownload) || leadsToDownload.length === 0) {
      return toast(
        <CustomToast
          type="error"
          title="Download Failed"
          message="No leads provided for CSV download."
        />
      );
    }

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/leads/report/download-by-leads`,
        { leads: leadsToDownload },
        { responseType: 'blob' }
      );

      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${user.name}_Leads_Report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast(
        <CustomToast
          type="success"
          title="Report Ready"
          message="My leads report downloaded successfully!"
        />
      );

      await logActivity('Downloaded My Leads Report', {
        leadsCount: leadsToDownload.length,
      });
    } catch (error) {
      console.error('Error downloading leads CSV report:', error);
      toast(
        <CustomToast
          type="error"
          title="Download Failed"
          message="Failed to download leads report."
        />
      );
    }
  };

  return (
    <>
      <div className="lead-card">
        <div className="lead-header">
          <h5>My Leads Report</h5>
          <div className="lead-btn-group">
            <button className="btn-add-2" onClick={handleAddLead}>
              + Add
            </button>
            <button
              className="btn-update-2"
              onClick={() => setShowProductModal(true)}
            >
              Products
            </button>
            <button
              className="btn-download-2"
              onClick={() => setLeadsforDownload(true)}
              disabled={!leads.length}
            >
              Download
            </button>
            <button
              className="btn-update-2"
              onClick={() => setShowFilterModal(true)}
            >
              Filters
            </button>
          </div>
        </div>

        <div className="lead-table-wrapper">
          <table className="lead-table">
            <thead>
              <tr>
                <th>S.NO</th>
                <th>Lead</th>
                <th>Company Name</th>
                <th>Status</th>
                <th>Category</th>
                <th>State</th>
                <th>Datatype</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {getPaginatedLeads().length === 0 ? (
                <tr>
                  <td colSpan="8" className="no-data">
                    No leads found.
                  </td>
                </tr>
              ) : (
                getPaginatedLeads().map((lead, index) => (
                  <tr key={lead.id || `${lead.email}-${index}`}>
                    <td>{(currentPage - 1) * leadsPerPage + index + 1}</td>
                    <td>
                      <div className="lead-info">
                        <div className="lead-details">
                          <span className="lead-name">{lead.name}</span>
                          <span className="lead-email">{lead.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td>{lead.company}</td>
                    <td>
                      <span
                        className={`lead-status ${getStatusClass(
                          lead.status
                        )}`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td>{lead.category}</td>
                    <td>{lead.state}</td>
                    <td>{lead.datatype}</td>
                    <td>
                      <div className="lead-actions">
                        <button
                          className="btn-view"
                          title="View"
                          onClick={() => setSelectedLead(lead)}
                        >
                          <AiOutlineEye />
                        </button>
                        <button
                          className="btn-edit"
                          title="Edit"
                          onClick={() => setEditLead(lead)}
                        >
                          <AiOutlineEdit />
                        </button>
                        {user.role === 'admin' && (
                          <button
                            className="btn-delete"
                            title="Delete"
                            onClick={() => setLeadforDelete(lead)}
                          >
                            <AiOutlineDelete />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="lead-pagination-wrapper">
          <span className="lead-entries">
            Showing {getPaginatedLeads().length} of {totalLeads} Entries
          </span>
          <ul className="lead-pagination">
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.max(prev - 1, 1))
                }
                disabled={currentPage === 1}
              >
                Prev
              </button>
            </li>
            {[...Array(Math.min(totalPages, 2))].map((_, i) => {
              const pageNumber = Math.min(
                Math.floor((currentPage - 1) / 2) * 2 + i + 1,
                totalPages
              );
              return (
                <li
                  key={`page-${pageNumber}`}
                  className={`page-item ${
                    currentPage === pageNumber ? 'active' : ''
                  }`}
                >
                  <button onClick={() => setCurrentPage(pageNumber)}>
                    {pageNumber}
                  </button>
                </li>
              );
            })}
            <li
              className={`page-item ${
                currentPage === totalPages ? 'disabled' : ''
              }`}
            >
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </li>
          </ul>
        </div>

        {selectedLead && (
          <LeadModal
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
          />
        )}

        {isFormModalOpen && (
          <FormModal
            isOpen={isFormModalOpen}
            onClose={() => setFormModalOpen(false)}
          />
        )}

        {editLead && (
          <EditLeadModal
            lead={editLead}
            onClose={() => setEditLead(null)}
            onSave={refreshLeads} // 🔥 keep filters after edit
            userRole={user.role}
          />
        )}

        {leadforDelete && (
          <ConfirmModal
            message={`Are you sure you want to delete ${leadforDelete.name}?`}
            onCancel={() => setLeadforDelete(null)}
            onConfirm={handleDeleteLead} // assuming this exists in your real file
          />
        )}

        {showModal && (
          <DownloadReportModal
            onClose={() => setShowModal(false)}
            leads={leads}
          />
        )}

        {showFilterModal && (
          <UserFilterModal
            onClose={() => setShowFilterModal(false)}
            onApply={(appliedFilters) => {
              setFilters(appliedFilters);
              filterAssignedLeads(userName, appliedFilters);
            }}
            defaultFilters={filters}
          />
        )}

        {showProductModal && (
          <SearchProductModal
            isOpen={showProductModal}
            onClose={() => setShowProductModal(false)}
          />
        )}

        {LeadsforDownload && (
          <ConfirmModal
            message="Are you sure you want to download report?"
            onCancel={() => setLeadsforDownload(false)}
            onConfirm={() => {
              downloadCSVReport(leads);
              setLeadsforDownload(false);
            }}
          />
        )}
      </div>
    </>
  );
};

export default MyLeadTable;
