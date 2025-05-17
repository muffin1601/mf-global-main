import React from "react";
import { Routes, Route} from "react-router-dom";
import NewLeads from "./pages/crm/NewLeads";
import Dashboard from "./pages/crm/Dashboard";
import LeadManagement from "./pages/crm/LeadManagement";
import Home from "./landingpage/components/Home";
import Login from "./pages/crm/Login";
import UserManagement from "./pages/crm/UserManagement";
import Mainhome from "./pages/main/Mainhome";
import AssignedLeadManagement from "./pages/crm/AssignedLeadManagement"
import UnassignedLeadManagement from "./pages/crm/UnassignedLeadManagement"
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ProtectedRoute from "./utils/ProtectedRoute"


const App = () => {
  // const loggedInUser = JSON.parse(localStorage.getItem("user"));

// if (!loggedInUser || !loggedInUser.userId) {
//   // Handle the case where the user is not logged in or the userId is missing
//   return <div>User is not logged in. Please log in.</div>;
// }

  return (
    <>
        <Routes>
          <Route path="/" element={<Mainhome />} />
          <Route path="/crm" element = {<Home />}/>
          <Route path ="/crm/entrydashboard" element={<ProtectedRoute role={["user", "admin"]}><Dashboard /></ProtectedRoute>}/>
          <Route path="/crm/lead-management" element={<ProtectedRoute role={["user", "admin"]}><LeadManagement /></ProtectedRoute>} />
          <Route path="/crm/unassigned-leads" element={<ProtectedRoute role={["user", "admin"]}><UnassignedLeadManagement /></ProtectedRoute>} />
          <Route path="/crm/new-leads" element={<ProtectedRoute role={["user", "admin"]}><NewLeads /></ProtectedRoute>} />
          <Route path="/crm/user-management" element={<ProtectedRoute role={["user", "admin"]}><UserManagement /></ProtectedRoute>} />
          <Route path="/crm/assigned-leads" element={<ProtectedRoute role={["user", "admin"]}><AssignedLeadManagement /></ProtectedRoute>} />
          <Route path="/crm/login"  element={<Login/>}/>
          {/* <Route path="/crm/forgot-password"  element={<ForgotPassword/>}/>
          <Route path="/crm/track-user-activity"  element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>}/>
          <Route path="/crm/assign-work" element={<ProtectedRoute role="admin"><AssignWork /></ProtectedRoute>} />
          <Route path="/crm/manage-users" element={<ProtectedRoute role="admin"><ManageUsers /></ProtectedRoute>} />
          <Route path="/crm/user-work"  element={<ProtectedRoute role={["user", "admin"]}><ClientWorkShow /></ProtectedRoute>}/> */}
        </Routes>
        <ToastContainer position="top-center" autoClose={3000} />
    </>
  );
};

export default App;
