import React, { useEffect, useState } from 'react';
import axios from 'axios';
import "../../styles/crm/SalesPerformance.css";

const SalesPerformance = () => {
    const [sales, setSales] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState("Today");
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        
        const fetchSalesData = async () => {
            try {
                
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/sales-performance`);
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
        <div className="sales-performance-card">
            <div className="sales-card-header">
                <h3>Sales Performance</h3>
                <div className="relative">
                    <span
                        className={`sales-dropdown-trigger ${showDropdown ? 'open' : ''}`}
                        onClick={() => setShowDropdown(!showDropdown)}
                    >
                        {selectedPeriod}
                        <svg className="dropdown-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </span>
                    {showDropdown && (
                        <div className="sales-dropdown-menu">
                            {["Today", "Monthly", "Yearly"].map(option => (
                                <div
                                    key={option}
                                    onClick={() => handleSelectPeriod(option)}
                                    className="sales-dropdown-item"
                                >
                                    {option}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="sales-table-container">
                <table className="sales-table">
                    <thead className="sales-table-header">
                        <tr>
                            <th scope="col" className="px-6 py-3">S.No.</th>
                            <th scope="col" className="px-6 py-3">Representative</th>
                            <th scope="col" className="px-6 py-3 text-center">Deals Closed</th>
                            <th scope="col" className="px-6 py-3 text-center">Leads</th>
                            <th scope="col" className="px-6 py-3 text-right">Rate (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sales.map((rep, i) => (
                            <tr key={i} className="sales-table-row">
                                <td className="px-6 py-4">{i + 1}</td>
                                <td className="px-6 py-4">{rep.name}</td>
                                <td className="px-6 py-4 text-center">{rep.deals}</td>
                                <td className="px-6 py-4 text-center">{rep.leads}</td>
                                <td className="px-6 py-4 sales-rate-cell">
                                    {rep.rate.toFixed(1)}%
                                    <span className={`sales-change-icon ${rep.change === "up" ? "sales-change-up" : rep.change === "down" ? "sales-change-down" : "sales-change-neutral"}`}>
                                        {rep.change === "up" ? (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
                                            </svg>
                                        ) : rep.change === "down" ? (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
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
