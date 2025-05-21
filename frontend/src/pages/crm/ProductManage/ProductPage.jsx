import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../../styles/crm/Dashboard.css";
import Navbar from "../../../components/crm/Navbar"; // Adjust the import path as needed
import Sidebar from "../../../components/crm/Sidebar";
import ProductsTable from "../../../components/crm/Product/ProductsTable";


const LeadManagement = () => {
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true); // To handle loading state
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
        Authorization: `Bearer ${token}`, // ✅ Ensure token is correctly sent
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
        setMessage(data.message || ""); // Ensure message is properly set
      })
      .catch((error) => {
        console.error("Dashboard Fetch Error:", error);
        navigate("/crm/login"); // Redirect to login if there's an error
      })
      .finally(() => setLoading(false)); // Set loading to false once the fetch is done
  }, [navigate]);

  if (loading) {
    return <div>Loading...</div>; // Add a loading indicator
  }

  return (
  
    <>
      <div className="dashboard-layout">
        <Sidebar /> {/* Left sidebar */}
        <div className="main-content">
          <Navbar /> {/* Top navbar */}
          <div className="dashboard-main">
            <ProductsTable />
          </div>
          <footer style={{ 
            marginTop: "20px", 
            padding: "10px 20px", 
            backgroundColor: "#f1f1f1", 
            textAlign: "center", 
            fontSize: "14px", 
            color: "#555", 
            borderTop: "1px solid #ddd" 
          }}>
            © {new Date().getFullYear()} MF Global Services. All rights reserved.
          </footer>
        </div>
      </div>

    </>
  );
};

export default LeadManagement;
