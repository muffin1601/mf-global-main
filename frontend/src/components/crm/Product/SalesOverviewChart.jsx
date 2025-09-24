import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,      // ✅ ADD THIS
  LineController,     // ✅ ADD THIS
  Legend,
  Tooltip
} from 'chart.js';

import { Chart } from 'react-chartjs-2';
import './styles/SalesOverviewChart.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,     // ✅ REQUIRED
  LineController,    // ✅ REQUIRED
  Legend,
  Tooltip
);


const SalesOverviewChart = () => {
  const data = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        type: 'bar',
        label: 'Growth',
        data: [130, 110, 150, 360, 140, 210, 160, 340, 260, 270, 120, 300],
        backgroundColor: '#f7921e',
        borderRadius: 4,
      },
      {
        type: 'line',
        label: 'Profit',
        data: [200, 150, 300, 100, 350, 400, 500, 330, 420, 370, 300, 460],
        borderColor: '#e2e8f0',
        backgroundColor: '#e2e8f0',
        tension: 0.4,
        pointRadius: 0,
        fill: true,
      },
      {
        type: 'line',
        label: 'Sales',
        data: [250, 310, 120, 180, 360, 420, 580, 340, 390, 510, 430, 460],
        borderColor: '#d63384',
        backgroundColor: '#d63384',
        tension: 0.4,
        pointRadius: 0,
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 10,
          padding: 20,
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 100
        },
        grid: {
          color: '#f1f5f9'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    },
  };

  return (
    <div className="sales-overview-card">
      <div className="sales-overview-header">
        <h4>Sales Overview</h4>
        <button className="sort-btn">Sort By ▼</button>
      </div>
      <div className="sales-chart-wrapper">
        <Chart type='bar' data={data} options={options} />
      </div>
    </div>
  );
};

export default SalesOverviewChart;
