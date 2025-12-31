import React from "react";
import "../../styles/main/RaiseTheBar.css";

const RaiseTheBar = () => {
  return (
    <section className="raise-container">
      <div className="raise-content">
        <h5 className="raise-subtitle">ABOUT MF GLOBAL SERVICES</h5>

        <h2 className="raise-title">
          Building brands through <span>gifting, digital marketing & technology</span>
        </h2>

        <p className="raise-description">
          <strong>MF Global Services</strong> is a multi-service company specializing
          in corporate gifting, digital marketing, and website development. Since
          2018, we have been helping businesses strengthen their brand identity
          through high-quality customized products and result-driven digital
          solutions.
        </p>

        <p className="raise-description">
          We offer end-to-end corporate gifting solutions with a wide range of
          products including corporate diaries, bags, apparel, drinkware,
          stationery, and customized merchandise. With our in-house manufacturing
          and printing facility, we maintain complete control over quality,
          branding accuracy, timelines, and cost efficiency.
        </p>

        <p className="raise-description">
          Backed by a deep understanding of the digital landscape, we design and
          execute customized digital marketing campaigns aligned with each
          client’s business goals. From brand awareness to lead generation and
          customer engagement, we ensure your brand stands out in a competitive
          online market.
        </p>

        <p className="raise-description">
          We believe digital marketing is not just about promotion—it’s about
          creating meaningful connections between brands and their customers.
        </p>
      </div>

      <div className="raise-image-wrapper">
        <div className="raise-image-mask">
          <img
            src="https://images.pexels.com/photos/6400307/pexels-photo-6400307.jpeg"
            alt="MF Global Services branding and corporate solutions"
          />
        </div>
      </div>
    </section>
  );
};

export default RaiseTheBar;
