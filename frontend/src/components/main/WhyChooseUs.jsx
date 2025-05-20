import React from "react";
import "../../styles/main/WhyChooseUs.css";
import { FaGem, FaHandsHelping, FaRocket, FaClock } from "react-icons/fa";

const reasons = [
  {
    icon: <FaGem />,
    title: "Premium Quality",
    description: "Top-tier materials and finish for every product we deliver.",
  },
  {
    icon: <FaHandsHelping />,
    title: "Client-Centric",
    description: "Solutions tailored to your goals and audience.",
  },
  {
    icon: <FaRocket />,
    title: "Creative Gifting",
    description: "Unique, innovative ideas that stand out.",
  },
  {
    icon: <FaClock />,
    title: "Timely Delivery",
    description: "Strict adherence to deadlines, always.",
  },
];

const WhyChooseUs = () => {
  return (
    <section className="why-choose-section">
      <h2 className="why-choose-heading">Why Choose Us</h2>
      <p className="why-choose-subtext">Elevating your brand, one gift at a time.</p>

      <div className="reasons-container">
        {reasons.map((item, index) => (
          <div className="reason-card" key={index}>
            <div className="reason-icon">{item.icon}</div>
            <h3 className="reason-title">{item.title}</h3>
            <p className="reason-description">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default WhyChooseUs;
