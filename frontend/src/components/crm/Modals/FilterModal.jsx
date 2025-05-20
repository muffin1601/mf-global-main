import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './styles/FilterModal.css';
import { toast } from 'react-toastify';
import ChipSelect from './ChipSelect';
import { FaTrash } from 'react-icons/fa';

const FilterModal = ({ onClose, onApply, onDeleteAll, defaultFilters }) => {
  const [filteredLeads, setFilteredLeads] = useState ({});
  const [modalFilters, setModalFilters] = useState(defaultFilters || {
    category: [],
    datatype: [],
    location: [],
    fileName: [],
    status: [],
    callStatus: []
  });

  const [dbOptions, setDbOptions] = useState({
    category: [],
    location: [],
    fileName: []
  });

  const [permissions, setPermissions] = useState({
    view: false,
    update: false,
    delete: false
  });

  const [assignoptions, setAssignoptions] = useState(false);
  const [users, setUsers] = useState([]); // all users
  const [selectedUsers, setSelectedUsers] = useState([]); // assigned users

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
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/clients/meta`);
        setDbOptions({
          category: [...new Set(res.data.categories || [])],
          location: [...new Set(res.data.locations || [])],
          fileName: [...new Set(res.data.filenames || [])]
        });

        const userRes = await axios.get(`${import.meta.env.VITE_API_URL}/users`);
        setUsers(userRes.data);
      } catch (error) {
        console.error(error);
        toast.error('Failed to load options');
      }
    };
    fetchMeta();
  }, []);

  const handleDeleteAll = () => {
    onDeleteAll(modalFilters);
    onClose();
  };

  const filterleadsforassign = (incomingFilters = modalFilters) => {
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
    // setTotalLeads(res.data.length);
    setFilteredLeads(res.data);
    // toast.success("Leads filtered successfully");
  }).catch((err) => {
    console.error("Filter Error:", err);
    // toast.error("Failed to apply filters.");
  });
};


  const handleApply = () => {
    onApply(modalFilters);
    onClose();
    
  };

const handleAssign = async () => {
  if (selectedUsers.length === 0) {
    toast.error("Please select at least one user.");
    return;
  }

  try {
    await axios.post(`${import.meta.env.VITE_API_URL}/leads/assign`, {
      Leads: filteredLeads,
      userIds: selectedUsers, // now includes {_id, name}
      permissions,
    });
    toast.success("Leads assigned successfully.");
    setAssignoptions(false);
  } catch (error) {
    toast.error("Failed to assign leads.");
  }
};

const handleRemoveAssignments = async () => {
  if (selectedUsers.length === 0) {
    toast.error("Please select at least one user to remove.");
    return;
  }

  try {
    await axios.post(`${import.meta.env.VITE_API_URL}/leads/remove-assignments`, {
      Leads: filteredLeads,
      userIds: selectedUsers.map(u => u._id),
    });
    toast.success("Assignments removed successfully.");
    setAssignoptions(false);
  } catch (error) {
    toast.error("Failed to remove assignments.");
  }
};

const Openassignblock = () =>{
  setAssignoptions(true); filterleadsforassign();
}
  return (
    <div className="filter-modal-overlay" onClick={onClose}>
      <div className="filter-modal" onClick={(e) => e.stopPropagation()}>
        <div className="filter-header">
          <h3 className="filter-title">Filter Leads</h3>
          <button className="btn-close-filter" onClick={onClose}>✖</button>
        </div>

        <div className="filter-group">
          {['category', 'location', 'fileName'].map((field) => (
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

        <div className='filter-footer-btn'>
          {user.role == 'admin' && (
          <div className="filter-footer-1">
            <button className="assign-leads" onClick={Openassignblock}>Assign</button>
            <button className="delete-btn-all" onClick={handleDeleteAll}><FaTrash /></button>
          </div>)}
          <div className="filter-footer">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button className="btn-apply" onClick={handleApply}>Apply Filters</button>
          </div>
        </div>
        {assignoptions && (
          <div className="permissions-section">
            <h4>Assign To Users</h4>
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
            <h4>User Permissions</h4>
            {['view', 'update', 'delete'].map((perm) => (
              <div key={perm} className="permission-group">
                <label>{perm.charAt(0).toUpperCase() + perm.slice(1)}:</label>
                <label>
                  <input
                    type="radio"
                    name={perm}
                    checked={permissions[perm]}
                    onChange={() =>
                      setPermissions((prev) => ({ ...prev, [perm]: true }))
                    }
                  />
                  Allow
                </label>
                <label>
                  <input
                    type="radio"
                    name={perm}
                    checked={!permissions[perm]}
                    onChange={() =>
                      setPermissions((prev) => ({ ...prev, [perm]: false }))
                    }
                  />
                  Deny
                </label>
              </div>
            ))}

            {/* <button onClick={() => setPermissions({ view: false, update: false, delete: false })}>
              Remove All
            </button> */}
            <button className="btn-apply" onClick={handleAssign}>Okay</button>
            <button className="btn-remove-permissions" onClick={handleRemoveAssignments}>Remove</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterModal;
