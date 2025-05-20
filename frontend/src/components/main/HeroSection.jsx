import React from 'react';
import '../../styles/main/HeroSection.css';

const HeroSection = () => {
  return (
    <section className="hero">
        <div className="hero-overlay"></div>
        <div className="hero-text">
          <h1>Premium Corporate Gifts for Every Occasion!</h1>
          <p>Customized, high-quality promotional items tailored for your brand needs.</p>
          <button className="hero-cta">Get Started</button>
        </div>
    </section>
  );
};

export default HeroSection;
