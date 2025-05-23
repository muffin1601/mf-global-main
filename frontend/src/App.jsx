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
import ProtectedRoute from "./utils/ProtectedRoute";
import MyLeads from "./pages/crm/MyLeads";
import MyConversions from "./pages/crm/MyConversions";
import TodayFollowups from "./pages/crm/TodayFollowups";
import UpcomingFollowups from "./pages/crm/UpcomingFollowups"

const App = () => {

  return (
    <>
        <Routes>
          <Route path="/" element={<Mainhome />} />
          <Route path="/crm" element = {<Home />}/>
          <Route path ="/crm/entrydashboard" element={<ProtectedRoute role={["user", "admin"]}><Dashboard /></ProtectedRoute>}/>
          <Route path="/crm/lead-management" element={<ProtectedRoute role={["user", "admin"]}><LeadManagement /></ProtectedRoute>} />
          <Route path="/crm/unassigned-leads" element={<ProtectedRoute role="admin"><UnassignedLeadManagement /></ProtectedRoute>} />
          <Route path="/crm/new-leads" element={<ProtectedRoute role="admin"><NewLeads /></ProtectedRoute>} />
          <Route path="/crm/user-management" element={<ProtectedRoute role="admin"><UserManagement /></ProtectedRoute>} />
          <Route path="/crm/assigned-leads" element={<ProtectedRoute role="admin"><AssignedLeadManagement /></ProtectedRoute>} />
          <Route path="/crm/login"  element={<Login/>}/>
          <Route path="/crm/my-leads"  element={<ProtectedRoute role={["admin","user"]}><MyLeads /></ProtectedRoute>}/>
          <Route path="/crm/conversions"  element={<ProtectedRoute role={["user", "admin"]}><MyConversions /></ProtectedRoute>}/>
          <Route path="/crm/today-followups" element={<ProtectedRoute role={["user", "admin"]}><TodayFollowups /></ProtectedRoute>} />
          <Route path="/crm/upcoming-followups" element={<ProtectedRoute role={["user", "admin"]}><UpcomingFollowups /></ProtectedRoute>} />
        </Routes>
        <ToastContainer position="top-center" autoClose={3000} />
    </>
  );
};

export default App;
