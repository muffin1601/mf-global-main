import React, { useEffect, useState } from "react";
<<<<<<< HEAD
import { useNavigate } from "react-router-dom";
import "../../styles/crm/Dashboard.css";
import Navbar from "../../components/crm/Navbar";
import Sidebar from "../../components/crm/Sidebar";
import Overview from "../../components/crm/Overview";
import ToDoPerformance from "../../components/crm/ToDoPerformance";
import ChartOverview from "../../components/crm/ChartOverview";
import "../../styles/crm/global.css";
=======
import { Link, useNavigate } from "react-router-dom";
import "../../styles/crm/Dashboard.css";
import Navbar from "../../components/crm/Navbar"; // Adjust the import path as needed
import Sidebar from "../../components/crm/Sidebar";
import Overview from "../../components/crm/Overview";
import ToDoPerformance from "../../components/crm/ToDoPerformance"; // Adjust the import path as needed
import ChartOverview from "../../components/crm/ChartOverview";
// import { ToastContainer } from 'react-toastify';
// import 'react-toastify/dist/ReactToastify.css';
import "../../styles/crm/global.css"; // Adjust the import path as needed

>>>>>>> e535ab6584991d2da1192b8eb158a59d2165b973

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
<<<<<<< HEAD
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
=======
  const [loading, setLoading] = useState(true); // To handle loading state
  const navigate = useNavigate();
  
>>>>>>> e535ab6584991d2da1192b8eb158a59d2165b973

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
<<<<<<< HEAD
        Authorization: `Bearer ${token}`,
=======
        Authorization: `Bearer ${token}`, // ✅ Ensure token is correctly sent
>>>>>>> e535ab6584991d2da1192b8eb158a59d2165b973
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
<<<<<<< HEAD
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
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="dashboard-main">
          <Overview />
          <ToDoPerformance />
          <ChartOverview />
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
=======
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
            {/* <ToastContainer position="top-right" autoClose={3000} /> */}
            <Overview /> {/* Dashboard cards/content */}
            <ToDoPerformance /> {/* Placeholder for future content */}
            <ChartOverview /> {/* Placeholder for future content */}
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
>>>>>>> e535ab6584991d2da1192b8eb158a59d2165b973
  );
};

export default Dashboard;
