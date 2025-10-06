import React, { useEffect, useState } from "react";
import axios from "axios";
import ChipSelect from "./ChipSelect";
import { toast } from "react-toastify";
import CustomToast from "../CustomToast";

const FetchReportModal = ({ onClose, onFetch, onDownload, onRemoveAssignment, onTransferAssignment }) => {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [targetUser, setTargetUser] = useState(null);
  const [isTransferMode, setIsTransferMode] = useState(false); // toggle view

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/users`);
        setUsers(res.data);
      } catch (err) {
        console.error(err);
        toast(<CustomToast type="error" title="Load Failed" message="Failed to load users" />);
      }
    };

    fetchUsers();
  }, []);

  const handleFetchClick = () => {
    if (!selectedUsers.length) {
      toast(<CustomToast type="warning" title="Validation Error" message="Please select at least one user" />);
      return;
    }

    const filtersToSend = {
      assignedTo: selectedUsers.map(user => user.name),
    };

    toast(<CustomToast type="success" title="Report Fetched" message="Leads fetched successfully" />);
    onFetch(filtersToSend);
    onClose();
  };

  // const handleDownloadClick = () => {
  //   if (!fromDate || !toDate) {
  //     toast(<CustomToast type="error" title="Validation Error" message="Please select both from and to dates" />);
  //     return;
  //   }

  //   const filtersToSend = {
  //     assignedTo: selectedUsers.map(user => user.name),
  //     fromDate,
  //     toDate,
  //   };

  //   toast(<CustomToast type="success" title="Report Download" message="Report generated successfully" />);
  //   onDownload(filtersToSend);
  //   onClose();
  // };

  const handleRemoveClick = () => {
    if (!selectedUsers.length) {
      toast(<CustomToast type="warning" title="Validation Error" message="Please select at least one user" />);
      return;
    }
    if (onRemoveAssignment) {
      const filtersToSend = {
        assignedTo: selectedUsers.map(u => u.name),
      };
      onRemoveAssignment(filtersToSend);
      onClose();
    }
  };

 const handleTransferClick = () => {
  if (!selectedUsers.length || !targetUser) {
    toast(<CustomToast type="warning" title="Validation Error" message="Select users and target user" />);
    return;
  }

  const filtersToSend = {
    assignedTo: selectedUsers.map(u => u.name), 
  };

  onTransferAssignment(filtersToSend, targetUser.name); 
  onClose();
};


  return (
    <div className="fetch-report-modal__overlay">
      <div className="fetch-report-modal__container">
        <div className="fetch-report-modal__header">
          <h2 className="fetch-report-modal__title">
            {isTransferMode ? "Transfer Assignments" : "Filter Leads by Users"}
          </h2>
          <button className="fetch-report-modal__close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="fetch-report-modal__body">
          {!isTransferMode ? (
            <>
              <ChipSelect
                label="Users"
                name="users"
                options={users.map(u => u.name)}
                selected={selectedUsers.map(u => u.name)}
                onChange={(name, selectedNames) => {
                  const selected = selectedNames
                    .map(n => users.find(u => u.name === n))
                    .filter(Boolean)
                    .map(u => ({ _id: u._id, name: u.name }));
                  setSelectedUsers(selected);
                }}
              />
              <div className="foot-btns">
              <button
                className="fetch-report-modal__fetch-btn fetch-report-modal__btn--full"
                onClick={handleFetchClick}
              >
                Fetch Report
              </button>

              <button className="am-remove-btn" onClick={handleRemoveClick}>
                Remove Assignments
              </button>
             </div>
              <button
                className="fetch-report-modal__link-btn"
                onClick={() => setIsTransferMode(true)}
              >
                Transfer Assignments
              </button>
            </>
          ) : (
            <>
              <ChipSelect
                label="From Users"
                name="fromUsers"
                options={users.map(u => u.name)}
                selected={selectedUsers.map(u => u.name)}
                onChange={(name, selectedNames) => {
                  const selected = selectedNames
                    .map(n => users.find(u => u.name === n))
                    .filter(Boolean)
                    .map(u => ({ _id: u._id, name: u.name }));
                  setSelectedUsers(selected);
                }}
              />

              <ChipSelect
                label="To User"
                name="toUser"
                options={users.map(u => u.name)}
                selected={targetUser ? [targetUser.name] : []}
                onChange={(name, selectedNames) => {
                  const user = users.find(u => u.name === selectedNames[0]);
                  setTargetUser(user || null);
                }}
                singleSelect
              />

              <button
                className="fetch-report-modal__generate-btn fetch-report-modal__btn--full"
                onClick={handleTransferClick}
              >
                Confirm Transfer
              </button>

              <button
                className="fetch-report-modal__link-btn"
                onClick={() => setIsTransferMode(false)}
              >
                Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FetchReportModal;

const css = `
.fetch-report-modal__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px); /* subtle blur */
  display: flex;
  border-radius: 20px;
  justify-content: center;
  align-items: center;
  z-index: 99999;
  font-family: 'Outfit', sans-serif;
}

