import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChartBar, FaExclamationTriangle, FaStar, FaBoxOpen, FaUsers, FaUndoAlt } from 'react-icons/fa';
import '../../../styles/crm/Overview.css';
import axios from 'axios';

const ProductOverview = () => {
  const navigate = useNavigate();

  // Product-related states
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

        const vendorRes = await axios.get(`${import.meta.env.VITE_API_URL}/vendors/count`);
        setTotalVendors(vendorRes.data.totalVendors || 0);
      } catch (error) {
        console.error('Error fetching product or vendor stats:', error);
      }
    };

    fetchProductStats();
  }, []);

  const cards = [
  {
    title: 'Total Products',
    value: totalProducts,
    icon: <FaChartBar />,
    change: '+4.2%',
    color: 'white',
    bg: '#42a5f5',
    route: '/crm/product-management',
  },  
  {
    title: 'Total Vendors',
    value: totalVendors,
    icon: <FaUsers />,
    change: '+1.5%',
    color: 'white',
    bg: '#26a69a',
    route: '/vendors',
  },
  {
    title: 'Low Stock Items',
    value: lowStock,
    icon: <FaExclamationTriangle />,
    change: '-1.1%',
    color: 'white',
    bg: '#ef5350',
    negative: true,
    route: '/products/low-stock',
  },
  {
    title: 'Top Selling Product',
    value: topSellingProduct,
    icon: <FaStar />,
    change: '+8.0%',
    color: 'white',
    bg: '#ab47bc',
    route: '/products/top-selling',
  },
  {
    title: 'Out of Stock',
    value: outOfStock,
    icon: <FaBoxOpen />,
    change: '+2.0%',
    color: 'white',
    bg: '#ffa726',
    route: '/products/out-of-stock',
  },

  {
    title: 'Returned Products',
    value: returnedProducts,
    icon: <FaUndoAlt />,
    change: '+0.8%',
    color: 'white',
    bg: '#7986cb',
    route: '/products/returned',
  }
];


  return (
    <div className="dashboard-overview">
      <div className="dashboard-header">
        <div>
          <p className="breadcrumb">Dashboards <span>→</span> Product Management</p>
          <h2>Hello, {user.name} 👋</h2>
        </div>
        <div className="dashboard-user-actions">
          <button className="btn filter">Filter</button>
          <button className="btn share">Share</button>
        </div>
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
                color: card.color,
                boxShadow: `0px 2px 6px ${card.bg}`
              }}
            >
              {card.icon}
            </div>
            <div className="card-content">
              <p className="card-title">{card.title}</p>
              <h3 className="card-value">{card.value}</h3>
              <span className={`card-change ${card.negative ? 'negative' : 'positive'}`}>
                {card.negative ? '↓' : '↑'} {card.change}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductOverview;
