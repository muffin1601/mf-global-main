// Vendor list page. `preset` selects the All / Active / Pending / Inactive view.

import React from 'react';
import VendorLayout from './VendorLayout';
import VendorList from '../../../components/crm/Vendor/VendorList';

const VendorsPage = ({ preset = 'all' }) => (
  <VendorLayout>
    <VendorList preset={preset} />
  </VendorLayout>
);

export default VendorsPage;