.fetch-report-modal__container {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  width: 480px;
  max-width: 92%;
  padding: 1.5rem;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.25);
  animation: fadeInScale 0.25s ease;
}

.fetch-report-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.fetch-report-modal__title {
  font-size: 1.35rem;
  font-weight: 600;
  color: #222;
}

.fetch-report-modal__close-btn {
  border: none;
  background: transparent;
  font-size: 1.4rem;
  cursor: pointer;
  color: #888;
  transition: color 0.2s ease, transform 0.15s ease;
}

.fetch-report-modal__close-btn:hover {
  color: #111;
  transform: scale(1.15);
}

.fetch-report-modal__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  font-family: 'Outfit', sans-serif;
}

.fetch-report-modal__form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.fetch-report-modal__label {
  font-size: 0.95rem;
  color: #444;
  font-weight: 500;
}

.fetch-report-modal__input,
.fetch-report-modal__select {
  padding: 0.65rem 0.9rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: 'Outfit', sans-serif;
  background: #fff;
  transition: border 0.2s ease, box-shadow 0.2s ease;
}

.fetch-report-modal__input:focus,
.fetch-report-modal__select:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.15);
  outline: none;
}

.foot-btns{
display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
.fetch-report-modal__btn--full {
  width: 40%;
  padding: 0.7rem 1.2rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  font-family: 'Outfit', sans-serif;
  border: none;
  transition: background 0.25s ease, transform 0.15s ease;
}

.fetch-report-modal__btn--full:active {
  transform: scale(0.98);
}


.fetch-report-modal__fetch-btn {
  background: #28a745;
  color: #fff;
}

.fetch-report-modal__fetch-btn:hover {
  background: #218838;
}

.fetch-report-modal__generate-btn {
  background: #007bff;
  color: #fff;
}

.fetch-report-modal__generate-btn:hover {
  background: #0069d9;
}


.am-remove-btn {
  background: #dc3545;
  color: #fff;
  border: none;
  padding: 0.7rem 1.2rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.25s ease;
}

.am-remove-btn:hover {
  background: #c82333;
}

/* Transfer button distinct style */
.fetch-report-modal__transfer-btn {
  background: #ffc107;
  color: #222;
  border: none;
  padding: 0.7rem 1.2rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.25s ease;
}

.fetch-report-modal__transfer-btn:hover {
  background: #e0a800;
}

.fetch-report-modal__link-btn {
  background: transparent;
  border: none;
  color: #007bff;
  font-size: 0.95rem;
  font-family: 'Outfit', sans-serif;
  cursor: pointer;
  padding: 0.25rem 0;
  text-align: left;
}

.fetch-report-modal__link-btn:hover {
  text-decoration: underline;
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

`;

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);
