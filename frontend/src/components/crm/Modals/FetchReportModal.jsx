import React, { useEffect, useState } from "react";
import axios from "axios";
import ChipSelect from "./ChipSelect";
import "./styles/FetchReportModal.css";
import { toast } from "react-toastify";

const FetchReportModal = ({  onClose, onFetch, onDownload }) => {
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
      toast.error("Failed to load users");
    }
  };

  fetchUsers(); // ✅ Properly called here
}, []);


  const handleFetchClick = () => {
    if (!selectedUsers.length) {
      toast.error("Please select at least one user");
      return;
    }

    const filtersToSend = {
      ...modalFilters,
      assignedTo: selectedUsers.map(user => user.name)
    };

    onFetch(filtersToSend);
    onClose();
  };

  const handleSubmit = () => {
    if (!fromDate || !toDate) {
      toast.error("Please select both from and to dates");
      return;
    }

    const filtersToSend = {
      ...modalFilters,
      assignedTo: selectedUsers.map(user => user.name),
      fromDate,
      toDate
    };

    onDownload(filtersToSend);
    onClose();
  };

  return (
    <div className="fetch-report-modal__overlay">
      <div className="fetch-report-modal__container">
        <div className="fetch-report-modal__header">
          <h2 className="fetch-report-modal__title">Filter Leads by Users</h2>
          <button className="fetch-report-modal__close-btn" onClick={onClose}>
            ×
          </button>
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
              <button
                className="fetch-report-modal__link-btn"
                onClick={() => setShowDateRange(true)}
              >
                Filter with Date Range
              </button>
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
