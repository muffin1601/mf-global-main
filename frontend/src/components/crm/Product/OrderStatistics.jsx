import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import './styles/OrderStatistics.css';
import { Chart, ArcElement, Tooltip } from 'chart.js';

Chart.register(ArcElement, Tooltip);

const OrderStatistics = () => {
  const data = {
    labels: ['Delivered', 'Cancelled', 'Pending', 'Returned'],
    datasets: [
      {
        data: [40, 20, 25, 15],
        backgroundColor: ['#f7921e', '#e54f6d', '#f37fc1', '#fc897c'],
        borderWidth: 0,
        cutout: '70%',
        rotation: -90,
        circumference: 180,
      },
    ],
  };

  return (
    <div className="order-stats-card">
      <div className="order-stats-header">
        <h4>Order Statistics</h4>
        <button className="dots-btn">⋮</button>
      </div>
      <div className="order-total">
        <div className="total-info">
          {/* <div className="icon-box">
            {/* <i className="icon">📈</i> 
          </div> */}
          <div>
            <p className="label">TOTAL ORDERS</p>
            <h2>3,736 <span className="percent">↑ 0.57%</span></h2>
          </div>
          <a href="#" className="earnings-link">Earnings ?</a>
        </div>

        <div className="chart-container">
          <Doughnut data={data} />
          <div className="chart-center-text">
            <div>Total</div>
            <strong>3736</strong>
          </div>
        </div>

        <div className="legend">
          <div><span className="dot dot-orange"></span> Delivered</div>
          <div><span className="dot dot-pink"></span> Pending</div>
          <div><span className="dot dot-magenta"></span> Cancelled</div>
          <div><span className="dot dot-red"></span> Returned</div>
        </div>

        <button className="stats-button">Complete Statistics →</button>
      </div>
    </div>
  );
};

export default OrderStatistics;
