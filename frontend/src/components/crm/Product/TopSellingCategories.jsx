import React from 'react';
import './styles/TopSellingCategories.css';

const categories = [
  {
    name: 'Clothing',
    sales: '31,245',
    gross: '25% Gross',
    change: '0.45%',
    color: '#22c55e',
    bgColor: '#dcfce7',
    icon: '📈',
  },
  {
    name: 'Electronics',
    sales: '29,553',
    gross: '16% Gross',
    change: '0.27%',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    icon: '📉',
  },
  {
    name: 'Grocery',
    sales: '24,577',
    gross: '22% Gross',
    change: '0.63%',
    color: '#8b5cf6',
    bgColor: '#ede9fe',
    icon: '📈',
  },
  {
    name: 'Automobiles',
    sales: '19,278',
    gross: '18% Gross',
    change: '1.14%',
    color: '#ec4899',
    bgColor: '#fce7f3',
    icon: '📉',
  },
  {
    name: 'others',
    sales: '15,934',
    gross: '15% Gross',
    change: '3.87%',
    color: '#f97316',
    bgColor: '#ffedd5',
    icon: '📉',
  },
];

const TopSellingCategories = () => {
  return (
    <div className="top-categories-card">
      <div className="top-header">
        <h4>Top Selling Categories</h4>
        <button className="sort-btn">Sort By ▼</button>
      </div>

      <div className="overall-sales-row">
        <div className="bars">
          <span className="bar bar1"></span>
          <span className="bar bar2"></span>
          <span className="bar bar3"></span>
          <span className="bar bar4"></span>
          <span className="bar bar5"></span>
          <span className="bar bar6"></span>
        </div>
        <div className="summary">
          <span className="growth">2.74% ↑</span>
          <span className="total">1,25,875</span>
        </div>
      </div>

      <div className="category-list">
        {categories.map((cat, idx) => (
          <div className="category-item" key={idx}>
            <span className="dot" style={{ backgroundColor: cat.color }}></span>
            <span className="name">{cat.name}</span>
            <span className="sales">{cat.sales}</span>
            <span className="gross">{cat.gross}</span>
            <span className="change" style={{ backgroundColor: cat.bgColor, color: cat.color }}>
              {cat.change} {cat.icon}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopSellingCategories;
