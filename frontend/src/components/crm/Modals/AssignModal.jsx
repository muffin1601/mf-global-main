import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import ChipSelect from './ChipSelect';
import { FaTrash } from 'react-icons/fa';
import CustomToast from '../CustomToast';

const AssignModal = ({ onClose, onApply, onDeleteAll, defaultFilters }) => {
  const [filteredLeads, setFilteredLeads] = useState({});
  const [modalFilters, setModalFilters] = useState(defaultFilters || {
    category: [],
    datatype: [],
    location: [],
    state: [],
    fileName: [],
    status: [],
    callStatus: []
  });

  const [dbOptions, setDbOptions] = useState({
    category: [],
    location: [],
    state: [],
    fileName: []
  });

  const [permissions, setPermissions] = useState({
    view: false,
    update: false,
    delete: false
  });

  const [assignOptionsVisible, setAssignOptionsVisible] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  const fixedOptions = {
    datatype: ["🌐 IndiaMart", "🏢 Offline", "📊 TradeIndia", "📞 JustDial", "🖥️ WebPortals", "🔍 Other"],
    status: ["🆕 New Lead", "🏆 Won Lead", "❌ Lost Lead", "🔄 In Progress"],
    callStatus: ["Not Called", "📞 Ring", "❌ Not Interested", "⏳ Available After One Month", "✅ Converted", "📆 Follow-up Required", "🚫 Wrong Number"]
  };

  const user = JSON.parse(localStorage.getItem('user'));

  const handleChipChange = (field, values) => {
    setModalFilters(prev => ({ ...prev, [field]: values }));
  };

  useEffect(() => {
  const fetchMeta = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/clients/unassigned/meta`);
      setDbOptions({
        category: res.data.categories || [],
        location: res.data.locations || [],
        state: res.data.states || [],
        fileName: res.data.filenames || [],
      });

      const userRes = await axios.get(`${import.meta.env.VITE_API_URL}/users`);
      setUsers(userRes.data);
    } catch (error) {
      console.error(error);
      toast(
        <CustomToast
          type="error"
          title="Failed to Load"
          message="Could not fetch filter options. Please try again."
        />
      );
    }
  };
  fetchMeta();
}, []);

const handleDeleteAll = () => {
  onDeleteAll(modalFilters);
  onClose();
};

// const filterLeadsForAssign = (incomingFilters = modalFilters) => {
//   const removeIcons = (options) => {
//     if (Array.isArray(options)) {
//       return options.map(option => typeof option === "string" ? option.replace(/^[^\w]*\s*/, "").trim() : option);
//     }
//     return options;
//   };

//   const cleanedFilters = {
//     ...incomingFilters,
//     datatype: removeIcons(incomingFilters.datatype),
//     status: removeIcons(incomingFilters.status),
//     callStatus: removeIcons(incomingFilters.callStatus),
//   };

//   axios.post(`${import.meta.env.VITE_API_URL}/clients/unassigned/filter`, cleanedFilters)
//     .then(res => setFilteredLeads(res.data))
//     .catch(err => {
//       console.error("Filter Error:", err);
//       toast(
//         <CustomToast
//           type="error"
//           title="Filter Failed"
//           message="Could not filter leads. Please try again."
//         />
//       );
//     });
// };

const handleApply = () => {
  onApply(modalFilters);
  onClose();
};

const handleAssign = async () => {
  if (selectedUsers.length === 0) {
    return toast(
      <CustomToast
        type="error"
        title="No Users Selected"
        message="Please select at least one user."
      />
    );
  }

  try {
    await axios.post(`${import.meta.env.VITE_API_URL}/leads/assign`, {
      Leads: filteredLeads,
      userIds: selectedUsers,
      permissions,
    });
    toast(
      <CustomToast
        type="success"
        title="Leads Assigned"
        message="Leads assigned successfully!"
      />
    );
    setAssignOptionsVisible(false);
  } catch (error) {
    console.error(error);
    toast(
      <CustomToast
        type="error"
        title="Assign Failed"
        message="Failed to assign leads."
      />
    );
  }
};

const handleRemoveAssignments = async () => {
  if (selectedUsers.length === 0) {
    return toast(
      <CustomToast
        type="error"
        title="No Users Selected"
        message="Please select at least one user to remove."
      />
    );
  }

  try {
    await axios.post(`${import.meta.env.VITE_API_URL}/leads/remove-assignments`, {
      Leads: filteredLeads,
      userIds: selectedUsers.map(u => u._id),
    });
    toast(
      <CustomToast
        type="success"
        title="Assignments Removed"
        message="Assignments removed successfully!"
      />
    );
    setAssignOptionsVisible(false);
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

const openAssignBlock = () => {
  setAssignOptionsVisible(true);
  // filterLeadsForAssign();
};

  return (
  <div className="am-overlay" onClick={onClose}>
    <div className="am-container" onClick={e => e.stopPropagation()}>

      {/* Header */}
      <div className="am-header">
        <h3 className="am-title">Filter Leads to Assign</h3>
        <button className="am-close-btn" onClick={onClose}>✖</button>
      </div>

      {/* Filters */}
      <div className="am-filters">
        {['category', 'location', 'state', 'fileName'].map(field => (
          <ChipSelect
            key={field}
            label={field.charAt(0).toUpperCase() + field.slice(1)}
            name={field}
            options={dbOptions[field]}
            selected={modalFilters[field]}
            onChange={handleChipChange}
          />
        ))}
        {Object.entries(fixedOptions).map(([field, options]) => (
          <ChipSelect
            key={field}
            label={field.charAt(0).toUpperCase() + field.slice(1)}
            name={field}
            options={options}
            selected={modalFilters[field]}
            onChange={handleChipChange}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="am-footer-wrapper">
        {user.role === 'admin' && (
          <div className="am-footer-left">
            <button className="am-assign-btn" onClick={openAssignBlock}>Assign</button>
            <button className="am-deleteall-btn" onClick={handleDeleteAll}>
              <FaTrash />
            </button>
          </div>
        )}
        <div className="am-footer-right">
          <button className="am-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="am-apply-btn" onClick={handleApply}>Apply Filters</button>
        </div>
      </div>

      {/* Assign Section */}
      {assignOptionsVisible && (
        <div className="am-assign-overlay" onClick={() => setAssignOptionsVisible(false)}>
          <div className="am-assign-container" onClick={e => e.stopPropagation()}>
            <h3 className="am-assign-title">Assign To Users</h3>
            <ChipSelect
              label="Users"
              name="users"
              options={users.map(u => u.name)}
              selected={selectedUsers.map(u => u.name)}
              onChange={(name, selectedNames) => {
                const selected = selectedNames
                  .map(name => users.find(u => u.name === name))
                  .filter(Boolean)
                  .map(u => ({ _id: u._id, name: u.name }));
                setSelectedUsers(selected);
              }}
            />

            <h4 className="am-permissions-title">User Permissions</h4>
            {['view', 'update', 'delete'].map(perm => (
              <div key={perm} className="am-permission-group">
                <label className="am-perm-label">{perm.charAt(0).toUpperCase() + perm.slice(1)}:</label>
                <label className="am-perm-option">
                  <input
                    type="radio"
                    name={perm}
                    checked={permissions[perm]}
                    onChange={() => setPermissions(prev => ({ ...prev, [perm]: true }))}
                  />
                  Allow
                </label>
                <label className="am-perm-option">
                  <input
                    type="radio"
                    name={perm}
                    checked={!permissions[perm]}
                    onChange={() => setPermissions(prev => ({ ...prev, [perm]: false }))}
                  />
                  Deny
                </label>
              </div>
            ))}

            <div className="am-assign-footer">
              <button className="am-apply-btn" onClick={handleAssign}>Okay</button>
              <button className="am-remove-btn" onClick={handleRemoveAssignments}>Remove</button>
              <button className="am-cancel-btn" onClick={() => setAssignOptionsVisible(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  </div>
);

};

export default AssignModal;

const css = `
/* Overlay */
.am-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  border-radius: 20px;
  align-items: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

/* Modal Container */
.am-container {
  width: 750px;
  max-width: 95%;
  max-height: 90%;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(15px);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  font-family: 'Outfit', sans-serif;
  scroll-behavior: smooth;
}

.am-container::-webkit-scrollbar {
  width: 12px;
}

.am-container::-webkit-scrollbar-track {
  background: rgba(200,200,200,0.2);
  border-radius: 10px;
}

.am-container::-webkit-scrollbar-thumb {
  background-color: rgba(100,100,100,0.5);
  border-radius: 10px;
  border: 3px solid rgba(200,200,200,0.2);
}

.am-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(80,80,80,0.7);
  transform: scaleX(1.2);
}

/* Header */
.am-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.am-title {
  font-size: 1.5rem;
  color: #313131;
}

.am-close-btn {
  font-size: 1.2rem;
  color: #3b3b3b;
  background: none;
  border: none;
  cursor: pointer;
}

/* Filters grid */
.am-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

/* Footer */
.am-footer-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.am-footer-left {
  display: flex;  
  align-items: center;
  gap: 0.5rem;
}

.am-footer-right {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

/* Buttons */
.am-assign-btn,
.am-deleteall-btn,
.am-apply-btn,
.am-cancel-btn,
.am-remove-btn {
  padding: 0.6rem 1rem;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-family: 'Outfit', sans-serif;
  transition: all 0.2s ease;
}

/* Assign buttons colors */
.am-assign-btn { background: rgba(0,0,255,0.6); color: #fff; }
.am-deleteall-btn { background: rgba(220,53,69,0.8); color: #fff; }
.am-apply-btn { background: rgba(23,146,23,1); color: #fff; }
.am-cancel-btn { background: rgba(255,0,0,0.6); color: #fff; }
.am-remove-btn { background: rgba(255,140,0,0.8); color: #fff; }

/* Hover effects */
.am-assign-btn:hover { background: rgba(0,0,200,0.8); }
.am-deleteall-btn:hover { background: rgba(180,40,50,0.9); }
.am-apply-btn:hover { background: rgba(18,120,18,0.95); }
.am-cancel-btn:hover { background: rgba(200,0,0,0.8); }
.am-remove-btn:hover { background: rgba(255,120,0,1); }

/* Assign Modal Overlay */
.am-assign-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

/* Assign Container */
.am-assign-container {
  width: 500px;
  max-width: 95%;
  max-height: 85%;
  overflow-y: auto;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(15px);
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.3);
}

/* Assign Header */
.am-assign-title {
  font-size: 1.3rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

/* Permissions */
.am-permissions-title {
  margin: 1rem 0 0.5rem;
  font-size: 1.1rem;
  font-weight: 500;
}

.am-permission-group {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.am-perm-label {
  font-weight: 500;
}

.am-perm-option input {
  margin-right: 0.25rem;
}

/* Assign Footer */
.am-assign-footer {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

/* Select styling (matches glasso select) */
.am-container select,
.am-assign-container select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background: rgba(255,255,255,0.84);
  color: #000;
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: none;
  outline: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1rem;
  transition: background 0.3s ease, box-shadow 0.3s ease;
  height: 2.5rem;
}

.am-container select:hover,
.am-assign-container select:hover { background: rgba(255,255,255,0.9); }

.am-container select:focus,
.am-assign-container select:focus { box-shadow: 0 0 8px rgba(0,0,0,0.25); }

.am-container select option,
.am-assign-container select option { background: rgba(255,255,255,0.95); color: #000; 
}


`;

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);