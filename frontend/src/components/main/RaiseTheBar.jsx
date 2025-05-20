import React from "react";
import "../../styles/main/RaiseTheBar.css";
import raiseImage from "/assets/main/raise-bar.jpg"; // Update with your actual image path

const RaiseTheBar = () => {
  return (
    <section className="raise-container">
      <div className="raise-content">
        <h5 className="raise-subtitle">BRAND EXCELLENCE</h5>
        <h2 className="raise-title">
          Raise the bar with <span>exceptional corporate gifting</span>
        </h2>
        <p className="raise-description">
          At MF Global Services, we believe that gifts are more than just objects—they are statements of value,
          gratitude, and brand strength. Our tailored gifting solutions help you make a lasting impact.
        </p>
      </div>
      <div className="raise-image-wrapper">
        <div className="raise-image-mask">
          <img src={raiseImage} alt="Raise the bar visual" />
        </div>
      </div>
    </section>
  );
};

export default RaiseTheBar;
