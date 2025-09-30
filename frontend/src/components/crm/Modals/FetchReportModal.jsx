import React, { useEffect, useState } from "react";
import axios from "axios";
import ChipSelect from "./ChipSelect";
import "./styles/FetchReportModal.css";
import { toast } from "react-toastify";
import CustomToast from "../CustomToast"; // import your custom toast

const FetchReportModal = ({ onClose, onFetch, onDownload }) => {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showDateRange, setShowDateRange] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [modalFilters, setModalFilters] = useState({
    category: [],
    datatype: [],
    location: [],
    fileName: [],
    status: [],
    callStatus: [],
    assignedTo: []
  });

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
      toast(<CustomToast type="error" title="Validation Error" message="Please select at least one user" />);
      return;
    }

    const filtersToSend = {
      ...modalFilters,
      assignedTo: selectedUsers.map(user => user.name)
    };

    toast(<CustomToast type="success" title="Report Fetched" message="Leads fetched successfully" />);
    onFetch(filtersToSend);
    onClose();
  };

  const handleSubmit = () => {
    if (!fromDate || !toDate) {
      toast(<CustomToast type="error" title="Validation Error" message="Please select both from and to dates" />);
      return;
    }

    const filtersToSend = {
      ...modalFilters,
      assignedTo: selectedUsers.map(user => user.name),
      fromDate,
      toDate
    };

    toast(<CustomToast type="success" title="Report Download" message="Report generated successfully" />);
    onDownload(filtersToSend);
    onClose();
  };

  return (
    <div className="fetch-report-modal__overlay">
      <div className="fetch-report-modal__container">
        <div className="fetch-report-modal__header">
          <h2 className="fetch-report-modal__title">Filter Leads by Users</h2>
          <button className="fetch-report-modal__close-btn" onClick={onClose}>×</button>
        </div>

        <div className="fetch-report-modal__body">
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

          {!showDateRange ? (
            <>
              <button
                className="fetch-report-modal__fetch-btn fetch-report-modal__btn--full"
                onClick={handleFetchClick}
              >
                Fetch Report
              </button>
              {/* <button
                className="fetch-report-modal__link-btn"
                onClick={() => setShowDateRange(true)}
              >
                Filter with Date Range
              </button> */}
            </>
          ) : (
            <>
              <div className="fetch-report-modal__form-group">
                <label className="fetch-report-modal__label">From Date</label>
                <input
                  className="fetch-report-modal__input"
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                />
              </div>
              <div className="fetch-report-modal__form-group">
                <label className="fetch-report-modal__label">To Date</label>
                <input
                  className="fetch-report-modal__input"
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                />
              </div>
              <button
                className="fetch-report-modal__generate-btn fetch-report-modal__btn--full"
                onClick={handleSubmit}
              >
                Download Report
              </button>
              <button
                className="fetch-report-modal__link-btn"
                onClick={() => setShowDateRange(false)}
              >
                Cancel Date Range
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
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  border-radius: 20px;
  justify-content: center;
  align-items: center;
  z-index: 99999;
  font-family: 'Outfit', sans-serif;
}

.fetch-report-modal__container {
  background: rgba(255, 255, 255, 0.84);
  border-radius: 12px;
  width: 480px;
  max-width: 90%;
  font-family: 'Outfit', sans-serif;
  padding: 1.5rem;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.2);
  animation: fadeInScale 0.25s ease;
}

.fetch-report-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.fetch-report-modal__title {
  font-size: 1.3rem;
  font-weight: 600;
  color: #333;
}

.fetch-report-modal__close-btn {
  border: none;
  background: transparent;
  font-size: 1.2rem;
  cursor: pointer;
  color: #777;
  transition: color 0.2s ease;
}

.fetch-report-modal__close-btn:hover {
  color: #222;
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
}

.fetch-report-modal__input,
.fetch-report-modal__select {
  padding: 0.6rem 0.8rem;
  font-family: 'Outfit', sans-serif;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 0.95rem;
}

.fetch-report-modal__btn--full {
  width: 100%;
  padding: 0.65rem 1.2rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  font-family: 'Outfit', sans-serif;
  border: none;
  transition: background 0.2s ease;
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
