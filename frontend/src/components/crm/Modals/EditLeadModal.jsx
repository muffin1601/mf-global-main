import React, { useState, useEffect } from 'react';

import { AiOutlineClose } from 'react-icons/ai';
import axios from 'axios';
import { toast } from 'react-toastify';
import AdditionalContactsModal from './AdditionalContactsModal';
import CustomToast from '../CustomToast'; 
import { logActivity } from '../../../utils/logActivity';

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
      toast(<CustomToast type="error" title="Error" message="Failed to fetch users." />);
    }
  };

  const handleChange = (field, value) => setEditedLead(prev => ({ ...prev, [field]: value }));

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

  const formatDate = (dateString) => (!dateString ? "" : new Date(dateString).toISOString().split("T")[0]);

  const saveEditedLead = async () => {
  const updates = { ...editedLead, additionalContacts, id: editedLead._id }; 
  try {
    const res = await axios.post(`${import.meta.env.VITE_API_URL}/save-all-updates`, { updates: [updates] });

   
const assignedUser = editedLead.assignedTo?.[0]?.user;


    if (assignedUser && assignedUser._id) {

      const userIdToAssign = assignedUser._id;


      const permissionsToAssign = editedLead.assignedTo[0].permissions || { view: true, update: false, delete: false };


      await axios.post(`${import.meta.env.VITE_API_URL}/leads/assign/single`, {
        Leads: [editedLead._id],
        userIds: [userIdToAssign],
        permissions: permissionsToAssign,
      });
    }
    toast(<CustomToast type="success" title="Lead Updated" message="Lead updated successfully!" />);
    await logActivity("Edited Lead", { leadId: editedLead._id });
    onSave(res.data.updates?.[0] || updates);
    onClose();
  } catch (error) {
    console.error(error.response || error.message);
    toast(<CustomToast type="error" title="Update Failed" message={error.response?.data?.message || error.message} />);
  }
};

  const dropdownFields = {
    callStatus: ["Not Called","📞 Ring","❌ Not Interested","⏳ Available After One Month","✅ Converted","📆 Follow-up Required","🚫 Wrong Number"],
    status: ["🆕 New Lead","🏆 Won Lead","❌ Lost Lead","🔄 In Progress"],
    datatype: ["🌐 IndiaMart","🏢 Offline","📊 TradeIndia","📞 JustDial","🖥️ WebPortals","🔍 Other"]
  };

  if (!lead) return null;

  return (
    <div className="glasso-modal-overlay" onClick={onClose}>
      <div className="glasso-modal-container" onClick={(e) => e.stopPropagation()} style={{ backgroundImage: `url(/mnt/data/1dec7ce6-ed53-4f2f-9ddb-d5c7596859e3.png)` }}>
        <div className="glasso-modal-header">
          <h3 className="glasso-modal-title">Edit Lead Details</h3>
          <button className="glasso-close-btn" onClick={onClose}><AiOutlineClose /></button>
        </div>

        <div className="glasso-modal-body grid">
          {["name", "email", "phone", "company", "contact", "location", "state","category",  "address"].map((field) => (
            <div className={`glasso-input-group glasso-${field}`} key={field}>
              <label>{field.replace(/([A-Z])/g, ' $1').replace(/\b\w/g, l => l.toUpperCase())}</label>
              <input
                type={field.includes("Date") ? "date" : "text"}
                value={field.includes("Date") ? formatDate(editedLead[field]) : (editedLead[field] || "")}
                onChange={(e) => handleChange(field, e.target.value)}
                disabled={[ "phone", "company", "contact"].includes(field) && userRole !== "admin"}
              />
            </div>
          ))}

          {["requirements", "remarks"].map((field) => (
            <div className={`glasso-input-group glasso-${field}`} key={field}>
              <label>{field.replace(/([A-Z])/g, ' $1').replace(/\b\w/g, l => l.toUpperCase())}</label>
              <textarea rows={3} value={editedLead[field] || ""} onChange={(e) => handleChange(field, e.target.value)} />
            </div>
          ))}

          <div className="glasso-input-group glasso-assigned">
            <label>Assigned To</label>
            <select
              value={editedLead.assignedTo?.[0]?.user?._id || ""}
              disabled={userRole !== "admin"}
              onChange={(e) => {
                const selectedUser = users.find(u => u._id === e.target.value);
                handleChange("assignedTo", selectedUser ? [{ user: selectedUser, permissions: { view: true, update: false, delete: false } }] : []);
              }}
            >
              <option value="">Select User</option>
              {users.map(user => <option key={user._id} value={user._id}>{user.name}</option>)}
            </select>
          </div>

          {Object.entries(dropdownFields).map(([field, options]) => (
            <div className={`glasso-input-group glasso-${field}`} key={field}>
              <label>{field.replace(/([A-Z])/g, ' $1').replace(/\b\w/g, l => l.toUpperCase())}</label>
              <select value={editedLead[field] || ""} onChange={(e) => handleChange(field, e.target.value)}>
                <option value="">Select {field}</option>
                {options.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          ))}

          <div className="glasso-input-group glasso-followup">
            <label>Follow Up Date</label>
            <input type="date" value={formatDate(editedLead.followUpDate)} onChange={(e) => handleChange("followUpDate", e.target.value)} />
          </div>
          <div className="glasso-input-group glasso-followup">
            <label>Calling Date</label>
            <input type="date" value={formatDate(editedLead.callingdate)} onChange={(e) => handleChange("callingdate", e.target.value)} />
          </div>
        </div>

        <div className="glasso-footer-buttons">
          <button className="glasso-btn-add-contact" onClick={() => setShowContactsModal(true)}>View / Edit Contacts</button>
          <div className="glasso-action-buttons">
            <button className="glasso-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="glasso-btn-save" onClick={saveEditedLead}>Save</button>
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
          />
        )}
      </div>
    </div>
  );
};

