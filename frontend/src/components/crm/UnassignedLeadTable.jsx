import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/crm/LeadTable.css'; // Ensure CSS contains styles for .btn-view, .btn-edit, .btn-delete, etc.
import { AiOutlineEye, AiOutlineEdit, AiOutlineDelete } from 'react-icons/ai';
import LeadModal from './Modals/LeadModal';
import EditLeadModal from './Modals/EditLeadModal';
import ConfirmModal from './Modals/ConfirmModal';
import AssignModal from "./Modals/AssignModal";
import FormModal from './Modals/FormModal';
import { logActivity } from '../../utils/logActivity'; // Adjust the import path as necessary
import DownloadReportModal from './Modals/DownloadModal';
import BulkUpdateModal from './Modals/BulkUpdateModal';
import { toast } from 'react-toastify';
import CustomToast from './CustomToast';


const UnassignedLeadTable = () => {
  const [leads, setLeads] = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 5;
  const [selectedLead, setSelectedLead] = useState(null);
  const [editLead, setEditLead] = useState(null);
  const [leadforDelete, setLeadforDelete] = useState(null);
  // const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [LeadsforDownload, setLeadsforDownload] = useState(false);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [isFormModalOpen, setFormModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    category: [],
    datatype: [],
    location: [],
    fileName: [],
    status: [],
    callStatus: [],
    assignedTo: [],
  });


  const user = JSON.parse(localStorage.getItem('user'))

useEffect(() => {
  fetchLeads();
}, []);

const fetchLeads = async () => {
  try {
    const response = await axios.get(`${import.meta.env.VITE_API_URL}/get-details-clients`);
    const data = response.data;
    setLeads(data.uniqueUnassignedClients);
    setTotalLeads(data.uniqueUnassignedClients.length);
  } catch (error) {
    console.error(error);
    toast(<CustomToast type="error" title="Error" message="Error fetching leads" />);
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

const filterForAssign = async (incomingFilters = filters) => {

  const cleanOptions = (options) =>
    Array.isArray(options)
      ? options.map((o) =>
          typeof o === "string"
            ? o.replace(/^[^\w]*\s*/, "").trim()
            : o
        )
      : options;

  
  const normalizeFilters = (filterObj) => {
    const fields = ["datatype", "status", "callStatus", "category", "location", "state", "fileName"];
    const normalized = {};

    fields.forEach((field) => {
      if (filterObj[field]) {
        normalized[field] = filterObj[field].map((v) =>
          v === null || v === undefined ? "" : v
        );
      }
    });

    return normalized;
  };

  const cleanedFilters = {
    ...normalizeFilters(incomingFilters),
    datatype: cleanOptions(incomingFilters.datatype),
    status: cleanOptions(incomingFilters.status),
    callStatus: cleanOptions(incomingFilters.callStatus),
  };

  try {
    const res = await axios.post(
      `${import.meta.env.VITE_API_URL}/clients/unassigned/filter`,
      cleanedFilters
    );
    setTotalLeads(res.data.length);
    setLeads(res.data);
    toast(
      <CustomToast
        type="success"
        title="Filtered"
        message="Leads filtered successfully"
      />
    );
  } catch (err) {
    console.error("Filter Error:", err);
    toast(
      <CustomToast
        type="error"
        title="Filter Failed"
        message="Failed to filter leads."
      />
    );
  }
};

const handleDeleteLead = async () => {
  if (!leadforDelete) return;

  const ids = [leadforDelete._id || leadforDelete.id];
  try {
    await axios.post(`${import.meta.env.VITE_API_URL}/clients/delete`, { ids });
    toast(<CustomToast type="success" title="Success" message="Lead deleted successfully" />);

    await logActivity("Deleted Lead", { leadId: leadforDelete._id });

    setLeadforDelete(null); // close modal
    filterLeads(); // refresh
  } catch (error) {
    console.error("Error deleting lead:", error);
    toast(<CustomToast type="error" title="Error" message="Failed to delete lead." />);
  }
};

const downloadCSVReport = async (leads) => {
  if (!Array.isArray(leads) || leads.length === 0) {
    toast(<CustomToast type="error" title="Error" message="No leads provided for CSV download." />);
    return;
  }

  try {
    const res = await axios.post(
      `${import.meta.env.VITE_API_URL}/leads/report/download-by-leads`,
      { leads }, 
      { responseType: "blob" }
    );

    const blob = new Blob([res.data], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Unassigned_Leads_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast(<CustomToast type="success" title="Success" message="Unassigned leads report downloaded successfully!" />);

    await logActivity("Downloaded unassigned Leads Report", {
      leadsCount: leads.length,
    });
  } catch (error) {
    console.error("Error downloading leads CSV report:", error);
    toast(<CustomToast type="error" title="Error" message="Failed to download leads report." />);
  }
};

  return (
    <div className="lead-card">
      <div className="lead-header">
        <h5>Unassigned Leads Report</h5>
        <div className="lead-btn-group">
          {/* <button className="btn-add" onClick={handleAddLead}>+ Add</button>
          <button className="btn-update"onClick={() => setShowBulkUpdateModal(true)}>Update</button> */}
          <button
            className="btn-filter-2"
            onClick={() => setShowAssignModal(true)}
            // disabled={!leads.length}
          >
            Assign Leads
          </button>
          <button className="btn-download-2" onClick={() => setLeadsforDownload(true)}disabled={!leads.length}>Download</button>
          {/* <button className="btn-filter" onClick={() => setShowFilterModal(true)}>Filters</button> */}
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
                <td>{lead.category}</td>
                <td><i className="ti ti-map-pin"></i> {lead.state}</td>
                <td>{lead.datatype}</td>
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
      {showAssignModal && (
        <AssignModal
          onClose={() => setShowAssignModal(false)}
          onApply={(appliedFilters) => {
            setFilters(appliedFilters);       
            filterForAssign(appliedFilters);    
          }}
          defaultFilters={filters}
          onAssigndone={fetchLeads}
        />
      )}
      {/* {showAssignModal && (
        <AssignLeadModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          filteredLeads={leads}
          onSuccess={fetchLeads} 
        />
      )} */}
      {isFormModalOpen && (
        <FormModal
        isOpen={isFormModalOpen} onClose={() => setFormModalOpen(false)}
        />
      )}
      {showModal && (
        <DownloadReportModal
          onClose={() => setShowModal(false)}
        />
      )}
      {showBulkUpdateModal && (
        <BulkUpdateModal
          onClose={() => setShowBulkUpdateModal(false)}
          filteredLeads={leads}
          onUpdateSuccess={filterLeads} 
        />
      )}
       {LeadsforDownload && (
        <ConfirmModal
          message="Are you sure you want to download report?"
          onCancel={() => setLeadsforDownload(false)}
          onConfirm={() => {downloadCSVReport(leads); setLeadsforDownload(false); }}  // <-- Fix here
        />
      )}
    </div>
  );
};

export default UnassignedLeadTable;
