// Shared page shell for every Vendor Management screen.
//
// Reuses the CRM's existing dashboard layout (Sidebar + Navbar + content +
// footer) so vendor pages sit inside the same chrome as the rest of the app.

import React from 'react';
import Navbar from '../../../components/crm/Navbar';
import Sidebar from '../../../components/crm/Sidebar';
import '../../../styles/crm/Dashboard.css';

const VendorLayout = ({ children }) => (
  <>
    <div className="premium-dashboard-layout">
      <Sidebar />
      <div className="main-content-wrapper">
        <Navbar />
        <main className="premium-dashboard-main">{children}</main>
      </div>
    </div>
    <div className="premium-footer">
      © {new Date().getFullYear()} MF Global Services. All rights reserved.
    </div>
  </>
);

export default VendorLayout;