export default EditLeadModal;

const css = `
  .glasso-modal-overlay {
  position: fixed;
  inset: 0;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99999;
}


.glasso-modal-container select {
  appearance: none; /* Remove default arrow */
  -webkit-appearance: none;
  -moz-appearance: none;
  background: rgba(255, 255, 255, 0.84);
  color: #000;
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: none;
  outline: none;
  font-family: 'Outfit', sans-serif;
  cursor: pointer;
  transition: background 0.3s ease, box-shadow 0.3s ease;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1rem;
}

/* Hover and focus effects */
.glasso-modal-container select:hover {
  background: rgba(255, 255, 255, 0.9);
}

.glasso-modal-container select:focus {
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.25);
}

/* Optional: add consistent height for dropdowns to match inputs */
.glasso-modal-container select {
  height: 2.5rem;
}

/* Scroll inside dropdown if options are long */
.glasso-modal-container select option {
  background: rgba(255,255,255,0.95);
  color: #000;
}

.glasso-modal-container {
  width: 700px;
  max-height: 90%;
  overflow-y: auto;
  backdrop-filter: blur(15px);
  background: rgba(255, 255, 255, 0.87);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  background-size: cover;
  background-position: center;
}

.glasso-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.glasso-modal-title {
  font-size: 1.5rem;
  color: #313131ff;
}

.glasso-close-btn {
  font-size: 1.2rem;
  color: #3b3b3bff;
  background: none;
  border: none;
  cursor: pointer;
}

.glasso-modal-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 0.5rem;
  margin-top: 1rem;
}


.glasso-input-group {
  display: flex;
  flex-direction: column;
}

.glasso-input-group label {
  color: #292929ff;
  margin-bottom: 0.25rem;
}

.glasso-input-group input,
.glasso-input-group select,
.glasso-input-group textarea {
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  border: none;
  outline: none;
  font-family: 'Outfit', sans-serif;
  background: rgba(255, 255, 255, 0.84);
  color: #000000ff;
}

.glasso-footer-buttons {
  display: flex;
  flex-wrap: wrap; 
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  gap: 1rem;
}

.glasso-btn-add-contact {
  flex: 1 1 100%; 
  max-width: 200px; 
}

.glasso-action-buttons {
  display: flex;
  gap: 1rem;
  flex: 1 1 auto; 
  justify-content: flex-end;
}

.glasso-btn-add-contact,
.glasso-btn-cancel,
.glasso-btn-save {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-family: 'Outfit', sans-serif;
  white-space: nowrap;
}


.glasso-btn-cancel { background: rgba(255,0,0,0.6); color: #fff; }
.glasso-btn-save { background: rgba(23, 146, 23, 1); color: #fff; }
.glasso-btn-add-contact { background: rgba(0,0,255,0.6); color: #fff; }

.glasso-btn-add-contact:hover {
  background: rgba(0,0,180,0.8);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,255,0.15);
  transition: background 0.2s, box-shadow 0.2s;
}

.glasso-btn-cancel:hover {
  background: rgba(200,0,0,0.8);
  color: #fff;
  box-shadow: 0 2px 8px rgba(255,0,0,0.15);
  transition: background 0.2s, box-shadow 0.2s;
}

.glasso-btn-save:hover {
  background: rgba(18, 120, 18, 0.95);
  color: #fff;
  box-shadow: 0 2px 8px rgba(23,146,23,0.15);
  transition: background 0.2s, box-shadow 0.2s;
}
.glasso-modal-container {
  overflow-y: auto;
  scrollbar-width: thin; /* Firefox */
  scrollbar-color: rgba(100,100,100,0.5) rgba(200,200,200,0.2); /* Firefox thumb & track */
  scroll-behavior: smooth; /* Smooth scrolling */
}


.glasso-modal-container::-webkit-scrollbar {
  width: 12px;
  transition: all 0.3s ease;
}

.glasso-modal-container::-webkit-scrollbar-track {
  background: rgba(200,200,200,0.2);
  border-radius: 10px;
}

.glasso-modal-container::-webkit-scrollbar-thumb {
  background-color: rgba(100,100,100,0.5);
  border-radius: 10px;
  border: 3px solid rgba(200,200,200,0.2);
  transition: background-color 0.3s ease, transform 0.3s ease;
}

.glasso-modal-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(80,80,80,0.7);
  transform: scaleX(1.2); /* slight grow effect on hover */
}

`;
const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);