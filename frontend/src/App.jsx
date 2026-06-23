import React, { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import "./styles/crm/ToastStyles.css";
import ProtectedRoute from "./utils/ProtectedRoute";

// Route-level code splitting: each page becomes its own lazily-loaded chunk so
// the first load only ships the matched route (not the entire app).
const Mainhome = lazy(() => import("./pages/main/Mainhome"));
const Contact = lazy(() => import("./pages/main/Contact"));
const BlogDetail = lazy(() => import("./pages/main/BlogDetail"));
const BlogList = lazy(() => import("./pages/main/BlogList"));
const BlogForm = lazy(() => import("./pages/main/BlogForm"));

const NewLeads = lazy(() => import("./pages/crm/NewLeads"));
const Dashboard = lazy(() => import("./pages/crm/Dashboard"));
const LeadManagement = lazy(() => import("./pages/crm/LeadManagement"));
const Home = lazy(() => import("./landingpage/components/Home"));
const Login = lazy(() => import("./pages/crm/Login"));
const UserManagement = lazy(() => import("./pages/crm/UserManagement"));
const AssignedLeadManagement = lazy(() => import("./pages/crm/AssignedLeadManagement"));
const UnassignedLeadManagement = lazy(() => import("./pages/crm/UnassignedLeadManagement"));
const MyLeads = lazy(() => import("./pages/crm/MyLeads"));
const MyConversions = lazy(() => import("./pages/crm/MyConversions"));
const TodayFollowups = lazy(() => import("./pages/crm/TodayFollowups"));
const UpcomingFollowups = lazy(() => import("./pages/crm/UpcomingFollowups"));
const ConvertedLeads = lazy(() => import("./pages/crm/ConvertedLeads"));
const PDashboard = lazy(() => import("./pages/crm/ProductManage/PDashboard"));
const ProductPage = lazy(() => import("./pages/crm/ProductManage/ProductPage"));
const VendorPage = lazy(() => import("./pages/crm/ProductManage/VendorPage"));
const TrendingLeads = lazy(() => import("./pages/crm/TrendingLeads"));
const MyTrendingLeads = lazy(() => import("./pages/crm/Mytrending"));
const Quotations = lazy(() => import("./pages/crm/ProductManage/Quotations"));
const CreateQuotation = lazy(() => import("./pages/crm/ProductManage/CreateQuotation"));
const QuotationEditPage = lazy(() => import("./pages/crm/ProductManage/QuotationEditPage"));
const ImportLeads = lazy(() => import("./pages/crm/ImportLeads"));

// Minimal fallback shown only while a route chunk is being fetched.
const RouteFallback = () => (
  <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
    Loading…
  </div>
);

const App = () => {
  return (
    <>
      <Suspense fallback={<RouteFallback />}>
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
          <Route path="/crm/import-leads" element={<ProtectedRoute role={["user", "admin"]}><ImportLeads /></ProtectedRoute>} />
          <Route path="/crm/unassigned-leads" element={<ProtectedRoute role="admin"><UnassignedLeadManagement /></ProtectedRoute>} />
          <Route path="/crm/new-leads" element={<ProtectedRoute role="admin"><NewLeads /></ProtectedRoute>} />
          <Route path="/crm/user-management" element={<ProtectedRoute role="admin"><UserManagement /></ProtectedRoute>} />
          <Route path="/crm/assigned-leads" element={<ProtectedRoute role="admin"><AssignedLeadManagement /></ProtectedRoute>} />
          <Route path="/crm/trending-leads" element={<ProtectedRoute role="admin"><TrendingLeads /></ProtectedRoute>} />
          <Route path="/crm/my-trending-leads" element={<ProtectedRoute role={["admin", "user"]}><MyTrendingLeads /></ProtectedRoute>} />
          <Route path="/crm/my-leads" element={<ProtectedRoute role={["admin", "user"]}><MyLeads /></ProtectedRoute>} />
          <Route path="/crm/conversions" element={<ProtectedRoute role={["user", "admin"]}><MyConversions /></ProtectedRoute>} />
          <Route path="/crm/today-followups" element={<ProtectedRoute role={["user", "admin"]}><TodayFollowups /></ProtectedRoute>} />
          <Route path="/crm/upcoming-followups" element={<ProtectedRoute role={["user", "admin"]}><UpcomingFollowups /></ProtectedRoute>} />
          <Route path="/crm/won-leads" element={<ProtectedRoute role="admin"><ConvertedLeads /></ProtectedRoute>} />
          <Route path="/crm/product-dashboard" element={<ProtectedRoute role="admin"><PDashboard /></ProtectedRoute>} />
          <Route path="/crm/product-management" element={<ProtectedRoute role="admin"><ProductPage /></ProtectedRoute>} />
          <Route path="/crm/vendor-management" element={<ProtectedRoute role="admin"><VendorPage /></ProtectedRoute>} />
          <Route path="/crm/quotations" element={<ProtectedRoute role={["user", "admin"]}><Quotations /></ProtectedRoute>} />
          <Route path="/crm/quotations/create" element={<ProtectedRoute role={["user", "admin"]}><CreateQuotation /></ProtectedRoute>} />
          <Route path="/crm/quotations/edit/:id" element={<ProtectedRoute role={["user", "admin"]}><QuotationEditPage /></ProtectedRoute>} />
        </Routes>
      </Suspense>
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
