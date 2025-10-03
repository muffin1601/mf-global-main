import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/crm/LeadTable.css'; 
import { AiOutlineEye, AiOutlineEdit, AiOutlineDelete } from 'react-icons/ai';
import LeadModal from './Modals/LeadModal';
import EditLeadModal from './Modals/EditLeadModal';
import ConfirmModal from './Modals/ConfirmModal';
import { logActivity } from '../../utils/logActivity'; 
import { toast } from 'react-toastify';
import FetchReportModal from './Modals/FetchReportModal';
import CustomToast from './CustomToast'

const AssignedLeadsTable = () => {
  const [leads, setLeads] = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 5;
  const [selectedLead, setSelectedLead] = useState(null);
  const [editLead, setEditLead] = useState(null);
  const [leadforDelete, setLeadforDelete] = useState(null);
  const [showFetchModal, setShowFetchModal] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [LeadsforDownload, setLeadsforDownload] = useState(false);
  const dateType = 'followUpDate'
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
      setLeads(data.uniqueAssignedClients);
      setTotalLeads(data.uniqueAssignedClients.length);
    } catch (error) {
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

  const filterLeads = (incomingFilters = filters) => {
    const removeIcons = (options) => Array.isArray(options) ? options.map(option => typeof option === "string" ? option.replace(/^[^\w]*\s*/, "").trim() : option) : options;
    const cleanedFilters = { ...incomingFilters, datatype: removeIcons(incomingFilters.datatype), status: removeIcons(incomingFilters.status), callStatus: removeIcons(incomingFilters.callStatus) };

    axios.post(`${import.meta.env.VITE_API_URL}/clients/filter`, cleanedFilters)
      .then((res) => {
        setTotalLeads(res.data.length);
        setLeads(res.data);
        // toast(<CustomToast type="success" title="Filtered" message="Leads filtered successfully" />);
      })
      .catch(() => toast(<CustomToast type="error" title="Failed" message="Failed to apply filters." />));
  };

  const handleDeleteLead = async () => {
    if (!leadforDelete) return;
    const ids = [leadforDelete._id || leadforDelete.id];
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/clients/delete`, { ids });
      toast(<CustomToast type="success" title="Deleted" message="Lead deleted successfully" />);
      await logActivity("Deleted Lead", { leadId: leadforDelete._id });
      setLeadforDelete(null);
      filterLeads();
    } catch {
      toast(<CustomToast type="error" title="Error" message="Failed to delete lead." />);
    }
  };

  const downloadCSVReport = async (leads) => {
    if (!Array.isArray(leads) || leads.length === 0) {
      return toast(<CustomToast type="error" title="Error" message="No leads provided for CSV download." />);
    }
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/leads/report/download-by-leads`, { leads }, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Assigned_Leads_Report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast(<CustomToast type="success" title="Success" message="Assigned leads report downloaded successfully!" />);
      await logActivity("Downloaded Assigned Leads Report", { leadsCount: leads.length });
    } catch {
      toast(<CustomToast type="error" title="Error" message="Failed to download leads report." />);
    }
  };

  const handleDownload = () => {
    if (!fromDate || !toDate) {
      return toast(<CustomToast type="warning" title="Warning" message="Please select both From and To dates." />);
    }
    downloadCSVUserReport(dateType, fromDate, toDate, leads);
  };

  const downloadCSVUserReport = async (dateType, fromDate, toDate, leads) => {
    if (!fromDate || !toDate) {
      return toast(<CustomToast type="error" title="Error" message="Please select both From and To dates." />);
    }
    if (!Array.isArray(leads) || leads.length === 0) {
      return toast(<CustomToast type="error" title="Error" message="No leads available to include in the report." />);
    }

    const formattedFromDate = new Date(fromDate).toISOString().split("T")[0];
    const formattedToDate = new Date(toDate).toISOString().split("T")[0];

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/leads/report/download`,
        { from: formattedFromDate, to: formattedToDate, type: dateType, leads },
        { responseType: "blob" }
      );

      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `LeadsReport_${formattedFromDate}_to_${formattedToDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast(<CustomToast type="success" title="Downloaded" message="Report downloaded successfully!" />);
      await logActivity("Downloaded Client Report", { fromDate: formattedFromDate, toDate: formattedToDate, type: dateType, leadsCount: leads.length });
    } catch {
      toast(<CustomToast type="error" title="Error" message="Failed to download report. Please try again." />);
    }
  };

  const handleRemoveAssignments = async (filtersToSend) => {

    const filterResponse = await axios.post(`${import.meta.env.VITE_API_URL}/clients/filter`, filtersToSend);
    const filteredLeads = filterResponse.data;

  if (!filteredLeads || filteredLeads.length === 0) {
    return toast(
      <CustomToast
        type="error"
        title="No Leads Selected"
        message="No leads available to remove assignments from."
      />
    );
  }

  try {
    await axios.post(`${import.meta.env.VITE_API_URL}/leads/remove-assignments`, {
      Leads: filteredLeads.map(l => l._id), 
    });

    toast(
      <CustomToast
        type="success"
        title="Assignments Removed"
        message="Assignments removed successfully!"
      />
    );

    fetchLeads(); 
  } catch (error) {
    console.error(error);
    toast(
      <CustomToast
        type="error"
        title="Remove Failed"
        message="Failed to remove assignments."
      />
    );
  }
};


  return (
    <div className="lead-card">
      <div className="lead-header">
        <h5>Assigned Leads Report</h5>
        <div className="lead-btn-group">
          <button className="btn-filter-2" onClick={() => setShowFetchModal(true)}>Fetch Report</button>
          {/* <button className="btn-update">Filter</button> */}
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
                
                <td>{lead.state}</td>
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
      {showFetchModal && (
        <FetchReportModal
          onClose={() => setShowFetchModal(false)}
          onFetch={(incomingFilters) => {
            setFilters(incomingFilters);
            filterLeads(incomingFilters);
            
          }}
          onDownload={(incomingFilters) => {
            setFilters(incomingFilters);
            setFromDate(incomingFilters.fromDate || "");
            setToDate(incomingFilters.toDate || "");
            handleDownload();
          }}
          onRemoveAssignment={(incomingFilters) => {
            setFilters(incomingFilters);
            handleRemoveAssignments(incomingFilters);
          }}
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

export default AssignedLeadsTable;
