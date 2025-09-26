import React from "react";
import { Routes, Route } from "react-router-dom";
import Mainhome from "./pages/main/Mainhome";
import Contact from "./pages/main/Contact";
import BlogDetail from "./pages/main/BlogDetail";
import BlogList from "./pages/main/BlogList";
import BlogForm from "./pages/main/BlogForm";

import NewLeads from "./pages/crm/NewLeads";
import Dashboard from "./pages/crm/Dashboard";
import LeadManagement from "./pages/crm/LeadManagement";
import Home from "./landingpage/components/Home";
import Login from "./pages/crm/Login";
import UserManagement from "./pages/crm/UserManagement";
import AssignedLeadManagement from "./pages/crm/AssignedLeadManagement"
import UnassignedLeadManagement from "./pages/crm/UnassignedLeadManagement"
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import "./styles/crm/ToastStyles.css";
import CustomToast from "./components/crm/CustomToast";
import ProtectedRoute from "./utils/ProtectedRoute";
import MyLeads from "./pages/crm/MyLeads";
import MyConversions from "./pages/crm/MyConversions";
import TodayFollowups from "./pages/crm/TodayFollowups";
import UpcomingFollowups from "./pages/crm/UpcomingFollowups"
import ConvertedLeads from "./pages/crm/ConvertedLeads"
import PDashboard from "./pages/crm/ProductManage/PDashboard";
import ProductPage from "./pages/crm/ProductManage/ProductPage";
import VendorPage from "./pages/crm/ProductManage/VendorPage";
import TrendingLeads from "./pages/crm/TrendingLeads";

const App = () => {
  const showSuccess = () =>
    toast(<CustomToast type="success" title="Well done!" message="Your message has been sent successfully." />);

  const showError = () =>
    toast(<CustomToast type="error" title="Oh snap!" message="Change a few things up and try submitting again." />);

  const showWarning = () =>
    toast(<CustomToast type="warning" title="Warning!" message="There was a problem with your request." />);

  const showInfo = () =>
    toast(<CustomToast type="info" title="Hi there!" message="Do you have a problem? Just use this contact form." />);

  return (
    <>
      <Routes>
        <Route path="/" element={<Mainhome />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/blogs" element={<BlogList />} />
        <Route path="/blogs/new" element={<BlogForm />} />
        <Route path="/blogs/:id" element={<BlogDetail />} />


        <Route path="/crm" element={<Home />} />
        <Route path="/crm/login" element={<Login />} />
        <Route path="/crm/entrydashboard" element={<ProtectedRoute role={["user", "admin"]}><Dashboard /></ProtectedRoute>} />
        <Route path="/crm/lead-management" element={<ProtectedRoute role={["user", "admin"]}><LeadManagement /></ProtectedRoute>} />
        <Route path="/crm/unassigned-leads" element={<ProtectedRoute role="admin"><UnassignedLeadManagement /></ProtectedRoute>} />
        <Route path="/crm/new-leads" element={<ProtectedRoute role="admin"><NewLeads /></ProtectedRoute>} />
        <Route path="/crm/user-management" element={<ProtectedRoute role="admin"><UserManagement /></ProtectedRoute>} />
        <Route path="/crm/assigned-leads" element={<ProtectedRoute role="admin"><AssignedLeadManagement /></ProtectedRoute>} />
        <Route path="/crm/trending-leads" element={<ProtectedRoute role="admin"><TrendingLeads /></ProtectedRoute>} />
        <Route path="/crm/my-leads" element={<ProtectedRoute role={["admin", "user"]}><MyLeads /></ProtectedRoute>} />
        <Route path="/crm/conversions" element={<ProtectedRoute role={["user", "admin"]}><MyConversions /></ProtectedRoute>} />
        <Route path="/crm/today-followups" element={<ProtectedRoute role={["user", "admin"]}><TodayFollowups /></ProtectedRoute>} />
        <Route path="/crm/upcoming-followups" element={<ProtectedRoute role={["user", "admin"]}><UpcomingFollowups /></ProtectedRoute>} />
        <Route path="/crm/won-leads" element={<ProtectedRoute role="admin"><ConvertedLeads /></ProtectedRoute>} />
        <Route path="/crm/product-dashboard" element={<ProtectedRoute role="admin"><PDashboard /></ProtectedRoute>} />
        <Route path="/crm/product-management" element={<ProtectedRoute role="admin"><ProductPage /></ProtectedRoute>} />
        <Route path="/crm/vendor-management" element={<ProtectedRoute role="admin"><VendorPage /></ProtectedRoute>} />
      </Routes>
      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar
        closeOnClick
        closeButton={false}  
        toastClassName="bg-transparent shadow-none p-0" 
      />
    </>
  );
};

export default App;
