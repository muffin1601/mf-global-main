import React from "react";
import "../../styles/main/RaiseTheBar.css";

const RaiseTheBar = () => {
  return (
    <section className="raise-container">
      <div className="raise-content">
        <h5 className="raise-subtitle">BRAND EXCELLENCE</h5>
        <h2 className="raise-title">
          Raise the bar with <span>exceptional corporate gifting</span>
        </h2>
        <p className="raise-description">
          At <strong>MF Global Services</strong>, we don’t just deliver gifts—we create experiences. Every gift is thoughtfully curated to reflect your brand’s identity, values, and care for the recipient.
        </p>
        <p className="raise-description">
          Whether you're welcoming new employees, delighting clients, or celebrating milestones, our custom gifting solutions ensure your brand stands out with elegance and intention. From sustainable packaging to high-end branding, every detail is handled with precision and passion.
        </p>
        <p className="raise-description">
          Join the companies that trust us to make lasting impressions—<strong>through creativity, quality, and impact</strong>.
        </p>
      </div>
      <div className="raise-image-wrapper">
        <div className="raise-image-mask">
          <img
            src="https://images.pexels.com/photos/6400307/pexels-photo-6400307.jpeg"
            alt="Raise the bar visual"
          />
        </div>
      </div>
    </section>
  );
};

export default RaiseTheBar;
