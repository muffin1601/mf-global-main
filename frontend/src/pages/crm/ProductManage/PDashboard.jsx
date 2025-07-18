import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../../styles/crm/PDashboard.css";
import Navbar from "../../../components/crm/Navbar";
import Sidebar from "../../../components/crm/Sidebar";
import ProductOverview from "../../../components/crm/Product/ProductOverview";
import SalesOverviewChart from '../../../components/crm/Product/SalesOverviewChart';
import OrderStatistics from '../../../components/crm/Product/OrderStatistics';
import TopSellingCategories from '../../../components/crm/Product/TopSellingCategories';
// import LatestTransactions from '../../../components/crm/Product/LatestTransactions';
// import RecentActivity from '../../../components/crm/Product/RecentActivity';
// import SalesStatistics from '../../../components/crm/Product/SalesStatistics';
// import OverallStatistics from '../../../components/crm/Product/OverallStatistics';
import "../../../styles/crm/global.css";

const PDashboard = () => {
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/crm/login");
      return;
    }

    fetch(`${import.meta.env.VITE_API_URL}/dashboard`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server responded with status ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!data.user) {
          throw new Error("Invalid response from server");
        }
        setUser(data.user);
        setMessage(data.message || "");
      })
      .catch((error) => {
        console.error("Dashboard Fetch Error:", error);
        navigate("/crm/login");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="loader"></div>
        <p>Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="product-dashboard-layout">
      <Sidebar />
      <div className="product-main-content">
        <Navbar />
        <ProductOverview />
        <div className="product-dashboard-main">
          
          <SalesOverviewChart />
        <OrderStatistics />
        <TopSellingCategories />
        </div>
        <footer
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            backgroundColor: "#f1f1f1",
            textAlign: "center",
            fontSize: "14px",
            color: "#555",
            borderTop: "1px solid #ddd",
          }}
        >
          © {new Date().getFullYear()} MF Global Services. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default PDashboard;
