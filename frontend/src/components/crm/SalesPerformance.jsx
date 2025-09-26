import React, { useEffect, useState } from "react";
import axios from "axios";
import "../../styles/crm/SalesPerformance.css";

const SalesPerformance = () => {
  const [sales, setSales] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("Today");
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/sales-performance`
        );
        setSales(response.data);
      } catch (error) {
        console.error("Error fetching sales data:", error);
      }
    };
    fetchSalesData();
  }, [selectedPeriod]);

  const handleSelectPeriod = (period) => {
    setSelectedPeriod(period);
    setShowDropdown(false);
  };

  return (
    <div className="sp-card">
      {/* Header */}
      <div className="sp-card-header">
        <h3 className="sp-title">Sales Performance</h3>
        <div className="sp-period-selector">
          <span
            className={`sp-dropdown-trigger ${showDropdown ? "open" : ""}`}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            {selectedPeriod}
            <svg
              className="sp-dropdown-arrow"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </span>
          {showDropdown && (
            <div className="sp-dropdown-menu">
              {["Today", "Monthly", "Yearly"].map((option) => (
                <div
                  key={option}
                  onClick={() => handleSelectPeriod(option)}
                  className="sp-dropdown-item"
                >
                  {option}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="sp-table-container">
        <table className="sp-table">
          <thead className="sp-table-head">
            <tr className="sp-table-head-row">
              <th scope="col" className="sp-th sp-th-sno">
                S.No.
              </th>
              <th scope="col" className="sp-th sp-th-rep">
                Representative
              </th>
              <th scope="col" className="sp-th sp-th-deals">
                Deals Closed
              </th>
              <th scope="col" className="sp-th sp-th-leads">
                Leads
              </th>
              <th scope="col" className="sp-th sp-th-rate">
                Rate (%)
              </th>
            </tr>
          </thead>
          <tbody className="sp-table-body">
            {sales.map((rep, i) => (
              <tr key={i} className="sp-table-row">
                <td className="sp-td sp-td-sno">{i + 1}</td>
                <td className="sp-td sp-td-rep">{rep.name}</td>
                <td className="sp-td sp-td-deals">{rep.deals}</td>
                <td className="sp-td sp-td-leads">{rep.leads}</td>
                <td className="sp-td sp-td-rate">
                  {rep.closedPercentage?.toFixed(1) || 0}%
                  <span
                    className={`sp-rate-icon ${
                      rep.change === "up"
                        ? "sp-rate-up"
                        : rep.change === "down"
                        ? "sp-rate-down"
                        : "sp-rate-neutral"
                    }`}
                  >
                    {rep.change === "up" ? (
                      <svg
                        className="sp-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 10l7-7m0 0l7 7m-7-7v18"
                        ></path>
                      </svg>
                    ) : rep.change === "down" ? (
                      <svg
                        className="sp-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        ></path>
                      </svg>
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalesPerformance;
