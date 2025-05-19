import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/crm/LeadTable.css'; // Ensure CSS contains styles for .btn-view, .btn-edit, .btn-delete, etc.
import { AiOutlineEye, AiOutlineEdit, AiOutlineDelete } from 'react-icons/ai';
import LeadModal from './Modals/LeadModal';
import EditLeadModal from './Modals/EditLeadModal';
import ConfirmModal from './Modals/ConfirmModal';
import FilterModal from './Modals/FilterModal';
import FormModal from './Modals/FormModal';
import { logActivity } from '../../utils/logActivity'; // Adjust the import path as necessary
import DownloadReportModal from './Modals/DownloadModal';
import BulkUpdateModal from './Modals/BulkUpdateModal';
import { toast } from 'react-toastify';


const LeadTable = () => {
  const [leads, setLeads] = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 10;
  const [selectedLead, setSelectedLead] = useState(null);
  const [editLead, setEditLead] = useState(null);
  const [leadforDelete, setLeadforDelete] = useState(null);
  const [filtersForDelete, setFiltersForDelete] = useState(null);
  const [showAlldeleteModal, setShowAllDeleteModal] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [isFormModalOpen, setFormModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    category: [],
    datatype: [],
    location: [],
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
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/all-clients`);
        const uniqueClients = response.data || [];
        setLeads(uniqueClients);
        setTotalLeads(uniqueClients.length);
        const originalFilters = {
          category: [],
          datatype: [],
          location: [],
          fileName: [],
          status: [],
          callStatus: [],
        };
        setFilters(originalFilters);
      } catch (error) {
        console.error('Error fetching leads:', error);
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
      return options.map(option => {
        if (typeof option === "string") {
          return option.replace(/^[^\w]*\s*/, "").trim();
        }
        return option;
      });
    }
    return options;
  };

  const cleanedFilters = {
    ...incomingFilters,
    datatype: removeIcons(incomingFilters.datatype),
    status: removeIcons(incomingFilters.status),
    callStatus: removeIcons(incomingFilters.callStatus),
  };

  axios.post(`${import.meta.env.VITE_API_URL}/clients/filter`, cleanedFilters).then((res) => {
    setTotalLeads(res.data.length);
    setLeads(res.data);
    toast.success("Leads filtered successfully");
  }).catch((err) => {
    console.error("Filter Error:", err);
    toast.error("Failed to apply filters.");
  });
};


const handleAddLead = () => {
    setFormModalOpen(true);
  };

const handleDeleteLead = async () => {
  if (!leadforDelete) return;

  const ids = [leadforDelete._id || leadforDelete.id];
  try {
    const res = await axios.post(`${import.meta.env.VITE_API_URL}/clients/delete`, {ids});
    toast.success( "Lead deleted successfully");

    await logActivity("Deleted Lead", { leadId: leadforDelete._id });

    setLeadforDelete(null); // close modal
    filterLeads(); // refresh
  } catch (error) {
    console.error("Error deleting lead:", error);
    toast.error("Failed to delete lead.");
  }
};

const handleDeleteFilteredLeads = async (filterSet) => {
  
  const removeIcons = (options) =>
    Array.isArray(options) ? options.map(opt => opt.replace(/^[^\w]*\s*/, "").trim()) : options;

  const cleanedFilters = {
    ...filterSet,
    datatype: removeIcons(filterSet.datatype),
    status: removeIcons(filterSet.status),
    callStatus: removeIcons(filterSet.callStatus),
  };

  try {
    // Get leads matching filters
    const response = await axios.post(`${import.meta.env.VITE_API_URL}/clients/filter`, cleanedFilters);
    const leadsToDelete = response.data || [];

    if (leadsToDelete.length === 0) {
      toast.info("No leads matched the filters.");
      return;
    }

    const ids = leadsToDelete.map(lead => lead._id || lead.id);
    const res = await axios.post(`${import.meta.env.VITE_API_URL}/clients/delete`, { ids });

    toast.success(`${res.data.deletedCount || ids.length} lead(s) deleted successfully.`);
    filterLeads(); // refresh table
  } catch (error) {
    console.error("Delete by filter failed:", error);
    toast.error("Failed to delete filtered leads.");
  }
};


  return (
    <div className="lead-card">
      <div className="lead-header">
        <h5>Leads Report</h5>
        <div className="lead-btn-group">
          <button className="btn-add" onClick={handleAddLead}>+ Add</button>
          {user.role == 'admin' && (<button className="btn-update"onClick={() => setShowBulkUpdateModal(true)}>Update</button>)}
          <button className="btn-download" onClick={() => setShowModal(true)}>Download</button>
          <button className="btn-filter" onClick={() => setShowFilterModal(true)}>Filters</button>
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
              <th>Location</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {getPaginatedLeads().map((lead, index) => (
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
                {/* <td>{lead.phone}</td> */}
                <td>{lead.company}</td>
                <td><span className={`lead-status ${getStatusClass(lead.status)}`}>{lead.status}</span></td>
                <td><i className="ti ti-map-pin"></i> {lead.location}</td>
                <td>{lead.createdAt?.slice(0, 10)}</td>
                <td>
                    <div className="lead-actions">
                      <button className="btn-view" title="View" onClick={() => setSelectedLead(lead)}><AiOutlineEye  /></button>
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
          onDeleteAll={() =>{setShowAllDeleteModal(true);setFiltersForDelete(filters);}}
          onClose={() => setShowFilterModal(false)}
          onApply={(appliedFilters) => {
            setFilters(appliedFilters);        // Keep state updated
            filterLeads(appliedFilters);       // Use fresh filters directly
          }}
          defaultFilters={filters}  // Make sure defaultFilters is passed if needed
        />
      )}
      {isFormModalOpen && (
        <FormModal
        isOpen={isFormModalOpen} onClose={() => setFormModalOpen(false)}
        />
      )}
      {showModal && (
        <DownloadReportModal
          onClose={() => setShowModal(false)}
          leads = {leads}
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
