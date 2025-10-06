import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../../styles/crm/Overview.css';
import axios from 'axios';

const ProductOverview = () => {
  const navigate = useNavigate();

  const [totalProducts, setTotalProducts] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [topSellingProduct, setTopSellingProduct] = useState('N/A');
  const [outOfStock, setOutOfStock] = useState(0);
  const [totalVendors, setTotalVendors] = useState(0);
  const [returnedProducts, setReturnedProducts] = useState(0);

  const user = JSON.parse(localStorage.getItem('user')) || {
    name: "Mr.Henry",
    profile: "/assets/profile.jpg",
    role: "user"
  };

  useEffect(() => {
    const fetchProductStats = async () => {
      try {
        const productRes = await axios.get(`${import.meta.env.VITE_API_URL}/products`);
        setTotalProducts(productRes.data.products.length || 0);
        setLowStock(productRes.data.lowStock || 0);
        setTopSellingProduct(productRes.data.topSellingProduct || 'N/A');
        setOutOfStock(productRes.data.outOfStock || 0);
        setReturnedProducts(productRes.data.returnedProducts || 0);

        const vendorRes = await axios.get(`${import.meta.env.VITE_API_URL}/vendors`);
        setTotalVendors(vendorRes.data.vendors.length || 0);
      } catch (error) {
        console.error('Error fetching product or vendor stats:', error);
      }
    };

    fetchProductStats();
  }, []);

  // SVG icons
  const icons = {
    totalProducts: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M3 13h2v-2H3v2zm4 0h2v-2H7v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zM3 17h2v-2H3v2zm4 0h2v-2H7v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zM3 21h18v-2H3v2z"/>
      </svg>
    ),
    totalVendors: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V20h14v-3.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V20h6v-3.5c0-2.33-4.67-3.5-7-3.5z"/>
      </svg>
    ),
    lowStock: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
      </svg>
    ),
    topSellingProduct: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M12 17.27L18.18 21 16.54 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21z"/>
      </svg>
    ),
    outOfStock: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M21 5H3v14h18V5zm-2 12H5V7h14v10z"/>
      </svg>
    ),
    returnedProducts: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.66-.69 3.16-1.76 4.24l1.42 1.42C19.07 16.28 20 14.24 20 12c0-4.42-3.58-8-8-8zm-6.24 1.76L4.34 7.18C3.93 7.59 3.5 8.28 3.5 9h2c0-.17.07-.34.21-.48l1.25-1.25zm-.21 7.48L3.5 15c0 .72.43 1.41.84 1.82l1.42-1.42C5.69 15.16 5 14.66 5 14h2c0 .17.07.34.21.48z"/>
      </svg>
    ),
  };

  const cards = [
    { title: 'Total Products', value: totalProducts, icon: icons.totalProducts, bg: '#42a5f5', route: '/crm/product-management' },
    { title: 'Total Vendors', value: totalVendors, icon: icons.totalVendors, bg: '#26a69a', route: '/crm/vendor-management' },
    { title: 'Low Stock Items', value: lowStock, icon: icons.lowStock, bg: '#ef5350', route: '/products/low-stock' },
    { title: 'Top Selling Product', value: topSellingProduct, icon: icons.topSellingProduct, bg: '#ab47bc', route: '/products/top-selling' },
    { title: 'Out of Stock', value: outOfStock, icon: icons.outOfStock, bg: '#ffa726', route: '/products/out-of-stock' },
    { title: 'Returned Products', value: returnedProducts, icon: icons.returnedProducts, bg: '#7986cb', route: '/products/returned' }
  ];

  return (
    <div className="dashboard-overview">
      <div className="dashboard-header">
        <div>
          <p className="breadcrumb">Dashboards <span>→</span> Product Management</p>
          <h2>Hello, {user.name} 👋</h2>
        </div>
        {/* <div className="dashboard-user-actions">
          <button className="btn filter">Filter</button>
          <button className="btn share">Share</button>
        </div> */}
      </div>

      <div className="dashboard-cards">
        {cards.map((card, index) => (
          <div
            key={index}
            className="dashboard-card"
            onClick={() => navigate(card.route)}
          >
            <div
              className="card-icon"
              style={{
                backgroundColor: card.bg,
                boxShadow: `0px 2px 6px ${card.bg}`
              }}
            >
              {card.icon}
            </div>
            <div className="card-content">
              <p className="card-title">{card.title}</p>
              <h3 className="card-value">{card.value}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductOverview;
