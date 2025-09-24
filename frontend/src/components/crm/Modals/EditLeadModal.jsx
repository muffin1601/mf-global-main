import React, { useState, useEffect } from 'react';
import './styles/EditLeadModal.css';
import { AiOutlineClose } from 'react-icons/ai';
import axios from 'axios';
import { logActivity } from '../../../utils/logActivity';
import { toast } from 'react-toastify';
import AdditionalContactsModal from './AdditionalContactsModal';

const EditLeadModal = ({ lead, onClose, onSave, userRole }) => {
  const [editedLead, setEditedLead] = useState({});
  const [users, setUsers] = useState([]);
  const [additionalContacts, setAdditionalContacts] = useState([]);
  const [showContactsModal, setShowContactsModal] = useState(false);


  useEffect(() => {
    fetchUsers();
    if (lead) {
      setEditedLead({ ...lead });
      setAdditionalContacts(lead.additionalContacts || []);
    }
  }, [lead]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/users`);
      setUsers(res.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleChange = (field, value) => {
    setEditedLead(prev => ({ ...prev, [field]: value }));
  };

  const handleContactChange = (index, field, value) => {
    const updated = [...additionalContacts];
    updated[index][field] = value;
    setAdditionalContacts(updated);
  };

  const removeContact = (index) => {
  const updated = [...additionalContacts];
  updated.splice(index, 1);
  setAdditionalContacts(updated);
};


  const addNewContact = () => {
    setAdditionalContacts([...additionalContacts, { name: "", contact: "", details: "" }]);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toISOString().split("T")[0];
  };

 const saveEditedLead = async () => {
  const updates = {
    id: editedLead._id,
    name: editedLead.name,
    email: editedLead.email,
    phone: editedLead.phone,
    contact: editedLead.contact,
    remarks: editedLead.remarks,
    requirements: editedLead.requirements,
    location: editedLead.location,
    category: editedLead.category,
    datatype: editedLead.datatype,
    callStatus: editedLead.callStatus,
    status: editedLead.status,
    followUpDate: editedLead.followUpDate,
    additionalContacts,
    assignedTo: editedLead.assignedTo,
  };
  console.log("Saving lead updates:", updates);
  try {
    // Save the lead details
    const res = await axios.post(`${import.meta.env.VITE_API_URL}/save-all-updates`, {
      updates: [updates],
    });

    // ✅ Only assign if there's a valid user ID
    const assignedUser = editedLead.assignedTo?.[0]?.user;
    if (assignedUser && assignedUser._id) {
      await axios.post(`${import.meta.env.VITE_API_URL}/leads/assign`, {
        Leads: [editedLead._id],
        userIds: [assignedUser._id],
        permissions: editedLead.assignedTo[0].permissions || {
          view: true,
          update: false,
          delete: false,
        },
      });
    }

    toast.success("Lead updated successfully!");
    await logActivity("Edited Lead", { leadId: editedLead._id });
    onSave(res.data);
    onClose();
  } catch (error) {
    console.error("Error updating lead:", error.response || error.message);
    toast.warning(`Error: ${error.response?.data?.message || error.message}`);
  }
};

  const dropdownFields = {
    callStatus: [
      "Not Called",
      "📞 Ring",
      "❌ Not Interested",
      "⏳ Available After One Month",
      "✅ Converted",
      "📆 Follow-up Required",
      "🚫 Wrong Number",
    ],
    status: [
      "🆕 New Lead",
      "🏆 Won Lead",
      "❌ Lost Lead",
      "🔄 In Progress",
    ],
    datatype: [
      "🌐 IndiaMart",
      "🏢 Offline",
      "📊 TradeIndia",
      "📞 JustDial",
      "🖥️ WebPortals",
      "🔍 Other",
    ],
  };

  if (!lead) return null;

  return (
    <div className="lead-modal-overlay" onClick={onClose}>
      <div className="lead-modal edit" onClick={(e) => e.stopPropagation()}>
        <div className="lead-modal-header">
          <h3>Edit Details</h3>
          <button className="close-btn" onClick={onClose}><AiOutlineClose /></button>
        </div>

        <div className="lead-modal-body grid">
          {[
            "name", "email", "phone", "company", "contact", "location",
            "category", "inquiryDate", "address"
          ].map((field) => (
            <div className="input-group" key={field}>
              <label>{field.replace(/([A-Z])/g, ' $1').replace(/\b\w/g, l => l.toUpperCase())}</label>
              <input
                type={field.includes("Date") ? "date" : "text"}
                value={field.includes("Date") ? formatDate(editedLead[field]) : (editedLead[field] || "")}
                onChange={(e) => handleChange(field, e.target.value)}
                disabled={
                  ["name", "email", "phone", "company", "contact"].includes(field) && userRole !== "admin"
                }
              />
            </div>
          ))}

          {["requirements", "remarks"].map((field) => (
            <div className="input-group" key={field}>
              <label>{field.replace(/([A-Z])/g, ' $1').replace(/\b\w/g, l => l.toUpperCase())}</label>
              <textarea
                rows={3}
                value={editedLead[field] || ""}
                onChange={(e) => handleChange(field, e.target.value)}
              />
            </div>
          ))}

          <div className="input-group">
            <label>Assigned To</label>
            <select
              value={editedLead.assignedTo?.[0]?.user?._id || ""}
              disabled={userRole !== "admin"}
              onChange={(e) => {
                const selectedUser = users.find(u => u._id === e.target.value);
                if (selectedUser) {
                  handleChange("assignedTo", [
                    {
                      user: {
                        _id: selectedUser._id,
                        name: selectedUser.name,
                      },
                      permissions: { view: true, update: false, delete: false },
                    },
                  ]);
                } else {
                  handleChange("assignedTo", []);
                }
              }}
            >
              <option value="">Select User</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          {Object.entries(dropdownFields).map(([field, options]) => (
            <div className="input-group" key={field}>
              <label>{field.replace(/([A-Z])/g, ' $1').replace(/\b\w/g, l => l.toUpperCase())}</label>
              <select
                value={editedLead[field] || ""}
                onChange={(e) => handleChange(field, e.target.value)}
              >
                <option value="">Select {field}</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <div className="input-group">
            <label>Follow Up Date</label>
            <input
              type="date"
              value={formatDate(editedLead.followUpDate)}
              onChange={(e) => handleChange("followUpDate", e.target.value)}
            />
          </div>
        </div>
        <div className='footer-edit-btns'>
          <label></label>
          <button type="button" className="btn-add-contact" onClick={() => setShowContactsModal(true)}>
            View / Edit Contacts
          </button>
            <div className="lead-modal-footer-edit">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save-edit" onClick={saveEditedLead}>Save</button>
        </div>
        </div>
        {showContactsModal && (
          <AdditionalContactsModal
            isOpen={showContactsModal}
            onClose={() => setShowContactsModal(false)}
            additionalContacts={additionalContacts}
            handleContactChange={handleContactChange}
            addNewContact={addNewContact}
            removeContact={removeContact}
          />)}
      </div>
    </div>
  );
};

export default EditLeadModal;
