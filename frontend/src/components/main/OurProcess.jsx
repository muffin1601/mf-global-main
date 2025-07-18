import React from "react";
import "../../styles/main/OurProcess.css";
import { FaPencilAlt, FaBoxes, FaShippingFast, FaPaintBrush } from "react-icons/fa";

const steps = [
  {
    icon: <FaPencilAlt />,
    title: "1. Share Your Requirement",
    desc: "Kickstart the conversation by telling us your occasion, quantity, budget, and branding preferences. No detail is too small.",
  },
  {
    icon: <FaPaintBrush />,
    title: "2. We Curate Tailored Options",
    desc: "Our gifting experts handpick premium, innovative, and brand-aligned options that wow your recipients and elevate your message.",
  },
  {
    icon: <FaBoxes />,
    title: "3. Personalize Gifts & Packaging",
    desc: "From engraving logos to custom sleeves and luxury boxing — we make sure your gifts reflect your brand story with every detail.",
  },
  {
    icon: <FaShippingFast />,
    title: "4. Packed & Delivered Nationwide",
    desc: "We securely pack and ship gifts to one location or to individual doorsteps, pan-India or global — on time, every time.",
  },
];

const OurProcess = () => (
  <section className="process-section">
    <div className="process-container">
      <h2 className="process-title">How It Works</h2>
      <p className="process-subtitle">
        From idea to doorstep — our seamless 4-step gifting journey ensures your brand leaves a lasting impression.
      </p>
      <div className="process-steps">
        {steps.map((step, index) => (
          <div className="process-card" key={index}>
            <div className="process-icon">{step.icon}</div>
            <h3 className="process-step-title">{step.title}</h3>
            <p className="process-desc">{step.desc}</p>
          </div>
        ))}
      </div>
      {/* <button className="process-cta">Get Started</button> */}
    </div>
  </section>
);

export default OurProcess;
