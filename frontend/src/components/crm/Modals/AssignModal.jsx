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


        <button className="assign-leads" onClick={Openassignblock}>Assign</button>

        const handleAssign = async () => {
  if (selectedUsers.length === 0) {
    toast.error("Please select at least one user.");
    return;
  }

  try {
    await axios.post(`${import.meta.env.VITE_API_URL}/leads/assign`, {
      Leads: filteredLeads,
      userIds: selectedUsers, 
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

  const [permissions, setPermissions] = useState({
    view: false,
    update: false,
    delete: false
  });

  const [assignoptions, setAssignoptions] = useState(false);
  const [users, setUsers] = useState([]); 
  const [selectedUsers, setSelectedUsers] = useState([]); 