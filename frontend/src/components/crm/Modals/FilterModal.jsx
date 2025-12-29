import React, { useState, useEffect } from "react";
import axios from "axios";

import { toast } from "react-toastify";
import CustomToast from "../CustomToast"; 
import ChipSelect from "./ChipSelect";
import { FaTrash } from "react-icons/fa";

const FilterModal = ({ onClose, onApply, onDeleteAll, defaultFilters }) => {
  const [modalFilters, setModalFilters] = useState(
    defaultFilters || {
      category: [],
      datatype: [],
      location: [],
      state: [],
      fileName: [],
      status: [],
      callStatus: [],
    }
  );

  const [dbOptions, setDbOptions] = useState({
    category: [],
    location: [],
      state: [],
    fileName: [],
  });

  const fixedOptions = {
    datatype: [
      "🌐 IndiaMart",
      "🏢 Offline",
      "📊 TradeIndia",
      "📞 Exhibition",
      "🖥️ WebPortals",
      "🔍 Other",
    ],
    status: ["🆕 New Lead", "🏆 Won Lead", "❌ Lost Lead", "🔄 In Progress"],
    callStatus: [
      "Not Called",
      "📞 Ring",
      "❌ Not Interested",
      "⏳ Available After One Month",
      "✅ Converted",
      "📆 Follow-up Required",
      "🚫 Wrong Number",
    ],
  };

  const user = JSON.parse(localStorage.getItem("user"));

  const handleChipChange = (field, values) => {
    setModalFilters((prev) => ({ ...prev, [field]: values }));
  };

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/clients/meta`
        );
        setDbOptions({
          category: [...new Set(res.data.categories || [])],
          location: [...new Set(res.data.locations || [])],
            state: [...new Set(res.data.states || [])],
          fileName: [...new Set(res.data.filenames || [])],
        });
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

  const handleApply = () => {
    onApply(modalFilters);
    onClose();
  };

  return (
    <div className="filtermodal-overlay" onClick={onClose}>
      <div
        className="filtermodal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="filtermodal-header">
          <h3 className="filtermodal-title">Filter Leads</h3>
          <button className="filtermodal-close-btn" onClick={onClose}>
            ✖
          </button>
        </div>

        <div className="filtermodal-group">
          {["category", "location", "state","fileName"].map((field) => (
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

        <div className="filtermodal-footer-wrapper">
          {user.role === "admin" && (
            <div className="filtermodal-footer-left">
              <button
                className="filtermodal-btn-deleteall"
                onClick={handleDeleteAll}
              >
                <FaTrash />
              </button>
            </div>
          )}
          <div className="filtermodal-footer-right">
            <button className="filtermodal-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button className="filtermodal-btn-apply" onClick={handleApply}>
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterModal;

const css = `
.filtermodal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: 'Outfit', sans-serif;
  border-radius: 20px;
  z-index: 1200;
}

.filtermodal-container {
  background: rgba(255, 255, 255, 0.84);
  border-radius: 12px;
  width: 600px;
  max-width: 95%;
  padding: 1.5rem;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
  animation: fadeInScale 0.25s ease;
  font-family: 'Outfit', sans-serif;
}

.filtermodal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.filtermodal-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: #333;
}

.filtermodal-close-btn {
  border: none;
  background: transparent;
  font-size: 1.2rem;
  cursor: pointer;
  color: #777;
  transition: color 0.2s ease;
}

.filtermodal-close-btn:hover {
  color: #222;
}

.filtermodal-group {
  display: grid;
  font-family: 'Outfit', sans-serif;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.filtermodal-footer-wrapper {
  display: flex;
  font-family: 'Outfit', sans-serif;
  justify-content: space-between;
  align-items: center;
}

.filtermodal-footer-left {
  display: flex;
  align-items: center;
}

.filtermodal-btn-deleteall {
  background: #dc3545;
  border: none;
  padding:  0.5rem 0.75rem;
  border-radius: 12px;
  justify-content: center;

  font-family: 'Outfit', sans-serif;
  cursor: pointer;
  color: #fff;
  font-size: 1rem;
  transition: background 0.2s ease;
}

.filtermodal-btn-deleteall:hover {
  background: #b52b37;
}

.filtermodal-footer-right {
  display: flex;
  gap: 0.8rem;
}

.filtermodal-btn-cancel {
  background: #ddd;
  border: none;
  font-family: 'Outfit', sans-serif;
  padding: 0.65rem 1.2rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s ease;
}

.filtermodal-btn-cancel:hover {
  background: #bbb;
}

.filtermodal-btn-apply {
  background: #007bff;
  color: #fff;
  border: none;
  padding: 0.65rem 1.2rem;
  border-radius: 8px;
  font-family: 'Outfit', sans-serif;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s ease;
}

.filtermodal-btn-apply:hover {
  background: #0069d9;
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
