import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/crm/LeadTable.css'; 
import { AiOutlineEye, AiOutlineEdit, AiOutlineDelete } from 'react-icons/ai';
import LeadModal from './Modals/LeadModal';
import EditLeadModal from './Modals/EditLeadModal';
import ConfirmModal from './Modals/ConfirmModal';
import FilterModal from './Modals/FilterModal';
import FormModal from './Modals/FormModal';
import { logActivity } from '../../utils/logActivity'; 
import DownloadReportModal from './Modals/DownloadModal';
import BulkUpdateModal from './Modals/BulkUpdateModal';
import SearchProductModal from './Modals/SearchProductModal';
import { toast } from 'react-toastify';
import CustomToast from "./CustomToast";

const LeadTable = () => {
  const [leads, setLeads] = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 5;
  const [selectedLead, setSelectedLead] = useState(null);
  const [editLead, setEditLead] = useState(null);
  const [leadforDelete, setLeadforDelete] = useState(null);
  const [filtersForDelete, setFiltersForDelete] = useState(null);
  const [showAlldeleteModal, setShowAllDeleteModal] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [isFormModalOpen, setFormModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    category: [],
    datatype: [],
    location: [],
    state: [],
    fileName: [],
    status: [],
    callStatus: [],
  });


  const user = JSON.parse(localStorage.getItem('user'));

   useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/overview/all-clients`);
      const uniqueClients = response.data.data || []
      setLeads(uniqueClients);
      setTotalLeads(uniqueClients.length);
      setFilters({
        category: [],
        datatype: [],
        location: [],
        state: [],
        fileName: [],
        status: [],
        callStatus: [],
      });

    } catch (error) {
      console.error("Error fetching leads:", error);
      toast(<CustomToast type="error" title="Fetch Failed" message="Failed to fetch leads." />);
    }
  };

  const totalPages = Math.ceil(totalLeads / leadsPerPage);

  const getPaginatedLeads = () => {
    const startIndex = (currentPage - 1) * leadsPerPage;
    return leads.slice(startIndex, startIndex + leadsPerPage);
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Won Lead': return 'status-won';
      case 'New Lead': return 'status-new';
      case 'Lost Lead': return 'status-lost';
      case 'In Progress': return 'status-in-progress';
      default: return 'status-other';
    }
  };


  const filterLeads = (incomingFilters = filters) => {
    const removeIcons = (options) => {
      if (Array.isArray(options)) {
        return options.map((option) => (typeof option === "string" ? option.replace(/^[^\w]*\s*/, "").trim() : option));
      }
      return options;
    };

    const cleanedFilters = {
      ...incomingFilters,
      datatype: removeIcons(incomingFilters.datatype),
      status: removeIcons(incomingFilters.status),
      callStatus: removeIcons(incomingFilters.callStatus),
    };

    axios
      .post(`${import.meta.env.VITE_API_URL}/clients/filter`, cleanedFilters)
      .then((res) => {
        setTotalLeads(res.data.length);
        setLeads(res.data);
        toast(<CustomToast type="success" title="Filtered" message="Leads filtered successfully" />);
      })
      .catch((err) => {
        console.error("Filter Error:", err);
        toast(<CustomToast type="error" title="Filter Failed" message="Failed to apply filters." />);
      });
  };


  const handleAddLead = () => {
    setFormModalOpen(true);
  };

  const handleDeleteLead = async () => {
    if (!leadforDelete) return;

    const ids = [leadforDelete._id || leadforDelete.id];
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/clients/delete`, { ids });
      await logActivity("Deleted Lead", { leadId: leadforDelete._id });
      setLeadforDelete(null);
      filterLeads();
      toast(<CustomToast type="success" title="Deleted" message="Lead deleted successfully" />);
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast(<CustomToast type="error" title="Delete Failed" message="Failed to delete lead." />);
    }
  };

  const handleDeleteFilteredLeads = async (filterSet) => {
    const removeIcons = (options) =>
      Array.isArray(options) ? options.map((opt) => opt.replace(/^[^\w]*\s*/, "").trim()) : options;

    const cleanedFilters = {
      ...filterSet,
      datatype: removeIcons(filterSet.datatype),
      status: removeIcons(filterSet.status),
      callStatus: removeIcons(filterSet.callStatus),
    };

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/clients/filter`, cleanedFilters);
      const leadsToDelete = response.data || [];

      if (leadsToDelete.length === 0) {
        return toast(<CustomToast type="info" title="No Leads" message="No leads matched the filters." />);
      }

      const ids = leadsToDelete.map((lead) => lead._id || lead.id);
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/clients/delete`, { ids });

      filterLeads();

      toast(
        <CustomToast
          type="success"
          title="Deleted"
          message={`${res.data.deletedCount || ids.length} lead(s) deleted successfully.`}
        />
      );
    } catch (error) {
      console.error("Delete by filter failed:", error);
      toast(<CustomToast type="error" title="Delete Failed" message="Failed to delete filtered leads." />);
    }
  };

  return (
    <div className="lead-card">
      <div className="lead-header">
        <h5>Leads Report</h5>
        <div className="lead-btn-group">
          <button className="btn-add-2" onClick={handleAddLead}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>
          <button className="btn-filter-2" onClick={() => setShowProductModal(true)}>Products</button>
          {user.role == 'admin' && (
            <button className="btn-update-2" onClick={() => setShowBulkUpdateModal(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="0" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6" /><path d="M2.5 22v-6h6" /><path d="M21.5 8a10 10 0 0 0-17.927-4.996" /><path d="M2.5 16a10 10 0 0 0 17.927 4.996" />
              </svg>
              Update
            </button>
          )}
          <button className="btn-download-2" onClick={() => setShowModal(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
          <button className="btn-filter-2" onClick={() => setShowFilterModal(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
            </svg>
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
              {/* <th>Phone No.</th> */}
              <th>Company Name</th>
              <th>Status</th>
              <th>Category</th>
              <th>State</th>
              <th>Datatype</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {getPaginatedLeads().map((lead, index) => (
              <tr key={lead.id || `${lead.email}-${index}`}>
                <td data-label="S.NO">{(currentPage - 1) * leadsPerPage + index + 1}</td>
                <td data-label="Lead">
                  <div className="lead-info">
                    <div className="lead-details">
                      <span className="lead-name">{lead.name}</span>
                      <span className="lead-email">{lead.phone}</span>
                    </div>
                  </div>
                </td>
                <td data-label="Company Name">{lead.company}</td>
                <td data-label="Status">
                  <span className={`lead-status ${getStatusClass(lead.status)}`}>{lead.status}</span>
                </td>
                <td data-label="Category">{lead.category}</td>
                <td data-label="Location">

                  {lead.state}
                </td>
                <td data-label="Datatype">{lead.datatype}</td>
                <td data-label="Action">
                  <div className="lead-actions">
                    <button className="btn-view" title="View" onClick={() => setSelectedLead(lead)}><AiOutlineEye /></button>
                    <button className="btn-edit" title="Edit" onClick={() => setEditLead(lead)}><AiOutlineEdit /></button>
                    {user.role === 'admin' && (
                      <button className="btn-delete" title="Delete" onClick={() => setLeadforDelete(lead)}>
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
          Showing {getPaginatedLeads().length} of {totalLeads} Entries
        </span>
        <ul className="lead-pagination">
          <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Prev
            </button>
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
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </li>
        </ul>
      </div>
      {selectedLead && (
        <LeadModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
      )}
      {editLead && (
        <EditLeadModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSave={fetchLeads}
          userRole={user.role}
        />
      )}
      {leadforDelete && (
        <ConfirmModal
          message={`Are you sure you want to delete ${leadforDelete.name}?`}
          onCancel={() => setLeadforDelete(null)}
          onConfirm={handleDeleteLead}
        />
      )}
      {showAlldeleteModal && (
        <ConfirmModal
          message={`Are you sure you want to delete filtered Leads?`}
          onCancel={() => setShowAllDeleteModal(false)}
          onConfirm={() => {
            handleDeleteFilteredLeads(filtersForDelete);
            setShowAllDeleteModal(false);
          }}
        />
      )}
      {showFilterModal && (
        <FilterModal
          onDeleteAll={() => { setShowAllDeleteModal(true); setFiltersForDelete(filters); }}
          onClose={() => setShowFilterModal(false)}
          onApply={(appliedFilters) => {
            setFilters(appliedFilters);        
            filterLeads(appliedFilters);       
          }}
          defaultFilters={filters}  
        />
      )}
      {showProductModal && (
              <SearchProductModal isOpen={showProductModal} onClose={() => setShowProductModal(false)} />
            )}
      {isFormModalOpen && (
        <FormModal
          isOpen={isFormModalOpen} onClose={() => setFormModalOpen(false)}
        />
      )}
      {showModal && (
        <DownloadReportModal
          onClose={() => setShowModal(false)}
          leads={leads}
        />
      )}
      {showBulkUpdateModal && (
        <BulkUpdateModal
          onClose={() => setShowBulkUpdateModal(false)}
          filteredLeads={leads}
          onUpdateSuccess={filterLeads} // reapply filters after update
        />
      )}
    </div>
  );
};

export default LeadTable;
